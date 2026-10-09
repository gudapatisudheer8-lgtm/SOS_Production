import React from 'react';
import { Role, TenantFirm, AuthenticatedAppUser } from '../types';
import { 
  ShieldCheck, 
  Building2, 
  Calculator, 
  Smartphone, 
  LogOut 
} from 'lucide-react';

interface HeaderProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  firms: TenantFirm[];
  selectedFirmId: string;
  onFirmChange: (firmId: string) => void;
  onWipeMockData?: () => void;
  onRestoreDemoData?: () => void;
  pendingExpensesCount: number;
  firmAccountsCount?: number;
  isStandalone?: boolean;
  onToggleStandalone?: () => void;
  currentUser?: AuthenticatedAppUser | null;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  firms,
  selectedFirmId,
  onFirmChange,
  pendingExpensesCount,
  currentUser,
  onSignOut,
}) => {
  const currentFirm = firms.find((f) => f.id === selectedFirmId) || firms[0];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md text-slate-900 shadow-xs border-b border-stone-200">
      {/* Main Header Row in Clean Enterprise Warm White */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo & Active Firm info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 p-1 flex items-center justify-center shadow-md shadow-amber-500/20">
            <span className="font-black text-xl tracking-tighter">S<span className="text-amber-950">OS</span></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                Syndicate<span className="text-amber-600 underline decoration-amber-500/40">OS</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-stone-100 text-slate-800 border border-stone-200 px-2 py-0.5 rounded-full shadow-xs">
                AP / TG Syndicate
              </span>
            </div>
            {currentRole === 'super_admin' ? (
              <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-bold text-slate-900">Application / Product Owner Console</span>
                <span className="text-stone-300">•</span>
                <span className="text-stone-500 font-medium">Platform SaaS & Tenant Governance</span>
              </div>
            ) : currentFirm ? (
              <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-bold text-slate-900">{currentFirm?.name}</span>
                <span className="text-stone-300">•</span>
                <span className="text-stone-500 font-medium">{currentFirm?.location}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                <span className="font-bold text-slate-900">No Active Firm</span>
                <span className="text-stone-300">•</span>
                <span className="text-stone-500 font-medium">Provision firm in Super Admin</span>
              </div>
            )}
          </div>
        </div>

        {/* Firm Selector: Shown for Accountant if firms exist */}
        {currentRole === 'accountant' && firms.length > 0 ? (
          <div className="hidden lg:flex items-center gap-2 bg-[#F7F5EE] px-3 py-1.5 rounded-full border border-stone-200 shadow-xs">
            <span className="text-xs text-stone-700 font-bold">Syndicate Firm:</span>
            <select
              id="tenant-firm-selector"
              value={selectedFirmId}
              onChange={(e) => onFirmChange(e.target.value)}
              className="bg-white text-xs font-bold text-slate-900 border border-stone-300 rounded-full px-3 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-xs"
            >
              {firms.map((firm) => (
                <option key={firm.id} value={firm.id}>
                  {firm.name} ({firm.state === 'Andhra Pradesh' ? 'AP' : 'TG'})
                </option>
              ))}
            </select>
          </div>
        ) : currentRole === 'field_partner' ? (
          <div className="hidden lg:flex items-center gap-2 bg-[#F7F5EE] px-3.5 py-1.5 rounded-full border border-stone-200 text-xs font-bold text-slate-900 shadow-xs">
            <Smartphone className="w-3.5 h-3.5 text-amber-600" />
            <span>Field Partner Session • {currentFirm?.name || 'Awaiting Firm'}</span>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-2 bg-[#F7F5EE] px-3.5 py-1.5 rounded-full border border-stone-200 text-xs font-bold text-slate-900 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Product Owner Scope • {firms.length} Onboarded Firms</span>
          </div>
        )}

        {/* Dedicated Role Badge & User Session info */}
        <div className="flex items-center gap-3">
          {currentRole === 'super_admin' ? (
            <div className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-full border border-stone-200 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900">Super Admin Console</span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                  Owner
                </span>
              </div>
            </div>
          ) : currentRole === 'accountant' ? (
            <div className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-full border border-stone-200 shadow-xs">
              <Calculator className="w-4 h-4 text-amber-600" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-900">Firm Accountant Portal</span>
                {pendingExpensesCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-500 text-white font-black rounded-full text-[10px] animate-pulse">
                    {pendingExpensesCount}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-stone-100 px-4 py-2 rounded-full border border-stone-200 shadow-xs">
              <Smartphone className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-black text-slate-900">Partner Mobile Portal</span>
            </div>
          )}

          {/* User Identity Chip & Sign Out */}
          {currentUser && (
            <div className="flex items-center gap-2 bg-stone-100 px-3.5 py-1.5 rounded-full border border-stone-200 shadow-xs">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 leading-none">
                  <span>{currentUser.name}</span>
                  {currentUser.firmCode && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-mono font-bold">
                      {currentUser.firmCode}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5 leading-none">
                  +91 {currentUser.phone}
                </div>
              </div>
            </div>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out of session"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-red-50 text-stone-700 hover:text-red-700 rounded-full text-xs font-bold border border-stone-200 hover:border-red-300 transition-colors cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
