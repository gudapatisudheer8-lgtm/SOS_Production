import { MasterOptions } from '../../../adapter/config';
import React, { useEffect, useRef, useState } from 'react';
import { BookingReceiptView } from './BookingReceiptView';
import { RegistrationAppointment } from './RegistrationAppointment';
import { bookingBusinessDate, createRequestIdKeeper, findCommittedReceipt, paymentPosition, validatePayment, toPaise, fromPaise, receiptAnnotation } from './bookingPayments';
import { Plot, Project, TenantFirm, FirmAccount, FirmAccountTransaction } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  Compass,
  CheckCircle2,
  User,
  X,
  DollarSign,
  AlertTriangle,
  Landmark,
  Lock,
  Clock,
  AlertCircle,
  History,
  Loader2
} from 'lucide-react';

interface CustomerPlotBookingModalProps {
  plot: Plot;
  project?: Project;
  firm: TenantFirm;
  floorRate?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking: (updatedPlot: Plot) => void | boolean | Promise<boolean>;
  onApproveBooking?: (receiptId: string) => boolean | Promise<boolean>;
  onReleasePlot?: (plotId: number) => void | boolean | Promise<boolean>;
  firmAccounts?: FirmAccount[];
  onAddAccountTransaction?: (accountId: string, tx: FirmAccountTransaction) => void | boolean | Promise<boolean>;
}

