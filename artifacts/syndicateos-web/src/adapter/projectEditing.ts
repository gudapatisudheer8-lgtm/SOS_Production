import { api, newRequestId } from './api';
import { command, pickConfigured } from './erp';
import { validatePlanFile } from './planFile';
import type { PlanUploadDocument } from '../original/types';

/** Only setup-defined fields go back to the setup API, never ledger projections. */
export function setupFields(fields: any[] = [], values: Record<string, any> = {}) {
  return Object.fromEntries(fields.filter((field) => Object.prototype.hasOwnProperty.call(values, field.key))
    .map((field) => [field.key, values[field.key]]));
}

export function projectEditContext(workspace: any, erp: any, projectId: string) {
  const project = (workspace?.projects || []).find((row: any) => String(row.id) === projectId);
  const assignedInterface = (workspace?.interfaces || []).find((entry: any) =>
    String(entry.firmId) === String(project?.firmId) && String(entry.sectorId) === String(project?.sectorId) && entry.enabled
  );
  if (!project || !assignedInterface) return undefined;
  const definition = project.setupDefinition || assignedInterface.configuration?.projectSetup;
  if (!definition?.sections || (project.setupReleaseId && !project.setupDefinition)) return undefined;
  return {
    project, definition,
    values: setupFields(definition.sections.flatMap((section: any) => section.fields || []), {
      ...(project.setupData?.values || {}), ...(project.details || {}),
      name: project.name, location: project.location || '',
    }),
    settings: setupFields(definition.settingsFields, {
      ...(project.setupData?.settings || {}), ...(erp?.settings || {}),
    }),
  };
}

export function projectEditPayload(project: any, definition: any, values: Record<string, any>,
  settings: Record<string, any>, revision: number,
  plotEdits: Array<{ recordId: string; revision: number; data: Record<string, any> }> = []) {
  if (!Number.isInteger(revision) || revision < 1) throw new Error('Reload the project before editing its details.');
  if (project.setupState !== 'READY') throw new Error('Finish project setup before editing operational details.');
  const ids = new Set<string>();
  for (const edit of plotEdits) {
    if (!edit.recordId || ids.has(edit.recordId) || !Number.isInteger(edit.revision) || edit.revision < 1 ||
        !edit.data || edit.data.status !== 'available') throw new Error('Reload the saved plots before editing them.');
    ids.add(edit.recordId);
  }
  const previous = project.setupData || {};
  // READY setups cannot recreate their children. Keep the exact historical
  // arrays, including files uploaded at creation, rather than current balances.
  const setup = {
    values: setupFields(definition.sections.flatMap((section: any) => section.fields || []), values),
    settings: setupFields(definition.settingsFields, settings),
    groups: previous.groups || [], partners: previous.partners || [],
    accounts: previous.accounts || [], documents: previous.documents || [],
  };
  return { projectId: String(project.id), sectorId: String(project.sectorId),
    setupReleaseId: project.setupReleaseId || undefined, revision, setup, plotEdits };
}

/** Retain request IDs and uploaded files across ambiguous network retries. */
export class ProjectEditorSaver {
  private requests = new Map<string, string>();
  private uploads = new Map<string, { attachmentId?: string; requestId: string; saved: boolean }>();
  clear() { this.requests.clear(); this.uploads.clear(); }

  async save(payload: ReturnType<typeof projectEditPayload>) {
    const key = JSON.stringify(payload);
    const requestId = this.requests.get(key) || newRequestId();
    this.requests.set(key, requestId);
    return command('project.setup-save', { ...payload, requestId });
  }

  async uploadDocuments(projectId: string, erp: any, plans: PlanUploadDocument[]) {
    const resource = (erp?.resources || []).find((entry: any) => entry.kind === 'documents' && entry.canCreate);
    if (!resource) throw new Error('You do not have permission to add project documents.');
    // Validate the whole selection before uploading any file.
    const files = plans.map((plan) => {
      const match = plan.dataUrl?.match(/^data:([^;,]+);base64,([\s\S]+)$/);
      if (!match) throw new Error(`Select "${plan.fileName}" again before uploading.`);
      const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
      return new File([bytes], plan.fileName, { type: match[1] });
    });
    for (const file of files) await validatePlanFile(file);
    for (const [index, plan] of plans.entries()) {
      const key = `${projectId}:${plan.id}:${plan.dataUrl}`;
      const progress = this.uploads.get(key) || { requestId: newRequestId(), saved: false };
      this.uploads.set(key, progress);
      if (progress.saved) continue;
      if (!progress.attachmentId) {
        const body = new FormData();
        body.append('file', files[index]);
        const attachment = await api<any>(`/erp/${projectId}/attachments`, { body });
        progress.attachmentId = String(attachment.id);
      }
      const data = pickConfigured(resource.fields, {
        title: plan.title, category: plan.category, attachmentId: progress.attachmentId,
      }, 'Project document');
      await command('erp.save', { projectId, kind: 'documents', data, requestId: progress.requestId });
      progress.saved = true;
    }
  }
}
