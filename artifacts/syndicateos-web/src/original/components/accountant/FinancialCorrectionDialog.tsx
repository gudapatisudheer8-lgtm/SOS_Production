import React, { useState } from 'react';
import { RotateCcw, PencilLine, X, AlertTriangle } from 'lucide-react';
import type { FirmAccount, Plot, Project, SyndicatePartner } from '../../types';
import { newRequestId } from '../../../adapter/api';
import { formatINR } from '../../utils/formatters';
import {
  type CorrectionField, correctionErrors, correctionPayload, fieldKind, isFieldVisible,
} from '../../../adapter/financialCorrections';
import type { UnifiedProjectTransaction } from './ProjectStatementModule';

export type FinancialDialogMode = 'refer-back' | 'resubmit';

interface Props {
  mode: FinancialDialogMode;
  entry: UnifiedProjectTransaction;
  project?: Project | null;
  accounts: FirmAccount[];
  partners: SyndicatePartner[];
  plots: Plot[];
  onClose: () => void;
  onReferBack?: (entry: UnifiedProjectTransaction, reason: string, requestId: string) => Promise<boolean>;
  onResubmit?: (entry: UnifiedProjectTransaction, data: Record<string, any>, requestId: string) => Promise<boolean>;
}

const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-2xl text-xs font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none';

export function liveOptions(f: CorrectionField, project: Project | null | undefined, accounts: FirmAccount[], partners: SyndicatePartner[], plots: Plot[]): Array<{ value: string; label: string }> | null {
  const kind = fieldKind(f);
  const pid = project?.id;
  if (f.key === 'accountId' || kind === 'account') {
    return accounts.filter((a) => !pid || !a.linkedProjectId || a.linkedProjectId === 'all' || a.linkedProjectId === pid)
      .map((a) => ({ value: String(a.id), label: `${a.accountName || a.bankName}${a.accountNumber ? ` (${String(a.accountNumber).slice(-4)})` : ''}` }));
  }
  if (f.key === 'partnerId' || kind === 'partner') {
    const fromProject = (project?.partners || []).map((p) => ({ value: String(p.partnerId), label: p.name }));
    if (fromProject.length) return fromProject;
    return partners.filter((p: any) => !pid || !p.__projectId || p.__projectId === pid).map((p) => ({ value: String(p.id), label: p.name }));
  }
  if (f.key === 'inventoryId' || kind === 'inventory') {
    return plots.filter((p) => !pid || p.projectId === pid).map((p: any) => ({
      value: String(p.__recordId ?? p.recordId ?? p.id), label: `Plot ${p.plotNumber}${p.status ? ` · ${p.status}` : ''}`,
    }));
  }
  return null;
}

