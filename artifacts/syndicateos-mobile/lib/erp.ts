import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { executeCommand, getGetProjectErpQueryKey, getGetWorkspaceQueryKey, useGetProjectErp, type CommandResult } from '@workspace/api-client-react';
import { reportError } from '@/lib/session';

export function newRequestId(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 3) | 8).toString(16);
  });
}

export function useErp(projectId: string | null | undefined) {
  const id = projectId ?? '';
  return useGetProjectErp(id, { query: { queryKey: getGetProjectErpQueryKey(id), enabled: !!projectId, refetchInterval: 20000, refetchOnWindowFocus: true } });
}

export function useErpCommands(projectId: string) {
  const qc = useQueryClient();
  const run = useCallback(
    async (action: string, data: Record<string, unknown>): Promise<CommandResult> => {
      try {
        const res = await executeCommand(action, { data: { projectId, ...data } });
        await Promise.all([
          qc.invalidateQueries({ queryKey: getGetProjectErpQueryKey(projectId) }),
          qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() }),
        ]);
        return res;
      } catch (e) {
        reportError(e);
        throw e;
      }
    },
    [qc, projectId],
  );
  return {
    save: (kind: string, data: Record<string, unknown>, ex?: { recordId?: string; revision?: number; requestId?: string }) =>
      run('erp.save', { kind, data, requestId: ex?.requestId ?? newRequestId(), ...(ex?.recordId ? { recordId: ex.recordId, revision: ex.revision } : {}) }),
    review: (recordId: string, revision: number, decision: 'approved' | 'rejected', reason?: string) =>
      run('erp.review', { recordId, revision, decision, ...(reason ? { reason } : {}) }),
    remove: (recordId: string, revision: number) => run('erp.delete', { recordId, revision }),
    bulkSave: (kind: string, records: Record<string, unknown>[], requestId?: string) => run('erp.bulk-save', { kind, records, requestId: requestId ?? newRequestId() }),
    inventoryStage: (recordId: string, revision: number, p: { status: string; paymentMilestone?: string; currentMilestone?: string; officialDocValue?: number }) => run('erp.inventory-stage', { recordId, revision, ...p }),
    settings: (revision: number, settings: Record<string, unknown>) => run('erp.settings', { revision, settings }),
  };
}

export const BULK_MAX_ROWS = 2000;
export const BULK_MAX_BYTES = 2 * 1024 * 1024;
/** Splits rows into request chunks within the row and body limits. Never drops rows; a single oversized row is reported. */
export function planChunks(rows: Record<string, unknown>[]): { chunks: Record<string, unknown>[][]; error: string | null } {
  const chunks: Record<string, unknown>[][] = [];
  let cur: Record<string, unknown>[] = []; let size = 200;
  for (const r of rows) {
    const n = JSON.stringify(r).length + 1;
    if (n > BULK_MAX_BYTES - 1000) return { chunks: [], error: 'A single row exceeds the 2 MB request limit.' };
    if (cur.length >= BULK_MAX_ROWS || size + n > BULK_MAX_BYTES - 4096) { chunks.push(cur); cur = []; size = 200; }
    cur.push(r); size += n;
  }
  if (cur.length) chunks.push(cur);
  return { chunks, error: null };
}
