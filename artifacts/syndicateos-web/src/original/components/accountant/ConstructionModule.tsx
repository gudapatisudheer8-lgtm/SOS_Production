import React, { useState } from 'react';
import { ApartmentUnit, ApartmentPricingMatrix, FlatStatus, LedgerMode, Project, PlanUploadDocument } from '../../types';
import { formatINR, formatIndianCompact } from '../../utils/formatters';
import {
  Building,
  Sliders,
  DollarSign,
  CheckCircle2,
  Clock,
  User,
  Phone,
  ShieldCheck,
  Tag,
  Key,
  Layers,
  Sparkles,
  ShieldAlert,
  Eye,
  Dumbbell,
  Maximize2,
  X,
  FileText
} from 'lucide-react';
import { DiscountAlertModal } from '../modals/DiscountAlertModal';
import { SAMPLE_CONSTRUCTION_BLUEPRINT } from '../../data/sampleBlueprints';

interface ConstructionModuleProps {
  units: ApartmentUnit[];
  onUpdateUnit: (unit: ApartmentUnit) => void;
  pricingMatrix: ApartmentPricingMatrix;
  onUpdatePricingMatrix: (matrix: ApartmentPricingMatrix) => void;
  ledgerMode?: LedgerMode;
  project?: Project;
}

