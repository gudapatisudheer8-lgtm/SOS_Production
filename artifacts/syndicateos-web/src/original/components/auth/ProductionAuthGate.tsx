import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import type { AuthenticatedAppUser } from '../../types';

interface ProductionAuthGateProps {
  onLoginSuccess: (user: AuthenticatedAppUser) => void;
  availableFirmsCount?: number;
  entry?: 'owner' | 'client';
}

type AuthStep =  'firm_code' | 'member_login' | 'super_admin_login' | 'set_pin';

const SixPin: React.FC<{ value: string; onChange: (v: string) => void; autoFocus?: boolean; label: string }> = ({ value, onChange, autoFocus, label }) => (
  <label className="relative block cursor-text">
    <span className="sr-only">{label}</span>
    <div className="flex justify-between gap-2" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`flex-1 h-14 rounded-2xl border bg-[#FAF9F5] flex items-center justify-center text-2xl font-black text-slate-900 shadow-inner ${i === value.length ? 'border-amber-600 ring-4 ring-amber-500/10' : 'border-stone-300'}`}>
          {value[i] ? '\u2022' : <span className="text-stone-300">-</span>}
        </div>
      ))}
    </div>
    <input
      type="password"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      maxLength={6}
      className="absolute inset-0 w-full h-full opacity-0 cursor-text"
    />
  </label>
);

