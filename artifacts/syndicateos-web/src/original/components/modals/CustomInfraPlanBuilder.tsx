import React from 'react';
import { Hammer, HardHat, Plus, Trash2 } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export interface InfraPackageConfig {
  id: string;
  name: string;
  chainage: string;
  scopeCategory: string;
  targetCompletionMonths: number;
}

export interface InfraFacilityConfig {
  id: string;
  name: string;
  areaString: string;
  purpose: string;
}

interface CustomInfraPlanBuilderProps {
  packages: InfraPackageConfig[];
  onPackagesChange: (packages: InfraPackageConfig[]) => void;
  facilities: InfraFacilityConfig[];
  onFacilitiesChange: (facilities: InfraFacilityConfig[]) => void;
}

export const CustomInfraPlanBuilder: React.FC<CustomInfraPlanBuilderProps> = ({
  packages,
  onPackagesChange,
  facilities,
  onFacilitiesChange,
}) => {
  const handleUpdatePackage = (idx: number, field: keyof InfraPackageConfig, val: any) => {
    const updated = [...packages];
    updated[idx] = {
      ...updated[idx],
      [field]: val,
    };
    onPackagesChange(updated);
  };

  const handleAddPackage = () => {
    const nextIdx = packages.length + 1;
    const newPkg: InfraPackageConfig = {
      id: `pkg-${Date.now()}`,
      name: `Package ${nextIdx} - Road Widening & DBM`,
      chainage: `KM ${nextIdx}.0 to KM ${nextIdx + 1}.5`,
      scopeCategory: 'Bituminous Macadam & Wearing Course',
      targetCompletionMonths: 6,
    };
    onPackagesChange([...packages, newPkg]);
  };

  const handleRemovePackage = (idx: number) => {
    if (packages.length <= 1) return;
    onPackagesChange(packages.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Hammer className="w-5 h-5 text-amber-700" />
            <h4 className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide">
              Turnkey Contract Packages &amp; Site Plant Facilities
            </h4>
          </div>
          <p className="text-[11px] text-amber-900 mt-0.5">
            Configure chainage packages, work categories, site batching yards, and resident QC testing lab setup.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddPackage}
          className="self-start sm:self-auto px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-950 rounded-xl text-xs font-bold border border-amber-300 shadow-2xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 text-amber-700" />
          <span>+ Add Chainage Package</span>
        </button>
      </div>

      {/* Packages Grid */}
      <div className="space-y-3">
        {packages.map((pkg, idx) => (
          <div
            key={pkg.id}
            className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={pkg.name}
                onChange={(e) => handleUpdatePackage(idx, 'name', e.target.value)}
                className="w-full text-xs font-black text-gray-950 border-b border-gray-200 focus:border-amber-500 outline-none pb-0.5 bg-transparent"
              />
              <span className="text-[10px] text-gray-500 font-semibold mt-0.5 block">
                {pkg.scopeCategory}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-36">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Chainage / Stretch</label>
                <input
                  type="text"
                  value={pkg.chainage}
                  onChange={(e) => handleUpdatePackage(idx, 'chainage', e.target.value)}
                  className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 outline-none"
                />
              </div>

              <div className="w-24">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Timeline</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={pkg.targetCompletionMonths}
                    onChange={(e) =>
                      handleUpdatePackage(idx, 'targetCompletionMonths', parseInt(e.target.value) || 1)
                    }
                    className="w-14 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 outline-none"
                  />
                  <span className="text-[10px] text-gray-500 font-bold">Mos</span>
                </div>
              </div>

              {packages.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemovePackage(idx)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Facilities: Batching Plant, Yard */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
        <span className="text-xs font-bold text-gray-800 uppercase tracking-wide block">
          Site Batching Plants &amp; Equipment Yard Facilities
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {facilities.map((fac) => (
            <div key={fac.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-900 block truncate">{fac.name}</span>
              <span className="text-[10px] text-gray-500 block">{fac.purpose}</span>
              <span className="text-xs font-black text-amber-800 mt-1 block">{fac.areaString}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