export const FinancialCorrectionDialog: React.FC<Props> = ({ mode, entry, project, accounts, partners, plots, onClose, onReferBack, onResubmit }) => {
  // One request id per opened dialog: retries after a failure reuse it so the server can deduplicate.
  const [requestId] = useState(() => newRequestId());
  const [reason, setReason] = useState('');
  const [row, setRow] = useState<Record<string, any>>(() => ({ ...(entry.correctionData || {}) }));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fields: CorrectionField[] = Array.isArray(entry.correctionFields) ? entry.correctionFields : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mode === 'refer-back') {
      if (!reason.trim()) { setErrors(['Enter the reason for referring this entry back.']); return; }
      if (!onReferBack) return;
      setBusy(true); setErrors([]);
      const ok = await onReferBack(entry, reason, requestId).catch(() => false);
      setBusy(false);
      if (ok) onClose(); else setErrors(['Refer back was not recorded. Your reason is kept; review the message and try again.']);
      return;
    }
    const errs = correctionErrors(fields, row);
    if (errs.length) { setErrors(errs); return; }
    if (!onResubmit) return;
    setBusy(true); setErrors([]);
    const ok = await onResubmit(entry, correctionPayload(fields, row), requestId).catch(() => false);
    setBusy(false);
    if (ok) onClose(); else setErrors(['The correction was not recorded. Your edits are kept; review the message and try again.']);
  };

  const set = (k: string, v: any) => setRow((r) => ({ ...r, [k]: v }));
  const isRefer = mode === 'refer-back';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-950/50" role="dialog" aria-modal="true" aria-labelledby="fin-dialog-title" data-testid={`dialog-${mode}`}>
      <form onSubmit={submit} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-amber-200 flex flex-col max-h-[calc(100dvh-2rem)]">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 shrink-0">
          <div>
            <h3 id="fin-dialog-title" className="text-base font-black text-gray-950 flex items-center gap-2">
              {isRefer ? <RotateCcw className="w-4 h-4 text-rose-600" /> : <PencilLine className="w-4 h-4 text-amber-700" />}
              {isRefer ? 'Refer back this entry' : 'Correct & resubmit'}
            </h3>
            <p className="text-[11px] text-gray-500 mt-1 font-mono">{entry.referenceNo} · {entry.categoryLabel} · {entry.type === 'credit' ? '+' : '-'}{formatINR(entry.amount)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="text-gray-400 hover:text-gray-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          {isRefer ? (
            <>
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-[11px] text-rose-900 leading-relaxed flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{entry.affectsCash
                  ? 'This entry is already in the books. Referring it back records an equal and opposite reversal entry, so balances return to where they were. The original entry stays readable in history; nothing is deleted.'
                  : 'This entry does not affect cash, so no reversal amount is posted. It is marked as referred back and stays readable in history.'}
                  {' '}Bookings tied to sold or dependent inventory may be refused by the server.</span>
              </div>
              <label className="block text-xs font-bold text-gray-800">Reason (required)
                <textarea data-testid="input-referback-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} mt-1`} placeholder="What is wrong with this entry?" />
              </label>
            </>
          ) : (
            <>
              <p className="text-[11px] text-gray-600 leading-relaxed">A corrected replacement is recorded immediately. The current entry is kept in history as replaced{entry.affectsCash ? ' and its cash effect is reversed' : ''}, so totals are not counted twice.</p>
              {entry.correctionReason && <p className="text-[11px] rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">Referred back: {entry.correctionReason}</p>}
              {fields.length === 0 && <p className="text-xs text-rose-700 font-bold">This entry has no correctable fields configured.</p>}
              {fields.filter((f) => isFieldVisible(f, row)).map((f) => {
                const live = liveOptions(f, project, accounts, partners, plots);
                const kind = fieldKind(f);
                const v = row[f.key];
                const id = `corr-${f.key}`;
                return (
                  <label key={f.key} htmlFor={id} className="block text-xs font-bold text-gray-800">
                    {f.label}{f.required ? ' *' : ''}
                    {live || kind === 'select' ? (
                      <select id={id} data-testid={`input-correction-${f.key}`} disabled={f.readOnly} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} className={`${inputCls} mt-1`}>
                        <option value="">Select…</option>
                        {(live || (f.options || []).map((o) => ({ value: o, label: f.optionLabels?.[o] || o }))).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : kind === 'boolean' ? (
                      <input id={id} data-testid={`input-correction-${f.key}`} type="checkbox" disabled={f.readOnly} checked={!!v} onChange={(e) => set(f.key, e.target.checked)} className="ml-2" />
                    ) : kind === 'textarea' || kind === 'longtext' ? (
                      <textarea id={id} data-testid={`input-correction-${f.key}`} disabled={f.readOnly} value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} rows={2} className={`${inputCls} mt-1`} />
                    ) : (
                      <input id={id} data-testid={`input-correction-${f.key}`} disabled={f.readOnly}
                        type={kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'} step={kind === 'number' ? 'any' : undefined}
                        value={v ?? ''} onChange={(e) => set(f.key, e.target.value)} className={`${inputCls} mt-1`} />
                    )}
                  </label>
                );
              })}
            </>
          )}
          {errors.length > 0 && <ul role="alert" className="text-[11px] font-bold text-rose-700 space-y-0.5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
        <div className="p-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2.5 rounded-2xl bg-gray-100 text-gray-800 font-bold text-xs">Cancel</button>
          <button type="submit" data-testid={`button-confirm-${mode}`} disabled={busy || (!isRefer && fields.length === 0)}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs disabled:opacity-50 ${isRefer ? 'bg-rose-700 text-white' : 'bg-[#FFB800] text-gray-950'}`}>
            {busy ? 'Recording…' : isRefer ? 'Record refer back' : 'Record correction'}
          </button>
        </div>
      </form>
    </div>
  );
};
