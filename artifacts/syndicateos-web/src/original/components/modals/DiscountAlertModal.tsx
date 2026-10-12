import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, X, Users } from 'lucide-react';
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
    const [signNotes, setSignNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const rateDeficit = floorRate - attemptedRate;
  const totalFinancialDeficit = rateDeficit * unitExtent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signNotes.trim()) {
      setError('Enter the justification for the rate concession.');
      return;
    }
    const approvedSignature = `Concession requested by signed-in user: ${signNotes.trim()} (recorded with booking)`;
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
                Selling below project floor price diminishes the syndicate profit pool and is recorded with your justification and your signed-in identity; no PIN is entered here.
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
                Rate Concession Request
              </label>
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

            {error && <p className="text-[11px] text-red-600 mt-1 font-medium">{error}</p>}
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