export const CustomerPlotBookingModal: React.FC<CustomerPlotBookingModalProps> = ({
  plot,
  project,
  firm,
  floorRate = 0,
  isOpen,
  onClose,
  onConfirmBooking,
  onApproveBooking,
  onReleasePlot,
  firmAccounts = [],
  onAddAccountTransaction,
}) => {
  // Available bank & cash accounts of this firm
  const availableAccounts = firmAccounts.filter(
    (a) => a.firmId === firm.id && a.linkedProjectId === project?.id && a.status === 'active'
  );

  const [buyerName, setBuyerName] = useState(plot.buyerName || plot.marketingRequest?.buyerName || '');
  const [buyerPhone, setBuyerPhone] = useState(plot.buyerPhone || plot.marketingRequest?.buyerPhone || '');
  const summary = plot.bookingPayments;
  const isFirstBooking = !summary && (plot.status === 'available' || plot.status === 'blocked');
  const [ratePerSqYard, setRatePerSqYard] = useState(
    summary?.locked ? summary.ratePerSqYard : plot.ratePerSqYard || plot.blockedRate || plot.marketingRequest?.proposedRatePerSqYard || floorRate
  );
  // Next payment always starts empty: the user enters only the amount received in THIS payment.
  const [amountInput, setAmountInput] = useState('');
  const [paymentDate, setPaymentDate] = useState(bookingBusinessDate);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [awaitingRequestId, setAwaitingRequestId] = useState<string | null>(null);
  const [historyReceiptId, setHistoryReceiptId] = useState<string | null>(null);
  const requestIds = useRef(createRequestIdKeeper());
  const [lastAttemptRequestId, setLastAttemptRequestId] = useState<string | null>(null);
  // A commit can succeed while the follow-up refresh fails. Recognize its saved
  // receipt on the next refresh rather than issuing a second payment request.
  useEffect(() => {
    const saved = findCommittedReceipt(summary, lastAttemptRequestId);
    if (!saved?.posted) return;
    setAwaitingRequestId(lastAttemptRequestId);
    setAmountInput('');
    setSubmitError(null);
    setLastAttemptRequestId(null);
    requestIds.current.reset();
  }, [summary, lastAttemptRequestId]);
  const [paymentMode, setPaymentMode] = useState<Plot['paymentMode']>(plot.paymentMode);
  const [paymentRefNumber, setPaymentRefNumber] = useState(plot.paymentRefNumber || '');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (availableAccounts.length === 0) return '';
    if (availableAccounts.some((a) => a.id === plot.bookingAccountId)) return plot.bookingAccountId!;
    if (plot.paymentMode === 'Cash') {
      const cash = availableAccounts.find((a) => a.accountType === 'field_petty_cash');
      if (cash) return cash.id;
    }
    const rera = availableAccounts.find((a) => a.accountType === 'rera_escrow');
    if (rera) return rera.id;
    const primary = availableAccounts.find((a) => a.isPrimary);
    if (primary) return primary.id;
    return availableAccounts[0]?.id || '';
  });
  const [status, setStatus] = useState<Plot['status']>(plot.status === 'available' || plot.status === 'blocked' ? 'reserved' : plot.status);
  const [paymentMilestone, setPaymentMilestone] = useState<Plot['paymentMilestone']>(
    plot.paymentMilestone || 'Token Advance'
  );
  const [notes, setNotes] = useState(plot.notes || '');
  const selectedAccount = availableAccounts.find((a) => a.id === selectedAccountId);


  const handleReleaseBlock = () => {
    if (confirm(`Release block on ${plot.plotNumber} back to Available inventory?`)) {
      const done = onReleasePlot ? onReleasePlot(plot.id) : onConfirmBooking({
          ...plot,
          status: 'available',
          buyerName: undefined,
          buyerPhone: undefined,
          buyerAadhaar: undefined,
          advanceReceived: 0,
          blockedByAgent: undefined,
          blockedForBuyer: undefined,
          blockedRate: undefined,
          blockedAt: undefined,
          paymentMode: undefined,
          paymentRefNumber: undefined,
          paymentMilestone: undefined,
          notes: 'Block released back to available inventory.',
          marketingRequest: undefined,
        });
      void Promise.resolve(done).then((ok) => { if (ok !== false) onClose(); });
    }
  };

  const handlePaymentModeChange = (mode: Plot['paymentMode']) => {
    setPaymentMode(mode);
    if (mode === 'Cash') {
      const cashAcc = availableAccounts.find((a) => a.accountType === 'field_petty_cash');
      if (cashAcc) setSelectedAccountId(cashAcc.id);
    } else {
      const bankAcc = availableAccounts.find((a) => a.accountType === 'rera_escrow') ||
                      availableAccounts.find((a) => a.accountType === 'current_operational') ||
                      availableAccounts.find((a) => a.isPrimary);
      if (bankAcc) setSelectedAccountId(bankAcc.id);
    }
  };

  if (!isOpen) return null;

  const rateLocked = !!summary?.locked;
  const effectiveRate = rateLocked ? summary!.ratePerSqYard : ratePerSqYard;
  const position = paymentPosition(summary, plot.areaSqYards, effectiveRate, isFirstBooking ? 0 : plot.advanceReceived || 0);
  const totalPlotValue = position.totalValue;
  const maxPayable = position.balance;
  const historyError = summary?.reconciliationRequired ||
    (!isFirstBooking && !summary ? 'Saved booking payments could not be verified. Refresh and reopen this plot before collecting money.' : '');
  const fullyPaid = !historyError && toPaise(maxPayable) <= 0 && toPaise(totalPlotValue) > 0;
  const validation = validatePayment(amountInput, maxPayable);
  const enteredPaise = toPaise(Number(amountInput) || 0);
  const balanceAfterEntry = fromPaise(Math.max(0, toPaise(maxPayable) - (validation.ok ? enteredPaise : 0)));
  const isBelowFloor = !rateLocked && ratePerSqYard < floorRate;
  const receipts = summary?.receipts || [];
  const committedReceipt = findCommittedReceipt(summary, awaitingRequestId);
  const historyReceipt = receipts.find((r) => r.id === historyReceiptId);
  const showReceiptView = !!awaitingRequestId;
  const receiptContext = {
    firmName: firm.tradeName || firm.name,
    projectName: project?.name,
    lpOrReraNumber: project?.lpOrReraNumber || undefined,
    plotNumber: plot.plotNumber,
    facing: plot.facing,
  };

  const handleFastToken = (amount: number) => {
    const capped = Math.min(toPaise(amount), toPaise(maxPayable));
    if (capped > 0) setAmountInput(fromPaise(capped).toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (plot.pendingBookingId || submitting) return;
    if (findCommittedReceipt(summary, lastAttemptRequestId)?.posted) {
      setAwaitingRequestId(lastAttemptRequestId);
      setLastAttemptRequestId(null);
      setAmountInput('');
      requestIds.current.reset();
      return;
    }
    if (historyError) { setSubmitError(historyError); return; }
    setSubmitError(null);
    if (!validation.ok) {
      setSubmitError(validation.error);
      return;
    }
    if (!paymentDate) {
      setSubmitError('Select the payment date.');
      return;
    }
    if (!paymentMode || !selectedAccountId) {
      alert('Select the payment mode and the project account before submitting this receipt.');
      return;
    }
    if (!buyerName.trim()) {
      alert('Please enter Customer / Buyer Name for the booking receipt.');
      return;
    }

    const lockedBuyer = rateLocked && summary ? { name: summary.buyerName, phone: summary.buyerPhone } : null;
    const finalBuyerName = lockedBuyer?.name || buyerName.trim();
    const finalBuyerPhone = lockedBuyer?.phone || buyerPhone.trim();
    const finalRate = rateLocked ? summary!.ratePerSqYard : Number(ratePerSqYard) || floorRate;
    const fingerprint = JSON.stringify([plot.__recordId || plot.id, validation.amount, paymentDate, paymentMode, selectedAccountId, paymentRefNumber.trim(), finalRate, finalBuyerName, finalBuyerPhone, status, paymentMilestone, notes.trim()]);
    const requestId = requestIds.current.idFor(fingerprint);
    setLastAttemptRequestId(requestId);

    const updatedPlot: Plot = {
      ...plot,
      ratePerSqYard: finalRate,
      status,
      buyerName: finalBuyerName,
      buyerPhone: finalBuyerPhone,
      // New positive payment for THIS receipt only; the server keeps cumulative totals.
      advanceReceived: validation.amount,
      bookingPaymentDate: paymentDate,
      bookingPaymentRequestId: requestId,
      paymentMode,
      paymentRefNumber: paymentRefNumber.trim(),
      bookingAccountId: selectedAccountId,
      bookedAt: plot.bookedAt || new Date().toISOString().split('T')[0],
      paymentMilestone,
      notes: notes.trim(),
    };

    // The booking record carries the advance; the backend posts it to the ledger. No client-side receipt is simulated.
    setSubmitting(true);
    try {
      const savedOk = await onConfirmBooking(updatedPlot);
      if (savedOk === false) {
        setSubmitError('The payment was not saved. Check the details and retry; retrying the same payment will not record it twice.');
        return;
      }
      requestIds.current.reset();
      setAmountInput('');
      setAwaitingRequestId(requestId);
      setLastAttemptRequestId(null);
    } catch (err) {
      setSubmitError(`The payment could not be saved${err instanceof Error && err.message ? `: ${err.message}` : ''}. Retry safely; the same payment keeps its request reference.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = () => {
    if (confirm(`Are you sure you want to release ${plot.plotNumber} back to Available inventory?`)) {
      const done = onReleasePlot ? onReleasePlot(plot.id) : onConfirmBooking({
          ...plot,
          status: 'available',
          buyerName: undefined,
          buyerPhone: undefined,
          buyerAadhaar: undefined,
          advanceReceived: 0,
          paymentMode: undefined,
          paymentRefNumber: undefined,
          paymentMilestone: undefined,
          notes: 'Booking released back to inventory.',
        });
      void Promise.resolve(done).then((ok) => { if (ok !== false) onClose(); });
    }
  };

  const getFacingBadge = (facing: string) => {
    switch (facing) {
      case 'East':
        return { label: 'East Facing (Auspicious Sunrise)', color: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'North':
        return { label: 'North Facing (Kubera Vastu)', color: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'North-East Corner':
        return { label: 'North-East Corner (Eeshanya Premium)', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
      case 'South-East Corner':
        return { label: 'South-East Corner (Agneya)', color: 'bg-orange-100 text-orange-900 border-orange-300' };
      case 'West':
        return { label: 'West Facing (Vastu Compliant)', color: 'bg-purple-100 text-purple-900 border-purple-300' };
      case 'South':
        return { label: 'South Facing', color: 'bg-rose-100 text-rose-900 border-rose-300' };
      default:
        return { label: facing, color: 'bg-gray-100 text-gray-900 border-gray-300' };
    }
  };

  const facingInfo = getFacingBadge(plot.facing);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Plot ${plot.plotNumber} booking and collections`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-sm">
              {plot.plotNumber.replace('Plot #', '#')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {plot.plotNumber} - {isFirstBooking ? 'Fast Customer Booking' : 'Customer Plot Collections'}
                </h3>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    !showReceiptView && plot.status === 'available'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : showReceiptView || plot.status === 'reserved'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {showReceiptView ? 'Payment saved' : plot.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {project?.name || firm.name} • {plot.areaSqYards} Sq. Yards ({plot.areaSqYards * 9} Sq.Ft)
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close plot booking form"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {/* PLOT SPECIFICATION BADGES */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Directional Facing</span>
              <span className="font-extrabold text-gray-900 flex items-center gap-1 mt-0.5">
                <Compass className="w-3.5 h-3.5 text-amber-600" />
                {plot.facing}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Plot Extent</span>
              <span className="font-extrabold text-gray-900 mt-0.5 block">
                {plot.areaSqYards} Sq.Yds <span className="text-gray-500 text-[10px]">({plot.areaSqYards * 9} Sft)</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Dimensions</span>
              <span className="font-mono font-bold text-gray-900 mt-0.5 block">
                {plot.dimensions || `${Math.round(Math.sqrt(plot.areaSqYards * 9) * 0.8)}' × ${Math.round(Math.sqrt(plot.areaSqYards * 9) * 1.25)}'`}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Road Approach</span>
              <span className="font-bold text-gray-900 mt-0.5 block">
                {plot.roadWidthFt ? `${plot.roadWidthFt} Ft BT Road` : `${project?.roadWidth || 40} Ft Main Road`}
              </span>
            </div>
          </div>

          {/* Historical marketing request: activity only, never a hold or cash */}
          {plot.marketingRequest && plot.marketingRequest.status === 'pending' && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-1">
              <strong className="block text-[11px] uppercase tracking-wider">Booking request noted (historical, no hold)</strong>
              <p>
                {plot.marketingRequest.agentName} proposed {formatINR(plot.marketingRequest.proposedRatePerSqYard)}/Sq.Yd for {plot.marketingRequest.buyerName || 'a buyer'}.
                This request is recorded for reference only. It did not hold the plot and no promised token is counted as money.
              </p>
              {plot.marketingRequest.notes && <p className="italic text-amber-900">&ldquo;{plot.marketingRequest.notes}&rdquo;</p>}
            </div>
          )}

          {/* PLOT BLOCKED BANNER */}
          {plot.status === 'blocked' && (
            <div className="bg-amber-500/10 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black uppercase text-amber-950 tracking-wider">
                    Plot Blocked — Awaiting Booking Token Deposit
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReleaseBlock}
                  className="text-[11px] text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer"
                >
                  Release Block (Return to Available)
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-gray-600 block">
                    Blocked for: <strong className="text-gray-950">{plot.blockedForBuyer || plot.buyerName}</strong>
                    {plot.blockedByAgent && <span> via Agent: <strong className="text-indigo-900">{plot.blockedByAgent}</strong></span>}
                  </span>
                  <span className="text-gray-500 text-[11px] block mt-0.5">
                    Hold Rate: <strong className="font-mono text-gray-900">{formatINR(plot.blockedRate || plot.ratePerSqYard)}/Sq.Yd</strong> • Total Outlay: <strong className="font-mono text-gray-900">{formatINR(plot.areaSqYards * (plot.blockedRate || plot.ratePerSqYard))}</strong>
                  </span>
                </div>
                <div className="text-[11px] text-amber-900 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 font-bold">
                  Status: Blocked (Not Booked)
                </div>
              </div>
              <p className="text-[11px] text-gray-600">
                Enter the booking advance received below and click <strong>Confirm Booking &amp; Issue Receipt</strong> to convert this blocked plot into an official booking and record the deposit in firm accounts.
              </p>
            </div>
          )}

          {/* RECEIPT VIEW TOGGLE OR FORM */}
          {/* PAYMENT POSITION */}
          {!isFirstBooking && (
            <div className="grid grid-cols-3 gap-2 text-xs" data-testid="panel-payment-position">
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">Agreed total</span>
                <strong className="font-mono text-sm text-gray-950" data-testid="text-total-value">{formatINR(totalPlotValue)}</strong>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">Collected</span>
                <strong className="font-mono text-sm text-emerald-950" data-testid="text-collected">{formatINR(position.collected)}</strong>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3">
                <span className="text-[10px] font-bold uppercase text-blue-900 block">Outstanding</span>
                <strong className="font-mono text-sm text-blue-950" data-testid="text-outstanding">{formatINR(maxPayable)}</strong>
              </div>
              <div className="col-span-3 flex flex-wrap items-center gap-2 text-[11px]">
                {rateLocked && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-bold text-slate-800">
                    <Lock className="w-3 h-3" /> Agreed price locked at {formatINR(summary!.ratePerSqYard)}/Sq.Yd
                  </span>
                )}
                {fullyPaid && (
                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-bold text-emerald-900" data-testid="status-fully-paid">
                    Fully paid - plot status remains {plot.status}; mark sold/registered separately
                  </span>
                )}
                {!summary && (
                  <span className="text-gray-500">Totals are from the earlier booking record until the first itemised receipt is saved.</span>
                )}
              </div>
            </div>
          )}

          {showReceiptView ? (
            <div className="space-y-3 animate-fade-in">
              {committedReceipt ? (
                <BookingReceiptView receipt={committedReceipt} context={receiptContext} />
              ) : (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-xs text-amber-950 space-y-2" data-testid="status-receipt-loading" role="status">
                  <div className="flex items-center gap-2 font-black"><Loader2 className="w-4 h-4 animate-spin" /> Payment saved. Loading the official receipt from the books...</div>
                  <p>The shareable receipt appears only after the server confirms it. Keep this window open; it updates automatically when the refreshed record arrives.</p>
                  <div className="h-3 w-2/3 rounded bg-amber-200/70 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-amber-200/70 animate-pulse" />
                </div>
              )}
              <div className="flex justify-between gap-2">
                <button type="button" data-testid="button-back-to-collections" onClick={() => setAwaitingRequestId(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-xs">
                  Back to collections
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-bold rounded-xl text-xs">Close</button>
              </div>
            </div>
          ) : historyReceipt ? (
            <div className="space-y-3 animate-fade-in">
              <BookingReceiptView receipt={historyReceipt} context={receiptContext} historical />
              <button type="button" data-testid="button-close-history-receipt" onClick={() => setHistoryReceiptId(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-xs">
                Back to collections
              </button>
            </div>
          ) : (
            /* FAST BOOKING FORM */
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {receipts.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2" data-testid="panel-payment-history">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <History className="w-4 h-4 text-amber-600" />
                  <h4 className="font-black text-gray-900 text-xs uppercase tracking-wide">Payment history ({receipts.length})</h4>
                </div>
                <ul className="divide-y divide-gray-100">
                  {receipts.map((r) => {
                    const note = receiptAnnotation(r);
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900">
                            <span className="font-mono">{r.receiptNumber}</span> <span className="text-gray-500 font-normal">{r.date} | {r.paymentMode}</span>
                          </div>
                          <div className="text-[11px] text-gray-500">Paid to date {formatINR(r.totalCollected)} | Remaining {formatINR(r.balanceAfter)}</div>
                          {note && <div className="text-[10px] font-bold uppercase text-rose-700">{r.state}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono font-black ${note && r.state !== 'recorded' ? 'text-gray-400 line-through' : 'text-emerald-800'}`}>{formatINR(r.amount)}</span>
                          <button type="button" data-testid={`button-view-receipt-${r.id}`} onClick={() => setHistoryReceiptId(r.id)} className="px-2.5 py-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 font-bold text-[11px]">View</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {plot.pendingBookingId && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <strong>Historical unposted receipt.</strong> This {formatINR(plot.advanceReceived || 0)} receipt was saved before entries posted automatically and is not in the books. Its author can Correct &amp; Resubmit it from Project Statements to record it.
              </div>
            )}
              {historyError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{historyError}</div>}
              <fieldset disabled={!!plot.pendingBookingId || !!historyError} className="space-y-4">
              {/* CUSTOMER IDENTITY */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                  <User className="w-4 h-4 text-amber-600" />
                  <h4 className="font-black text-gray-900 text-xs uppercase tracking-wide">
                    Customer &amp; Purchaser Details
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Customer / Buyer Full Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. M. Srinivasulu Naidu"
                      value={buyerName}
                      readOnly={rateLocked}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Customer WhatsApp / Mobile Phone <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 98480 12345"
                      value={buyerPhone}
                      readOnly={rateLocked}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

              </div>

              {/* FINANCIAL PRICING & TOKEN ADVANCE */}
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-700" />
                    <h4 className="font-black text-amber-950 text-xs uppercase tracking-wide">
                      {isFirstBooking ? 'Pricing & Spot Token Advance' : 'Record Next Payment'}
                    </h4>
                  </div>
                  <span className="text-xs font-black text-gray-900 font-mono">
                    Total Value: {formatINR(totalPlotValue)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                      Agreed Rate per Sq.Yard {rateLocked ? '(locked)' : `(Floor: ${formatINR(floorRate)})`}
                    </label>
                    <input
                      type="number"
                      min={floorRate}
                      step="0.01"
                      data-testid="input-rate"
                      readOnly={rateLocked}
                      title={rateLocked ? 'Agreed price is locked after the first saved receipt.' : undefined}
                      value={effectiveRate}
                      onChange={(e) => setRatePerSqYard(Number(e.target.value) || 0)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold outline-none border ${
                        isBelowFloor ? 'border-red-500 bg-red-50 text-red-700' : 'border-amber-300 bg-white text-gray-950'
                      }`}
                    />
                    {isBelowFloor && (
                      <span className="text-[10px] text-red-600 font-bold block mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        Below syndicate floor rate ({formatINR(floorRate)}).
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                      Amount received THIS payment (Rs.)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max={maxPayable > 0 ? maxPayable : undefined}
                      step="0.01"
                      placeholder={fullyPaid ? 'Nothing outstanding' : 'Enter amount'}
                      disabled={toPaise(maxPayable) <= 0}
                      data-testid="input-payment-amount"
                      value={amountInput}
                      onChange={(e) => { setAmountInput(e.target.value); setSubmitError(null); }}
                      className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-mono font-black text-emerald-800 outline-none disabled:bg-gray-100 ${amountInput && !validation.ok ? 'border-red-500' : 'border-emerald-300'}`}
                    />
                    <span className="text-[10px] text-gray-600 block mt-1" data-testid="text-max-payable">
                      Max payable: <strong className="font-mono">{formatINR(maxPayable)}</strong>
                    </span>
                    {amountInput && !validation.ok && (
                      <span className="text-[10px] text-red-600 font-bold block mt-0.5" data-testid="error-payment-amount">{validation.error}</span>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Payment date</label>
                    <input
                      type="date"
                      required
                      data-testid="input-payment-date"
                      value={paymentDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
                    />
                  </div>
                </div>

                {/* FAST CHIPS FOR TOKEN AMOUNT */}
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                    Quick Token Selection:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[50000, 100000, 200000, 500000].filter((amt) => toPaise(amt) < toPaise(maxPayable)).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleFastToken(amt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          Number(amountInput) === amt
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white hover:bg-emerald-50 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {formatINR(amt)}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={toPaise(maxPayable) <= 0}
                      onClick={() => handleFastToken(maxPayable)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 ${
                        toPaise(Number(amountInput) || 0) === toPaise(maxPayable)
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      Full balance ({formatINR(maxPayable)})
                    </button>
                  </div>
                </div>

                {/* PAYMENT MODE & REFERENCE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Payment Mode
                    </label>
                    <select
                      required
                    value={paymentMode || ''}
                      onChange={(e) => handlePaymentModeChange(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 outline-none"
                    >
                    <option value="">Select payment mode</option>
                    <MasterOptions group="booking_payment_modes" />
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Cheque / UTR / Reference #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UTR 9384729103 or Cheque #881923"
                      value={paymentRefNumber}
                      onChange={(e) => setPaymentRefNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-mono text-gray-900 outline-none"
                    />
                  </div>

                  {/* DEPOSIT BANK ACCOUNT DROPDOWN (DYNAMIC FROM ENTERED FIRM ACCOUNTS) */}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-950 font-black">
                        <Landmark className="w-3.5 h-3.5 text-amber-600" />
                        <span>Deposit Bank / Firm Ledger Account *</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Ledger Incoming Credit Route
                      </span>
                    </label>
                    <select
                      required
                      id="plot-booking-bank-account-select"
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-amber-400 focus:border-amber-600 rounded-xl text-xs font-bold text-gray-950 outline-none shadow-2xs cursor-pointer"
                    >
                      {availableAccounts.length === 0 ? (
                        <option value="">No registered accounts - Default Cash Vault</option>
                      ) : (
                        availableAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.bankName} - {acc.accountName} ({acc.accountNumber.slice(-4) ? `•••• ${acc.accountNumber.slice(-4)}` : acc.accountNumber}) | Balance: {formatINR(acc.currentBalance)}
                          </option>
                        ))
                      )}
                    </select>
                    {selectedAccount && (
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1 px-1">
                        <span>
                          Account Type: <strong className="text-gray-800 uppercase">{selectedAccount.accountType?.replace('_', ' ') || 'Not specified'}</strong>
                        </span>
                        <span>
                          IFSC: <strong className="text-gray-800 font-mono">{selectedAccount.ifscCode}</strong> • Branch: <strong className="text-gray-800">{selectedAccount.branchName}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* BALANCE RECAP */}
                <div className="bg-white p-3 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Outstanding after this payment:</span>
                    <strong className="text-sm font-black text-blue-950 font-mono" data-testid="text-balance-after">
                      {formatINR(balanceAfterEntry)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Stage:</span>
                    <span className="text-xs font-bold text-gray-800">{paymentMilestone}</span>
                  </div>
                </div>
              </div>

              {/* BOOKING STATUS & STAGE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    Booking Status (read-only)
                  </label>
                  <select
                    value={status}
                    disabled
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 outline-none"
                  >
                    <MasterOptions group="plot_statuses" />
                  </select>
                  <p className="mt-1 text-[10px] text-gray-500">Recording a payment does not automatically mark the plot sold or registered.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    Agreement Stage
                  </label>
                  <select
                    value={paymentMilestone}
                    onChange={(e) => setPaymentMilestone(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 outline-none"
                  >
                    <MasterOptions group="booking_stages" />
                  </select>
                </div>
              </div>

              {/* NOTES / REMARKS */}
              <RegistrationAppointment plot={plot} project={project} stage={paymentMilestone} onLoadedStage={setPaymentMilestone} />
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                  Agreement Terms / Field Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Balance within 30 days. Corner clearance agreed with customer."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 outline-none"
                />
              </div>

              </fieldset>
              {submitError && (
                <div role="alert" data-testid="error-submit" className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-[11px] font-bold text-rose-900">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {submitError}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                {plot.status !== 'available' && !plot.pendingBookingId && (
                  <button
                    type="button"
                    onClick={handleRelease}
                    className="px-3.5 py-2 text-red-600 hover:bg-red-50 font-bold rounded-xl text-xs transition-colors border border-red-200"
                  >
                    Release / Cancel Booking
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-bold rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                  {plot.pendingBookingId ? (
                    <span className="text-xs font-bold text-amber-800">Correct &amp; resubmit from Project Statements</span>
                  ) : <button
                    type="submit"
                    data-testid="button-submit-payment"
                    disabled={submitting || !!historyError || toPaise(maxPayable) <= 0}
                    aria-busy={submitting}
                    className="px-6 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-xl text-xs shadow-md border border-amber-600/30 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{submitting ? 'Saving payment...' : toPaise(maxPayable) <= 0 ? 'Nothing outstanding' : isFirstBooking ? 'Confirm Booking & Record Payment' : 'Record This Payment'}</span>
                  </button>}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
