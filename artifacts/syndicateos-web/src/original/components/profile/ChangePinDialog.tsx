import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, X } from 'lucide-react';
import { api, setToken, toAppUser, SessionAccount, ApiError } from '../../../adapter/api';
import { AuthenticatedAppUser } from '../../types';

interface Props {
  open: boolean;
  isOwner?: boolean;
  onClose: () => void;
  onUpdated?: (user: AuthenticatedAppUser) => void;
}

export const ChangePinDialog: React.FC<Props> = ({ open, isOwner, onClose, onUpdated }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const label = isOwner ? 'password' : 'PIN';

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); };
  const close = () => { if (pending) return; reset(); onClose(); };

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const items = formRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError('');
    if (!current) return setError(`Enter your current ${label}.`);
    if (isOwner ? next.length < 8 : !/^\d{6}$/.test(next)) {
      return setError(isOwner ? 'New password must be at least 8 characters.' : 'New PIN must be exactly 6 digits.');
    }
    if (next !== confirm) return setError(`New ${label} and confirmation do not match.`);
    setPending(true);
    try {
      const r = await api<{ token: string; account: SessionAccount }>('/auth/credential', {
        body: { currentCredential: current, newCredential: next },
      });
      setToken(r.token);
      onUpdated?.(toAppUser(r.account));
      setPending(false);
      reset();
      onClose();
    } catch (err) {
      const ae = err as ApiError;
      setPending(false);
      setCurrent(''); setNext(''); setConfirm('');
      setError(ae?.code === 'INVALID_CREDENTIALS' ? `Current ${label} is incorrect.` : ae?.message || `Could not change ${label}. Try again.`);
    }
  };

  const digitProps = isOwner ? { type: 'password' } : { type: 'password', inputMode: 'numeric' as const, maxLength: 6, pattern: '\\d{6}' };
  const field = 'w-full rounded-xl border border-stone-300 bg-[#FBFAF6] px-3 py-2.5 text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500';

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/40 p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <form ref={formRef} role="dialog" aria-modal="true" aria-labelledby="chg-cred-title" onSubmit={submit}
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl border border-stone-200 shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center"><KeyRound className="w-4 h-4" /></div>
            <div>
              <h2 id="chg-cred-title" className="text-sm font-black text-slate-900">Change {label}</h2>
              <p className="text-[11px] text-stone-500">{isOwner ? 'At least 8 characters.' : 'Choose a different 6-digit PIN. Other sessions will be signed out.'}</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100"><X className="w-4 h-4" /></button>
        </div>
        <label className="block space-y-1"><span className="text-[11px] font-bold text-stone-600">Current {label}</span>
          <input ref={firstRef} {...(isOwner ? { type: 'password' } : { type: 'password', inputMode: 'numeric' as const })} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={field} /></label>
        <label className="block space-y-1"><span className="text-[11px] font-bold text-stone-600">New {label}</span>
          <input {...digitProps} autoComplete="new-password" value={next} onChange={(e) => setNext(isOwner ? e.target.value : e.target.value.replace(/\D/g, ''))} className={field} /></label>
        <label className="block space-y-1"><span className="text-[11px] font-bold text-stone-600">Confirm new {label}</span>
          <input {...digitProps} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(isOwner ? e.target.value : e.target.value.replace(/\D/g, ''))} className={field} /></label>
        {error && <p role="alert" className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={close} disabled={pending} className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black disabled:opacity-60">{pending ? 'Saving...' : `Update ${label}`}</button>
        </div>
      </form>
    </div>, document.body
  );
};
