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
