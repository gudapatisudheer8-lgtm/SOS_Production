import React, { useState, useEffect } from 'react';
import {
  TenantFirm,
  Project,
  SyndicatePartner,
  FirmAccount,
} from '../../types';
import {
  X,
  Coins,
  Calendar,
  Landmark,
  User,
  CreditCard,
  FileText,
  AlertCircle,
  TrendingUp,
  Briefcase,
  Hash,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Wallet,
  Building,
  Key,
  Users,
  Eye,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export interface IndividualInvestmentData {
  partnerId: string;
  partnerName: string;
  amount: number;
  accountId: string;
  accountName: string;
  accountType: 'bank' | 'cash';
  date: string;
  purpose: string;
  paymentMode: string;
  referenceNo: string;
  notes: string;
  status: 'approved' | 'pending';
  approvedBy?: string;
  approvedAt?: string;
  coSignatory?: string;
  witnessName?: string;
  cashVaultLocation?: string;
  proofSlip?: string;
}

interface IndividualInvestmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  firm: TenantFirm;
  project: Project;
  partners: SyndicatePartner[];
  firmAccounts: FirmAccount[];
  onRecordInvestment: (data: IndividualInvestmentData) => void;
  preSelectedPartnerId?: string;
  initiatorRole?: 'accountant' | 'field_partner' | 'managing_partner';
}

const COMMON_PURPOSES = [
  'Land Purchase & Procurement (Farmer / Landowner Advance)',
  'SRO Sub-Registrar Registration & Stamp Duty',
  'Civil & Earthwork Mobilization',
  'Layout Survey & DTCP/HMDA Approval Fee',
  'Boundary Wall & Plot Demarcation Pegs',
  'Working Capital & Operational Infusion',
  'Partner Equity Tranche Infusion',
  'Road Infrastructure, CC Roads & Asphalt Work',
  'Electricity Transformer & Water Pipeline Outlay',
];

const CASH_ACCOUNTS = [
  {
    id: 'cash_main_vault',
    name: '💵 Cash in Hand / Main Office Cash Vault & Safe',
    category: 'Venture Office Vault',
    baseBal: 6500000,
  },
  {
    id: 'cash_site_vault',
    name: '💵 Cash in Hand / Site Office Imprest Cash (Mangalagiri Site)',
    category: 'Field Site Cash Box',
    baseBal: 2400000,
  },
  {
    id: 'cash_sro_deal',
    name: '💵 Cash in Hand / Direct Landowner / SRO Spot Cash Settlement',
    category: 'Procurement Spot Cash',
    baseBal: 4000000,
  },
  {
    id: 'cash_field_imprest',
    name: '💵 Cash in Hand / Field Partner Imprest Treasury',
    category: 'Partner Imprest',
    baseBal: 1200000,
  },
];

