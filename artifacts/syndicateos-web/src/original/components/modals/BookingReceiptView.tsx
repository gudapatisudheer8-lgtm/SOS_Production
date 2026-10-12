import { useState } from 'react';
import { Copy, Printer, Share2, AlertCircle, Check } from 'lucide-react';
import type { BookingPaymentReceipt } from '../../types';
import { formatINR } from '../../utils/formatters';
import { receiptAnnotation, receiptPrintHtml, receiptText, type ReceiptContext } from './bookingPayments';

interface Props {
  receipt: BookingPaymentReceipt;
  context: ReceiptContext;
  historical?: boolean;
}

export function BookingReceiptView({ receipt: r, context, historical }: Props) {
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const note = receiptAnnotation(r);
  const text = receiptText(r, context);

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setFeedback({ kind: 'ok', text: 'Receipt text copied.' });
    } catch {
      setFeedback({ kind: 'error', text: 'Could not copy. Clipboard access is blocked in this browser; select and copy the receipt manually.' });
    }
  };

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Receipt ${r.receiptNumber}`, text });
        setFeedback({ kind: 'ok', text: 'Receipt shared.' });
        return;
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
      }
    }
    await copy();
  };

  const print = () => {
    try {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
      document.body.appendChild(frame);
      const doc = frame.contentWindow?.document;
      if (!doc || !frame.contentWindow) throw new Error('No print frame');
      doc.open();
      doc.write(receiptPrintHtml(r, context));
      doc.close();
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1000);
      setFeedback(null);
    } catch {
      setFeedback({ kind: 'error', text: 'Printing failed. Use Copy and paste the receipt into a document instead.' });
    }
  };

  const reversed = r.state === 'reversed' || r.state === 'replaced';

  return (
    <div className="space-y-3" data-testid={`receipt-${r.requestId}`}>
      <div className={`bg-white p-5 rounded-2xl border-2 border-dashed ${reversed ? 'border-rose-300' : 'border-amber-300'} space-y-3 text-xs`}>
        <div className="flex justify-between items-start border-b border-gray-200 pb-3 gap-3">
          <div>
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-700 block">
              {historical ? 'Historical payment receipt (read-only)' : 'Plot payment receipt'}
            </span>
            <h4 className="text-base font-black text-gray-950">{context.firmName}</h4>
            <p className="text-[11px] text-gray-500">
              {context.projectName || 'Plotted layout'}{context.lpOrReraNumber ? ` | LP / RERA: ${context.lpOrReraNumber}` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-sm font-black text-slate-900 bg-amber-100 px-3 py-1 rounded-lg border border-amber-300 font-mono" data-testid="text-receipt-number">
              {r.receiptNumber}
            </span>
            <span className="block text-[10px] text-gray-500 mt-1">Date: {r.date}</span>
          </div>
        </div>
        {note && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-900" data-testid="text-receipt-annotation">{note}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-500 block uppercase font-bold">Customer</span>
            <strong className="text-sm text-gray-900 block">{r.buyerName}</strong>
            <span className="text-gray-600 font-mono text-[11px] block">{r.buyerPhone || 'Phone not provided'}</span>
          </div>
          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-800 block uppercase font-bold">This payment</span>
            <strong className={`text-base font-black font-mono block ${reversed ? 'text-gray-500 line-through' : 'text-emerald-950'}`}>{formatINR(r.amount)}</strong>
            <span className="text-[11px] text-emerald-700 font-semibold block">{r.paymentMode}{r.paymentRefNumber ? ` (${r.paymentRefNumber})` : ''}</span>
          </div>
        </div>
        <table className="w-full text-left border border-gray-200 rounded-xl overflow-hidden">
          <tbody>
            {[
              ['Plot & extent', `${context.plotNumber} - ${r.areaSqYards} Sq. Yards`],
              ['Agreed rate per Sq. Yard', formatINR(r.ratePerSqYard)],
              ['Total consideration', formatINR(r.totalValue)],
              ['Paid before this receipt', formatINR(r.previousCollected)],
              ['This payment', formatINR(r.amount)],
              ['Total paid to date', formatINR(r.totalCollected)],
              ['Balance remaining after this payment', formatINR(r.balanceAfter)],
            ].map(([k, v], i) => (
              <tr key={k} className={`border-b border-gray-100 ${i === 6 ? 'bg-gray-50 font-bold' : ''}`}>
                <td className="p-2 text-gray-600">{k}</td>
                <td className="p-2 text-right font-mono font-bold text-gray-900">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" data-testid="button-copy-receipt" onClick={copy} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold rounded-xl text-xs">
          <Copy className="w-3.5 h-3.5" /> Copy
        </button>
        <button type="button" data-testid="button-share-receipt" onClick={share} className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs">
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
        <button type="button" data-testid="button-print-receipt" onClick={print} className="flex items-center gap-1.5 px-3 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-xl text-xs border border-amber-600/30">
          <Printer className="w-3.5 h-3.5" /> Print / Save PDF
        </button>
      </div>
      {feedback && (
        <p role="status" className={`flex items-center gap-1.5 text-[11px] font-bold ${feedback.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {feedback.kind === 'ok' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {feedback.text}
        </p>
      )}
    </div>
  );
}