export const ProductionAuthGate: React.FC<ProductionAuthGateProps> = ({
  onLoginSuccess,
  entry = 'client',
}) => {
  const [step, setStep] = useState<AuthStep>(entry === 'owner' ? 'super_admin_login' : 'firm_code');
  
  // Firm Code step state
  const [firmCodeInput, setFirmCodeInput] = useState('');
  const [verifyingFirm, setVerifyingFirm] = useState(false);
  const [verifiedFirm, setVerifiedFirm] = useState<{
    id: string;
    name: string;
    code: string;
    location: string;
    state: string;
  } | null>(null);
  const [firmCodeError, setFirmCodeError] = useState('');

  // Member Login state
  const [memberPhone, setMemberPhone] = useState('');
  const [memberPin, setMemberPin] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState('');

  // Super Admin Login state
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Set PIN state (First-time login)
  const [pendingUser, setPendingUser] = useState<AuthenticatedAppUser | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinChangeLoading, setPinChangeLoading] = useState(false);
  const [pinChangeError, setPinChangeError] = useState('');

  const isOwnerChange = pendingUser?.role === 'super_admin';
  const minCredential = isOwnerChange ? 8 : 6;
  const cleanCredential = (v: string) => (isOwnerChange ? v.slice(0, 72) : v.replace(/\D/g, '').slice(0, 6));

  // Validate Firm Code
  const handleVerifyFirmCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFirmCodeError('');
    const code = firmCodeInput.trim().toUpperCase();
    if (!code) {
      setFirmCodeError('Please enter a valid Firm Code (e.g. SC-AP).');
      return;
    }

    setVerifyingFirm(true);
    try {
      const res = await fetch(`/api/auth/validate-firm/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.valid && data.firm) {
        setVerifiedFirm(data.firm);
        setStep('member_login');
      } else {
        setVerifiedFirm(null);
        setFirmCodeError(data.error || `Firm Code "${code}" not found. Please verify with your firm administrator.`);
      }
    } catch {
      setFirmCodeError('Network error connecting to authentication service. Please try again.');
    } finally {
      setVerifyingFirm(false);
    }
  };

  // Submit Member Login (Accountant / Partner / Managing Partner)
  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError('');

    const cleanPhone = memberPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setMemberError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!memberPin || !/^\d{6}$/.test(memberPin)) {
      setMemberError('Please enter your 6-digit security PIN.');
      return;
    }

    setMemberLoading(true);
    try {
      let res: Response | null = null;
      let attempts = 0;
      while (attempts < 2) {
        try {
          res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: cleanPhone,
              pin: memberPin,
              firmCode: verifiedFirm?.code,
            }),
          });
          break;
        } catch (fetchErr) {
          attempts++;
          if (attempts >= 2) throw fetchErr;
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (!res) throw new Error('Network connection failed');

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        if (data.user.mustChangePin) {
          setPendingUser(data.user);
          setStep('set_pin');
        } else {
          onLoginSuccess(data.user);
        }
      } else {
        setMemberError(data.error || 'Authentication failed. Please verify your mobile number and security PIN.');
      }
    } catch (err: any) {
      setMemberError(
        err?.message?.includes('Failed to fetch') || err?.message?.includes('Network')
          ? 'Connecting to database server... Please tap Sign In again.'
          : (err?.message || 'Authentication service temporarily unavailable. Please try again.')
      );
    } finally {
      setMemberLoading(false);
    }
  };

  // Submit Super Admin Login
  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    const cleanPhone = adminPhone.trim();
    const adminDigits = cleanPhone.replace(/\D/g, '');
    if (adminDigits.length < 8 || adminDigits.length > 15) {
      setAdminError('Enter your full mobile number, with country code if it is not an Indian number.');
      return;
    }

    if (!adminPin || adminPin.length < 8) {
      setAdminError('Please enter your owner password (at least 8 characters).');
      return;
    }

    setAdminLoading(true);
    try {
      let res: Response | null = null;
      let attempts = 0;
      while (attempts < 2) {
        try {
          res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: cleanPhone,
              pin: adminPin,
            }),
          });
          break;
        } catch (fetchErr) {
          attempts++;
          if (attempts >= 2) throw fetchErr;
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (!res) throw new Error('Network connection failed');

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        if (data.user.mustChangePin) {
          setPendingUser(data.user);
          setStep('set_pin');
        } else {
          onLoginSuccess(data.user);
        }
      } else {
        setAdminError(data.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setAdminError(
        err?.message?.includes('Failed to fetch') || err?.message?.includes('Network')
          ? 'Connecting to database server... Please tap Sign In again.'
          : (err?.message || 'Authentication service temporarily unavailable. Please try again.')
      );
    } finally {
      setAdminLoading(false);
    }
  };

  // Submit PIN Change (Mandatory for first-time login)
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError('');

    if (!pendingUser) return;

    const bytes = new TextEncoder().encode(newPin).length;
    if (isOwnerChange) {
      if (newPin.length < 8 || bytes > 72) {
        setPinChangeError('New password must be at least 8 characters and at most 72 bytes.');
        return;
      }
    } else if (!/^\d{6}$/.test(newPin)) {
      setPinChangeError('New PIN must be exactly 6 numeric digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setPinChangeError('PIN confirmation does not match. Please re-enter.');
      return;
    }

    setPinChangeLoading(true);
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: pendingUser.phone,
          newPin: newPin.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess(data.user ? data.user : { ...pendingUser, mustChangePin: false });
      } else {
        setPinChangeError(data.error || 'Failed to update PIN. Please try again.');
      }
    } catch {
      setPinChangeError('Connection error while updating PIN. Please try again.');
    } finally {
      setPinChangeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-slate-800 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-amber-100 selection:text-amber-900">
      <div />

      {/* Main Container */}
      <div className="max-w-xl w-full mx-auto my-auto py-8">
        
        {/* Brand in the middle, top of the syndicate portal access */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3 border border-amber-400/50">
            S<span className="text-amber-950">OS</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-black text-2xl sm:text-3xl tracking-tight text-slate-900">
              Syndicate<span className="text-amber-600">OS</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium max-w-md">
            Enterprise Multi-Tenant Real Estate & Venture Syndicate Platform
          </p>
        </div>

        {/* STEP 2: FIRM CODE VALIDATION */}
        {step === 'firm_code' && (
          <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 space-y-6">
            <div className="flex items-center justify-between">
              <span />
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Step 1 of 2
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Enter Firm Code</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Each syndicate operates under an isolated Firm Code assigned by the platform administrator.
              </p>
            </div>

            <form onSubmit={handleVerifyFirmCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Firm Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={firmCodeInput}
                    onChange={(e) => {
                      setFirmCodeInput(e.target.value.toUpperCase());
                      setFirmCodeError('');
                    }}
                    placeholder="e.g. SC-AP"
                    className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-amber-600 rounded-2xl px-4 py-3 text-lg font-mono font-black text-slate-900 uppercase placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 tracking-wider shadow-inner"
                    autoFocus
                  />
                  {verifiedFirm && (
                    <div className="absolute right-3.5 top-3.5 text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                </div>
              </div>

              {firmCodeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{firmCodeError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingFirm || !firmCodeInput.trim()}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black rounded-2xl py-3.5 text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {verifyingFirm ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    <span>Verifying Firm Code...</span>
                  </span>
                ) : (
                  <>
                    <span>Verify Firm & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: MEMBER MOBILE NUMBER & PIN */}
        {step === 'member_login' && verifiedFirm && (
          <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('firm_code')}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-slate-900 transition-colors cursor-pointer font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Change Firm Code</span>
              </button>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Step 2 of 2
              </span>
            </div>

            {/* Verified Firm Banner */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-amber-800">
                    Verified Firm
                  </div>
                  <h3 className="text-sm font-black text-slate-900">{verifiedFirm.name}</h3>
                  <div className="text-xs text-stone-600">
                    Code: <strong className="text-slate-900">{verifiedFirm.code}</strong> {verifiedFirm.location ? ` • ${verifiedFirm.location}` : ''}
                  </div>
                </div>
              </div>
              <div className="text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Member Sign-In</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Enter your registered 10-digit mobile number and 6-digit security PIN.
              </p>
            </div>

            <form onSubmit={handleMemberLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-xs font-bold text-stone-500 font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={memberPhone}
                    onChange={(e) => {
                      setMemberPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setMemberError('');
                    }}
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                    className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-amber-600 rounded-2xl pl-13 pr-4 py-3 text-base font-mono font-bold text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 tracking-wider shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  6-Digit Security PIN
                </label>
                <SixPin label="6-digit security PIN" value={memberPin} autoFocus={false} onChange={(v) => { setMemberPin(v); setMemberError(''); }} />
              </div>

              {memberError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{memberError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={memberLoading || memberPhone.length < 10 || memberPin.length < 6}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black rounded-2xl py-3.5 text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {memberLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    <span>Authenticating...</span>
                  </span>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 4: SUPER ADMIN LOGIN */}
        {step === 'super_admin_login' && (
          <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 space-y-6">
            <div className="flex items-center justify-between">
              <span />
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-stone-200">
                Platform Admin
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Super Admin Console</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Authorized for the platform owner only. Enter your registered mobile number and owner password.
              </p>
            </div>

            <form onSubmit={handleSuperAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-xs font-bold text-stone-500 font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => {
                      setAdminPhone(e.target.value.replace(/[^\d+\s()-]/g, '').slice(0, 20));
                      setAdminError('');
                    }}
                    placeholder="Full mobile number"
                    maxLength={20}
                    className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-slate-800 rounded-2xl pl-13 pr-4 py-3 text-base font-mono font-bold text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-slate-500/10 tracking-wider shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Owner Password
                </label>
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => {
                    setAdminPin(e.target.value.slice(0, 128));
                    setAdminError('');
                  }}
                  placeholder="••••"
                  maxLength={128}
                  className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-slate-800 rounded-2xl px-4 py-3 text-xl font-mono text-center tracking-widest text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-slate-500/10 shadow-inner"
                />
              </div>

              {adminError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{adminError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={adminLoading || adminPhone.replace(/\D/g, '').length < 8 || adminPin.length < 8}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black rounded-2xl py-3.5 text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {adminLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    <span>Authenticating...</span>
                  </span>
                ) : (
                  <>
                    <span>Sign In to Console</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 5: MANDATORY SET PIN (First login) */}
        {step === 'set_pin' && pendingUser && (
          <div className="bg-white border border-amber-300 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto shadow-md">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {isOwnerChange ? 'Set Your New Owner Password' : 'Set Your Personal 6-Digit PIN'}
              </h2>
              <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                Welcome, <strong className="text-amber-800">{pendingUser.name}</strong>! {isOwnerChange ? 'Please choose a new password (8+ characters) for future logins.' : 'Please choose your confidential 6-digit security PIN for future logins.'}
              </p>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  {isOwnerChange ? 'New Password' : 'New 6-Digit Security PIN'}
                </label>
                {isOwnerChange ? (
<input
                  type="password"
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(cleanCredential(e.target.value));
                    setPinChangeError('');
                  }}
                  placeholder="••••"
                  maxLength={isOwnerChange ? 72 : 6}
                  className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-amber-600 rounded-2xl px-4 py-3 text-xl font-mono text-center tracking-widest text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 shadow-inner"
                  autoFocus
                />
) : (
<SixPin label="newPin" value={newPin} autoFocus onChange={(v) => { setNewPin(v); setPinChangeError(''); }} />
)}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  {isOwnerChange ? 'Confirm Password' : 'Confirm 6-Digit PIN'}
                </label>
                {isOwnerChange ? (
<input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(cleanCredential(e.target.value));
                    setPinChangeError('');
                  }}
                  placeholder="••••"
                  maxLength={isOwnerChange ? 72 : 6}
                  className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-amber-600 rounded-2xl px-4 py-3 text-xl font-mono text-center tracking-widest text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 shadow-inner"
                />
) : (
<SixPin label="confirmPin" value={confirmPin}  onChange={(v) => { setConfirmPin(v); setPinChangeError(''); }} />
)}
              </div>

              {pinChangeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{pinChangeError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={pinChangeLoading || newPin.length < minCredential || confirmPin.length < minCredential}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black rounded-2xl py-3.5 text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {pinChangeLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    <span>Updating Security PIN...</span>
                  </span>
                ) : (
                  <>
                    <span>Confirm PIN & Enter Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Enterprise Footer */}
      <footer className="w-full py-4 text-center text-xs text-stone-500 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
        <span>© 2026 SyndicateOS. All rights reserved.</span>
        <span className="hidden sm:inline">•</span>
        <span className="flex items-center gap-1 text-stone-600">
          <span>Multi-Tenant Enterprise Portal</span>
        </span>
      </footer>
    </div>
  );
};
