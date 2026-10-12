import type { BookingPaymentReceipt, BookingPaymentSummary } from '../../types';

/** Parse a user-entered rupee string into integer paise. Returns null when not a positive 2-decimal amount. */
export function parseAmountToPaise(input: string): number | null {
  const s = String(input ?? '').trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const paise = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(paise) || paise <= 0) return null;
  return paise;
}

export const toPaise = (rupees: number) => Math.round((Number(rupees) || 0) * 100);
export const fromPaise = (paise: number) => paise / 100;

export interface PaymentPosition {
  totalValue: number;
  collected: number;
  balance: number;
  locked: boolean;
}

export function paymentPosition(
  summary: BookingPaymentSummary | undefined,
  areaSqYards: number,
  ratePerSqYard: number,
  legacyCollected: number,
): PaymentPosition {
  if (summary) {
    const totalP = toPaise(summary.totalValue);
    const collP = toPaise(summary.collected);
    return { totalValue: fromPaise(totalP), collected: fromPaise(collP), balance: fromPaise(Math.max(0, totalP - collP)), locked: !!summary.locked };
  }
  const totalP = toPaise(areaSqYards * ratePerSqYard);
  const collP = toPaise(legacyCollected);
  return { totalValue: fromPaise(totalP), collected: fromPaise(collP), balance: fromPaise(Math.max(0, totalP - collP)), locked: false };
}

export function validatePayment(input: string, balance: number): { ok: true; amount: number } | { ok: false; error: string } {
  const balP = toPaise(balance);
  if (balP <= 0) return { ok: false, error: 'No outstanding balance. Nothing further can be collected on this plot.' };
  if (String(input ?? '').trim() === '') return { ok: false, error: 'Enter the amount received in THIS payment.' };
  const p = parseAmountToPaise(input);
  if (p === null) return { ok: false, error: 'Enter a positive amount in rupees with at most 2 decimals.' };
  if (p > balP) return { ok: false, error: `Amount exceeds the maximum payable of Rs. ${fromPaise(balP).toLocaleString('en-IN', { minimumFractionDigits: 2 })}.` };
  return { ok: true, amount: fromPaise(p) };
}

