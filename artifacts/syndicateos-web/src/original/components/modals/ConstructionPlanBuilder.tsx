import React, { useState } from 'react';
import { FloorFlatConfig, FlatConfigUnit, ProjectAmenity } from '../../types';
import {
  Building2,
  Plus,
  Trash2,
  Copy,
  Layers,
  Sparkles,
  Info,
  Dumbbell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sliders,
  DollarSign
} from 'lucide-react';
import { formatINR, formatIndianCompact } from '../../utils/formatters';

interface ConstructionPlanBuilderProps {
  floorsCount: number;
  onFloorsCountChange: (count: number) => void;
  floorPlans: FloorFlatConfig[];
  onFloorPlansChange: (plans: FloorFlatConfig[]) => void;
  amenities: ProjectAmenity[];
  onAmenitiesChange: (amenities: ProjectAmenity[]) => void;
  baseSqFtRate: number;
}

const FLAT_TYPES: FlatConfigUnit['flatType'][] = [
  '1 BHK',
  '2 BHK',
  '2.5 BHK',
  '3 BHK',
  '4 BHK',
  'Duplex Penthouse',
];

const FACINGS: FlatConfigUnit['facing'][] = [
  'East',
  'North',
  'West',
  'South',
  'Corner',
];

export const ConstructionPlanBuilder: React.FC<ConstructionPlanBuilderProps> = ({
  floorsCount,
  onFloorsCountChange,
  floorPlans,
  onFloorPlansChange,
  amenities,
  onAmenitiesChange,
  baseSqFtRate,
}) => {
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0);
  const [newAmenityName, setNewAmenityName] = useState('');
  const [newAmenitySqFt, setNewAmenitySqFt] = useState<number>(1500);
  const [showAddAmenityForm, setShowAddAmenityForm] = useState(false);

  // Sync floor count with floorPlans array
  const handleFloorsChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(25, newCount));
    onFloorsCountChange(validCount);

    if (validCount > floorPlans.length) {
      // Add missing floors based on floor 1 or default template
      const templateFloor = floorPlans[0] || null;
      const newPlans = [...floorPlans];

      for (let f = floorPlans.length + 1; f <= validCount; f++) {
        const isPenthouseFloor = f === validCount && validCount >= 4;
        const defaultUnits: FlatConfigUnit[] = templateFloor
          ? templateFloor.units.map((u, idx) => ({
              ...u,
              unitNumber: `#${f}${idx + 1 < 10 ? '0' + (idx + 1) : idx + 1}`,
              baseRate: baseSqFtRate,
            }))
          : [
              { unitNumber: `#${f}01`, flatType: '3 BHK', sftArea: 1650, facing: 'East', baseRate: baseSqFtRate },
              { unitNumber: `#${f}02`, flatType: '2 BHK', sftArea: 1250, facing: 'North', baseRate: baseSqFtRate },
              { unitNumber: `#${f}03`, flatType: '2 BHK', sftArea: 1250, facing: 'West', baseRate: baseSqFtRate },
              { unitNumber: `#${f}04`, flatType: '3 BHK', sftArea: 1650, facing: 'Corner', baseRate: baseSqFtRate },
            ];

        if (isPenthouseFloor && defaultUnits.length >= 2) {
          defaultUnits[0].flatType = 'Duplex Penthouse';
          defaultUnits[0].sftArea = 2500;
          defaultUnits[defaultUnits.length - 1].flatType = 'Duplex Penthouse';
          defaultUnits[defaultUnits.length - 1].sftArea = 2500;
        }

        newPlans.push({
          floorNumber: f,
          floorLabel: isPenthouseFloor ? `Floor ${f} (Penthouse Floor)` : f === 1 ? 'Floor 1 (Ground / Lower)' : `Floor ${f}`,
          flatsCount: defaultUnits.length,
          units: defaultUnits,
        });
      }
      onFloorPlansChange(newPlans);
    } else if (validCount < floorPlans.length) {
      onFloorPlansChange(floorPlans.slice(0, validCount));
      if (activeFloorIndex >= validCount) {
        setActiveFloorIndex(validCount - 1);
      }
    }
  };

  // Duplicate Floor 1 configuration across all floors
  const handleCopyFloor1ToAll = () => {
    if (floorPlans.length === 0) return;
    const f1Units = floorPlans[0].units;

    const updated = floorPlans.map((floor, fIdx) => {
      const fNum = floor.floorNumber;
      return {
        ...floor,
        flatsCount: f1Units.length,
        units: f1Units.map((u, uIdx) => ({
          ...u,
          unitNumber: `#${fNum}${uIdx + 1 < 10 ? '0' + (uIdx + 1) : uIdx + 1}`,
          baseRate: u.baseRate || baseSqFtRate,
        })),
      };
    });

    onFloorPlansChange(updated);
  };

  // Add flat to a specific floor
  const handleAddFlatToFloor = (floorIdx: number) => {
    const targetFloor = floorPlans[floorIdx];
    if (!targetFloor) return;

    const nextIndex = targetFloor.units.length + 1;
    const newUnit: FlatConfigUnit = {
      unitNumber: `#${targetFloor.floorNumber}${nextIndex < 10 ? '0' + nextIndex : nextIndex}`,
      flatType: '2 BHK',
      sftArea: 1250,
      facing: 'East',
      baseRate: baseSqFtRate,
    };

    const updated = [...floorPlans];
    updated[floorIdx] = {
      ...targetFloor,
      flatsCount: targetFloor.units.length + 1,
      units: [...targetFloor.units, newUnit],
    };
    onFloorPlansChange(updated);
  };

  // Remove flat from floor
  const handleRemoveFlat = (floorIdx: number, flatIdx: number) => {
    const targetFloor = floorPlans[floorIdx];
    if (!targetFloor || targetFloor.units.length <= 1) return;

    const updatedUnits = targetFloor.units.filter((_, idx) => idx !== flatIdx);
    const updated = [...floorPlans];
    updated[floorIdx] = {
      ...targetFloor,
      flatsCount: updatedUnits.length,
      units: updatedUnits,
    };
    onFloorPlansChange(updated);
  };

  // Update specific flat field
  const handleUpdateFlat = (
    floorIdx: number,
    flatIdx: number,
    field: keyof FlatConfigUnit,
    val: any
  ) => {
    const updated = [...floorPlans];
    const floor = updated[floorIdx];
    const unit = floor.units[flatIdx];

    floor.units[flatIdx] = {
      ...unit,
      [field]: field === 'sftArea' || field === 'baseRate' ? Number(val) || 0 : val,
    };
    onFloorPlansChange(updated);
  };

  // Amenities handling
  const handleToggleAmenity = (id: string) => {
    const exists = amenities.some((a) => a.id === id);
    if (exists) {
      onAmenitiesChange(amenities.filter((a) => a.id !== id));
    }
  };

  const handleUpdateAmenitySqFt = (id: string, sft: number) => {
    onAmenitiesChange(
      amenities.map((a) => (a.id === id ? { ...a, plannedSqFt: Number(sft) || 0 } : a))
    );
  };

  const handleAddCustomAmenity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmenityName.trim()) return;

    const newAmenity: ProjectAmenity = {
      id: `amenity-custom-${Date.now()}`,
      name: newAmenityName.trim(),
      plannedSqFt: Number(newAmenitySqFt) || 1000,
      floorLocation: 'Common Block / Podium',
      description: 'Custom community amenity',
    };

    onAmenitiesChange([...amenities, newAmenity]);
    setNewAmenityName('');
    setNewAmenitySqFt(1500);
    setShowAddAmenityForm(false);
  };

  const handleRemoveAmenity = (id: string) => {
    onAmenitiesChange(amenities.filter((a) => a.id !== id));
  };

  // Aggregate Metrics
  const totalFlats = floorPlans.reduce((sum, f) => sum + f.units.length, 0);
  const totalResidentialSft = floorPlans.reduce(
    (sum, f) => sum + f.units.reduce((uSum, u) => uSum + (Number(u.sftArea) || 0), 0),
    0
  );
  const totalAmenitiesSft = amenities.reduce((sum, a) => sum + (Number(a.plannedSqFt) || 0), 0);
  const commonCirculationSft = Math.round((totalResidentialSft + totalAmenitiesSft) * 0.18);
  const totalBuiltUpAreaSft = totalResidentialSft + totalAmenitiesSft + commonCirculationSft;

  const totalProjectedFlatValue = floorPlans.reduce((sum, f) => {
    return (
      sum +
      f.units.reduce((uSum, u) => {
        const rate = u.baseRate || baseSqFtRate;
        return uSum + (u.sftArea || 0) * rate;
      }, 0)
    );
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Controls: Floors Count & Automation */}
      <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-700" />
            <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
              Whole Construction Plan Matrix (Floors &amp; Flats Breakdown)
            </h4>
          </div>
          <p className="text-[11px] text-amber-900 mt-0.5">
            Configure number of floors, flats per floor, 2 BHK / 3 BHK / 4 BHK types, and individual square feet area.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-amber-300 shadow-2xs">
            <label className="text-[11px] font-bold text-gray-700">Floors:</label>
            <input
              type="number"
              min="1"
              max="25"
              value={floorsCount}
              onChange={(e) => handleFloorsChange(parseInt(e.target.value) || 1)}
              className="w-12 px-1.5 py-0.5 text-center text-xs font-black text-gray-950 bg-amber-50 rounded-lg outline-none border border-amber-200"
            />
          </div>

          <button
            type="button"
            onClick={handleCopyFloor1ToAll}
            className="px-3 py-1.5 bg-white hover:bg-amber-100/70 text-amber-950 rounded-xl text-xs font-bold border border-amber-300 shadow-2xs transition-colors flex items-center gap-1.5"
            title="Applies Flat count, 2BHK/3BHK types, and SqFt from Floor 1 to all other floors"
          >
            <Copy className="w-3.5 h-3.5 text-amber-700" />
            <span>Apply Floor 1 Specs to All</span>
          </button>
        </div>
      </div>

      {/* Live Construction Plan BUA Summary Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
          <span className="block text-[10px] font-bold text-gray-500 uppercase">Total Residential Units</span>
          <span className="text-base sm:text-lg font-black text-gray-950">
            {totalFlats} <span className="text-xs font-bold text-gray-500">Flats ({floorsCount} Floors)</span>
          </span>
        </div>

        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
          <span className="block text-[10px] font-bold text-gray-500 uppercase">Residential Built-up</span>
          <span className="text-base sm:text-lg font-black text-amber-700">
            {totalResidentialSft.toLocaleString('en-IN')} <span className="text-xs font-bold text-gray-500">SFT</span>
          </span>
        </div>

        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
          <span className="block text-[10px] font-bold text-gray-500 uppercase">Amenities &amp; Common Area</span>
          <span className="text-base sm:text-lg font-black text-sky-700">
            {(totalAmenitiesSft + commonCirculationSft).toLocaleString('en-IN')}{' '}
            <span className="text-xs font-bold text-gray-500">SFT</span>
          </span>
        </div>

        <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-300">
          <span className="block text-[10px] font-black text-amber-900 uppercase">Grand Total Project BUA</span>
          <span className="text-base sm:text-lg font-black text-gray-950">
            {totalBuiltUpAreaSft.toLocaleString('en-IN')} <span className="text-xs font-bold text-amber-900">SFT</span>
          </span>
        </div>
      </div>

      {/* Floor-by-Floor Construction Arrangement */}
      <div className="space-y-4">
        {/* Floor Selection Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {floorPlans.map((floor, idx) => {
            const floorSft = floor.units.reduce((s, u) => s + (u.sftArea || 0), 0);
            const isActive = activeFloorIndex === idx;

            return (
              <button
                key={floor.floorNumber}
                type="button"
                onClick={() => setActiveFloorIndex(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 border ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-950 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span>Floor {floor.floorNumber}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-amber-400 text-gray-950' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {floor.units.length} Flats
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Floor Flat Configuration Matrix */}
        {floorPlans[activeFloorIndex] && (
          <div className="bg-gray-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h5 className="text-xs sm:text-sm font-black text-gray-950">
                    {floorPlans[activeFloorIndex].floorLabel}
                  </h5>
                  <span className="text-xs text-gray-500 font-semibold">
                    • {floorPlans[activeFloorIndex].units.length} Flats •{' '}
                    {floorPlans[activeFloorIndex].units
                      .reduce((s, u) => s + (u.sftArea || 0), 0)
                      .toLocaleString('en-IN')}{' '}
                    SFT Floor Slab Area
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAddFlatToFloor(activeFloorIndex)}
                className="self-start sm:self-auto px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-gray-950 rounded-xl text-xs font-black shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Flat to Floor {floorPlans[activeFloorIndex].floorNumber}</span>
              </button>
            </div>

            {/* Flats Grid for this floor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {floorPlans[activeFloorIndex].units.map((unit, uIdx) => (
                <div
                  key={unit.unitNumber || uIdx}
                  className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={unit.unitNumber}
                        onChange={(e) =>
                          handleUpdateFlat(activeFloorIndex, uIdx, 'unitNumber', e.target.value)
                        }
                        className="w-20 px-2 py-1 text-xs font-black text-gray-950 bg-gray-100 rounded-lg border border-gray-200 outline-none text-center"
                        placeholder="Unit #"
                      />
                      <span className="text-[10px] font-bold text-gray-500">Unit ID</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {formatINR((unit.sftArea || 0) * (unit.baseRate || baseSqFtRate))}
                      </span>
                      {floorPlans[activeFloorIndex].units.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFlat(activeFloorIndex, uIdx)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove Flat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                        Configuration
                      </label>
                      <select
                        value={unit.flatType}
                        onChange={(e) =>
                          handleUpdateFlat(activeFloorIndex, uIdx, 'flatType', e.target.value)
                        }
                        className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 outline-none"
                      >
                        {FLAT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                        Area (Sq.Ft) *
                      </label>
                      <input
                        type="number"
                        step="25"
                        min="300"
                        value={unit.sftArea}
                        onChange={(e) =>
                          handleUpdateFlat(activeFloorIndex, uIdx, 'sftArea', e.target.value)
                        }
                        className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-black text-gray-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                        Facing
                      </label>
                      <select
                        value={unit.facing}
                        onChange={(e) =>
                          handleUpdateFlat(activeFloorIndex, uIdx, 'facing', e.target.value)
                        }
                        className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 outline-none"
                      >
                        {FACINGS.map((fc) => (
                          <option key={fc} value={fc}>
                            {fc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AMENITIES & COMMON FACILITIES PLANNING */}
      <div className="bg-amber-50/50 p-4 sm:p-5 rounded-2xl border border-amber-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-amber-700" />
              <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
                Amenities &amp; Common Facilities Planning (Clubhouse, Gym, Pool)
              </h4>
            </div>
            <p className="text-[11px] text-amber-900 mt-0.5">
              Specify planned square feet for the clubhouse, fitness centre/gym, pool deck, indoor sports, and other facilities.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddAmenityForm(!showAddAmenityForm)}
            className="self-start sm:self-auto px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-950 rounded-xl text-xs font-bold border border-amber-300 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-amber-700" />
            <span>+ Add Custom Facility</span>
          </button>
        </div>

        {/* Add custom amenity form */}
        {showAddAmenityForm && (
          <form
            onSubmit={handleAddCustomAmenity}
            className="bg-white p-3.5 rounded-xl border border-amber-300 shadow-sm flex flex-wrap items-center gap-3"
          >
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                Facility Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Squash Court, Yoga Pavilion, Rooftop Sky Cafe"
                value={newAmenityName}
                onChange={(e) => setNewAmenityName(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 outline-none"
              />
            </div>

            <div className="w-32">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                Planned Sq.Ft
              </label>
              <input
                type="number"
                step="100"
                min="100"
                value={newAmenitySqFt}
                onChange={(e) => setNewAmenitySqFt(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-black text-gray-900 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-500 text-gray-950 font-bold rounded-lg text-xs hover:bg-amber-400"
              >
                Add Amenity
              </button>
              <button
                type="button"
                onClick={() => setShowAddAmenityForm(false)}
                className="px-3 py-1.5 text-gray-500 hover:text-gray-900 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Amenities List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {amenities.map((amenity) => (
            <div
              key={amenity.id}
              className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-gray-900 block truncate">{amenity.name}</span>
                <span className="text-[10px] text-gray-500 block truncate">
                  {amenity.floorLocation || 'Podium Level'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                  <input
                    type="number"
                    step="100"
                    min="100"
                    value={amenity.plannedSqFt}
                    onChange={(e) => handleUpdateAmenitySqFt(amenity.id, parseInt(e.target.value) || 0)}
                    className="w-16 text-xs font-black text-amber-900 bg-transparent outline-none text-right"
                  />
                  <span className="text-[10px] font-bold text-amber-800">SFT</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveAmenity(amenity.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="Remove amenity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
