import React, { useEffect, useRef, useState } from 'react';
import { Role, TenantFirm, AuthenticatedAppUser } from '../types';
import { ShieldCheck, Building2, ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { ChangePinDialog } from './profile/ChangePinDialog';
import { NotificationBell } from './NotificationBell';
import { useHeaderSlotHost } from './HeaderSlot';

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
  onAccountUpdated?: (user: AuthenticatedAppUser) => void;
}

const roleLabel = (r: Role) => (r === 'super_admin' ? 'Product owner' : r === 'accountant' ? 'Firm accountant' : 'Project partner');

export const Header: React.FC<HeaderProps> = ({
  currentRole, firms, selectedFirmId, onFirmChange, currentUser, onSignOut, onAccountUpdated,
}) => {
  const currentFirm = firms.find((f) => f.id === selectedFirmId) || firms[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isOwner = currentRole === 'super_admin';
  const slot = useHeaderSlotHost();

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const initials = (currentUser?.name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

  return (
    <header className="sticky top-0 z-40 bg-[#FBFAF6]/95 backdrop-blur-md text-slate-900 border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3 min-w-0 flex-1 lg:flex-none lg:max-w-[18rem]">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
            <span className="font-black text-base tracking-tighter">S<span className="text-amber-950">OS</span></span>
          </div>
          <div className="min-w-0">
            <div className="text-base font-black tracking-tight leading-tight">Syndicate<span className="text-amber-600">OS</span></div>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-600 min-w-0">
              {isOwner ? (
                <><ShieldCheck className="w-3 h-3 text-amber-600 shrink-0" /><span className="truncate">Platform governance, {firms.length} firms</span></>
              ) : currentFirm ? (
                <><Building2 className="w-3 h-3 text-amber-600 shrink-0" /><span className="font-bold text-slate-800 truncate">{currentFirm.name}</span><span className="hidden sm:inline text-stone-400 truncate">{currentFirm.location}</span></>
              ) : (
                <span className="truncate">No active firm assigned</span>
              )}
            </div>
            <div ref={slot.brandRef} data-testid="header-brand-context" className="min-w-0 mt-0.5 empty:hidden" />
          </div>
        </div>

        {/* Page-owned context controls (project/firm selectors, actions) portal in here. */}
        <div ref={slot.ref} data-testid="header-slot"
          className="order-last w-full min-w-0 empty:hidden lg:order-none lg:w-auto lg:flex-1" />

        <div className="flex items-center gap-2 shrink-0">
          {currentRole === 'accountant' && firms.length > 1 && !slot.occupied && (
            <label className="flex items-center gap-2 text-[11px] font-bold text-stone-600">
              <span>Firm</span>
              <select id="tenant-firm-selector" value={selectedFirmId} onChange={(e) => onFirmChange(e.target.value)}
                className="bg-white text-xs font-bold text-slate-900 border border-stone-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer max-w-[220px]">
                {firms.map((firm) => (
                  <option key={firm.id} value={firm.id}>{firm.name} ({firm.code})</option>
                ))}
              </select>
            </label>
          )}

          {currentUser && !isOwner && <NotificationBell identityKey={`${currentUser.id}:${currentUser.role}:${currentUser.firmId || ''}`} />}
          {currentUser ? (
            <div ref={wrapRef} className="relative">
              <button ref={btnRef} type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="profile-menu"
                aria-label={`Account menu for ${currentUser.name}`} onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-stone-200 bg-white hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors">
                <span className="relative w-7 h-7 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center text-[11px] font-black">
                  {initials}
                </span>
                <span className="hidden sm:flex flex-col items-start leading-tight text-left">
                  <span className="text-xs font-black text-slate-900 max-w-[140px] truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-stone-500">{roleLabel(currentRole)}</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-stone-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div id="profile-menu" role="menu" className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-2rem))] bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 bg-[#F7F5EE] border-b border-stone-200">
                    <div className="text-sm font-black text-slate-900 truncate">{currentUser.name}</div>
                    <div className="text-[11px] text-stone-600 font-mono">{currentUser.phone}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300">{roleLabel(currentRole)}</span>
                      {!isOwner && (currentFirm?.code || currentUser.firmCode) && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono">{currentFirm?.code || currentUser.firmCode}</span>}
                    </div>
                    {!isOwner && currentFirm && <div className="mt-1 text-[11px] text-stone-500 truncate">{currentFirm.name}</div>}
                  </div>
                  {!isOwner && (
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPinOpen(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-800 hover:bg-stone-50 focus:bg-stone-50 focus:outline-none">
                      <KeyRound className="w-4 h-4 text-amber-600" /> Change PIN
                    </button>
                  )}
                  {onSignOut && (
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onSignOut(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 focus:bg-red-50 focus:outline-none border-t border-stone-100">
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : onSignOut ? (
            <button type="button" onClick={onSignOut} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 bg-white text-xs font-bold text-stone-700 hover:text-red-700">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          ) : null}
        </div>
      </div>
      <ChangePinDialog open={pinOpen} onClose={() => { setPinOpen(false); btnRef.current?.focus(); }} onUpdated={onAccountUpdated} />
    </header>
  );
};