export function newRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function bookingBusinessDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((p) => p.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Keeps the same request id while the submitted payload is identical, so retries are idempotent. */
export function createRequestIdKeeper(gen: () => string = newRequestId) {
  let last: { fingerprint: string; id: string } | null = null;
  return {
    idFor(fingerprint: string) {
      if (!last || last.fingerprint !== fingerprint) last = { fingerprint, id: gen() };
      return last.id;
    },
    reset() { last = null; },
  };
}

export function findCommittedReceipt(summary: BookingPaymentSummary | undefined, requestId: string | null) {
  if (!summary || !requestId) return undefined;
  return summary.receipts.find((r) => r.requestId === requestId);
}

export function receiptAnnotation(r: BookingPaymentReceipt): string | null {
  switch (r.state) {
    case 'reversed': return 'REVERSED - this receipt was reversed and no longer counts toward the amount collected.';
    case 'replaced': return 'REPLACED - this receipt was superseded by a corrected receipt.';
    case 'unposted': return 'UNPOSTED - recorded but not yet posted to the books.';
    default: return r.posted ? null : 'Not yet posted to the books.';
  }
}

const inr = (n: number) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface ReceiptContext { firmName: string; projectName?: string; lpOrReraNumber?: string; plotNumber: string; facing?: string }

function requireIssuedReceipt(r: BookingPaymentReceipt) {
  if (!r.posted || r.state === 'unposted')
    throw new Error('This entry has no posted customer payment. It cannot be shared as a payment receipt.');
  if (!(r.totalValue > 0 && r.areaSqYards > 0 && r.ratePerSqYard > 0))
    throw new Error('The original agreed pricing must be reconciled before sharing this receipt.');
}

export function receiptText(r: BookingPaymentReceipt, ctx: ReceiptContext): string {
  requireIssuedReceipt(r);
  const note = receiptAnnotation(r);
  return [
    ctx.firmName,
    `${ctx.projectName || 'Plotted layout'} - Plot Payment Receipt`,
    '--------------------------------------------------',
    `Receipt No.        : ${r.receiptNumber}`,
    `Payment Date       : ${r.date}`,
    `Plot               : ${ctx.plotNumber}${ctx.facing ? ` (${ctx.facing})` : ''}`,
    `Extent             : ${r.areaSqYards} Sq. Yards`,
    `Agreed Rate/Sq.Yd  : ${inr(r.ratePerSqYard)}`,
    `Total Consideration: ${inr(r.totalValue)}`,
    '--------------------------------------------------',
    `Customer           : ${r.buyerName}`,
    `Phone              : ${r.buyerPhone || 'N/A'}`,
    `Paid Before        : ${inr(r.previousCollected)}`,
    `This Payment       : ${inr(r.amount)} (${r.paymentMode}${r.paymentRefNumber ? `, Ref ${r.paymentRefNumber}` : ''})`,
    `Total Paid to Date : ${inr(r.totalCollected)}`,
    `Balance Remaining  : ${inr(r.balanceAfter)}`,
    ...(ctx.lpOrReraNumber ? [`LP / RERA No.      : ${ctx.lpOrReraNumber}`] : []),
    ...(note ? ['--------------------------------------------------', note] : []),
    '--------------------------------------------------',
    `Thank you. ${ctx.firmName}`,
  ].join('\n');
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Standalone customer-safe HTML document (no dashboard chrome, no bank balances). */
export function receiptPrintHtml(r: BookingPaymentReceipt, ctx: ReceiptContext): string {
  requireIssuedReceipt(r);
  const note = receiptAnnotation(r);
  const row = (k: string, v: string, strong = false) => `<tr><td>${esc(k)}</td><td class="v${strong ? ' s' : ''}">${esc(v)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(r.receiptNumber)}</title>
<style>body{font-family:Georgia,serif;color:#1c1917;margin:32px;max-width:640px}h1{font-size:20px;margin:0}small{color:#57534e}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}td{padding:6px 4px;border-bottom:1px solid #e7e5e4}.v{text-align:right;font-family:monospace}.s{font-weight:bold}
.note{margin-top:16px;padding:8px;border:1px solid #b45309;color:#7c2d12;font-size:12px}.sig{display:flex;justify-content:space-between;margin-top:48px;font-size:12px}</style></head><body>
<h1>${esc(ctx.firmName)}</h1><small>${esc(ctx.projectName || 'Plotted layout')}${ctx.lpOrReraNumber ? ` | LP / RERA: ${esc(ctx.lpOrReraNumber)}` : ''}</small>
<h2 style="font-size:15px;margin-top:20px">Plot Payment Receipt No. ${esc(r.receiptNumber)}</h2>
<table>${row('Payment date', r.date)}${row('Plot', `${ctx.plotNumber}${ctx.facing ? ` (${ctx.facing})` : ''}`)}${row('Customer', r.buyerName)}${row('Phone', r.buyerPhone || 'N/A')}
${row('Extent', `${r.areaSqYards} Sq. Yards`)}${row('Agreed rate per Sq. Yard', inr(r.ratePerSqYard))}${row('Total consideration', inr(r.totalValue), true)}
${row('Paid before this receipt', inr(r.previousCollected))}${row(`This payment (${r.paymentMode}${r.paymentRefNumber ? `, Ref ${r.paymentRefNumber}` : ''})`, inr(r.amount), true)}
${row('Total paid to date', inr(r.totalCollected))}${row('Balance remaining', inr(r.balanceAfter), true)}</table>
${note ? `<div class="note">${esc(note)}</div>` : ''}
<div class="sig"><div>For ${esc(ctx.firmName)}<br><br>Authorised signature</div><div>${esc(r.buyerName)}<br><br>Customer</div></div></body></html>`;
}
