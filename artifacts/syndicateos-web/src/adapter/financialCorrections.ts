// Pure helpers for the no-approval financial workflow: every save posts
// immediately; mistakes are fixed with Refer Back (reversal) or
// Correct & Resubmit (posted replacement). No approval state is shown.

export type PostingState = 'posted' | 'legacy_unposted' | 'referred_back' | 'superseded' | 'reversal';

export interface CorrectionField {
  key: string; label: string; kind?: string; type?: string; required?: boolean;
  options?: string[]; optionLabels?: Record<string, string>;
  visibleWhen?: { field: string; values: string[] }; readOnly?: boolean;
  min?: number; max?: number; maxLength?: number; integer?: boolean;
}

export interface StatementEntryLike {
  id: string; type: 'credit' | 'debit'; amount: number; date?: string;
  affectsCash?: boolean; postingState?: PostingState | string;
}

export const POSTING_LABELS: Record<string, string> = {
  posted: 'Recorded',
  legacy_unposted: 'Not posted (historical)',
  referred_back: 'Referred back',
  superseded: 'Replaced by correction',
  reversal: 'Reversal entry',
};
export const postingLabel = (s?: string) => POSTING_LABELS[s || ''] || 'Recorded';

/** Cash effect is decided by the server's affectsCash flag only, never by a status. */
export const countsForCash = (t: StatementEntryLike) => t.affectsCash === true;

export function statementTotals(list: StatementEntryLike[]) {
  let inflows = 0; let outflows = 0;
  for (const t of list) {
    if (!countsForCash(t)) continue;
    if (t.type === 'credit') inflows += Number(t.amount) || 0; else outflows += Number(t.amount) || 0;
  }
  return { inflows, outflows, net: inflows - outflows };
}

/** Running balance in chronological order; non-cash rows carry the prior balance. */
export function runningBalances(list: StatementEntryLike[]): Map<string, number> {
  const sorted = [...list].sort((a, b) => (new Date(a.date || 0).getTime() || 0) - (new Date(b.date || 0).getTime() || 0));
  const out = new Map<string, number>();
  let bal = 0;
  for (const t of sorted) {
    if (countsForCash(t)) bal += t.type === 'credit' ? Number(t.amount) || 0 : -(Number(t.amount) || 0);
    out.set(t.id, bal);
  }
  return out;
}

export const fieldKind = (f: CorrectionField) => String(f.kind || f.type || 'text');

export const isFieldVisible = (f: CorrectionField, row: Record<string, any>) => {
  if (!f.visibleWhen) return true;
  const v = row[f.visibleWhen.field];
  return (f.visibleWhen.values || []).includes(v === undefined || v === null ? '' : String(v));
};

export function correctionErrors(fields: CorrectionField[], row: Record<string, any>): string[] {
  const errs: string[] = [];
  for (const f of fields) {
    if (!isFieldVisible(f, row) || f.readOnly) continue;
    const v = row[f.key];
    const blank = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    const kind = fieldKind(f);
    if (blank) { if (f.required && kind !== 'boolean') errs.push(`${f.label} is required.`); continue; }
    if (kind === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n)) errs.push(`${f.label} must be a number.`);
      else if (f.min !== undefined && n < f.min) errs.push(`${f.label} must be at least ${f.min}.`);
      else if (f.max !== undefined && n > f.max) errs.push(`${f.label} must be at most ${f.max}.`);
    } else if (kind === 'select' && f.options?.length && !f.options.includes(String(v))) errs.push(`Choose a valid ${f.label}.`);
    else if (kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) errs.push(`${f.label} must be a valid date.`);
  }
  return errs;
}

/** Keep only configured, visible field keys; coerce numbers. Data contract unchanged. */
export function correctionPayload(fields: CorrectionField[], row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (!isFieldVisible(f, row)) continue;
    const v = row[f.key];
    if (v === undefined || v === null || v === '') continue;
    out[f.key] = fieldKind(f) === 'number' ? Number(v) : v;
  }
  return out;
}

export function referBackInput(projectId: string, recordId: string, revision: number, requestId: string, reason: string) {
  return { projectId, recordId, revision, requestId, reason: reason.trim() };
}
export function resubmitInput(projectId: string, recordId: string, revision: number, requestId: string, data: Record<string, any>) {
  return { projectId, recordId, revision, requestId, data };
}
