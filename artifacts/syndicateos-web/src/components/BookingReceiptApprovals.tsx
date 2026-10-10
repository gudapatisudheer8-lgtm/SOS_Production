import { useState } from 'react';
import { formatINR } from '../original/utils/formatters';

/** The same project receipt queue is shown to accountants and partners.
 * Balances remain server-owned: approval, never rendering this queue, posts money.
 */
export function BookingReceiptApprovals({ snapshot, onReview }: {
  snapshot: any;
  onReview: (id: string, decision: 'approved' | 'rejected') => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const receipts = (snapshot?.records || []).filter((r: any) => r.kind === 'bookings' && r.status === 'pending');
  if (!receipts.length) return null;
  const review = async (id: string, decision: 'approved' | 'rejected') => {
    setBusy(id);
    try { await onReview(id, decision); } finally { setBusy(null); }
  };
  return (
    <section className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4" aria-label="Booking receipts awaiting approval">
      <h2 className="font-bold text-gray-950">Booking receipts awaiting approval ({receipts.length})</h2>
      <p className="mt-1 text-sm text-gray-700">These receipts are saved, but not yet included in Cash or bank balances. Approval credits the selected project account and updates the project statement.</p>
      <div className="mt-3 space-y-3">
        {receipts.map((receipt: any) => {
          const d = receipt.data;
          const inventory = snapshot.records.find((r: any) => r.id === d.inventoryId);
          const account = snapshot.records.find((r: any) => r.id === d.accountId);
          const eligible = snapshot.reviewableRecordIds?.includes(receipt.id);
          return (
            <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-3 text-sm">
              <div>
                <div className="font-bold">Plot {inventory?.data?.plotNumber || '—'} · {formatINR(Number(d.advanceReceived))}</div>
                <div className="text-gray-600">{d.buyerName} · {d.paymentMode} · {account?.data?.accountName || 'Project account'}</div>
                <div className="text-xs text-gray-500">Submitted by {receipt.createdByName} · Pending approval</div>
              </div>
              {eligible ? (
                <div className="flex gap-2">
                  <button disabled={busy !== null} onClick={() => void review(receipt.id, 'approved')} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">{busy === receipt.id ? 'Saving…' : 'Approve receipt'}</button>
                  <button disabled={busy !== null} onClick={() => void review(receipt.id, 'rejected')} className="rounded-lg border border-rose-200 px-3 py-2 text-rose-700 disabled:opacity-50">Reject</button>
                </div>
              ) : <span className="text-xs text-amber-800">Awaiting an eligible reviewer</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
