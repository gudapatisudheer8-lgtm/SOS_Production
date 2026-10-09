import React, { useState } from 'react';
import { PlotDistributionConfig, LayoutAmenity } from '../../types';
import {
  Compass,
  TreePine,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Percent,
  Sliders,
  Building,
  Eye,
  ChevronRight
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

interface OpenPlottingPlanBuilderProps {
  extentValue: number;
  extentUnit: string;
  floorRatePerSqYard: number;
  distribution: PlotDistributionConfig;
  onDistributionChange: (dist: PlotDistributionConfig) => void;
  amenities: LayoutAmenity[];
  onAmenitiesChange: (amenities: LayoutAmenity[]) => void;
  roadWidth: number;
  openSpacePercent: number;
}

export const OpenPlottingPlanBuilder: React.FC<OpenPlottingPlanBuilderProps> = ({
  extentValue,
  extentUnit,
  floorRatePerSqYard,
  distribution,
  onDistributionChange,
  amenities,
  onAmenitiesChange,
  roadWidth,
  openSpacePercent,
}) => {
  const [newAmenityName, setNewAmenityName] = useState('');
  const [newAmenityArea, setNewAmenityArea] = useState<number>(500);
  const [showAddAmenity, setShowAddAmenity] = useState(false);
  const [showLiveGridPreview, setShowLiveGridPreview] = useState(false);

  // Total extent in Sq. Yards
  const totalExtentSqYds =
    extentUnit === 'Acres'
      ? extentValue * 4840
      : extentUnit === 'Guntas / Cents'
      ? extentValue * 48.4
      : extentValue;

  // Ensure default values if undefined (defaults to 0, no hardcoded limitations)
  const eastCount = distribution.eastPlotsCount ?? distribution.premiumPlotsCount ?? 0;
  const eastArea = distribution.eastAreaSqYards ?? distribution.premiumAreaSqYards ?? 0;

  const northCount = distribution.northPlotsCount ?? 0;
  const northArea = distribution.northAreaSqYards ?? 0;

  const westCount = distribution.westPlotsCount ?? distribution.standardPlotsCount ?? 0;
  const westArea = distribution.westAreaSqYards ?? distribution.standardAreaSqYards ?? 0;

  const southCount = distribution.southPlotsCount ?? 0;
  const southArea = distribution.southAreaSqYards ?? 0;

  const cornerCount = distribution.cornerPlotsCount ?? 0;
  const cornerArea = distribution.cornerAreaSqYards ?? 0;

  const commercialCount = distribution.commercialPlotsCount ?? 0;
  const commercialArea = distribution.commercialAreaSqYards ?? 0;

  // Subtotals
  const totalEastArea = eastCount * eastArea;
  const totalNorthArea = northCount * northArea;
  const totalWestArea = westCount * westArea;
  const totalSouthArea = southCount * southArea;
  const totalCornerArea = cornerCount * cornerArea;
  const totalCommercialArea = commercialCount * commercialArea;

  const totalPlottedArea =
    totalEastArea + totalNorthArea + totalWestArea + totalSouthArea + totalCornerArea + totalCommercialArea;

  const totalPlotsCount =
    eastCount + northCount + westCount + southCount + cornerCount + commercialCount;

  const totalAmenitiesArea = amenities.reduce((sum, a) => sum + (Number(a.allocatedAreaSqYards) || 0), 0);
  const estimatedRoadArea = Math.round(totalExtentSqYds * (roadWidth >= 40 ? 0.28 : 0.22));

  const handleUpdate = (field: keyof PlotDistributionConfig, val: number) => {
    const numVal = isNaN(val) ? 0 : Math.max(0, val);
    onDistributionChange({
      ...distribution,
      eastPlotsCount: field === 'eastPlotsCount' ? numVal : eastCount,
      eastAreaSqYards: field === 'eastAreaSqYards' ? numVal : eastArea,
      northPlotsCount: field === 'northPlotsCount' ? numVal : northCount,
      northAreaSqYards: field === 'northAreaSqYards' ? numVal : northArea,
      westPlotsCount: field === 'westPlotsCount' ? numVal : westCount,
      westAreaSqYards: field === 'westAreaSqYards' ? numVal : westArea,
      southPlotsCount: field === 'southPlotsCount' ? numVal : southCount,
      southAreaSqYards: field === 'southAreaSqYards' ? numVal : southArea,
      cornerPlotsCount: field === 'cornerPlotsCount' ? numVal : cornerCount,
      cornerAreaSqYards: field === 'cornerAreaSqYards' ? numVal : cornerArea,
      commercialPlotsCount: field === 'commercialPlotsCount' ? numVal : commercialCount,
      commercialAreaSqYards: field === 'commercialAreaSqYards' ? numVal : commercialArea,
      // Keep standard & premium in sync for backward compatibility
      standardPlotsCount: field === 'westPlotsCount' ? numVal : westCount,
      standardAreaSqYards: field === 'westAreaSqYards' ? numVal : westArea,
      premiumPlotsCount: field === 'eastPlotsCount' ? numVal : eastCount,
      premiumAreaSqYards: field === 'eastAreaSqYards' ? numVal : eastArea,
      [field]: numVal,
    });
  };

  const handleAddAmenity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmenityName.trim()) return;

    const newAmenity: LayoutAmenity = {
      id: `layout-amenity-${Date.now()}`,
      name: newAmenityName.trim(),
      allocatedAreaSqYards: Number(newAmenityArea) || 200,
      category: 'park',
    };

    onAmenitiesChange([...amenities, newAmenity]);
    setNewAmenityName('');
    setNewAmenityArea(500);
    setShowAddAmenity(false);
  };

  const handleRemoveAmenity = (id: string) => {
    onAmenitiesChange(amenities.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Title & Context */}
      <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-700" />
            <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
              Directional Facing Demarcation Matrix (East, North, West, South &amp; Corners)
            </h4>
          </div>
          <p className="text-[11px] text-amber-900 mt-0.5">
            Split venture plots individually by directional facing and layout road hierarchy for accurate pricing and customer booking.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Plotted Units</span>
            <span className="text-sm font-black text-gray-900 font-mono">
              {totalPlotsCount} Plots ({totalPlottedArea.toLocaleString('en-IN')} Sq.Yds)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowLiveGridPreview(!showLiveGridPreview)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>{showLiveGridPreview ? 'Hide Venture Grid' : 'Live Venture Grid'}</span>
          </button>
        </div>
      </div>

      {/* DIRECTIONAL SPLIT: 6 DISTINCT CATEGORIES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. East Facing Plots */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-2.5 bg-amber-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm">🌅</span>
              <span className="text-xs font-black text-amber-950">East Facing</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-black">
              Sunrise
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Plots Count</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={eastCount === 0 ? '' : eastCount}
                onChange={(e) => handleUpdate('eastPlotsCount', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-black text-gray-950 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Area / Plot (Sq.Yds)</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={eastArea === 0 ? '' : eastArea}
                onChange={(e) => handleUpdate('eastAreaSqYards', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-gray-950 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-[11px] text-amber-900 font-semibold">
            <span>Sub-total:</span>
            <strong className="text-amber-950 font-bold">{totalEastArea.toLocaleString('en-IN')} Sq.Yds</strong>
          </div>
        </div>

        {/* 2. North Facing Plots */}
        <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-2xs space-y-2.5 bg-blue-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm">⭐</span>
              <span className="text-xs font-black text-blue-950">North Facing</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-black">
              Kubera
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Plots Count</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={northCount === 0 ? '' : northCount}
                onChange={(e) => handleUpdate('northPlotsCount', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-black text-gray-950 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Area / Plot (Sq.Yds)</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={northArea === 0 ? '' : northArea}
                onChange={(e) => handleUpdate('northAreaSqYards', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-gray-950 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-blue-100 flex items-center justify-between text-[11px] text-blue-900 font-semibold">
            <span>Sub-total:</span>
            <strong className="text-blue-950 font-bold">{totalNorthArea.toLocaleString('en-IN')} Sq.Yds</strong>
          </div>
        </div>

        {/* 3. West Facing Plots */}
        <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-2xs space-y-2.5 bg-purple-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm">🌇</span>
              <span className="text-xs font-black text-purple-950">West Facing</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold">
              Standard
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Plots Count</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={westCount === 0 ? '' : westCount}
                onChange={(e) => handleUpdate('westPlotsCount', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-black text-gray-950 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Area / Plot (Sq.Yds)</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={westArea === 0 ? '' : westArea}
                onChange={(e) => handleUpdate('westAreaSqYards', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-purple-300 rounded-lg text-xs font-bold text-gray-950 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-purple-100 flex items-center justify-between text-[11px] text-purple-900 font-semibold">
            <span>Sub-total:</span>
            <strong className="text-purple-950 font-bold">{totalWestArea.toLocaleString('en-IN')} Sq.Yds</strong>
          </div>
        </div>

        {/* 4. South Facing Plots */}
        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-2xs space-y-2.5 bg-rose-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm">☀️</span>
              <span className="text-xs font-black text-rose-950">South Facing</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-900 font-bold">
              Budget
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Plots Count</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={southCount === 0 ? '' : southCount}
                onChange={(e) => handleUpdate('southPlotsCount', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-black text-gray-950 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Area / Plot (Sq.Yds)</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={southArea === 0 ? '' : southArea}
                onChange={(e) => handleUpdate('southAreaSqYards', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-bold text-gray-950 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-rose-100 flex items-center justify-between text-[11px] text-rose-900 font-semibold">
            <span>Sub-total:</span>
            <strong className="text-rose-950 font-bold">{totalSouthArea.toLocaleString('en-IN')} Sq.Yds</strong>
          </div>
        </div>

        {/* 5. Corner Plots */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs space-y-2.5 bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm">👑</span>
              <span className="text-xs font-black text-emerald-950">Corner Plots</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-black">
              NE / SE
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Plots Count</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={cornerCount === 0 ? '' : cornerCount}
                onChange={(e) => handleUpdate('cornerPlotsCount', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-black text-gray-950 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Area / Plot (Sq.Yds)</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={cornerArea === 0 ? '' : cornerArea}
                onChange={(e) => handleUpdate('cornerAreaSqYards', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-gray-950 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-900 font-semibold">
            <span>Sub-total:</span>
            <strong className="text-emerald-950 font-bold">{totalCornerArea.toLocaleString('en-IN')} Sq.Yds</strong>
          </div>
        </div>

        {/* 6. Commercial Frontage Plots */}
        <div className="bg-white p-3.5 rounded-2xl border border-indigo-200 shadow-2xs space-y-2.5 bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm">🏢</span>
              <span className="text-xs font-black text-indigo-950">Commercial</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-black">
              Main Road
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Plots Count</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={commercialCount === 0 ? '' : commercialCount}
                onChange={(e) => handleUpdate('commercialPlotsCount', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-black text-gray-950 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Area / Plot (Sq.Yds)</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={commercialArea === 0 ? '' : commercialArea}
                onChange={(e) => handleUpdate('commercialAreaSqYards', e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-gray-950 outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-indigo-100 flex items-center justify-between text-[11px] text-indigo-900 font-semibold">
            <span>Sub-total:</span>
            <strong className="text-indigo-950 font-bold">{totalCommercialArea.toLocaleString('en-IN')} Sq.Yds</strong>
          </div>
        </div>
      </div>

      {/* LIVE VENTURE MASTER LAYOUT PREVIEW (WHEN TOGGLED) */}
      {showLiveGridPreview && (
        <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-3xl border border-slate-800 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-400" />
              <h5 className="font-black text-white text-xs sm:text-sm uppercase tracking-wide">
                Live Venture Master Demarcation Grid Preview (Generated from Entered Splits)
              </h5>
            </div>
            <span className="text-[11px] text-amber-400 font-mono font-bold">
              {totalPlotsCount} Plots Demarcated
            </span>
          </div>

          {/* Road Network Graphics */}
          <div className="h-6 bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden border border-slate-700">
            <div className="w-full border-t border-dashed border-amber-400/80" />
            <span className="absolute text-[9px] uppercase font-black tracking-widest text-amber-300 bg-slate-900 px-3 py-0.2 rounded-full">
              40 FT MAIN ROAD FRONTAGE (COMMERCIAL: {commercialCount} PLOTS)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-800/80 rounded-2xl border border-amber-500/30">
              <span className="text-[10px] text-amber-300 font-bold uppercase block">Sector A (East)</span>
              <strong className="text-base text-white font-mono block mt-1">{eastCount} Plots</strong>
              <span className="text-[10px] text-slate-400">Avg {eastArea} Sq.Yds / Plot</span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-2xl border border-blue-500/30">
              <span className="text-[10px] text-blue-300 font-bold uppercase block">Sector B (North)</span>
              <strong className="text-base text-white font-mono block mt-1">{northCount} Plots</strong>
              <span className="text-[10px] text-slate-400">Avg {northArea} Sq.Yds / Plot</span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-2xl border border-purple-500/30">
              <span className="text-[10px] text-purple-300 font-bold uppercase block">Sector C (West)</span>
              <strong className="text-base text-white font-mono block mt-1">{westCount} Plots</strong>
              <span className="text-[10px] text-slate-400">Avg {westArea} Sq.Yds / Plot</span>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-2xl border border-emerald-500/30">
              <span className="text-[10px] text-emerald-300 font-bold uppercase block">Corner Enclaves</span>
              <strong className="text-base text-white font-mono block mt-1">{cornerCount} Plots</strong>
              <span className="text-[10px] text-slate-400">Avg {cornerArea} Sq.Yds / Plot</span>
            </div>
          </div>

          <div className="h-5 bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden border border-slate-700">
            <div className="w-full border-t border-dashed border-white/40" />
            <span className="absolute text-[8px] uppercase font-bold tracking-widest text-slate-300 bg-slate-900 px-3 py-0.2 rounded-full">
              33 FT INTERNAL SECTOR ROADS &amp; STATUTORY PARKS
            </span>
          </div>
        </div>
      )}

      {/* STATUTORY LAYOUT AMENITIES & OPEN SPACE PLANNING */}
      <div className="bg-emerald-50/40 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <TreePine className="w-5 h-5 text-emerald-700" />
              <h4 className="text-xs sm:text-sm font-black text-emerald-950 uppercase tracking-wide">
                Layout Statutory Open Space &amp; Community Amenities Planning
              </h4>
            </div>
            <p className="text-[11px] text-emerald-900 mt-0.5">
              Statutory 10% DTCP / CRDA / HMDA public park reserves, overhead water tank (OHT), utilities, and entrance arch.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddAmenity(!showAddAmenity)}
            className="self-start sm:self-auto px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-950 rounded-xl text-xs font-bold border border-emerald-300 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>+ Add Layout Utility Area</span>
          </button>
        </div>

        {/* Add amenity modal/form */}
        {showAddAmenity && (
          <form
            onSubmit={handleAddAmenity}
            className="bg-white p-3.5 rounded-xl border border-emerald-300 shadow-sm flex flex-wrap items-center gap-3"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                Layout Utility / Space Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Electrical Transformer Yard, Gated Arch Plaza, Sump"
                value={newAmenityName}
                onChange={(e) => setNewAmenityName(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 outline-none"
              />
            </div>

            <div className="w-36">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                Area (Sq.Yards)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={newAmenityArea === 0 ? '' : newAmenityArea}
                onChange={(e) => setNewAmenityArea(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-black text-gray-900 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-xs hover:bg-emerald-700"
              >
                Add Space
              </button>
              <button
                type="button"
                onClick={() => setShowAddAmenity(false)}
                className="px-3 py-1.5 text-gray-500 hover:text-gray-900 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Amenities List */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {amenities.map((amenity) => (
            <div
              key={amenity.id}
              className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-gray-900 block truncate">{amenity.name}</span>
                <span className="text-[10px] text-emerald-700 font-bold block">
                  {amenity.allocatedAreaSqYards.toLocaleString('en-IN')} Sq.Yds allocated
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveAmenity(amenity.id)}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Remove space"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
