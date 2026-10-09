import React, { useState } from 'react';
import { Wine, Store, Plus, Trash2, ShieldCheck, DollarSign } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export interface RetailCounterConfig {
  id: string;
  name: string;
  category: 'Premium Walk-in Lounge' | 'High-Footfall Transit' | 'Highway Express' | 'Urban Neighborhood';
  sqFtArea: number;
  dailySalesTarget: number;
  staffCount: number;
}

export interface LiquorFacilityConfig {
  id: string;
  name: string;
  sqFtArea: number;
  description: string;
}

interface LiquorVendPlanBuilderProps {
  counters: RetailCounterConfig[];
  onCountersChange: (counters: RetailCounterConfig[]) => void;
  facilities: LiquorFacilityConfig[];
  onFacilitiesChange: (facilities: LiquorFacilityConfig[]) => void;
}

export const LiquorVendPlanBuilder: React.FC<LiquorVendPlanBuilderProps> = ({
  counters,
  onCountersChange,
  facilities,
  onFacilitiesChange,
}) => {
  const handleUpdateCounter = (idx: number, field: keyof RetailCounterConfig, val: any) => {
    const updated = [...counters];
    updated[idx] = {
      ...updated[idx],
      [field]: field === 'sqFtArea' || field === 'dailySalesTarget' || field === 'staffCount' ? Number(val) || 0 : val,
    };
    onCountersChange(updated);
  };

  const handleAddCounter = () => {
    const newIdx = counters.length + 1;
    const newCounter: RetailCounterConfig = {
      id: `counter-${Date.now()}`,
      name: `Excise Vend #${newIdx < 10 ? '0' + newIdx : newIdx}`,
      category: 'Urban Neighborhood',
      sqFtArea: 400,
      dailySalesTarget: 300000,
      staffCount: 3,
    };
    onCountersChange([...counters, newCounter]);
  };

  const handleRemoveCounter = (idx: number) => {
    if (counters.length <= 1) return;
    onCountersChange(counters.filter((_, i) => i !== idx));
  };

  const totalDailyTarget = counters.reduce((sum, c) => sum + (c.dailySalesTarget || 0), 0);
  const totalRetailSft = counters.reduce((sum, c) => sum + (c.sqFtArea || 0), 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Wine className="w-5 h-5 text-rose-700" />
            <h4 className="text-xs sm:text-sm font-black text-rose-950 uppercase tracking-wide">
              Retail Counter Outlets &amp; Logistics Space Planning
            </h4>
          </div>
          <p className="text-[11px] text-rose-900 mt-0.5">
            Configure retail outlet shops, sales counters, walk-in storage chillers, and security cash vault rooms.
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Daily Sales Target</span>
          <span className="text-sm font-black text-rose-950 font-mono">
            {formatINR(totalDailyTarget)} / Day ({counters.length} Vends)
          </span>
        </div>
      </div>

      {/* Counters Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-800">Licensed A4 Retail Shop Counters ({counters.length})</span>
          <button
            type="button"
            onClick={handleAddCounter}
            className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-950 rounded-xl text-xs font-bold border border-rose-300 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-rose-700" />
            <span>+ Add Retail Shop Counter</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {counters.map((counter, idx) => (
            <div
              key={counter.id}
              className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs space-y-3 relative"
            >
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={counter.name}
                  onChange={(e) => handleUpdateCounter(idx, 'name', e.target.value)}
                  className="text-xs font-black text-gray-950 border-b border-gray-200 focus:border-rose-500 outline-none pb-0.5 bg-transparent"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    Target: {formatINR(counter.dailySalesTarget)}/d
                  </span>
                  {counters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCounter(idx)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Outlet Type</label>
                  <select
                    value={counter.category}
                    onChange={(e) => handleUpdateCounter(idx, 'category', e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 outline-none"
                  >
                    <option value="Premium Walk-in Lounge">Premium Walk-in Lounge</option>
                    <option value="High-Footfall Transit">High-Footfall Transit</option>
                    <option value="Highway Express">Highway Express</option>
                    <option value="Urban Neighborhood">Urban Neighborhood</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Floor Sq.Ft</label>
                  <input
                    type="number"
                    step="50"
                    value={counter.sqFtArea}
                    onChange={(e) => handleUpdateCounter(idx, 'sqFtArea', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Daily Target (₹)</label>
                  <input
                    type="number"
                    step="10000"
                    value={counter.dailySalesTarget}
                    onChange={(e) => handleUpdateCounter(idx, 'dailySalesTarget', parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Facilities: Chiller, Vault */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
        <span className="text-xs font-bold text-gray-800 uppercase tracking-wide block">
          Central Cold Storage &amp; Cash Security Vault Facilities
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {facilities.map((fac) => (
            <div key={fac.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-900 block truncate">{fac.name}</span>
              <span className="text-[10px] text-gray-500 block">{fac.description}</span>
              <span className="text-xs font-black text-rose-800 mt-1 block">{fac.sqFtArea} SFT</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
