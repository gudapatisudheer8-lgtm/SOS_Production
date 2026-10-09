import React, { useState, useMemo } from 'react';
import { FirmAccount, FirmAccountTransaction, TenantFirm, Project } from '../../types';
import {
  Landmark,
  X,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  Calendar,
  Tag,
  ShieldCheck,
  Building2,
  Receipt,
  User,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface RecordLedgerTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  firm: TenantFirm;
  accounts: FirmAccount[];
  projects: Project[];
  preselectedAccountId?: string;
  onAddTransaction: (accountId: string, tx: FirmAccountTransaction) => void;
}

export const RecordLedgerTransactionModal: React.FC<RecordLedgerTransactionModalProps> = ({
  isOpen,
  onClose,
  firm,
  accounts,
  projects,
  preselectedAccountId,
  onAddTransaction,
}) => {
  // Available bank accounts strictly for this firm
  const firmAccounts = accounts.filter((a) => a.firmId === firm.id);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (preselectedAccountId && firmAccounts.some((a) => a.id === preselectedAccountId)) {
      return preselectedAccountId;
    }
    const primary = firmAccounts.find((a) => a.isPrimary);
    return primary ? primary.id : firmAccounts[0]?.id || '';
  });

  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<string>('NEFT/RTGS');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [category, setCategory] = useState<string>('plot_booking_advance');
  const [counterpartyName, setCounterpartyName] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [description, setDescription] = useState<string>('');
  const [enrolledBy, setEnrolledBy] = useState<string>(firm.accountantName ? `${firm.accountantName} (Accountant)` : 'Accountant Console');
  const [approvedBy, setApprovedBy] = useState<string>(firm.managingPartnerName ? `${firm.managingPartnerName} (Managing Partner)` : 'Managing Partner Approval');

  // Extract all partners across projects for automatic ledger attribution
  const availablePartners = useMemo(() => {
    const list: { id: string; name: string; role: string }[] = [];
    const seen = new Set<string>();
    projects.forEach((proj) => {
      (proj.partners || []).forEach((ps) => {
        if (ps.name && !seen.has(ps.name.toLowerCase())) {
          seen.add(ps.name.toLowerCase());
          list.push({ id: ps.partnerId, name: ps.name, role: ps.roleInProject });
        }
      });
    });
    return list;
  }, [projects]);

  if (!isOpen) return null;

  const currentAccount = firmAccounts.find((a) => a.id === selectedAccountId) || firmAccounts[0];
  const numAmount = Number(amount) || 0;
  const currentBalance = currentAccount?.currentBalance || 0;
  const projectedBalance =
    txType === 'credit' ? currentBalance + numAmount : currentBalance - numAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) {
      alert('Please select a firm bank account from the dropdown.');
      return;
    }
    if (numAmount <= 0) {
      alert('Please enter a valid transaction amount greater than ₹0.');
      return;
    }

    const matchedProject = projects.find((p) => p.id === selectedProjectId);

    const newTx: FirmAccountTransaction = {
      id: `tx-ledger-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      accountId: currentAccount.id,
      date: date || new Date().toISOString().split('T')[0],
      type: txType,
      amount: numAmount,
      description:
        description.trim() ||
        (txType === 'credit'
          ? `Incoming Credit: ${category.replace(/_/g, ' ').toUpperCase()}${counterpartyName ? ` from ${counterpartyName}` : ''}`
          : `Outgoing Debit: ${category.replace(/_/g, ' ').toUpperCase()}${counterpartyName ? ` to ${counterpartyName}` : ''}`),
      referenceNo: referenceNo.trim() || `${currentAccount.bankName.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      category: category as any,
      partnerName: counterpartyName.trim() || undefined,
      projectName: matchedProject?.name || undefined,
      balanceAfter: projectedBalance,
      enrolledBy: enrolledBy.trim() || `${firm.accountantName} (Accountant)`,
      approvedBy: approvedBy.trim() || `${firm.managingPartnerName} (Managing Partner)`,
      status: 'approved',
      paymentMode: paymentMode,
    };

    onAddTransaction(currentAccount.id, newTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative bg-white rounded-3xl max-w-2xl w-full my-6 shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#FFB800] px-6 py-4 border-b border-amber-500/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-950 text-amber-400 flex items-center justify-center font-black shadow-sm shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/10 text-gray-950">
                  {firm.code} Treasury
                </span>
                <span className="text-xs text-gray-900 font-bold">{firm.name}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-gray-950">
                Record Bank Ledger Transaction
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-900 hover:text-black hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* DIRECTION SWITCHER: INCOMING (CREDIT) VS OUTGOING (DEBIT) */}
          <div>
            <label className="block text-[11px] font-black text-gray-700 uppercase mb-1.5">
              Transaction Direction / Ledger Flow *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTxType('credit');
                  if (category === 'vendor_payout' || category === 'contractor_payout') {
                    setCategory('plot_booking_advance');
                  }
                }}
                className={`py-3 px-4 rounded-2xl border flex items-center justify-center gap-2.5 font-black text-xs transition-all ${
                  txType === 'credit'
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-md scale-[1.01]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>🟢 INCOMING (Inflow / Credit)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTxType('debit');
                  if (category === 'plot_booking_advance' || category === 'partner_capital') {
                    setCategory('vendor_payout');
                  }
                }}
                className={`py-3 px-4 rounded-2xl border flex items-center justify-center gap-2.5 font-black text-xs transition-all ${
                  txType === 'debit'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-md scale-[1.01]'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>🔴 OUTGOING (Outflow / Debit)</span>
              </button>
            </div>
          </div>

          {/* 1. BANK ACCOUNT DROPDOWN FIELD (POPULATED BASED ON ENTERED FIRM ACCOUNTS) */}
          <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-300/80 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="ledger-bank-account-select" className="text-xs font-black text-gray-950 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-amber-700" />
                <span>Bank Account Dropdown Field *</span>
              </label>
              <span className="text-[10px] text-amber-900 font-bold bg-amber-200/70 px-2 py-0.5 rounded-full">
                {firmAccounts.length} entered accounts available
              </span>
            </div>

            <select
              id="ledger-bank-account-select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border-2 border-amber-400 focus:border-amber-600 rounded-xl text-xs font-black text-gray-950 outline-none shadow-sm cursor-pointer"
            >
              {firmAccounts.length === 0 ? (
                <option value="">No registered accounts - Default Cash Vault</option>
              ) : (
                firmAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bankName} — {acc.accountName} [{acc.accountType.replace(/_/g, ' ').toUpperCase()}] ({acc.accountNumber.slice(-4) ? `•••• ${acc.accountNumber.slice(-4)}` : acc.accountNumber}) | Balance: {formatINR(acc.currentBalance)}
                  </option>
                ))
              )}
            </select>

            {currentAccount && (
              <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-600 pt-1 border-t border-amber-200/60">
                <span>
                  IFSC: <strong className="font-mono text-gray-900">{currentAccount.ifscCode}</strong> • Branch: <strong className="text-gray-900">{currentAccount.branchName}</strong>
                </span>
                <span className="font-bold text-gray-800">
                  Current Balance: <strong className="font-mono text-gray-950">{formatINR(currentBalance)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* 2. AMOUNT & DATE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Transaction Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-gray-500 font-bold text-sm">₹</span>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-mono font-black text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Transaction Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>
          </div>

          {/* 3. CATEGORY & PAYMENT MODE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Ledger Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              >
                {txType === 'credit' ? (
                  <>
                    <option value="plot_booking_advance">Customer Plot Booking Advance</option>
                    <option value="flat_booking_advance">Customer Flat / Apartment Token</option>
                    <option value="partner_capital">Partner Syndicate Capital Deposit</option>
                    <option value="interest_credit">Bank Escrow Interest Credit</option>
                    <option value="inter_account_transfer">Inter-Account Transfer (Inflow)</option>
                    <option value="other">Other Ledger Receipt</option>
                  </>
                ) : (
                  <>
                    <option value="vendor_payout">Civil Contractor &amp; Material Payout</option>
                    <option value="contractor_payout">Labour &amp; Earthwork Contractor Payout</option>
                    <option value="field_imprest">Field Cash Imprest / Petty Cash</option>
                    <option value="statutory_fee">DTCP / HMDA / RERA Statutory Fees</option>
                    <option value="partner_draw">Partner Capital Draw / Dividend</option>
                    <option value="cash_withdrawal">Cash Withdrawal for On-Site Spends</option>
                    <option value="inter_account_transfer">Inter-Account Transfer (Outflow)</option>
                    <option value="other">Other Ledger Disbursement</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Payment Mode / Channel *
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              >
                <option value="NEFT/RTGS">NEFT / RTGS Bank Transfer</option>
                <option value="UPI">UPI / QR (PhonePe / Google Pay)</option>
                <option value="Cheque/DD">Bank Cheque / Demand Draft</option>
                <option value="Direct Cash Deposit">Direct Cash / Vault Deposit</option>
                <option value="Escrow Allocation">RERA 70:30 Escrow Allocation</option>
              </select>
            </div>
          </div>

          {/* 4. REFERENCE NUMBER & COUNTERPARTY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Bank UTR / Cheque / Ref Number
              </label>
              <input
                type="text"
                placeholder="e.g. UTR-SBI202609260192"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-mono font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none uppercase"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-black text-gray-700 uppercase">
                  {txType === 'credit' ? 'Payer / Customer / Partner Name' : 'Payee / Contractor / Vendor Name'}
                </label>
                {(category === 'partner_capital' || category === 'partner_draw') && (
                  <span className="text-[10px] text-amber-800 font-bold">
                    Select Partner to Auto-Credit Capital
                  </span>
                )}
              </div>
              <input
                type="text"
                list="ledger-partner-datalist"
                placeholder={txType === 'credit' ? 'e.g. Partner A: Srikanth Reddy / Buyer' : 'e.g. Sri Balaji Earthmovers'}
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
              <datalist id="ledger-partner-datalist">
                {availablePartners.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.role}
                  </option>
                ))}
              </datalist>

              {/* Quick Partner Chips if Partner Capital or Partner Draw */}
              {(category === 'partner_capital' || category === 'partner_draw') && availablePartners.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-gray-500 font-semibold">Quick select:</span>
                  {availablePartners.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setCounterpartyName(p.name)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        counterpartyName === p.name
                          ? 'bg-[#111827] text-white shadow-sm'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {p.name.replace(/^Partner\s+[A-Z]:\s*/i, '')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. ASSOCIATED PROJECT & DESCRIPTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Associated Venture / Project
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Narration / Voucher Notes
              </label>
              <input
                type="text"
                placeholder="e.g. 20% advance token for Plot #14"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>
          </div>

          {/* 6. ENROLLED BY & APPROVER NAME (AUDIT & COMPLIANCE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-amber-600" />
                <span>Enrolled By (Person Enrolling Entry)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. K. S. Narayana (Accountant)"
                value={enrolledBy}
                onChange={(e) => setEnrolledBy(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Approved By (Approver / Signoff)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Srikanth Reddy (Managing Partner)"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>
          </div>

          {/* LIVE BALANCE IMPACT SUMMARY BOX */}
          <div className="bg-gray-950 text-white rounded-2xl p-4 shadow-sm space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
              Live Bank Ledger Impact Preview
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/10 rounded-xl p-2.5">
                <span className="block text-[9px] uppercase font-bold text-gray-400">Current Balance</span>
                <span className="text-xs sm:text-sm font-black font-mono text-gray-200">
                  {formatINR(currentBalance)}
                </span>
              </div>
              <div className={`rounded-xl p-2.5 ${txType === 'credit' ? 'bg-emerald-950/80 border border-emerald-500/50' : 'bg-rose-950/80 border border-rose-500/50'}`}>
                <span className="block text-[9px] uppercase font-bold text-gray-300">
                  {txType === 'credit' ? '+ Inflow Credit' : '- Outflow Debit'}
                </span>
                <span className={`text-xs sm:text-sm font-black font-mono ${txType === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {numAmount > 0 ? `${txType === 'credit' ? '+' : '-'}${formatINR(numAmount)}` : '₹0'}
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5 border border-amber-400/40">
                <span className="block text-[9px] uppercase font-bold text-amber-300">Projected Balance</span>
                <span className="text-xs sm:text-sm font-black font-mono text-white">
                  {formatINR(projectedBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2.5 font-black text-xs rounded-full shadow-md transition-all flex items-center gap-2 ${
                txType === 'credit'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              {txType === 'credit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              <span>Commit {txType === 'credit' ? 'Incoming Credit' : 'Outgoing Debit'} to Ledger</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
