import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Key, CheckCircle, X, Users } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface DiscountAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDiscountSale: (approvedBy: string) => void;
  unitLabel: string; // e.g. "Plot #104" or "Flat #203"
  attemptedRate: number;
  floorRate: number;
  unitExtent: number; // Sq. Yards or Sq. Feet
  extentUnit: string; // "Sq. Yds" or "Sft"
}

export const DiscountAlertModal: React.FC<DiscountAlertModalProps> = ({
  isOpen,
  onClose,
  onConfirmDiscountSale,
  unitLabel,
  attemptedRate,
  floorRate,
  unitExtent,
  extentUnit,
}) => {
  const [authPartner1, setAuthPartner1] = useState('Partner A: Srikanth Reddy (Managing Partner)');
  const [authPartner2, setAuthPartner2] = useState('Partner B: K. Venkat Rao');
  const [signPin, setSignPin] = useState('');
  const [signNotes, setSignNotes] = useState('Special concession approved during Sunday Mega Site Visit by joint partner quorum.');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const rateDeficit = floorRate - attemptedRate;
  const totalFinancialDeficit = rateDeficit * unitExtent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signPin || signPin.length < 4) {
      setError('Please enter a valid 4-digit partner security PIN (e.g. 1234 or 9999).');
      return;
    }
    const approvedSignature = `${authPartner1} & ${authPartner2} (Digital PIN Verified)`;
    onConfirmDiscountSale(approvedSignature);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-red-500 max-w-lg w-full overflow-hidden">
        {/* Header Alert in Bright Red */}
        <div className="bg-[#EF4444] text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-extrabold bg-black/25 px-2 py-0.5 rounded-full inline-block">
                Floor Rate Protection Breach
              </div>
              <h3 className="text-lg font-black mt-0.5">Discretionary Sales Discount Alert</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breach Details Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Warning Banner */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-900 leading-relaxed">
                <strong className="font-bold block text-sm text-red-700 mb-1">
                  Sub-Floor Price Warning for {unitLabel}
                </strong>
                Selling below project floor price diminishes the syndicate profit pool and triggers mandatory 2-partner consensus sign-off under the syndicate partnership deed.
              </div>
            </div>
          </div>

          {/* Variance Breakdown Grid */}
          <div className="grid grid-cols-3 gap-3 bg-[#F4F4F6] p-3.5 rounded-2xl text-center">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Floor Rate</span>
              <span className="text-sm font-black text-gray-900">{formatINR(floorRate)}/{extentUnit}</span>
            </div>
            <div className="p-2 bg-white rounded-xl shadow-sm border border-red-200">
              <span className="text-[10px] text-red-600 block uppercase font-bold">Proposed Rate</span>
              <span className="text-sm font-black text-red-600">{formatINR(attemptedRate)}/{extentUnit}</span>
            </div>
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm">
              <span className="text-[10px] text-red-100 block uppercase font-bold">Total Deficit</span>
              <span className="text-sm font-black">-{formatINR(totalFinancialDeficit)}</span>
            </div>
          </div>

          {/* Partner Consensus Authorization Section */}
          <div className="space-y-3 pt-1 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              <label className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Multi-Partner Digital Authorization (Minimum 2 Signatures)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Authorizing Partner 1:</label>
                <select
                  value={authPartner1}
                  onChange={(e) => setAuthPartner1(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                >
                  <option value="Partner A: Srikanth Reddy (Managing Partner)">Partner A: Srikanth Reddy (MP)</option>
                  <option value="Partner B: K. Venkat Rao">Partner B: K. Venkat Rao</option>
                  <option value="Partner C: Rajesh Varma">Partner C: Rajesh Varma</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Authorizing Partner 2 (Co-Signer):</label>
                <select
                  value={authPartner2}
                  onChange={(e) => setAuthPartner2(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                >
                  <option value="Partner B: K. Venkat Rao">Partner B: K. Venkat Rao</option>
                  <option value="Partner C: Rajesh Varma">Partner C: Rajesh Varma</option>
                  <option value="Partner D: Murali Krishna">Partner D: Murali Krishna</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Justification / Meeting Minutes:</label>
              <input
                type="text"
                value={signNotes}
                onChange={(e) => setSignNotes(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Reason for rate concession..."
              />
            </div>

            <div>
              <label className="text-[11px] text-gray-500 block mb-1">
                Executive Authorization PIN (Enter 4 Digits):
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  value={signPin}
                  onChange={(e) => {
                    setSignPin(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 pl-9 text-xs font-mono font-bold tracking-widest text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="••••"
                  autoFocus
                />
                <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              </div>
              {error && <p className="text-[11px] text-red-600 mt-1 font-medium">{error}</p>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-all"
            >
              Cancel (Retain Floor Rate)
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-full shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Override & Authorize Discount</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
