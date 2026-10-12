import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../adapter/api';

interface ProposalRow {
  id: string; status: string; agentName: string; mobile: string; plotNumber: string;
  data: {
    buyerName?: string; buyerPhone?: string; proposedRatePerSqYard?: number;
    proposedAdvanceAmount?: number; tokenDeadlineHours?: number; notes?: string; submittedAt?: string;
  };
}

const inr = (n?: number) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);

export function MarketingRequestsPanel({ projectId }: { projectId?: string; onMarketingChanged?: () => void }) {
  const [rows, setRows] = useState<ProposalRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const current = useRef(projectId);
  current.current = projectId;

  const load = useCallback(async () => {
    if (!projectId) { setRows(null); return; }
    try {
      const r = await api<ProposalRow[]>(`/marketing/projects/${encodeURIComponent(projectId)}/proposals`);
      if (current.current !== projectId) return;
      setRows(Array.isArray(r) ? r : []);
      setErr(null);
    } catch (e) {
      if (current.current !== projectId) return;
      setErr(e instanceof Error ? e.message : 'Could not load marketing requests.');
    }
  }, [projectId]);

  useEffect(() => { setRows(null); setErr(null); load(); }, [load]);

  if (!projectId) return null;
  const label = (st?: string) => {
    const v = (st || '').toLowerCase();
    if (v === 'accepted_blocked' || v === 'accepted' || v === 'blocked') return 'Hold placed';
    if (v === 'pending') return 'Request noted (no hold, not posted)';
    if (v === 'rejected' || v === 'declined') return 'No hold (below floor or invalid)';
    if (v === 'expired' || v === 'released') return 'Hold ended';
    return st || 'Recorded';
  };
  const list = rows || [];

  return (
    <section className="border-b border-amber-700/40 bg-slate-900 px-4 py-4 sm:px-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-black text-amber-400">Booking requests &amp; holds ({list.length})</h3>
        <button type="button" onClick={load} className="text-[11px] font-bold text-slate-300 underline">Refresh</button>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">Activity log only. A request at or above the floor rate places a plot hold automatically. Proposed tokens are promises, not cash; the accountant records money only when it is actually received.</p>
      {err && <p role="alert" className="mb-2 rounded-xl bg-rose-950 p-2 text-xs font-bold text-rose-200">{err} <button type="button" onClick={load} className="underline">Retry</button></p>}
      {!rows && !err && <div className="h-16 animate-pulse rounded-xl bg-slate-800" />}
      {rows && list.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-3 text-xs text-slate-400">No booking requests recorded for this project.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((r) => (
          <div key={r.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-3 text-xs text-slate-200">
            <div className="flex items-center justify-between">
              <strong className="font-mono text-sm text-white">Plot {r.plotNumber}</strong>
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-amber-200">{label(r.status)}</span>
            </div>
            <p className="mt-1">Agent: <strong>{r.agentName}</strong> · {r.mobile}</p>
            <p>Buyer: <strong>{r.data?.buyerName || '—'}</strong> · {r.data?.buyerPhone || '—'}</p>
            <p>Rate <strong className="font-mono text-amber-300">{inr(r.data?.proposedRatePerSqYard)}</strong>/Sq.Yd · Promised token {inr(r.data?.proposedAdvanceAmount)} · {r.data?.tokenDeadlineHours ?? '—'} h</p>
            {r.data?.notes && <p className="mt-1 italic text-slate-400">{r.data.notes}</p>}
            {r.data?.submittedAt && <p className="mt-1 text-[10px] text-slate-500">{r.data.submittedAt}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