export const IndividualInvestmentModal: React.FC<IndividualInvestmentModalProps> = ({
  isOpen,
  onClose,
  firm,
  project,
  partners,
  firmAccounts,
  onRecordInvestment,
  preSelectedPartnerId,
  initiatorRole = 'accountant',
}) => {
  // Filter bank accounts for this firm & project
  const projectBankAccounts = (firmAccounts || []).filter(
    (a) =>
      a.firmId === firm.id &&
      (!a.linkedProjectId || a.linkedProjectId === 'all' || a.linkedProjectId === project.id) &&
      a.accountType !== 'field_petty_cash'
  );

  const existingCashAccount = (firmAccounts || []).find((a) => a.accountType === 'field_petty_cash');
  const cashVaultBalance = existingCashAccount?.currentBalance ?? 4500000;

  const defaultPartnerId = preSelectedPartnerId || partners[0]?.id || 'partner-custom';
  const defaultAccountId = 'cash_main_vault';

  const [partnerId, setPartnerId] = useState<string>(defaultPartnerId);
  const [customPartnerName, setCustomPartnerName] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [accountId, setAccountId] = useState<string>(defaultAccountId);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [purpose, setPurpose] = useState<string>('Land Purchase & Procurement (Farmer / Landowner Advance)');
  const [customPurpose, setCustomPurpose] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('💵 Cash - Direct Currency Handover to Promoter / MD');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // Cash Specific details
  const [cashWitness, setCashWitness] = useState<string>(
    firm.managingPartnerName ? `${firm.managingPartnerName} (Managing Partner)` : 'Site Operations Lead'
  );
  const [cashDenominations, setCashDenominations] = useState<string>('₹500 Notes Bundles');

  // Approval Process & Syndicate Consensus
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'pending'>(
    initiatorRole === 'field_partner' ? 'pending' : 'approved'
  );
  const [approverSignatory, setApproverSignatory] = useState<string>(
    firm.managingPartnerName ? `${firm.managingPartnerName} (Managing Partner)` : 'Srikanth Reddy (Managing Partner)'
  );
  const [coSignatory, setCoSignatory] = useState<string>(
    partners.length > 1 ? partners[1].name : 'K. Venkat Rao (Consensus Partner)'
  );
  const [authPin, setAuthPin] = useState<string>('7890');

  useEffect(() => {
    if (preSelectedPartnerId) {
      setPartnerId(preSelectedPartnerId);
    }
  }, [preSelectedPartnerId]);

  if (!isOpen) return null;

  const numAmount = typeof amount === 'number' ? amount : 0;
  const isCustomPartner = partnerId === 'partner-custom';
  const selectedPartner = partners.find((p) => p.id === partnerId);
  const finalPartnerName = isCustomPartner
    ? customPartnerName.trim() || 'External Syndicate Investor'
    : selectedPartner?.name || 'Syndicate Partner';

  const isCashAccount = accountId.startsWith('cash_') || accountId === existingCashAccount?.id;
  
  // Calculate display balance for chosen account
  let currentBal = 0;
  let chosenAccountName = '';
  if (isCashAccount) {
    const cashEntry = CASH_ACCOUNTS.find((c) => c.id === accountId);
    chosenAccountName = cashEntry?.name || 'Cash in Hand / Main Office Cash Vault & Safe';
    currentBal = existingCashAccount?.currentBalance ?? (cashEntry?.baseBal || cashVaultBalance);
  } else {
    const bAcc = projectBankAccounts.find((a) => a.id === accountId) || projectBankAccounts[0];
    chosenAccountName = bAcc ? `${bAcc.bankName} - ${bAcc.accountName}` : 'Primary Project Account';
    currentBal = bAcc?.currentBalance || 0;
  }

  const finalPurpose = purpose === 'Other Custom Outlay' ? customPurpose.trim() || 'Project Investment' : purpose;

  const handleAccountChange = (val: string) => {
    setAccountId(val);
    if (val.startsWith('cash_') || val === existingCashAccount?.id) {
      setPaymentMode('💵 Cash - Direct Currency Handover to Promoter / MD');
      if (!referenceNo || referenceNo.startsWith('UTR-') || referenceNo.startsWith('RTGS-')) {
        setReferenceNo(`CASH-VCH-${Date.now().toString().slice(-6)}`);
      }
    } else {
      setPaymentMode('🏦 Bank Wire (RTGS / NEFT)');
      if (!referenceNo || referenceNo.startsWith('CASH-')) {
        setReferenceNo(`UTR-${Date.now().toString().slice(-7)}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) {
      alert('Please enter a valid investment amount greater than ₹0.');
      return;
    }
    if (isCustomPartner && !customPartnerName.trim()) {
      alert('Please enter the investor/partner name.');
      return;
    }

    const payload: IndividualInvestmentData = {
      partnerId: isCustomPartner ? `partner-ext-${Date.now()}` : partnerId,
      partnerName: finalPartnerName,
      amount: numAmount,
      accountId: isCashAccount ? (existingCashAccount?.id || accountId) : accountId,
      accountName: chosenAccountName,
      accountType: isCashAccount ? 'cash' : 'bank',
      date,
      purpose: finalPurpose,
      paymentMode,
      referenceNo: referenceNo.trim() || (isCashAccount ? `CASH-REC-${Date.now().toString().slice(-6)}` : `UTR-${Date.now().toString().slice(-7)}`),
      notes: notes.trim() || `Individual capital investment by ${finalPartnerName} for ${finalPurpose}${isCashAccount ? ` [Cash Handover witnessed by: ${cashWitness}]` : ''}`,
      status: approvalStatus,
      approvedBy: approvalStatus === 'approved' ? approverSignatory : undefined,
      approvedAt: approvalStatus === 'approved' ? new Date().toISOString().replace('T', ' ').slice(0, 16) : undefined,
      coSignatory: approvalStatus === 'approved' ? coSignatory : undefined,
      witnessName: isCashAccount ? cashWitness : undefined,
      cashVaultLocation: isCashAccount ? chosenAccountName : undefined,
    };

    onRecordInvestment(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-2xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 via-[#FFB800] to-amber-500 p-5 flex items-center justify-between border-b border-amber-600/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-950 text-amber-400 flex items-center justify-center font-black shadow-md">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-gray-950 text-base leading-tight">
                  Enroll Individual Partner Investment
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-gray-950 text-amber-400">
                  Dual Cash / Bank
                </span>
              </div>
              <p className="text-[11px] text-gray-900 font-semibold mt-0.5">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs max-h-[82vh] overflow-y-auto">
          {/* Transparency & Approval Banner */}
          <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3 text-gray-900">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-black text-emerald-950 block text-xs">
                Syndicate Capital Enrollment &amp; Transparent Consensus Workflow
              </span>
              Recording an individual investment immediately registers the capital in the chosen <strong>Cash Treasury Vault</strong> or <strong>Bank Account</strong>. It initiates the partner approval process so that all syndicate members have 100% verified transparency on their dashboards.
            </div>
          </div>

          {/* 1. Partner Selection */}
          <div>
            <label className="block text-[11px] font-black text-gray-700 uppercase mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-600" />
                <span>Partner / Syndicate Investor *</span>
              </span>
              <span className="text-[10px] text-gray-500 font-medium lowercase">
                Select partner contributing capital
              </span>
            </label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
            >
              {partners.map((p) => {
                const invested = p.actualInvested !== undefined ? p.actualInvested : 0;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.roleDescription || 'Partner'}) — Invested: {formatINR(invested)} ({p.fixedEquityPercent}%)
                  </option>
                );
              })}
              <option value="partner-custom">+ Add External / New Syndicate Investor</option>
            </select>
          </div>

          {/* If Custom Investor */}
          {isCustomPartner && (
            <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200">
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1">
                New Investor / Partner Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Srikanth Reddy (Capital Lead / Land Aggregator)"
                value={customPartnerName}
                onChange={(e) => setCustomPartnerName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>
          )}

          {/* 2. Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span>Investment Amount (₹) *</span>
                </span>
                {numAmount > 0 && (
                  <span className="text-[10px] text-emerald-800 font-bold font-mono">
                    {formatINR(numAmount)}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 2500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-black font-mono text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Date of Investment / Infusion *</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Destination Account / Treasury (Prominent CASH and BANK choices) */}
          <div className="bg-amber-50/80 rounded-2xl p-4 border border-amber-300 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-amber-950 uppercase flex items-center gap-1.5">
                {isCashAccount ? (
                  <Wallet className="w-4 h-4 text-amber-800" />
                ) : (
                  <Landmark className="w-4 h-4 text-blue-800" />
                )}
                <span>Credited To Treasury Account (Cash Vault / Bank) *</span>
              </label>
              <span className="font-mono text-[10px] text-amber-900 font-bold px-2 py-0.5 bg-amber-200/80 rounded-lg">
                Current Bal: {formatINR(currentBal)}
              </span>
            </div>

            <select
              value={accountId}
              onChange={(e) => handleAccountChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
            >
              {/* GROUP 1: CASH IN HAND / VAULT DROPDOWN VALUES */}
              <optgroup label="💵 CASH IN HAND & SPOT VAULT OPTIONS">
                {CASH_ACCOUNTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.category})
                  </option>
                ))}
              </optgroup>

              {/* GROUP 2: PROJECT BANK ACCOUNTS */}
              <optgroup label="🏦 COMMERCIAL BANK ACCOUNTS (OFFICIAL ESCROW / OPERATIONS)">
                {projectBankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    🏦 {acc.bankName} - {acc.accountName} (A/C ...{acc.accountNumber.slice(-4)}) — Bal: {formatINR(acc.currentBalance)}
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Impact Calculation Preview */}
            {numAmount > 0 && (
              <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-amber-950 bg-white/90 p-2.5 rounded-xl border border-amber-200 shadow-2xs">
                <span className="flex items-center gap-1.5 font-bold">
                  {isCashAccount ? '💵 Projected Cash Vault Balance:' : '🏦 Projected Bank Balance After Credit:'}
                </span>
                <span className="text-emerald-700 font-black">
                  {formatINR(currentBal + numAmount)} (+{formatINR(numAmount)})
                </span>
              </div>
            )}
          </div>

          {/* 4. Cash Handling & Physical Receipt Details (Only when Cash is selected) */}
          {isCashAccount && (
            <div className="bg-amber-100/70 border border-amber-300 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-amber-950 font-black text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-800" />
                  <span>Physical Cash Handover &amp; Spot Custody Protocol</span>
                </span>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded-md">
                  Venture Cash Safe
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">
                    Cash Handover Witness / Custodian *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Srikanth Reddy (MD) / Site Cashier"
                    value={cashWitness}
                    onChange={(e) => setCashWitness(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">
                    Denominations / Currency Breakdown
                  </label>
                  <select
                    value={cashDenominations}
                    onChange={(e) => setCashDenominations(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                  >
                    <option value="₹500 Notes Bundles">₹500 Currency Notes Bundles (Verified Count)</option>
                    <option value="₹500 & ₹200 Mixed Currency">₹500 &amp; ₹200 Mixed Currency Notes</option>
                    <option value="₹200 & ₹100 Petty Cash Notes">₹200 &amp; ₹100 Petty Cash Notes</option>
                    <option value="Direct Token Cash Packet">Direct Token Cash Packet for Landowner</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 5. Purpose of Investment */}
          <div>
            <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-amber-600" />
              <span>Investment Purpose / Capital Head *</span>
            </label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
            >
              {COMMON_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="Other Custom Outlay">Other Custom Project Outlay</option>
            </select>
            {purpose === 'Other Custom Outlay' && (
              <input
                type="text"
                required
                placeholder="Specify purpose (e.g. SRO Sub-Registrar Liaison & Village Panchayat Clearance)"
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                className="w-full mt-2 px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 outline-none focus:ring-2 focus:ring-[#FFB800]"
              />
            )}
          </div>

          {/* 6. Payment Mode & Reference / Voucher # */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                <span>Payment Mode / Channel *</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                {/* Cash Options */}
                <optgroup label="💵 CASH PAYMENT OPTIONS">
                  <option value="💵 Cash - Direct Currency Handover to Promoter / MD">
                    💵 Cash - Direct Currency Handover to Promoter / MD
                  </option>
                  <option value="💵 Cash - Site Cash Vault Deposit">
                    💵 Cash - Site Cash Vault Deposit
                  </option>
                  <option value="💵 Cash - SRO / Landowner Spot Cash Delivery">
                    💵 Cash - SRO / Landowner Spot Cash Delivery
                  </option>
                  <option value="💵 Cash - Office Cash Counter / Spot Receipt">
                    💵 Cash - Office Cash Counter / Spot Receipt
                  </option>
                  <option value="💵 Cash - Partner Personal Liquid Cash Infusion">
                    💵 Cash - Partner Personal Liquid Cash Infusion
                  </option>
                </optgroup>

                {/* Digital / Banking Options */}
                <optgroup label="🏦 BANKING & DIGITAL OPTIONS">
                  <option value="🏦 Bank Wire (RTGS / NEFT)">🏦 Bank Wire (RTGS / NEFT)</option>
                  <option value="⚡ IMPS Immediate Transfer">⚡ IMPS Immediate Transfer</option>
                  <option value="📑 Bank Cheque / Demand Draft">📑 Bank Cheque / Demand Draft</option>
                  <option value="📱 UPI / QR Transfer (PhonePe / GPay)">📱 UPI / QR Transfer (PhonePe / GPay)</option>
                  <option value="🏧 Cash Deposit Directly into Project Bank Account">
                    🏧 Cash Deposit Directly into Project Bank Account
                  </option>
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-amber-600" />
                <span>Ref / UTR / Cash Voucher #</span>
              </label>
              <input
                type="text"
                placeholder={isCashAccount ? 'e.g. CASH-VCH-2026-08' : 'e.g. ICICR5202602198'}
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
              />
            </div>
          </div>

          {/* 7. APPROVAL PROCESS & TRANSPARENCY WORKFLOW */}
          <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-blue-950 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700" />
                <span>Syndicate Consensus &amp; Approval Process *</span>
              </label>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Transparent to All Partners</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-blue-900 uppercase mb-1">
                  Approval Workflow Mode:
                </label>
                <select
                  value={approvalStatus}
                  onChange={(e) => setApprovalStatus(e.target.value as 'approved' | 'pending')}
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value="approved">
                    ✓ Direct Verified &amp; Approved (Immediate Ledger Credit)
                  </option>
                  <option value="pending">
                    ⏳ Submit for Managing Partner &amp; Consortium Signoff
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-blue-900 uppercase mb-1">
                  Primary Authorizing Signatory:
                </label>
                <input
                  type="text"
                  value={approverSignatory}
                  onChange={(e) => setApproverSignatory(e.target.value)}
                  placeholder="e.g. Srikanth Reddy (Managing Partner)"
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-semibold text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Consortium 2-Partner Consensus Field */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-blue-200/70">
              <div>
                <label className="block text-[10px] font-black text-blue-900 uppercase mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3 text-blue-700" />
                  <span>Consensus Co-Signatory Partner:</span>
                </label>
                <select
                  value={coSignatory}
                  onChange={(e) => setCoSignatory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  {partners
                    .filter((p) => p.name !== approverSignatory)
                    .map((p) => (
                      <option key={p.id} value={`${p.name} (Consensus Partner - ${p.fixedEquityPercent}%)`}>
                        {p.name} ({p.roleDescription || 'Partner'} - {p.fixedEquityPercent}%)
                      </option>
                    ))}
                  <option value="Consortium Committee Approval">Consortium Committee General Approval</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-blue-900 uppercase mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3 text-blue-700" />
                  <span>Consensus Security PIN:</span>
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={authPin}
                  onChange={(e) => setAuthPin(e.target.value)}
                  placeholder="4-digit PIN"
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-mono font-bold text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Real-time Status Notice */}
            <div className="text-[10px] text-blue-950 leading-relaxed bg-white/90 p-2.5 rounded-xl border border-blue-200/80 flex items-center gap-2">
              {approvalStatus === 'approved' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Status: Approved &amp; Ratified (✓)</strong>. Capital immediately credits the partner equity ledger and project passbook. All partners will see this verified entry in their records history.
                  </span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Status: ⏳ Pending Consortium Signoff</strong>. This investment claim will display with an alert badge on all partner dashboard top bars and records history until ratified.
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 8. Remarks & Notes */}
          <div>
            <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Investment Remarks / Land Survey Demarcation Notes</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Capital infused for Mangalagiri highway survey demarcation and land agreement advance payment as per syndicate consortium resolution."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 flex items-center justify-between border-t border-gray-100">
            <span className="text-[11px] text-gray-500 font-medium">
              * Broadcasts instantly to Partner Dashboard Top Bar
            </span>
            <div className="flex items-center gap-2.5">
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
                <Coins className="w-4 h-4 text-gray-950" />
                <span>+ Record Individual Investment</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
