import React, { useState } from 'react';
import { FirmAccount, FirmAccountType, TenantFirm, Project } from '../../types';
import {
  Building2,
  X,
  CreditCard,
  ShieldCheck,
  Landmark,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Lock,
  Wallet,
  ArrowRight,
  PlusCircle
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface AddFirmAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  firm: TenantFirm;
  projects: Project[];
  activeProjectId?: string;
  onAddAccount: (account: FirmAccount) => void;
}

const BANK_OPTIONS = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank',
  'Canara Bank',
  'Union Bank of India',
  'Bank of Baroda',
  'IndusInd Bank',
  'Federal Bank',
  'Syndicate Cash Vault',
  'Other Commercial Bank'
];

export const AddFirmAccountModal: React.FC<AddFirmAccountModalProps> = ({
  isOpen,
  onClose,
  firm,
  projects,
  activeProjectId,
  onAddAccount,
}) => {
  const firmProjects = projects.filter((p) => p.firmId === firm.id);
  const [targetProjectId, setTargetProjectId] = useState<string>(
    activeProjectId || firmProjects[0]?.id || ''
  );
  const currentProject = projects.find((p) => p.id === (targetProjectId || activeProjectId));

  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('State Bank of India');
  const [accountType, setAccountType] = useState<FirmAccountType>('rera_escrow');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [city, setCity] = useState(firm.state === 'Andhra Pradesh' ? 'Vijayawada' : 'Hyderabad');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [upiId, setUpiId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');
  const [signatories, setSignatories] = useState<string[]>([
    `${firm.accountantName || 'Accountant'} (Accountant)`
  ]);
  const [newSignatoryInput, setNewSignatoryInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Auto-generate suggested account name
  const handleBankOrTypeChange = (newBank: string, newType: FirmAccountType) => {
    setBankName(newBank);
    setAccountType(newType);
    if (!accountName || accountName.includes('Account')) {
      const typeLabel = 
        newType === 'rera_escrow' ? 'RERA Escrow' :
        newType === 'syndicate_capital_pool' ? 'Syndicate Capital Pool' :
        newType === 'current_operational' ? 'Current Operational' :
        newType === 'field_petty_cash' ? 'Site Petty Cash Treasury' : 'Tax & Statutory';
      const suffix = currentProject ? currentProject.code : firm.code;
      setAccountName(`${newBank === 'Syndicate Cash Vault' ? 'Field Cash Vault' : newBank} ${typeLabel} - ${suffix}`);
    }
  };

  const handleAddSignatory = () => {
    if (newSignatoryInput.trim() && !signatories.includes(newSignatoryInput.trim())) {
      setSignatories([...signatories, newSignatoryInput.trim()]);
      setNewSignatoryInput('');
    }
  };

  const handleRemoveSignatory = (sig: string) => {
    setSignatories(signatories.filter((s) => s !== sig));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!accountName.trim()) {
      setError('Please provide a descriptive Account Name or Title.');
      return;
    }

    if (accountType !== 'field_petty_cash') {
      if (!accountNumber.trim()) {
        setError('Please enter a valid Account Number.');
        return;
      }
      if (accountNumber.trim() !== confirmAccountNumber.trim()) {
        setError('Account Number and Confirm Account Number do not match.');
        return;
      }
      if (!ifscCode.trim()) {
        setError('Please enter the bank IFSC code.');
        return;
      }
    }

    const resolvedProjectId = targetProjectId || activeProjectId || '';

    if (accountType !== 'field_petty_cash' && firmProjects.length > 0 && !resolvedProjectId) {
      setError('Please select which Project this bank account belongs to.');
      return;
    }

    const newAccount: FirmAccount = {
      id: `acc-${firm.code.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-5)}`,
      firmId: firm.id,
      accountName: accountName.trim(),
      bankName: accountType === 'field_petty_cash' && bankName !== 'Syndicate Cash Vault' ? 'Syndicate Cash Vault' : bankName,
      accountType,
      accountNumber: accountType === 'field_petty_cash' ? (accountNumber.trim() || `VAULT-${firm.code}-${Date.now().toString().slice(-4)}`) : accountNumber.trim(),
      ifscCode: accountType === 'field_petty_cash' ? (ifscCode.trim() || 'CASH0000001') : ifscCode.trim().toUpperCase(),
      branchName: branchName.trim() || (accountType === 'field_petty_cash' ? 'Project Site Office' : 'Main Commercial Branch'),
      city: city.trim() || firm.location,
      currentBalance: Math.max(0, Number(openingBalance) || 0),
      openingBalance: Math.max(0, Number(openingBalance) || 0),
      upiId: upiId.trim() || undefined,
      linkedProjectId: resolvedProjectId,
      isPrimary,
      status: 'active',
      authorizedSignatories: signatories.length > 0 ? signatories : [`${firm.managingPartnerName} (Managing Partner)`],
      createdDate: new Date().toISOString().split('T')[0],
      notes: notes.trim() || undefined,
      recentTransactions: openingBalance > 0 ? [
        {
          id: `tx-init-${Date.now()}`,
          accountId: '',
          date: new Date().toISOString().split('T')[0],
          type: 'credit',
          amount: Number(openingBalance),
          description: `Initial Opening Balance Ledger Credit`,
          category: accountType === 'syndicate_capital_pool' ? 'partner_capital' : 'interest_credit',
          balanceAfter: Number(openingBalance),
        }
      ] : []
    };

    onAddAccount(newAccount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl max-w-3xl w-full my-4 sm:my-8 shadow-2xl border border-gray-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header - Fixed & Pinned at Top */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-amber-400 font-black shadow-sm shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-amber-400">
                  Project Account
                </span>
                {currentProject && (
                  <span className="text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200">
                    [{currentProject.code}] {currentProject.name}
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-black text-gray-950 flex items-center gap-2 mt-0.5">
                + Add Project Account
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-900 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Associated Project Designation (Mapped to Project Only) */}
          {firmProjects.length > 0 && (
            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Designated Project / Venture</span>
                </label>
                <span className="text-[10px] font-bold text-gray-500 uppercase">Project Isolation</span>
              </div>
              <select
                value={targetProjectId}
                onChange={(e) => {
                  setTargetProjectId(e.target.value);
                  const selectedProj = projects.find((p) => p.id === e.target.value);
                  if (selectedProj && (!accountName || accountName.includes(' - '))) {
                    const typeLabel =
                      accountType === 'rera_escrow' ? 'RERA Escrow' :
                      accountType === 'syndicate_capital_pool' ? 'Syndicate Capital Pool' :
                      accountType === 'current_operational' ? 'Current Operational' :
                      accountType === 'field_petty_cash' ? 'Site Petty Cash Treasury' : 'Tax & Statutory';
                    setAccountName(`${bankName === 'Syndicate Cash Vault' ? 'Field Cash Vault' : bankName} ${typeLabel} - ${selectedProj.code}`);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              >
                {firmProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Account Details & Bank Selection */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-gray-600" />
              <span>Banking Institution &amp; Account Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Project Account Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={accountType}
                  onChange={(e) => handleBankOrTypeChange(bankName, e.target.value as FirmAccountType)}
                  className="w-full text-xs font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                >
                  <option value="rera_escrow">RERA Statutory Escrow (70% protected)</option>
                  <option value="syndicate_capital_pool">Syndicate Capital Pool (Partner Equity)</option>
                  <option value="current_operational">Commercial Current A/c (Operations &amp; Vendor)</option>
                  <option value="field_petty_cash">Site Petty Cash Treasury (Cash Imprest)</option>
                  <option value="tax_statutory">Tax &amp; GST Statutory</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Bank / Depository Institution <span className="text-red-500">*</span>
                </label>
                <select
                  value={bankName}
                  onChange={(e) => handleBankOrTypeChange(e.target.value, accountType)}
                  className="w-full text-xs font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                >
                  {BANK_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Account Name / Display Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. SBI RERA Escrow - Amaravati Phase 1"
                  className="w-full text-xs font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              {accountType !== 'field_petty_cash' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Bank Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                      placeholder="e.g. 39201948201"
                      className="w-full text-xs font-mono font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none tracking-wider"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Confirm Bank Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Re-enter account number"
                      className="w-full text-xs font-mono font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none tracking-wider"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      IFSC Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. SBIN0001234 or HDFC0000240"
                      maxLength={11}
                      className="w-full text-xs font-mono font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none uppercase"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Branch Name & City
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. MG Road Branch, Vijayawada"
                  className="w-full text-xs font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Opening Ledger Balance (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={openingBalance || ''}
                  onChange={(e) => setOpeningBalance(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full text-xs font-mono font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 font-medium mt-1 block">
                  Amount in words: <strong className="text-gray-900">{formatINR(openingBalance)}</strong>
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  UPI ID / QR VPA (Optional)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                  placeholder="e.g. firmname.rera@sbi"
                  className="w-full text-xs font-bold text-gray-900 border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">
                      Mark as Primary Settlement Account
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      Default account selected for sales bookings, advance receipts, and vendor payouts
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Authorized Signatories */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-gray-600" />
              <span>3. Authorized Banking Signatories &amp; Approvers</span>
            </h4>

            <div className="flex flex-wrap gap-2 items-center">
              {signatories.map((sig) => (
                <span
                  key={sig}
                  className="text-xs font-bold bg-gray-100 text-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{sig}</span>
                  {signatories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSignatory(sig)}
                      className="text-gray-400 hover:text-red-600 ml-1"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSignatoryInput}
                onChange={(e) => setNewSignatoryInput(e.target.value)}
                placeholder="+ Add another partner / authorized signatory name"
                className="flex-1 text-xs font-medium text-gray-900 border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSignatory}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors"
              >
                + Add Signatory
              </button>
            </div>
          </div>

          {/* Section 4: Notes & Statutory Reference */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Internal Notes &amp; Statutory Reference (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dedicated escrow account under AP-RERA registration. Dual signatures mandatory for cheques above ₹5 Lakhs."
              className="w-full text-xs font-medium text-gray-900 border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-500/40 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Save &amp; Register Bank Account</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
