import React, { useState } from 'react';
import {
  TenantFirm,
  Project,
  SyndicatePartner,
  FieldExpenseLog,
  ExpenseCategory,
  FirmAccount,
} from '../../types';
import {
  X,
  Receipt,
  User,
  Calendar,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Landmark,
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface EnrollExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  firm: TenantFirm;
  project: Project;
  partners: SyndicatePartner[];
  firmAccounts?: FirmAccount[];
  onEnrollExpense: (expense: FieldExpenseLog, bankAccountId?: string) => void;
}

export const EnrollExpenseModal: React.FC<EnrollExpenseModalProps> = ({
  isOpen,
  onClose,
  firm,
  project,
  partners,
  firmAccounts = [],
  onEnrollExpense,
}) => {
  // Filter accounts for this firm & project
  const projectAccounts = (firmAccounts || []).filter(
    (a) =>
      a.firmId === firm.id &&
      (!a.linkedProjectId || a.linkedProjectId === 'all' || a.linkedProjectId === project.id)
  );

  const [partnerId, setPartnerId] = useState<string>(partners[0]?.id || 'accountant');
  const [paymentSource, setPaymentSource] = useState<'project_bank' | 'individual'>('project_bank');
  const [bankAccountId, setBankAccountId] = useState<string>(projectAccounts[0]?.id || '');
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState<ExpenseCategory>('Labor Wages');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [taxInvoiceNo, setTaxInvoiceNo] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('Cash / Spot Voucher');
  const [initialStatus, setInitialStatus] = useState<'pending' | 'approved'>('approved');

  if (!isOpen) return null;

  const selectedPartner = partners.find((p) => p.id === partnerId);
  const enrolledName =
    selectedPartner ? selectedPartner.name : `${firm.accountantName || 'Accountant'} (Accountant)`;

  const chosenAccount = projectAccounts.find((a) => a.id === bankAccountId) || projectAccounts[0];
  const numAmount = typeof amount === 'number' ? amount : 0;
  const isHighValue = numAmount > 10000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) {
      alert('Please enter a valid expense amount greater than ₹0.');
      return;
    }

    const newExpense: FieldExpenseLog = {
      id: `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      firmId: firm.id,
      projectId: project.id,
      partnerId: partnerId,
      partnerName: enrolledName,
      amount: numAmount,
      category,
      date,
      note: note.trim() || `Project expense for ${category}`,
      status: initialStatus,
      reconciledDate: initialStatus === 'approved' ? date : undefined,
      reconciledBy: initialStatus === 'approved' ? `${firm.accountantName || 'Accountant'} (Accountant)` : undefined,
      requiresManagingPartnerSignoff: isHighValue && initialStatus === 'pending',
      approvedByPartners: initialStatus === 'approved' ? [firm.managingPartnerName || 'Managing Partner'] : undefined,
      taxInvoiceNo: taxInvoiceNo.trim() || undefined,
      vendorName: vendorName.trim() || undefined,
      paymentMode,
      paymentSource,
      bankAccountId: paymentSource === 'project_bank' ? (chosenAccount?.id || bankAccountId) : undefined,
      bankAccountName: paymentSource === 'project_bank' ? chosenAccount?.accountName : 'Partner Individual Funds',
      hasVoiceNote: false,
      enrolledBy: enrolledName,
    };

    onEnrollExpense(newExpense, paymentSource === 'project_bank' ? (chosenAccount?.id || undefined) : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-950 text-amber-400 flex items-center justify-center font-black">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-gray-950 text-base leading-tight">
                Enroll Project Expenses
              </h3>
              <p className="text-[11px] text-gray-900 font-semibold">
                {project.name} ({project.code}) • {firm.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-950 font-bold transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Payment Source: Project Bank vs Individual Personal Pocket */}
          <div className="bg-amber-50/70 rounded-2xl p-3.5 border border-amber-300 space-y-3">
            <div>
              <label className="block text-[11px] font-black text-amber-950 uppercase mb-1.5 flex items-center justify-between">
                <span>Payment Source (Who / Which Account Paid) *</span>
                <span className="text-[10px] text-amber-800 font-bold">Wages / Site Outlays</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource('project_bank')}
                  className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    paymentSource === 'project_bank'
                      ? 'bg-[#111827] text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-700 border-amber-200 hover:bg-amber-100/50'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5 text-amber-400" />
                  <span>Project Bank A/C</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource('individual')}
                  className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    paymentSource === 'individual'
                      ? 'bg-[#111827] text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-700 border-amber-200 hover:bg-amber-100/50'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Individual / Partner Funds</span>
                </button>
              </div>
            </div>

            {paymentSource === 'project_bank' ? (
              <div>
                <label className="block text-[11px] font-black text-amber-950 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-amber-700" />
                    <span>Select Project Bank Account to Debit *</span>
                  </span>
                  {chosenAccount && (
                    <span className="font-mono text-[10px] text-amber-900 font-bold">
                      Avail Bal: {formatINR(chosenAccount.currentBalance)}
                    </span>
                  )}
                </label>
                <select
                  value={bankAccountId || chosenAccount?.id}
                  onChange={(e) => setBankAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                >
                  {projectAccounts.length === 0 && (
                    <option value="">Cash Treasury / Site Imprest (General Treasury)</option>
                  )}
                  {projectAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bankName} - {acc.accountName} (A/C: ...{acc.accountNumber.slice(-4)}) — Bal: {formatINR(acc.currentBalance)}
                    </option>
                  ))}
                </select>
                {chosenAccount && numAmount > 0 && (
                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono font-semibold text-amber-950 bg-white/80 p-2 rounded-lg border border-amber-200">
                    <span>Projected Treasury Bal After Debit:</span>
                    <span className={chosenAccount.currentBalance - numAmount < 0 ? 'text-rose-700 font-black' : 'text-emerald-700 font-black'}>
                      {formatINR(chosenAccount.currentBalance - numAmount)} (-{formatINR(numAmount)})
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200 text-[11px] text-gray-700 space-y-1">
                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  <span>Paid from {enrolledName}&apos;s Personal Pocket</span>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Project bank balance will not be debited immediately. Recorded as partner reimbursable site expenditure in the consensus equity passbook.
                </p>
              </div>
            )}
          </div>

          {/* 1. Date & Enrolled By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Date of Expense *</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-amber-600" />
                <span>Spender / Enrolled By *</span>
              </label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.roleDescription || 'Partner'})
                  </option>
                ))}
                <option value="accountant">
                  {firm.accountantName || 'Accountant'} (Accountant Central Office)
                </option>
              </select>
            </div>
          </div>

          {/* 2. Category & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Cost Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                <option value="Labor Wages">🔨 Labor Wages (Daily Wages, Masonry)</option>
                <option value="Material">🧱 Material (Sand, Cement, Peg Stones)</option>
                <option value="Fuel">⛽ Fuel (Diesel for Roller, JCB, Tractor)</option>
                <option value="Tractor/Machinery">🚜 Tractor / Machinery Rent</option>
                <option value="Government/Fee">🏛️ Government / Fee (Survey, LP Challan)</option>
                <option value="Food & Batta">🍱 Food &amp; Batta (Worker Food &amp; Travel)</option>
                <option value="Misc">📦 Misc (Hardware, Electrical, Incidentals)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 25000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full pl-7 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black font-mono text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
                />
              </div>
              {numAmount > 0 && (
                <span className="text-[10px] text-amber-800 font-bold block mt-1 font-mono">
                  {formatINR(numAmount)}
                </span>
              )}
            </div>
          </div>

          {/* 3. Vendor Name & Tax Invoice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Vendor / Contractor Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sri Krishna River Sands"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Bill / Voucher / Invoice #
              </label>
              <input
                type="text"
                placeholder="e.g. VCH-2026-89"
                value={taxInvoiceNo}
                onChange={(e) => setTaxInvoiceNo(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>
          </div>

          {/* 4. Payment Mode & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Disbursement Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                <option value="Cash / Spot Voucher">Cash / Site Imprest Voucher</option>
                <option value="UPI / Online">UPI / PhonePe / GPay</option>
                <option value="RTGS / NEFT">Bank Transfer (RTGS / NEFT)</option>
                <option value="Cheque">Bank Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                Approval Workflow
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                <option value="approved">✓ Direct Fast-Approve &amp; Settle (Immediate Debit)</option>
                <option value="pending">⏳ Send to Verification Queue (Pending)</option>
              </select>
            </div>
          </div>

          {/* 5. Narration / Note */}
          <div>
            <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
              Expense Narration / Work Details *
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Spot payment for 3 tractor loads of gravel and boundary demarcation peg stones along 40ft road section."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none resize-none"
            />
          </div>

          {/* High-value compliance notice */}
          {isHighValue && initialStatus === 'pending' && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 flex items-start gap-2 text-amber-900 text-[11px]">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>High-Value Outlay (&gt; ₹10,000):</strong> This expense requires Managing Partner consensus signoff or multi-partner approval before reconciling into the partner capital ledger.
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <Receipt className="w-4 h-4 text-gray-950" />
              <span>Enroll Project Expenses</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
