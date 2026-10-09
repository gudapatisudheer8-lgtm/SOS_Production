import React, { useState } from 'react';
import { TenantFirm } from '../../types';
import {
  X,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Calculator,
  Smartphone,
  Lock,
  Sparkles,
  Info,
  CheckCircle2,
  Building2,
  Users,
  Eye,
  EyeOff,
  Share2
} from 'lucide-react';

interface DirectPortalLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  firms: TenantFirm[];
  selectedFirmId: string;
  onSelectFirm: (firmId: string) => void;
}

export const DirectPortalLinksModal: React.FC<DirectPortalLinksModalProps> = ({
  isOpen,
  onClose,
  firms,
  selectedFirmId,
  onSelectFirm,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isIsolated, setIsIsolated] = useState<boolean>(true);

  if (!isOpen) return null;

  const currentFirm = firms.find((f) => f.id === selectedFirmId) || firms[0];
  const baseUrl = window.location.origin + window.location.pathname;

  // Generate clean direct URLs
  const getPortalUrl = (role: 'super_admin' | 'accountant' | 'field_partner') => {
    const params = new URLSearchParams();
    params.set('role', role);
    if (role !== 'super_admin' && currentFirm) {
      params.set('firmId', currentFirm.id);
    }
    if (isIsolated && role !== 'super_admin') {
      params.set('isolated', 'true');
      params.set('standalone', 'true');
    }
    return `${baseUrl}?${params.toString()}`;
  };

  const accountantUrl = getPortalUrl('accountant');
  const partnerUrl = getPortalUrl('field_partner');
  const superAdminUrl = getPortalUrl('super_admin');
  const marketingUrl = `${baseUrl}?portal=marketing${currentFirm ? `&firmId=${encodeURIComponent(currentFirm.id)}` : ''}&standalone=true`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-2xl w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-400 via-[#FFB800] to-amber-500 p-5 flex items-center justify-between border-b border-amber-600/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#111827] text-amber-400 flex items-center justify-center font-black shadow-md">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-gray-950 text-base leading-tight">
                  Direct Portal Links for Client &amp; Tester Access
                </h3>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-gray-950 text-amber-400">
                  Role Isolated
                </span>
              </div>
              <p className="text-[11px] text-gray-900 font-semibold mt-0.5">
                Share individual dedicated links so testers/clients only access their assigned role and firm
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

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-xs max-h-[82vh] overflow-y-auto">
          {/* Workflow Guide Notice */}
          <div className="bg-blue-50/90 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-blue-950">
            <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-black text-xs block text-blue-950">
                Recommended 2-Tester Testing Workflow:
              </span>
              <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-blue-900 font-medium leading-relaxed">
                <li>
                  <strong>Step 1 (Super Admin):</strong> Register your target syndicate firm in the Super Admin dashboard.
                </li>
                <li>
                  <strong>Step 2 (Tester 1 — Accountant):</strong> Pass the <em>Accountant Portal Link</em> to add project ventures, setup partners, bank accounts, and enroll expenses.
                </li>
                <li>
                  <strong>Step 3 (Tester 2 — Partner):</strong> Pass the <em>Partner Dashboard Link</em> to test on-site expense entries, individual investments (Cash/Bank), plot bookings, and live statements.
                </li>
              </ol>
            </div>
          </div>

          {/* Firm Selection & Isolation Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <div>
              <label className="block text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Target Syndicate Firm:</span>
              </label>
              <select
                value={selectedFirmId}
                onChange={(e) => onSelectFirm(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-950 focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
              >
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code || f.location})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-center">
              <label className="text-[11px] font-black text-gray-700 uppercase mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Tester Isolation Security:</span>
              </label>
              <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-300 cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isIsolated}
                  onChange={(e) => setIsIsolated(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-gray-900">
                  Hide role switcher (Tester cannot navigate to other roles)
                </span>
              </label>
            </div>
          </div>

          {/* 3 Generated Links Cards */}
          <div className="space-y-4">
            {/* LINK 1: FIRM ACCOUNTANT PORTAL (TESTER 1) */}
            <div className="bg-white rounded-2xl border-2 border-amber-300/80 p-4 space-y-2.5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
                    <Calculator className="w-4 h-4 text-amber-700" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-950 text-xs flex items-center gap-1.5">
                      <span>Tester 1: Firm Accountant Portal Link</span>
                      <span className="text-[9px] bg-amber-100 text-amber-900 font-extrabold px-2 py-0.5 rounded-full">
                        {currentFirm?.code || 'FIRM'}
                      </span>
                    </h4>
                    <span className="text-[10px] text-gray-500 font-medium">
                      Setup projects, partners, capital accounts &amp; audit project passbooks
                    </span>
                  </div>
                </div>

                <a
                  href={accountantUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-950 transition-colors"
                  title="Open in new tab to test"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* URL Box & Copy Button */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={accountantUrl}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px] text-gray-800 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(accountantUrl, 'accountant')}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-gray-950 font-black text-xs flex items-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  {copiedKey === 'accountant' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-gray-950" />
                      <span>Copied! ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-950" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* LINK 2: PARTNER DASHBOARD PORTAL (TESTER 2) */}
            <div className="bg-white rounded-2xl border-2 border-emerald-300/80 p-4 space-y-2.5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-black">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-950 text-xs flex items-center gap-1.5">
                      <span>Tester 2: Syndicate Partner Dashboard Link</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full">
                        {currentFirm?.code || 'FIRM'}
                      </span>
                    </h4>
                    <span className="text-[10px] text-gray-500 font-medium">
                      Executive partner node: enroll investments (Cash/Bank), spot expenses, plot bookings
                    </span>
                  </div>
                </div>

                <a
                  href={partnerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-950 transition-colors"
                  title="Open in new tab to test"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* URL Box & Copy Button */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={partnerUrl}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px] text-gray-800 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(partnerUrl, 'partner')}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  {copiedKey === 'partner' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-slate-950" />
                      <span>Copied! ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-950" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* LINK 3: SUPER ADMIN CONSOLE LINK (PRODUCT OWNER) */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-gray-100 text-gray-900 flex items-center justify-center font-black">
                    <ShieldCheck className="w-4 h-4 text-gray-800" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-950 text-xs flex items-center gap-1.5">
                      <span>Super Admin Master Console Link</span>
                      <span className="text-[9px] bg-gray-900 text-white font-extrabold px-2 py-0.5 rounded-full">
                        Owner
                      </span>
                    </h4>
                    <span className="text-[10px] text-gray-500 font-medium">
                      Multi-tenant SaaS firm provisioning, feature flags, and MRR governance
                    </span>
                  </div>
                </div>

                <a
                  href={superAdminUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-950 transition-colors"
                  title="Open in new tab to test"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* URL Box & Copy Button */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={superAdminUrl}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px] text-gray-800 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(superAdminUrl, 'superadmin')}
                  className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-black text-white font-black text-xs flex items-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  {copiedKey === 'superadmin' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copied! ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-white" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* LINK 4: MARKETING & BROKER PORTAL (EXTERNAL FIELD ACCESS) */}
            <div className="bg-white rounded-2xl border-2 border-indigo-300/80 p-4 space-y-2.5 shadow-2xs hover:shadow-xs transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-black">
                    <Share2 className="w-4 h-4 text-indigo-700" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-950 text-xs flex items-center gap-1.5">
                      <span>Marketing &amp; Channel Partner Portal Link</span>
                      <span className="text-[9px] bg-indigo-100 text-indigo-900 font-extrabold px-2 py-0.5 rounded-full">
                        Brokers &amp; Sales
                      </span>
                    </h4>
                    <span className="text-[10px] text-gray-500 font-medium">
                      External broker &amp; marketing link: Plot inventory grid &amp; customer booking request only. No access to internal staff controls or confidential syndicate statements.
                    </span>
                  </div>
                </div>

                <a
                  href={marketingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-950 transition-colors"
                  title="Open in new tab to test"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* URL Box & Copy Button */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={marketingUrl}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[11px] text-gray-800 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(marketingUrl, 'marketing')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95"
                >
                  {copiedKey === 'marketing' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copied! ✓</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-white" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Links carry the firm ID &amp; isolation flags directly in the URL</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-gray-950 hover:bg-gray-800 text-white font-black text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