export const ConstructionModule: React.FC<ConstructionModuleProps> = ({
  units,
  onUpdateUnit,
  pricingMatrix,
  onUpdatePricingMatrix,
  ledgerMode = 'internal_syndicate',
  project,
}) => {
  const [selectedUnit, setSelectedUnit] = useState<ApartmentUnit | null>(null);
  const [showPriceMatrixModal, setShowPriceMatrixModal] = useState(false);
  const [tempPricing, setTempPricing] = useState<ApartmentPricingMatrix>({ ...pricingMatrix });
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [activeBlueprintDoc, setActiveBlueprintDoc] = useState<PlanUploadDocument | null>(null);
  const [showAmenitiesDrawer, setShowAmenitiesDrawer] = useState(false);

  // Floor Price Protection Modal state for apartments
  const FLOOR_RATE_PER_SQFT = 4400;
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [pendingDiscountUnit, setPendingDiscountUnit] = useState<ApartmentUnit | null>(null);

  // Group units by floor dynamically from units data
  const floorNumbers = Array.from(new Set(units.map((u) => u.floor))).sort((a, b) => b - a);
  const floors = floorNumbers.length > 0 ? floorNumbers : [5, 4, 3, 2, 1];

  // Derive blueprint image from project documents or fallback to sample
  const projectBlueprints = project?.planDocuments?.filter(
    (d) => d.category === 'floor_plan' || d.category === 'elevation' || d.category === 'master_layout'
  ) || [];

  const defaultBlueprintUrl =
    projectBlueprints.length > 0 && projectBlueprints[0].dataUrl
      ? projectBlueprints[0].dataUrl
      : SAMPLE_CONSTRUCTION_BLUEPRINT;

  const calculateUnitTotal = (unit: ApartmentUnit) => {
    const effectiveRate = unit.baseRate + unit.facingPremium + unit.floorRise;
    const baseAmount = unit.sftArea * effectiveRate;
    return baseAmount + unit.parkingFee + unit.amenitiesFee;
  };

  const bookedUnitsCount = units.filter((u) => u.status === 'booked' || u.status === 'registered').length;
  const availableUnitsCount = units.filter((u) => u.status === 'available').length;
  const totalCollections = units.reduce((acc, u) => acc + (u.advanceReceived || 0), 0);
  const totalProjectValue = units.reduce((acc, u) => acc + calculateUnitTotal(u), 0);

  const handleUnitFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    // Check Floor Rate Breach
    if (selectedUnit.baseRate < FLOOR_RATE_PER_SQFT) {
      setPendingDiscountUnit(selectedUnit);
      setShowDiscountModal(true);
      return;
    }

    onUpdateUnit(selectedUnit);
    setSelectedUnit(null);
  };

  const handleConfirmDiscountOverride = (approvedSignature: string) => {
    if (!pendingDiscountUnit) return;
    const updated = {
      ...pendingDiscountUnit,
      discountApprovedBy: approvedSignature,
    };
    onUpdateUnit(updated);
    setPendingDiscountUnit(null);
    setSelectedUnit(null);
  };

  const handleSavePricingMatrix = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePricingMatrix(tempPricing);

    // Recalculate units
    units.forEach((u) => {
      const facingPrem =
        u.facing === 'East'
          ? tempPricing.eastPremium
          : u.facing === 'North'
          ? tempPricing.northPremium
          : u.facing === 'Corner'
          ? tempPricing.cornerPremium
          : 0;
      const floorRise = (u.floor - 1) * tempPricing.floorRisePerFloor;

      onUpdateUnit({
        ...u,
        baseRate: tempPricing.baseSqFtRate,
        facingPremium: facingPrem,
        floorRise,
        parkingFee: tempPricing.carParkingFee,
        amenitiesFee: tempPricing.amenitiesFee,
      });
    });

    setShowPriceMatrixModal(false);
  };

  const milestoneSteps = [
    { name: 'Plinth Level', pct: '20%' },
    { name: '1st Slab', pct: '20%' },
    { name: 'Brickwork', pct: '15%' },
    { name: 'Plastering & Electrical', pct: '15%' },
    { name: 'Flooring', pct: '15%' },
    { name: 'Handover', pct: '15%' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Top Banner & Price Matrix Configuration Row */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-gray-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-[#FFB800]" />
              <h3 className="text-lg font-black text-gray-950">
                Residential Apartment Tower Construction Matrix
              </h3>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              G+5 Floor-by-floor unit matrix with automatic East/North premiums, floor-rise escalations, and milestone payment calls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setActiveBlueprintDoc(projectBlueprints[0] || null);
                setShowBlueprintModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-full text-xs shadow-xs transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Sanctioned Blueprint</span>
              {projectBlueprints.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-gray-950 font-black text-[10px]">
                  {projectBlueprints.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowAmenitiesDrawer(!showAmenitiesDrawer)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-950 font-bold rounded-full text-xs border border-amber-300 shadow-2xs transition-all"
            >
              <Dumbbell className="w-3.5 h-3.5 text-amber-700" />
              <span>Amenities &amp; BUA Plan</span>
            </button>

            <div className="bg-[#FFFDF0] px-3.5 py-1.5 rounded-full border border-amber-300 text-xs">
              <span className="text-gray-700 font-bold">Floor Rate: </span>
              <strong className="text-gray-950 font-black">{formatINR(FLOOR_RATE_PER_SQFT)}/Sft</strong>
            </div>

            <button
              id="btn-edit-pricing-matrix"
              onClick={() => {
                setTempPricing({ ...pricingMatrix });
                setShowPriceMatrixModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full text-xs shadow transition-all active:scale-95 border border-amber-600/30"
            >
              <Sliders className="w-4 h-4" />
              <span>Configure Pricing Matrix</span>
            </button>
          </div>
        </div>

        {/* Planned Amenities & Built-Up Area (BUA) Banner */}
        {showAmenitiesDrawer && (
          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-300/80 space-y-3 transition-all animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-950 tracking-wider">
                <Dumbbell className="w-4 h-4 text-amber-700" />
                <span>Planned Common Amenities &amp; Total Built-Up Area (BUA) Breakdown</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAmenitiesDrawer(false)}
                className="text-gray-400 hover:text-gray-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {(project?.amenities || [
                { id: '1', name: 'Clubhouse', plannedSqFt: 5000, description: 'Reception & Management' },
                { id: '2', name: 'Gymnasium', plannedSqFt: 2500, description: 'Cardio & Weights' },
                { id: '3', name: 'Swimming Pool', plannedSqFt: 1800, description: 'Lap Pool & Deck' },
                { id: '4', name: 'Badminton / Games', plannedSqFt: 1600, description: 'Indoor Sports' },
                { id: '5', name: 'Banquet Hall', plannedSqFt: 3000, description: 'Party Lounge' },
                { id: '6', name: 'Play Area & Creche', plannedSqFt: 1200, description: 'Kids Play Zone' },
              ]).map((am) => (
                <div key={am.id} className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs">
                  <span className="text-[11px] font-bold text-gray-900 block truncate">{am.name}</span>
                  <span className="text-[10px] text-gray-500 block truncate">{am.description}</span>
                  <span className="text-xs font-black text-amber-800 mt-1 block">
                    {am.plannedSqFt.toLocaleString('en-IN')} SFT
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200 text-xs font-semibold text-amber-950">
              <span>
                Total Planned Amenities:{' '}
                <strong className="font-bold">
                  {(
                    project?.totalAmenitiesSft ||
                    (project?.amenities
                      ? project.amenities.reduce((s, a) => s + (a.plannedSqFt || 0), 0)
                      : 15100)
                  ).toLocaleString('en-IN')}{' '}
                  SFT
                </strong>
              </span>
              <span>
                Grand Total Project Built-Up Area (BUA):{' '}
                <strong className="font-black text-gray-950 font-mono">
                  {(
                    project?.totalBuiltUpAreaSft ||
                    units.reduce((s, u) => s + u.sftArea, 0) + 15100 + 7000
                  ).toLocaleString('en-IN')}{' '}
                  SFT
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* Aggregate KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#F4F4F6] p-4 rounded-2xl">
            <span className="text-gray-500 text-[11px] font-bold uppercase block">Total Tower Inventory</span>
            <strong className="text-xl font-black text-gray-950 font-mono mt-0.5 block">
              {units.length} Flats (G+5)
            </strong>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              {bookedUnitsCount} Booked • {availableUnitsCount} Available
            </span>
          </div>

          <div className="bg-[#F4F4F6] p-4 rounded-2xl">
            <span className="text-gray-500 text-[11px] font-bold uppercase block">Total Project Valuation</span>
            <strong className="text-xl font-black text-gray-950 font-mono mt-0.5 block">
              {formatIndianCompact(totalProjectValue)}
            </strong>
            <span className="text-[10px] text-gray-500 block mt-0.5">At current matrix rates</span>
          </div>

          <div className="bg-[#F4F4F6] p-4 rounded-2xl">
            <span className="text-gray-500 text-[11px] font-bold uppercase block">Customer Collections</span>
            <strong className="text-xl font-black text-emerald-700 font-mono mt-0.5 block">
              {formatIndianCompact(totalCollections)}
            </strong>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">Escrow Bank Verified</span>
          </div>

          <div className="bg-[#FFFDF0] p-4 rounded-2xl border border-amber-300">
            <span className="text-amber-800 text-[11px] font-bold uppercase block">Base Price / Sft</span>
            <strong className="text-xl font-black text-gray-950 font-mono mt-0.5 block">
              {formatINR(pricingMatrix.baseSqFtRate)}
            </strong>
            <span className="text-[10px] text-gray-600 block mt-0.5">
              Floor Rise: +{formatINR(pricingMatrix.floorRisePerFloor)}/Flr
            </span>
          </div>
        </div>
      </div>

      {/* Floor-by-Floor Interactive Matrix */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-4">
        <h4 className="text-base font-black text-gray-950">Tower Elevation Matrix (5 Floors)</h4>

        <div className="space-y-4">
          {floors.map((floorNum) => {
            const floorUnits = units.filter((u) => u.floor === floorNum);

            return (
              <div key={floorNum} className="bg-[#F4F4F6] p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-extrabold text-gray-950 text-xs flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-500" />
                    Floor {floorNum} (Level {floorNum})
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">
                    Floor Rise Escalation: +{formatINR((floorNum - 1) * pricingMatrix.floorRisePerFloor)}/Sft
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {floorUnits.map((unit) => {
                    const totalCost = calculateUnitTotal(unit);
                    const isAvailable = unit.status === 'available';
                    const isBooked = unit.status === 'booked';
                    const isRegistered = unit.status === 'registered';

                    return (
                      <div
                        key={unit.id}
                        onClick={() => setSelectedUnit({ ...unit })}
                        className={`p-3 rounded-xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                          isAvailable
                            ? 'bg-emerald-50/60 border-emerald-300 hover:border-emerald-500'
                            : isBooked
                            ? 'bg-amber-50/60 border-amber-300 hover:border-amber-500'
                            : 'bg-red-50/50 border-red-200 hover:border-red-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-gray-950 text-xs">Flat #{unit.unitNumber}</span>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              isAvailable
                                ? 'bg-emerald-100 text-emerald-800'
                                : isBooked
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {unit.status}
                          </span>
                        </div>

                        <div className="text-[11px] space-y-0.5 text-gray-600">
                          <div className="flex justify-between">
                            <span>Area:</span>
                            <strong className="font-mono text-gray-900">{unit.sftArea} Sft</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Facing:</span>
                            <span className="font-bold text-gray-800">{unit.facing}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total:</span>
                            <span className="font-mono font-bold text-gray-950">{formatINR(totalCost)}</span>
                          </div>
                        </div>

                        {unit.buyerName && (
                          <div className="mt-2 pt-1 border-t border-gray-200 text-[10px] text-gray-700 truncate font-medium">
                            {unit.buyerName}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* UNIT BOOKING & EDIT MODAL */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
              <h3 className="font-black text-gray-950 text-base">
                Flat #{selectedUnit.unitNumber} - Apartment Booking & Pricing
              </h3>
              <button
                onClick={() => setSelectedUnit(null)}
                className="text-gray-900 font-bold p-1 rounded-full hover:bg-black/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUnitFormSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Status:</label>
                  <select
                    value={selectedUnit.status}
                    onChange={(e) =>
                      setSelectedUnit({
                        ...selectedUnit,
                        status: e.target.value as FlatStatus,
                      })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 text-xs"
                  >
                    <option value="available">Available</option>
                    <option value="booked">Booked (Token Advance)</option>
                    <option value="registered">Registered (Sale Deed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">
                    Base Rate / Sft (Floor: ₹4,400):
                  </label>
                  <input
                    type="number"
                    value={selectedUnit.baseRate}
                    onChange={(e) =>
                      setSelectedUnit({
                        ...selectedUnit,
                        baseRate: Number(e.target.value),
                      })
                    }
                    className={`w-full bg-gray-50 border rounded-xl p-2.5 font-mono font-bold text-xs ${
                      selectedUnit.baseRate < FLOOR_RATE_PER_SQFT
                        ? 'border-red-500 text-red-600 bg-red-50'
                        : 'border-gray-300 text-gray-950'
                    }`}
                  />
                  {selectedUnit.baseRate < FLOOR_RATE_PER_SQFT && (
                    <span className="text-[10px] text-red-600 font-bold block mt-1">
                      Below Floor Rate! Multi-partner signoff required.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Buyer Name:</label>
                <input
                  type="text"
                  value={selectedUnit.buyerName || ''}
                  onChange={(e) =>
                    setSelectedUnit({ ...selectedUnit, buyerName: e.target.value })
                  }
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs text-gray-900"
                  placeholder="e.g. S. Ramachandra Murthy"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Advance Received (₹):</label>
                  <input
                    type="number"
                    value={selectedUnit.advanceReceived || 0}
                    onChange={(e) =>
                      setSelectedUnit({
                        ...selectedUnit,
                        advanceReceived: Number(e.target.value),
                      })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Milestone Stage:</label>
                  <select
                    value={selectedUnit.milestoneStage || 'Token Advance'}
                    onChange={(e) =>
                      setSelectedUnit({
                        ...selectedUnit,
                        milestoneStage: e.target.value as any,
                      })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-bold text-gray-900"
                  >
                    <option value="Token Advance">Token Advance</option>
                    <option value="Plinth Level">Plinth Level (20%)</option>
                    <option value="1st Slab">1st Slab (20%)</option>
                    <option value="Brickwork">Brickwork (15%)</option>
                    <option value="Plastering & Electrical">Plastering & Electrical (15%)</option>
                    <option value="Flooring">Flooring (15%)</option>
                    <option value="Handover">Handover (15%)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUnit(null)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30"
                >
                  Save Flat Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APARTMENT DISCOUNT ALERT MODAL */}
      {showDiscountModal && pendingDiscountUnit && (
        <DiscountAlertModal
          isOpen={showDiscountModal}
          onClose={() => {
            setShowDiscountModal(false);
            setPendingDiscountUnit(null);
          }}
          onConfirmDiscountSale={handleConfirmDiscountOverride}
          unitLabel={`Flat #${pendingDiscountUnit.unitNumber}`}
          attemptedRate={pendingDiscountUnit.baseRate}
          floorRate={FLOOR_RATE_PER_SQFT}
          unitExtent={pendingDiscountUnit.sftArea}
          extentUnit="Sft"
        />
      )}

      {/* PRICING MATRIX CONFIG MODAL */}
      {showPriceMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
              <h3 className="font-black text-gray-950 text-base">Configure Apartment Price Matrix</h3>
              <button
                onClick={() => setShowPriceMatrixModal(false)}
                className="text-gray-900 font-bold p-1 rounded-full hover:bg-black/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePricingMatrix} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Base Sq.Ft Rate (₹):</label>
                <input
                  type="number"
                  value={tempPricing.baseSqFtRate}
                  onChange={(e) =>
                    setTempPricing({ ...tempPricing, baseSqFtRate: Number(e.target.value) })
                  }
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Floor Rise Escalation/Floor (₹):</label>
                  <input
                    type="number"
                    value={tempPricing.floorRisePerFloor}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, floorRisePerFloor: Number(e.target.value) })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">East Facing Premium/Sft (₹):</label>
                  <input
                    type="number"
                    value={tempPricing.eastPremium}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, eastPremium: Number(e.target.value) })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">North Facing Premium/Sft (₹):</label>
                  <input
                    type="number"
                    value={tempPricing.northPremium}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, northPremium: Number(e.target.value) })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Corner Flat Premium/Sft (₹):</label>
                  <input
                    type="number"
                    value={tempPricing.cornerPremium}
                    onChange={(e) =>
                      setTempPricing({ ...tempPricing, cornerPremium: Number(e.target.value) })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPriceMatrixModal(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30"
                >
                  Apply & Recalculate Units
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blueprint Fullscreen Lightbox Modal */}
      {showBlueprintModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between text-white pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-gray-950 flex items-center justify-center font-black">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black truncate max-w-md sm:max-w-xl">
                  {activeBlueprintDoc?.title ||
                    `${project?.name || 'Venture'} - Architectural Floor Blueprint & Elevation Plan`}
                </h3>
                <p className="text-[11px] text-gray-400">
                  RERA Reg: {project?.lpOrReraNumber || 'Sanctioned AP/TG-RERA'} • {floors.length} Floors •{' '}
                  {units.length} Units Matrix
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {projectBlueprints.length > 1 && (
                <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-xl">
                  {projectBlueprints.map((doc, idx) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setActiveBlueprintDoc(doc)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        (activeBlueprintDoc?.id || projectBlueprints[0].id) === doc.id
                          ? 'bg-amber-500 text-gray-950 font-black'
                          : 'text-white hover:bg-white/20'
                      }`}
                    >
                      Plan #{idx + 1}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowBlueprintModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-950 rounded-2xl overflow-auto p-2 sm:p-4 flex items-center justify-center border border-white/10">
            <img
              src={activeBlueprintDoc?.dataUrl || defaultBlueprintUrl}
              alt="Sanctioned Architectural Blueprint"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
