import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Lock,
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
}

type AuthStep = 'welcome' | 'firm_code' | 'member_login' | 'super_admin_login' | 'set_pin';

export const ProductionAuthGate: React.FC<ProductionAuthGateProps> = ({
  onLoginSuccess,
}) => {
  const [step, setStep] = useState<AuthStep>('welcome');
  
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

    if (!memberPin || memberPin.length !== 4) {
      setMemberError('Please enter your 4-digit security PIN.');
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

    const cleanPhone = adminPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setAdminError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!adminPin || adminPin.length !== 4) {
      setAdminError('Please enter your 4-digit security PIN.');
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

    if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setPinChangeError('New PIN must be exactly 4 numeric digits.');
      return;
    }

    if (newPin === '9999') {
      setPinChangeError('Please choose a personal PIN different from default 9999.');
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
        onLoginSuccess({
          ...pendingUser,
          mustChangePin: false,
        });
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

        {/* STEP 1: WELCOME SCREEN */}
        {step === 'welcome' && (
          <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 space-y-6">
            <div className="text-center space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Syndicate Portal Access
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
                Select your designated portal to sign in with your registered mobile and security PIN.
              </p>
            </div>

            {/* Portal Option Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Option 1: Firm Portal */}
              <button
                type="button"
                onClick={() => setStep('firm_code')}
                className="group relative bg-[#FAF9F5] hover:bg-amber-50/50 border border-stone-200 hover:border-amber-400 p-5 rounded-2xl text-left transition-all shadow-xs hover:shadow-md flex flex-col justify-between cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 group-hover:scale-105 transition-transform">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-amber-800 transition-colors">
                      Firm Member Portal
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      For Field Partners, Firm Accountants & Managing Partners. Access via assigned <strong>Firm Code</strong>.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between text-xs font-bold text-amber-700">
                  <span>Enter Firm Code</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>

              {/* Option 2: Super Admin Console */}
              <button
                type="button"
                onClick={() => setStep('super_admin_login')}
                className="group relative bg-[#FAF9F5] hover:bg-slate-50 border border-stone-200 hover:border-slate-400 p-5 rounded-2xl text-left transition-all shadow-xs hover:shadow-md flex flex-col justify-between cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center border border-stone-300 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-slate-800 transition-colors">
                      Super Admin Console
                    </h3>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      Platform governance for tenant provisioning, system settings, and audit oversight.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Sign In as Admin</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: FIRM CODE VALIDATION */}
        {step === 'firm_code' && (
          <div className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-200/60 space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-slate-900 transition-colors cursor-pointer font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Portals</span>
              </button>
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
                    Code: <strong className="text-slate-900">{verifiedFirm.code}</strong> • {verifiedFirm.location}
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
                Enter your registered 10-digit mobile number and 4-digit security PIN.
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
                  4-Digit Security PIN
                </label>
                <input
                  type="password"
                  value={memberPin}
                  onChange={(e) => {
                    setMemberPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setMemberError('');
                  }}
                  placeholder="••••"
                  maxLength={4}
                  className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-amber-600 rounded-2xl px-4 py-3 text-xl font-mono text-center tracking-widest text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 shadow-inner"
                />
              </div>

              {memberError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{memberError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={memberLoading || memberPhone.length < 10 || memberPin.length < 4}
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
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-slate-900 transition-colors cursor-pointer font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Portals</span>
              </button>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-800 border border-stone-200">
                Platform Admin
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Super Admin Console</h2>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                Authorized for Platform Owner. Enter your registered mobile number and security PIN.
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
                      setAdminPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setAdminError('');
                    }}
                    placeholder="Enter 10-digit mobile number"
                    maxLength={10}
                    className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-slate-800 rounded-2xl pl-13 pr-4 py-3 text-base font-mono font-bold text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-slate-500/10 tracking-wider shadow-inner"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  4-Digit Security PIN
                </label>
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => {
                    setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setAdminError('');
                  }}
                  placeholder="••••"
                  maxLength={4}
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
                disabled={adminLoading || adminPhone.length < 10 || adminPin.length < 4}
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
                Set Your Personal 4-Digit PIN
              </h2>
              <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                Welcome, <strong className="text-amber-800">{pendingUser.name}</strong>! Please choose your confidential 4-digit security PIN for future logins.
              </p>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  New 4-Digit Security PIN
                </label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => {
                    setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setPinChangeError('');
                  }}
                  placeholder="••••"
                  maxLength={4}
                  className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-amber-600 rounded-2xl px-4 py-3 text-xl font-mono text-center tracking-widest text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 shadow-inner"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Confirm 4-Digit PIN
                </label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setPinChangeError('');
                  }}
                  placeholder="••••"
                  maxLength={4}
                  className="w-full bg-[#FAF9F5] border border-stone-300 focus:bg-white focus:border-amber-600 rounded-2xl px-4 py-3 text-xl font-mono text-center tracking-widest text-slate-900 placeholder-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 shadow-inner"
                />
              </div>

              {pinChangeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{pinChangeError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={pinChangeLoading || newPin.length < 4 || confirmPin.length < 4}
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
          <Lock className="w-3 h-3 text-stone-400" />
          <span>Multi-Tenant Enterprise Portal • 256-Bit SSL Encrypted</span>
        </span>
      </footer>
    </div>
  );
};
