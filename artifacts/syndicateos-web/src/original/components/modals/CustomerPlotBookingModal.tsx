import React, { useState } from 'react';
import { Plot, Project, TenantFirm, FirmAccount, FirmAccountTransaction } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  Compass,
  CheckCircle2,
  Printer,
  Copy,
  Check,
  User,
  Phone,
  CreditCard,
  Building,
  ShieldCheck,
  X,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  Landmark,
  Lock,
  Clock,
  Send,
  AlertCircle
} from 'lucide-react';

interface CustomerPlotBookingModalProps {
  plot: Plot;
  project?: Project;
  firm: TenantFirm;
  floorRate?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking: (updatedPlot: Plot) => void;
  onReleasePlot?: (plotId: number) => void;
  firmAccounts?: FirmAccount[];
  onAddAccountTransaction?: (accountId: string, tx: FirmAccountTransaction) => void;
}

export const CustomerPlotBookingModal: React.FC<CustomerPlotBookingModalProps> = ({
  plot,
  project,
  firm,
  floorRate = 17000,
  isOpen,
  onClose,
  onConfirmBooking,
  onReleasePlot,
  firmAccounts = [],
  onAddAccountTransaction,
}) => {
  // Available bank & cash accounts of this firm
  const availableAccounts = firmAccounts.filter(
    (a) => a.firmId === firm.id || a.linkedProjectId === project?.id
  );

  const [buyerName, setBuyerName] = useState(plot.buyerName || plot.marketingRequest?.buyerName || '');
  const [buyerPhone, setBuyerPhone] = useState(plot.buyerPhone || plot.marketingRequest?.buyerPhone || '');
  const [buyerAadhaar, setBuyerAadhaar] = useState(plot.buyerAadhaar || '');
  const [ratePerSqYard, setRatePerSqYard] = useState(plot.ratePerSqYard || plot.marketingRequest?.proposedRatePerSqYard || floorRate);
  const [advanceReceived, setAdvanceReceived] = useState(plot.advanceReceived || plot.marketingRequest?.proposedAdvanceAmount || 100000);
  const [paymentMode, setPaymentMode] = useState<Plot['paymentMode']>(plot.paymentMode || 'UPI');
  const [paymentRefNumber, setPaymentRefNumber] = useState(plot.paymentRefNumber || '');
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (availableAccounts.length === 0) return '';
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
  const [showReceiptView, setShowReceiptView] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const selectedAccount = availableAccounts.find((a) => a.id === selectedAccountId);

  // Marketing Rate Proposal Acceptance: Sets status to 'blocked' awaiting token deposit
  const handleAcceptRateProposal = () => {
    if (!plot.marketingRequest) return;
    const req = plot.marketingRequest;
    const updatedPlot: Plot = {
      ...plot,
      status: 'blocked',
      ratePerSqYard: req.proposedRatePerSqYard,
      buyerName: req.buyerName,
      buyerPhone: req.buyerPhone,
      blockedByAgent: req.agentName,
      blockedForBuyer: req.buyerName,
      blockedRate: req.proposedRatePerSqYard,
      blockedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      notes: `Rate of ₹${req.proposedRatePerSqYard.toLocaleString('en-IN')}/Sq.Yd accepted. Blocked awaiting token deposit. Proposed by ${req.agentName}.`,
      marketingRequest: {
        ...req,
        status: 'accepted_blocked',
        reviewedBy: firm.managingPartnerName || 'Managing Partner / Accountant',
        reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      },
    };
    onConfirmBooking(updatedPlot);
    onClose();
  };

  const handleRejectRateProposal = () => {
    const updatedPlot: Plot = {
      ...plot,
      marketingRequest: plot.marketingRequest
        ? {
            ...plot.marketingRequest,
            status: 'rejected',
            reviewedBy: firm.managingPartnerName || 'Managing Partner / Accountant',
            reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          }
        : undefined,
    };
    onConfirmBooking(updatedPlot);
    onClose();
  };

  const handleReleaseBlock = () => {
    if (confirm(`Release block on ${plot.plotNumber} back to Available inventory?`)) {
      if (onReleasePlot) {
        onReleasePlot(plot.id);
      } else {
        onConfirmBooking({
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
      }
      onClose();
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

  const totalPlotValue = plot.areaSqYards * ratePerSqYard;
  const balancePayable = Math.max(0, totalPlotValue - (advanceReceived || 0));
  const isBelowFloor = ratePerSqYard < floorRate;

  const handleFastToken = (amount: number) => {
    setAdvanceReceived(amount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim()) {
      alert('Please enter Customer / Buyer Name for the booking receipt.');
      return;
    }

    const updatedPlot: Plot = {
      ...plot,
      ratePerSqYard: Number(ratePerSqYard) || floorRate,
      status,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      buyerAadhaar: buyerAadhaar.trim(),
      advanceReceived: Number(advanceReceived) || 0,
      paymentMode,
      paymentRefNumber: paymentRefNumber.trim(),
      bookedAt: plot.bookedAt || new Date().toISOString().split('T')[0],
      paymentMilestone,
      notes: notes.trim(),
    };

    const tokenAmt = Number(advanceReceived) || 0;
    if (tokenAmt > 0 && selectedAccountId && onAddAccountTransaction) {
      const chosenAcc = availableAccounts.find((a) => a.id === selectedAccountId);
      if (chosenAcc) {
        const incomingTx: FirmAccountTransaction = {
          id: `tx-plot-${plot.id}-${Date.now().toString().slice(-5)}`,
          accountId: chosenAcc.id,
          date: new Date().toISOString().split('T')[0],
          type: 'credit',
          amount: tokenAmt,
          description: `Plot Booking Advance: ${plot.plotNumber} - Buyer: ${buyerName.trim()}`,
          referenceNo: paymentRefNumber.trim() || `DEP-${Date.now().toString().slice(-6)}`,
          category: 'plot_booking_advance',
          partnerName: buyerName.trim(),
          projectName: project?.name,
          balanceAfter: chosenAcc.currentBalance + tokenAmt,
        };
        onAddAccountTransaction(chosenAcc.id, incomingTx);
      }
    }

    onConfirmBooking(updatedPlot);
    setShowReceiptView(true);
  };

  const handleRelease = () => {
    if (confirm(`Are you sure you want to release ${plot.plotNumber} back to Available inventory?`)) {
      if (onReleasePlot) {
        onReleasePlot(plot.id);
      } else {
        onConfirmBooking({
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
      }
      onClose();
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

  const copyReceiptToClipboard = () => {
    const text = `
--------------------------------------------------
*${firm.name}*
${project?.name || 'Venture Layout'} - Fast Booking Voucher
--------------------------------------------------
Plot Number     : ${plot.plotNumber}
Facing          : ${plot.facing}
Plot Extent     : ${plot.areaSqYards} Sq. Yards (${plot.areaSqYards * 9} Sq. Ft)
Rate per Sq.Yd  : ₹${ratePerSqYard.toLocaleString('en-IN')}
Total Value     : ₹${totalPlotValue.toLocaleString('en-IN')}
--------------------------------------------------
Customer Name   : ${buyerName}
Customer Phone  : ${buyerPhone || 'N/A'}
Token Paid      : ₹${Number(advanceReceived).toLocaleString('en-IN')} (${paymentMode})
Payment Ref     : ${paymentRefNumber || 'Cash Receipt / On-Site Spot Token'}
Booking Status  : ${status.toUpperCase()} (${paymentMilestone})
Balance Payable : ₹${balancePayable.toLocaleString('en-IN')}
Date of Booking : ${new Date().toLocaleDateString('en-IN')}
LP / RERA No.   : ${project?.lpOrReraNumber || firm.reraNumber || 'DTCP Sanctioned'}
--------------------------------------------------
Thank you for booking with ${firm.name}.
`.trim();

    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in">
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
                  {plot.plotNumber} - Fast Customer Booking
                </h3>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    plot.status === 'available'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : plot.status === 'reserved'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {plot.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {project?.name || firm.name} • {plot.areaSqYards} Sq. Yards ({plot.areaSqYards * 9} Sq.Ft)
              </p>
            </div>
          </div>

          <button
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

          {/* PENDING MARKETING BOOKING & RATE PROPOSAL REVIEW CARD */}
          {plot.marketingRequest && plot.marketingRequest.status === 'pending' && (
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-50 to-amber-500/10 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <span className="text-xs font-black uppercase text-amber-950 tracking-wider">
                    ⚡ Incoming Booking &amp; Rate Request from Marketing Agent
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                  Awaiting Acceptance
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Marketing Agent</span>
                  <strong className="text-gray-950 block">{plot.marketingRequest.agentName}</strong>
                  <span className="text-gray-600 font-mono text-[11px]">{plot.marketingRequest.agentPhone}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Client / Buyer</span>
                  <strong className="text-gray-950 block">{plot.marketingRequest.buyerName}</strong>
                  <span className="text-gray-600 font-mono text-[11px]">{plot.marketingRequest.buyerPhone || 'Phone on file'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Proposed Rate</span>
                  <div className="flex items-center gap-1.5">
                    <strong className="text-base font-black font-mono text-gray-950">
                      {formatINR(plot.marketingRequest.proposedRatePerSqYard)}
                    </strong>
                    <span className="text-[10px] text-gray-500">/Sq.Yd</span>
                  </div>
                  <span className="text-[10px] font-bold block text-emerald-700">
                    Total: {formatINR(plot.areaSqYards * plot.marketingRequest.proposedRatePerSqYard)}
                  </span>
                </div>
              </div>

              {plot.marketingRequest.notes && (
                <div className="text-[11px] text-amber-900 bg-amber-100/70 p-2.5 rounded-xl border border-amber-200 italic">
                  &ldquo;{plot.marketingRequest.notes}&rdquo;
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-amber-900/80 font-medium">
                  * Accepting this rate will <strong>block</strong> this plot exclusively for this client until token payment is deposited.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRejectRateProposal}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    Decline Request
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptRateProposal}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Accept Rate &amp; Block Plot</span>
                  </button>
                </div>
              </div>
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
                    Accepted Rate: <strong className="font-mono text-gray-900">{formatINR(plot.blockedRate || plot.ratePerSqYard)}/Sq.Yd</strong> • Total Outlay: <strong className="font-mono text-gray-900">{formatINR(plot.areaSqYards * (plot.blockedRate || plot.ratePerSqYard))}</strong>
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
          {showReceiptView ? (
            /* OFFICIAL BOOKING RECEIPT SLIP */
            <div className="space-y-4 animate-fade-in">
              <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-amber-300 shadow-sm space-y-4 font-sans text-xs">
                <div className="flex justify-between items-start border-b border-gray-200 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 block">
                      Official Booking Token Voucher
                    </span>
                    <h4 className="text-base font-black text-gray-950">{firm.name}</h4>
                    <p className="text-[11px] text-gray-500">
                      Venture: {project?.name || 'Sanctioned Plotted Layout'} | LP: {project?.lpOrReraNumber || firm.reraNumber || 'DTCP Approved'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 bg-amber-100 px-3 py-1 rounded-lg border border-amber-300 font-mono">
                      {plot.plotNumber}
                    </span>
                    <span className="block text-[10px] text-gray-400 mt-1">
                      Date: {new Date().toLocaleDateString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <span className="text-[10px] text-gray-500 block uppercase font-bold">Allottee / Customer</span>
                    <strong className="text-sm text-gray-900 font-bold block">{buyerName}</strong>
                    <span className="text-gray-600 font-mono text-[11px] block">📞 {buyerPhone || 'Phone not provided'}</span>
                    {buyerAadhaar && <span className="text-gray-500 text-[10px] block">ID: {buyerAadhaar}</span>}
                  </div>

                  <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 block uppercase font-bold">Token Amount Received</span>
                    <strong className="text-base text-emerald-950 font-black font-mono block">
                      {formatINR(Number(advanceReceived))}
                    </strong>
                    <span className="text-[11px] text-emerald-700 font-semibold block">
                      Mode: {paymentMode} {paymentRefNumber && `(${paymentRefNumber})`}
                    </span>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <tbody>
                      <tr className="border-b border-gray-100 bg-gray-50/80">
                        <td className="p-2 text-gray-600 font-medium">Plot Facing &amp; Extent:</td>
                        <td className="p-2 font-bold text-gray-900 text-right">
                          {plot.facing} • {plot.areaSqYards} Sq. Yards
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="p-2 text-gray-600 font-medium">Agreed Rate per Sq.Yard:</td>
                        <td className="p-2 font-bold text-gray-900 text-right font-mono">
                          {formatINR(ratePerSqYard)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-amber-50/40">
                        <td className="p-2 text-gray-900 font-bold">Total Consideration Value:</td>
                        <td className="p-2 font-black text-gray-950 text-right font-mono text-sm">
                          {formatINR(totalPlotValue)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="p-2 text-emerald-700 font-bold">Advance Token Paid:</td>
                        <td className="p-2 font-black text-emerald-700 text-right font-mono">
                          - {formatINR(Number(advanceReceived))}
                        </td>
                      </tr>
                      <tr className="bg-gray-50 font-bold">
                        <td className="p-2 text-gray-900">Balance Payable at Registration:</td>
                        <td className="p-2 font-black text-blue-900 text-right font-mono text-sm">
                          {formatINR(balancePayable)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="pt-3 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-500">
                  <div>
                    <span>Authorised Signature:</span>
                    <div className="mt-4 font-mono font-bold text-gray-800">For {firm.tradeName || firm.name}</div>
                  </div>
                  <div className="text-right">
                    <span>Customer Acceptance:</span>
                    <div className="mt-4 font-mono font-bold text-gray-800">{buyerName}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Receipt */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowReceiptView(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-xs"
                >
                  ← Edit Booking Form
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyReceiptToClipboard}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs shadow-xs"
                  >
                    {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedReceipt ? 'Copied to Clipboard!' : 'Share / Copy Token Slip'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-xl text-xs shadow-xs border border-amber-600/30"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* FAST BOOKING FORM */
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                    Aadhaar / PAN Number (For SRO Registration Allotment)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5421 8890 1234 or ABCDE1234F"
                    value={buyerAadhaar}
                    onChange={(e) => setBuyerAadhaar(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono text-gray-900 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* FINANCIAL PRICING & TOKEN ADVANCE */}
              <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-700" />
                    <h4 className="font-black text-amber-950 text-xs uppercase tracking-wide">
                      Pricing &amp; Spot Token Advance
                    </h4>
                  </div>
                  <span className="text-xs font-black text-gray-900 font-mono">
                    Total Value: {formatINR(totalPlotValue)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                      Rate per Sq.Yard (Floor: {formatINR(floorRate)})
                    </label>
                    <input
                      type="number"
                      min="5000"
                      step="250"
                      value={ratePerSqYard}
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
                      Spot Advance / Token Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      value={advanceReceived}
                      onChange={(e) => setAdvanceReceived(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-black text-emerald-800 outline-none"
                    />
                  </div>
                </div>

                {/* FAST CHIPS FOR TOKEN AMOUNT */}
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                    Quick Token Selection:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[50000, 100000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleFastToken(amt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          advanceReceived === amt
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white hover:bg-emerald-50 text-gray-700 border border-gray-300'
                        }`}
                      >
                        {formatINR(amt)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleFastToken(totalPlotValue)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        advanceReceived === totalPlotValue
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      100% Full Payment
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
                      value={paymentMode}
                      onChange={(e) => handlePaymentModeChange(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-900 outline-none"
                    >
                      <option value="UPI">Google Pay / PhonePe / UPI QR</option>
                      <option value="Cash">Cash (Spot Site Advance)</option>
                      <option value="Cheque">Bank Cheque</option>
                      <option value="RTGS / NEFT">RTGS / NEFT Bank Transfer</option>
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
                          Account Type: <strong className="text-gray-800 uppercase">{selectedAccount.accountType.replace('_', ' ')}</strong>
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
                    <span className="text-[10px] text-gray-500 font-bold uppercase block">Balance Due:</span>
                    <strong className="text-sm font-black text-blue-950 font-mono">
                      {formatINR(balancePayable)}
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
                    Booking Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 outline-none"
                  >
                    <option value="reserved">Reserved / Token Advance</option>
                    <option value="sold">Sold &amp; Registered</option>
                    <option value="available">Available (Unbooked)</option>
                  </select>
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
                    <option value="Token Advance">Token Advance Received</option>
                    <option value="Sale Agreement">Registered Agreement of Sale</option>
                    <option value="Registration Pending">Registration Slot Booked</option>
                    <option value="Registered & Cleared">Registered Sale Deed Executed</option>
                  </select>
                </div>
              </div>

              {/* NOTES / REMARKS */}
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

              {/* SUBMIT BUTTON ROW */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                {plot.status !== 'available' && (
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
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-xl text-xs shadow-md border border-amber-600/30 flex items-center gap-2 active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Booking &amp; Generate Token Slip</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
