import { api, ApiError, newRequestId } from './api';
import { command } from './erp';
import type { PlanUploadDocument } from '../original/types';

type Progress = {
  id?: string;
  revision?: number;
  firstSave?: any;
  finalize?: any;
  uploads: Map<string, { dataUrl: string; attachmentId: string }>;
};

/** In-session recovery: an upload retry reuses the draft, never recreates a live project. */
export class ProjectPlanSaver {
  private drafts = new Map<string, Progress>();
  clear() { this.drafts.clear(); }

  async create(localId: string, sectorId: string, setup: any, plans: PlanUploadDocument[]) {
    if (!plans.length && !this.drafts.has(localId)) {
      return command('project.setup-create', { requestId: newRequestId(), sectorId, setup });
    }
    // Decode before saving a draft. File bytes are uploaded privately, not stored
    // in project configuration or sent to the JSON command API.
    const files = plans.map((plan) => {
      const match = plan.dataUrl?.match(/^data:([^;,]+);base64,([\s\S]+)$/);
      if (!match) throw new Error(`Select the file again for "${plan.title}".`);
      const bytes = Uint8Array.from(atob(match[2]), (value) => value.charCodeAt(0));
      return new File([bytes], plan.fileName, { type: match[1] });
    });
    const progress: Progress = this.drafts.get(localId) || { uploads: new Map() };
    this.drafts.set(localId, progress);
    if (progress.finalize) {
      const result = await command('project.setup-finalize', progress.finalize);
      this.drafts.delete(localId);
      return result;
    }
    if (!progress.id) {
      progress.firstSave ||= { requestId: newRequestId(), sectorId, setup: { ...setup, documents: [] } };
      try {
        const draft: any = await command('project.setup-save', progress.firstSave);
        progress.id = draft.entity.id;
        progress.revision = draft.entity.revision;
        progress.firstSave = undefined;
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) progress.firstSave = undefined;
        throw error;
      }
    }
    const documents = [];
    for (const [index, plan] of plans.entries()) {
      let uploaded = progress.uploads.get(plan.id);
      if (!uploaded || uploaded.dataUrl !== plan.dataUrl) {
        const body = new FormData();
        body.append('file', files[index]);
        const result = await api(`/erp/${progress.id}/attachments`, { body });
        uploaded = { dataUrl: plan.dataUrl!, attachmentId: result.id };
        progress.uploads.set(plan.id, uploaded);
      }
      documents.push({ title: plan.title, category: plan.category, attachmentId: uploaded.attachmentId });
    }
    const saved: any = await command('project.setup-save', {
      requestId: newRequestId(), sectorId, projectId: progress.id, revision: progress.revision,
      setup: { ...setup, documents },
    });
    progress.revision = saved.entity.revision;
    progress.finalize = { requestId: newRequestId(), projectId: progress.id, revision: progress.revision };
    try {
      const result = await command('project.setup-finalize', progress.finalize);
      this.drafts.delete(localId);
      return result;
    } catch (error) {
      // Known validation failures allow corrections. An ambiguous network failure
      // retains the same finalization request for an idempotent retry.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) progress.finalize = undefined;
      throw error;
    }
  }
}
