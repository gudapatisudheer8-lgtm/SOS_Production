import React, { useState } from 'react';
import { FirmAccount, FirmAccountTransaction, TenantFirm } from '../../types';
import {
  Landmark,
  X,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  Copy,
  Check,
  Calendar,
  Tag,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface FirmAccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: FirmAccount;
  firm: TenantFirm;
  onAddTransaction: (accountId: string, tx: FirmAccountTransaction) => void;
}

export const FirmAccountStatementModal: React.FC<FirmAccountStatementModalProps> = ({
  isOpen,
  onClose,
  account,
  firm,
  onAddTransaction,
}) => {
  const [showAddTx, setShowAddTx] = useState(false);
  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txDesc, setTxDesc] = useState('');
  const [txRef, setTxRef] = useState('');
  const [txCategory, setTxCategory] = useState<FirmAccountTransaction['category']>('partner_capital');
  const [txPartner, setTxPartner] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(`${account.accountNumber} (${account.ifscCode})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRecordTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || txAmount <= 0) return;

    const newBalance =
      txType === 'credit'
        ? account.currentBalance + txAmount
        : account.currentBalance - txAmount;

    const newTx: FirmAccountTransaction = {
      id: `tx-${Date.now()}`,
      accountId: account.id,
      date: new Date().toISOString().split('T')[0],
      type: txType,
      amount: txAmount,
      description: txDesc || (txType === 'credit' ? 'Ledger Inflow Credit' : 'Disbursement Payout'),
      referenceNo: txRef || `${account.bankName.substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      category: txCategory,
      partnerName: txPartner || undefined,
      balanceAfter: newBalance,
    };

    onAddTransaction(account.id, newTx);
    setTxAmount(0);
    setTxDesc('');
    setTxRef('');
    setTxPartner('');
    setShowAddTx(false);
  };

  const transactions = account.recentTransactions || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl max-w-3xl w-full my-4 sm:my-8 shadow-2xl border border-gray-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFB800] flex items-center justify-center text-gray-950 font-black shadow-sm border border-amber-500/40 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                  {account.accountType.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-xs text-gray-500 font-semibold">{account.bankName}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-gray-950">
                {account.accountName}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-950 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Quick Stats Banner */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-950 to-gray-900 text-white p-5 px-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
              Current Available Balance
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
              {formatINR(account.currentBalance)}
            </span>
            <span className="text-xs text-gray-400 block mt-1">
              Opening Balance: {formatINR(account.openingBalance)} • {account.branchName}
            </span>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 bg-gray-800/80 px-3 py-1.5 rounded-xl border border-gray-700">
              <span className="text-xs font-mono text-gray-200">
                A/C: {account.accountNumber}
              </span>
              <span className="text-xs font-mono text-amber-300">
                IFSC: {account.ifscCode}
              </span>
              <button
                onClick={handleCopyAccount}
                className="text-gray-400 hover:text-white p-1 rounded"
                title="Copy A/C & IFSC"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              onClick={() => setShowAddTx(!showAddTx)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{showAddTx ? 'Close Quick Entry' : '+ Record Transaction / Inflow'}</span>
            </button>
          </div>
        </div>

        {/* Quick Add Transaction Form */}
        {showAddTx && (
          <form onSubmit={handleRecordTransaction} className="bg-amber-50/70 p-4 border-b border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-amber-950">Record Deposit or Payout</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setTxType('credit'); setTxCategory('partner_capital'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    txType === 'credit' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  + Credit / Deposit
                </button>
                <button
                  type="button"
                  onClick={() => { setTxType('debit'); setTxCategory('vendor_payout'); }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    txType === 'debit' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  - Debit / Payout
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  value={txAmount || ''}
                  onChange={(e) => setTxAmount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="Amount in ₹"
                  className="w-full text-xs font-mono font-bold border border-gray-300 rounded-xl p-2 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Category</label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value as any)}
                  className="w-full text-xs font-bold border border-gray-300 rounded-xl p-2 bg-white"
                >
                  <option value="partner_capital">Partner Capital Deposit</option>
                  <option value="plot_booking_advance">Plot Booking Advance</option>
                  <option value="vendor_payout">Vendor / Earthwork Payout</option>
                  <option value="statutory_fee">Statutory RERA / LP Fee</option>
                  <option value="cash_withdrawal">Site Cash Vault Imprest</option>
                  <option value="inter_account_transfer">Inter-Account Transfer</option>
                  <option value="other">Other Bank Transaction</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Partner / Depositor Name</label>
                <input
                  type="text"
                  value={txPartner}
                  onChange={(e) => setTxPartner(e.target.value)}
                  placeholder="e.g. Srikanth Reddy"
                  className="w-full text-xs font-medium border border-gray-300 rounded-xl p-2 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Description / Particulars</label>
                <input
                  type="text"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="e.g. Partner A 30% Equity tranche deposit"
                  className="w-full text-xs font-medium border border-gray-300 rounded-xl p-2 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Bank UTR / Chq / Ref No.</label>
                <input
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  placeholder="e.g. RTGS-SBI-8829104"
                  className="w-full text-xs font-mono font-medium border border-gray-300 rounded-xl p-2 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddTx(false)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-black text-xs font-bold"
              >
                Save Transaction to Ledger
              </button>
            </div>
          </form>
        )}

        {/* Transaction History Ledger */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span>Recent Ledger Entries & Statements ({transactions.length})</span>
            </h4>
            <span className="text-[11px] text-gray-500 font-medium">
              Verified Against Official Bank Passbook
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
              <Landmark className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-700">No Transactions Recorded Yet</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Click "+ Record Transaction / Inflow" above to enter deposits or payouts.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-4 hover:bg-gray-50/80 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'credit' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tx.type === 'credit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{tx.description}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="font-mono">{tx.referenceNo || 'REF-PENDING'}</span>
                        {tx.partnerName && (
                          <>
                            <span>•</span>
                            <span className="text-gray-700 font-semibold">{tx.partnerName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-xs font-bold font-mono ${
                      tx.type === 'credit' ? 'text-emerald-700' : 'text-red-700'
                    }`}>
                      {tx.type === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
                    </span>
                    <span className="block text-[10px] text-gray-400 font-mono">
                      Bal: {formatINR(tx.balanceAfter)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Signatories & Compliance Footer */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs text-gray-600">
            <span className="font-bold text-gray-800 block mb-1">Authorized Banking Signatories:</span>
            <div className="flex flex-wrap gap-1.5">
              {account.authorizedSignatories.map((sig) => (
                <span key={sig} className="text-[11px] font-medium bg-white px-2 py-0.5 rounded border border-gray-200">
                  {sig}
                </span>
              ))}
            </div>
            {account.notes && (
              <p className="text-[11px] text-gray-500 mt-2 italic">
                Note: {account.notes}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold"
          >
            Close Statement
          </button>
        </div>
      </div>
    </div>
  );
};
