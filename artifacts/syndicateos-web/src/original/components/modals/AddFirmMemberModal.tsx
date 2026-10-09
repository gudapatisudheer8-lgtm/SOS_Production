import React, { useState } from 'react';
import { TenantFirm, SyndicatePartner } from '../../types';
import {
  UserPlus,
  X,
  Smartphone,
  ShieldCheck,
  Building2,
  Key,
  DollarSign,
  Phone,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';

interface AddFirmMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  firm: TenantFirm;
  onAddMember: (newPartner: SyndicatePartner) => void;
}

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-indigo-600',
  'bg-amber-600',
  'bg-sky-600',
  'bg-purple-600',
  'bg-rose-600',
  'bg-teal-600',
  'bg-cyan-600'
];

export const AddFirmMemberModal: React.FC<AddFirmMemberModalProps> = ({
  isOpen,
  onClose,
  firm,
  onAddMember,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91 ');
  const [roleDescription, setRoleDescription] = useState('Site Operations & Field Lead');
  const [initialCapital, setInitialCapital] = useState('1000000');
  const [fixedEquityPercent, setFixedEquityPercent] = useState('10.0');
  const [dailySpendingLimit, setDailySpendingLimit] = useState('50000');
  const [pinCode, setPinCode] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [userRole, setUserRole] = useState<'field_partner' | 'site_supervisor' | 'investor_partner'>('field_partner');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerateRandomPin = () => {
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    setPinCode(random);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter the partner/member full name.');
      return;
    }

    if (!phone.trim() || phone.trim() === '+91') {
      setError('Please enter a valid mobile number for field communications.');
      return;
    }

    if (!pinCode || pinCode.length !== 4 || !/^\d{4}$/.test(pinCode)) {
      setError('Please provide a 4-digit numeric login PIN for the Field Partner.');
      return;
    }

    const capitalNum = parseFloat(initialCapital) || 0;
    const equityNum = parseFloat(fixedEquityPercent) || 0;
    const limitNum = parseFloat(dailySpendingLimit) || 50000;

    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const newPartner: SyndicatePartner = {
      id: `partner-${Date.now()}`,
      firmId: firm.id,
      name: name.trim(),
      phone: phone.trim(),
      roleDescription: roleDescription.trim() || 'Field Partner',
      avatarColor: randomColor,
      initialCapital: capitalNum,
      fixedEquityPercent: equityNum,
      drawings: 0,
      shareOfFieldExpenses: 0,
      userRole,
      userStatus: 'active',
      pinCode: pinCode.trim(),
      dailySpendingLimit: limitNum,
      addedDate: new Date().toISOString().split('T')[0],
      addedBy: `${firm.accountantName} (Accountant)`,
    };

    onAddMember(newPartner);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-amber-300 max-w-xl w-full overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#FFB800] text-gray-950 p-5 flex items-start justify-between border-b border-amber-500/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#111827] text-[#FFB800] flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-extrabold bg-[#111827] text-white px-2 py-0.5 rounded-full inline-block">
                Firm Accountant Member Provisioning
              </div>
              <h3 className="text-lg font-black text-gray-950 mt-0.5">
                Add Member as Field Partner User
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-950 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Isolation & Firm Notice Banner */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-300/80 rounded-2xl flex items-start gap-3">
            <Building2 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-gray-800">
              <span className="font-bold text-gray-950 block">
                Assigning to Syndicate Firm: {firm.name} ({firm.code})
              </span>
              <span className="text-[11px] text-gray-600 block mt-0.5">
                This member will be added strictly under <strong>{firm.name}</strong>. During Field Partner mobile login, when selecting this firm, they can authenticate and view only this firm's plots, inventory, and expense ledgers.
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-bold">
              {error}
            </div>
          )}

          {/* Row 1: Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-bold mb-1">
                Full Name of Partner / Member: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. G. Ramesh Reddy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#F4F4F6] border border-gray-300 rounded-2xl p-2.5 text-xs text-gray-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">
                Mobile Number: <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="+91 98480 12345"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#F4F4F6] border border-gray-300 rounded-2xl p-2.5 pl-8 text-xs text-gray-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Field Role & User Account Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-bold mb-1">
                Field Designation / Role Description:
              </label>
              <input
                type="text"
                placeholder="e.g. Site Operations Lead & Machinery Liaison"
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                className="w-full bg-[#F4F4F6] border border-gray-300 rounded-2xl p-2.5 text-xs text-gray-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">
                Member User Type:
              </label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as any)}
                className="w-full bg-[#F4F4F6] border border-gray-300 rounded-2xl p-2.5 text-xs text-gray-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="field_partner">Active Field Partner (On-Site & Sales)</option>
                <option value="site_supervisor">Site Supervisor & Petty Cash Custodian</option>
                <option value="investor_partner">Investor Partner with Field Access</option>
              </select>
            </div>
          </div>

          {/* Row 3: Capital & Agreed Share */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-bold mb-1">
                Capital Estimated Invest Value (₹):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(e.target.value)}
                  className="w-full bg-[#F4F4F6] border border-gray-300 rounded-2xl p-2.5 pl-7 text-xs text-gray-950 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">
                Agreed Equity / Profit Share (%):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={fixedEquityPercent}
                  onChange={(e) => setFixedEquityPercent(e.target.value)}
                  className="w-full bg-[#F4F4F6] border border-gray-300 rounded-2xl p-2.5 pr-7 text-xs text-gray-950 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">%</span>
              </div>
            </div>
          </div>

          {/* Row 4: Login PIN & Daily Spending Limit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-gray-900 font-bold flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  <span>4-Digit Mobile Login PIN:</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateRandomPin}
                  className="text-[10px] text-amber-700 hover:text-amber-900 font-bold underline"
                >
                  Generate New
                </button>
              </div>
              <input
                type="text"
                maxLength={4}
                required
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                placeholder="4-digit PIN"
                className="w-full bg-white border border-gray-300 rounded-xl p-2 text-center text-base tracking-widest font-mono font-black text-gray-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
              />
              <span className="text-[10px] text-gray-500 block mt-1">
                The field partner will use this PIN to log into this firm.
              </span>
            </div>

            <div>
              <label className="block text-gray-900 font-bold mb-1">
                Daily Field Cash Limit (₹):
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-gray-400 font-bold">₹</span>
                <input
                  type="number"
                  min="5000"
                  step="5000"
                  value={dailySpendingLimit}
                  onChange={(e) => setDailySpendingLimit(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2 pl-7 text-xs text-gray-950 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                />
              </div>
              <span className="text-[10px] text-gray-500 block mt-1">
                Discretionary spot outlay limit before requiring consensus.
              </span>
            </div>
          </div>

          {/* Quick Summary Preview */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Tenant Isolation: User will be bound to <strong>{firm.code}</strong>.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
              Active User Status
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-bold transition-all text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-confirm-add-firm-member"
              className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 rounded-full font-black flex items-center gap-2 shadow-md transition-all active:scale-95 text-xs border border-amber-600/30"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Member as Field Partner User</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
