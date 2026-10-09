import React, { useState } from 'react';
import { FieldExpenseLog, SyndicatePartner } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  ShieldAlert,
  CheckCircle2,
  Users,
  Key,
  Mic,
  FileText,
  X,
  AlertTriangle,
  Smartphone
} from 'lucide-react';

interface MultiPartnerApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: FieldExpenseLog | null;
  partners: SyndicatePartner[];
  onConfirmApproval: (expenseId: string, signoffDetails: string) => void;
}

export const MultiPartnerApprovalModal: React.FC<MultiPartnerApprovalModalProps> = ({
  isOpen,
  onClose,
  expense,
  partners,
  onConfirmApproval,
}) => {
  const [partner1, setPartner1] = useState('Partner A: Srikanth Reddy (Managing Partner)');
  const [partner2, setPartner2] = useState('Partner B: K. Venkat Rao');
  const [otpPin, setOtpPin] = useState('7890');
  const [auditNotes, setAuditNotes] = useState('Spot cash field outlay verified against physical work done.');
  const [error, setError] = useState('');

  if (!isOpen || !expense) return null;

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPin || otpPin.length < 4) {
      setError('Please enter a valid 4-digit partner verification PIN.');
      return;
    }
    const signature = `${partner1} & ${partner2} (Digital Consensus Auth PIN: ${otpPin})`;
    onConfirmApproval(expense.id, signature);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-amber-300 max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#FFB800] text-gray-950 p-5 flex items-start justify-between border-b border-amber-500/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#111827] text-white flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-[#FFB800]" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-extrabold bg-[#111827] text-white px-2 py-0.5 rounded-full inline-block">
                High-Value Field Outlay (&gt; ₹10,000)
              </div>
              <h3 className="text-lg font-black mt-0.5">Multi-Partner Consensus Sign-Off</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-black/10 transition-colors text-gray-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleApprove} className="p-6 space-y-5">
          {/* Amount and Threshold Alert */}
          <div className="bg-[#FFFDF0] border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-gray-500 block font-bold uppercase">Expense Amount</span>
              <span className="text-2xl font-black text-gray-950">{formatINR(expense.amount)}</span>
              <span className="text-[10px] text-amber-700 block font-medium mt-0.5">
                Exceeds ₹10,000 threshold • Requires Managing Partner digital sign-off
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-gray-500 block font-bold uppercase">Category</span>
              <span className="text-xs font-black text-gray-900 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                {expense.category}
              </span>
            </div>
          </div>

          {/* Expense Details Breakdown */}
          <div className="space-y-2 bg-[#F4F4F6] p-4 rounded-2xl text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Logged By:</span>
              <span className="font-bold text-gray-900">{expense.partnerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Date:</span>
              <span className="font-mono font-semibold text-gray-900">{expense.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Site Device ID:</span>
              <span className="font-mono text-[11px] text-gray-600 flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-gray-400" />
                {expense.deviceId || 'SM-S928B (Field Partner Device)'}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <span className="text-gray-500 block mb-1 font-medium">Field Partner Field Note:</span>
              <p className="italic text-gray-800 bg-white p-2.5 rounded-xl border border-gray-200">
                "{expense.note}"
              </p>
            </div>
            {expense.hasVoiceNote && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-xl text-amber-900 font-medium text-[11px] border border-amber-200">
                <Mic className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Voice Memo Attached: "సైట్ వద్ద లేబర్ టీ కూలీలు & డీజిల్ కోసం చెల్లించాను"</span>
              </div>
            )}
          </div>

          {/* Partner Consensus Selection */}
          <div className="space-y-3 pt-1 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <label className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Quorum Digital Signatures
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Signer 1 (Managing Partner):</label>
                <select
                  value={partner1}
                  onChange={(e) => setPartner1(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 font-medium text-gray-900 text-xs focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Partner A: Srikanth Reddy (Managing Partner)">Partner A: Srikanth Reddy (MP)</option>
                  <option value="Partner B: K. Venkat Rao">Partner B: K. Venkat Rao</option>
                  <option value="Partner C: Rajesh Varma">Partner C: Rajesh Varma</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Signer 2 (Co-Partner):</label>
                <select
                  value={partner2}
                  onChange={(e) => setPartner2(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 font-medium text-gray-900 text-xs focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Partner B: K. Venkat Rao">Partner B: K. Venkat Rao</option>
                  <option value="Partner C: Rajesh Varma">Partner C: Rajesh Varma</option>
                  <option value="Partner D: Murali Krishna">Partner D: Murali Krishna</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-500 block mb-1">
                Executive Authorization PIN (Enter 4 Digits):
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  value={otpPin}
                  onChange={(e) => {
                    setOtpPin(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 pl-9 text-xs font-mono font-bold tracking-widest text-gray-900 focus:ring-2 focus:ring-amber-500"
                  placeholder="••••"
                  autoFocus
                />
                <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
              {error && <p className="text-[11px] text-red-600 mt-1 font-medium">{error}</p>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-extrabold text-gray-950 bg-[#FFB800] hover:bg-amber-400 rounded-full shadow-md transition-all flex items-center gap-1.5 active:scale-95 border border-amber-600/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Authorize & Reconcile to Ledger</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
