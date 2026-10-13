import type { ProjectErp } from '@workspace/api-client-react';
import type { BookingPaymentReceipt, BookingPaymentSummary } from '../../syndicateos-web/src/original/types';

// The current web payment rules and receipt templates are platform-independent.
// Reuse them rather than maintaining a second financial implementation.
export {
  bookingBusinessDate, createRequestIdKeeper, validatePayment, paymentPosition,
  receiptText, receiptPrintHtml, receiptAnnotation,
} from '../../syndicateos-web/src/original/components/modals/bookingPayments';
export type { BookingPaymentReceipt, BookingPaymentSummary };

const numeric = ['amount', 'previousCollected', 'totalCollected', 'balanceAfter', 'ratePerSqYard', 'totalValue', 'areaSqYards'] as const;

/** PostgreSQL decimal values arrive as strings; preserve the authoritative summary. */
export function plotPaymentSummary(erp: ProjectErp, inventoryId: string): BookingPaymentSummary | undefined {
  const summaries = (erp as ProjectErp & { bookingPayments?: Record<string, BookingPaymentSummary> }).bookingPayments;
  const raw = summaries?.[inventoryId];
  if (!raw) return undefined;
  return {
    ...raw,
    ratePerSqYard: Number(raw.ratePerSqYard),
    areaSqYards: Number(raw.areaSqYards),
    totalValue: Number(raw.totalValue),
    collected: Number(raw.collected),
    balance: Number(raw.balance),
    receipts: (raw.receipts || []).map(item => {
      const receipt = { ...item };
      for (const key of numeric) receipt[key] = Number(item[key]);
      return receipt as BookingPaymentReceipt;
    }),
  };
}

export function receiptForRequest(erp: ProjectErp, inventoryId: string, requestId: string) {
  // A subsequently reversed entry still proves the request was committed. It
  // must never be silently retried as a new payment.
  return plotPaymentSummary(erp, inventoryId)?.receipts.find(r => r.requestId === requestId);
}

/** A failed follow-up read cannot turn an accepted/uncertain write into a rejected payment. */
export function isDefinitivePaymentRejection(status: number | undefined, accepted: boolean, previouslyUncertain: boolean): boolean {
  return !accepted && !previouslyUncertain && !!status && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/** Same rule as the web <input type="date" max=today>: a real calendar date, not after the India business date. */
export function validatePaymentDate(date: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Enter the payment date as YYYY-MM-DD.';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return 'Enter a real calendar date.';
  if (date > today) return 'The payment date cannot be in the future.';
  return null;
}

export interface DepositAccount { id: string; accountType?: string; isPrimary?: boolean }
export const isCashMode = (mode: string) => /cash/i.test(mode || '');

/** Web CustomerPlotBookingModal account rules. An explicit valid choice is preserved. */
export function defaultDepositAccount(accounts: DepositAccount[], mode: string, explicit?: string): string {
  if (explicit && accounts.some(a => a.id === explicit)) return explicit;
  if (!accounts.length) return '';
  if (isCashMode(mode)) {
    const cash = accounts.find(a => a.accountType === 'field_petty_cash');
    if (cash) return cash.id;
  }
  return accounts.find(a => a.accountType === 'rera_escrow')?.id
    || accounts.find(a => a.isPrimary)?.id
    || accounts[0].id;
}

/** Mode change: web switches to the matching account type only when one exists. */
export function accountForModeChange(accounts: DepositAccount[], mode: string, current: string): string {
  if (isCashMode(mode)) return accounts.find(a => a.accountType === 'field_petty_cash')?.id || current;
  return (accounts.find(a => a.accountType === 'rera_escrow') || accounts.find(a => a.accountType === 'current_operational')
    || accounts.find(a => a.isPrimary))?.id || current;
}

/** Quick tokens capped to the outstanding balance, as on the web. */
export function quickTokens(balance: number): number[] {
  const bal = Math.round(balance * 100);
  return [50000, 100000, 200000, 500000].filter(n => n * 100 < bal);
}
export function balanceAfter(balance: number, valid: boolean, entered: string): number {
  const p = valid ? Math.round((Number(String(entered).replace(/,/g, '')) || 0) * 100) : 0;
  return Math.max(0, Math.round(balance * 100) - p) / 100;
}
