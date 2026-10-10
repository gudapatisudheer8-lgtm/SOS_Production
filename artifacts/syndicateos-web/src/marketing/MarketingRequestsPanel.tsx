import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../adapter/api';

interface ProposalRow {
  id: string; status: string; agentName: string; mobile: string; plotNumber: string;
  data: {
    buyerName?: string; buyerPhone?: string; proposedRatePerSqYard?: number;
    proposedAdvanceAmount?: number; tokenDeadlineHours?: number; notes?: string; submittedAt?: string;
  };
}

const inr = (n?: number) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);

export function MarketingRequestsPanel({ projectId, onMarketingChanged }: { projectId?: string; onMarketingChanged?: () => void }) {
  const [rows, setRows] = useState<ProposalRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const lock = useRef(false);
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

  useEffect(() => { setRows(null); setErr(null); setReviewErr(null); load(); }, [load]);

  const review = async (id: string, accept: boolean) => {
    if (lock.current) return;
    lock.current = true;
    setBusyId(id);
    setReviewErr(null);
    try {
      await api(`/marketing/proposals/${encodeURIComponent(id)}/review`, { method: 'POST', body: { accept } });
      await load();
      window.dispatchEvent(new Event('sos-marketing-changed'));
      onMarketingChanged?.();
    } catch (e) {
      setReviewErr(e instanceof Error ? e.message : 'Review failed.');
    } finally { lock.current = false; setBusyId(null); }
  };

  if (!projectId) return null;
  const pending = (rows || []).filter((r) => r.status?.toLowerCase() === 'pending');

  return (
    <section className="border-b border-amber-700/40 bg-slate-900 px-4 py-4 sm:px-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-black text-amber-400">Agent booking requests ({pending.length} pending)</h3>
        <button type="button" onClick={load} className="text-[11px] font-bold text-slate-300 underline">Refresh</button>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">Accepting only places a hold on the plot. No money or bank entries are posted.</p>
      {err && <p role="alert" className="mb-2 rounded-xl bg-rose-950 p-2 text-xs font-bold text-rose-200">{err} <button type="button" onClick={load} className="underline">Retry</button></p>}
      {reviewErr && <p role="alert" className="mb-2 rounded-xl bg-rose-950 p-2 text-xs font-bold text-rose-200">{reviewErr}</p>}
      {!rows && !err && <div className="h-16 animate-pulse rounded-xl bg-slate-800" />}
      {rows && pending.length === 0 && <p className="rounded-xl border border-dashed border-slate-700 p-3 text-xs text-slate-400">No pending requests for this project.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {pending.map((r) => (
          <div key={r.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-3 text-xs text-slate-200">
            <div className="flex items-center justify-between">
              <strong className="font-mono text-sm text-white">Plot {r.plotNumber}</strong>
              <span className="text-[10px] text-slate-400">{r.data?.submittedAt || ''}</span>
            </div>
            <p className="mt-1">Agent: <strong>{r.agentName}</strong> · {r.mobile}</p>
            <p>Buyer: <strong>{r.data?.buyerName || '—'}</strong> · {r.data?.buyerPhone || '—'}</p>
            <p>Rate <strong className="font-mono text-amber-300">{inr(r.data?.proposedRatePerSqYard)}</strong>/Sq.Yd · Token {inr(r.data?.proposedAdvanceAmount)} · {r.data?.tokenDeadlineHours ?? '—'} h</p>
            {r.data?.notes && <p className="mt-1 italic text-slate-400">{r.data.notes}</p>}
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busyId !== null} onClick={() => review(r.id, true)} className="rounded-xl bg-amber-500 px-3 py-1.5 font-black text-slate-950 disabled:opacity-50">
                {busyId === r.id ? 'Working…' : 'Accept rate & hold'}
              </button>
              <button type="button" disabled={busyId !== null} onClick={() => review(r.id, false)} className="rounded-xl border border-slate-500 px-3 py-1.5 font-bold text-slate-200 disabled:opacity-50">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
