import React, { useState } from 'react';
import { Plot, LayoutCalculation, ProjectExpense, PlotStatus, LedgerMode, Project, PlanUploadDocument, TenantFirm, FirmAccount, FirmAccountTransaction } from '../../types';
import { formatINR, formatIndianCompact, calculateLayoutMetrics } from '../../utils/formatters';
import {
  Compass,
  Grid3X3,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  Ban,
  Plus,
  Edit2,
  Phone,
  User,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  ShieldAlert,
  Lock,
  ArrowRight,
  Eye,
  X,
  TreePine
} from 'lucide-react';
import { DiscountAlertModal } from '../modals/DiscountAlertModal';
import { SAMPLE_LAYOUT_BLUEPRINT } from '../../data/sampleBlueprints';
import { VentureLayoutMasterGrid } from './VentureLayoutMasterGrid';
import { CustomerPlotBookingModal } from '../modals/CustomerPlotBookingModal';

interface OpenPlottingModuleProps {
  plots: Plot[];
  onUpdatePlot: (plot: Plot) => void;
  layoutCalc: LayoutCalculation;
  onUpdateLayoutCalc: (calc: LayoutCalculation) => void;
  projectExpenses?: ProjectExpense[];
  onAddExpense?: (expense: ProjectExpense) => void;
  onUpdateExpense?: (expense: ProjectExpense) => void;
  ledgerMode?: LedgerMode;
  project?: Project;
  firm?: TenantFirm;
  firmAccounts?: FirmAccount[];
  onAddAccountTransaction?: (accountId: string, tx: FirmAccountTransaction) => void;
}

export const OpenPlottingModule: React.FC<OpenPlottingModuleProps> = ({
  plots,
  onUpdatePlot,
  layoutCalc,
  onUpdateLayoutCalc,
  ledgerMode = 'internal_syndicate',
  project,
  firm,
  firmAccounts = [],
  onAddAccountTransaction,
}) => {
  const [plotFilter, setPlotFilter] = useState<'all' | 'available' | 'reserved' | 'sold'>('all');
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [customerBookingPlot, setCustomerBookingPlot] = useState<Plot | null>(null);
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [activeBlueprintDoc, setActiveBlueprintDoc] = useState<PlanUploadDocument | null>(null);

  // Fallback firm if not passed directly
  const effectiveFirm: TenantFirm = firm || {
    id: project?.firmId || 'firm-1',
    name: project?.name || 'Amaravati Capital City Developers',
    code: project?.code || 'AV-DEV',
    location: project?.location || 'Amaravati Core Capital Belt',
    state: 'Andhra Pradesh',
    sectors: ['real_estate_open_plotting'],
    subscriptionPlan: 'enterprise',
    mrrAmount: 34999,
    status: 'active',
    createdDate: '2026-01-01',
    proprietorName: 'Srikanth Reddy',
    proprietorPhone: '+91 98480 12345',
    managingPartnerName: 'Srikanth Reddy',
    managingPartnerPhone: '+91 98480 12345',
    gstin: '37AABCA1234F1Z5',
    panNumber: 'AABCA1234F',
    businessType: 'Partnership',
    tradeName: 'Amaravati Ventures Consortium',
    officeAddress: 'NH-16 Bypass, Tadepalli, Guntur Dt, AP',
    contactEmail: 'accounts@amaravativentures.in',
    reraNumber: project?.lpOrReraNumber || 'P03240019284',
    accountantName: 'K. Rama Mohana Rao',
    accountantPhone: '+91 98480 11223',
    featureFlags: {
      enablePlotGrid: true,
      enableApartmentMatrix: false,
      enableWhatsAppAlerts: true,
      enableTallyExport: true,
      enableVoiceNotes: true,
      enableAuditLock: false,
    },
  };

  // Derive blueprint image from project documents or fallback to sample
  const projectBlueprints = project?.planDocuments?.filter(
    (d) => d.category === 'master_layout' || d.category === 'statutory_clearance' || d.category === 'floor_plan'
  ) || [];

  const defaultBlueprintUrl =
    projectBlueprints.length > 0 && projectBlueprints[0].dataUrl
      ? projectBlueprints[0].dataUrl
      : SAMPLE_LAYOUT_BLUEPRINT;

  // Floor Price Protection Modal state
  const FLOOR_RATE_PER_SQYD = 17000;
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [pendingDiscountPlot, setPendingDiscountPlot] = useState<Plot | null>(null);

  // Calculate layout metrics
  const metrics = calculateLayoutMetrics(
    layoutCalc.totalExtentValue,
    layoutCalc.unit,
    layoutCalc.roadWidth,
    layoutCalc.openSpacePercent
  );

  // Plot summaries
  const totalPlots = plots.length;
  const availablePlots = plots.filter((p) => p.status === 'available');
  const reservedPlots = plots.filter((p) => p.status === 'reserved');
  const soldPlots = plots.filter((p) => p.status === 'sold');

  const totalRealizedSales = plots.reduce((acc, p) => acc + (p.advanceReceived || 0), 0);
  const totalProjectedValue = plots.reduce((acc, p) => {
    const rate = ledgerMode === 'official_tax' ? Math.min(p.ratePerSqYard, 12000) : p.ratePerSqYard;
    return acc + p.areaSqYards * rate;
  }, 0);

  // Filtered plots
  const displayedPlots = plots.filter((p) => {
    if (plotFilter === 'all') return true;
    return p.status === plotFilter;
  });

  const handlePlotFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlot) return;

    // Check Floor Rate Breach
    if (selectedPlot.ratePerSqYard < FLOOR_RATE_PER_SQYD) {
      setPendingDiscountPlot(selectedPlot);
      setShowDiscountModal(true);
      return;
    }

    onUpdatePlot(selectedPlot);
    setSelectedPlot(null);
  };

  const handleConfirmDiscountOverride = (approvedSignature: string) => {
    if (!pendingDiscountPlot) return;
    const updated = {
      ...pendingDiscountPlot,
      discountApprovedBy: approvedSignature,
      notes: `${pendingDiscountPlot.notes || ''} [Floor Rate Override: Authorized by ${approvedSignature}]`,
    };
    onUpdatePlot(updated);
    setPendingDiscountPlot(null);
    setSelectedPlot(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. LAYOUT CALCULATOR & PROGRESSION STEP ENGINE */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#FFB800]" />
              <h3 className="text-lg font-black text-gray-950">
                DTCP / CRDA / HMDA Venture Layout Engine
              </h3>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Input gross parcel extent and road specifications to auto-calculate statutory deductions and net sellable plot inventory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setActiveBlueprintDoc(projectBlueprints[0] || null);
                setShowBlueprintModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-black text-white font-bold rounded-full text-xs shadow-xs transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Sanctioned Blueprint</span>
              {projectBlueprints.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-gray-950 font-black text-[10px]">
                  {projectBlueprints.length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 bg-[#FFFDF0] px-3.5 py-1.5 rounded-full border border-amber-300 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-gray-700 font-bold">Floor Rate Lock: </span>
              <strong className="text-gray-950 font-black">{formatINR(FLOOR_RATE_PER_SQYD)}/Sq.Yd</strong>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#F4F4F6] p-4 rounded-2xl">
          <div>
            <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
              Total Venture Extent:
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={layoutCalc.totalExtentValue}
                onChange={(e) =>
                  onUpdateLayoutCalc({
                    ...layoutCalc,
                    totalExtentValue: Number(e.target.value),
                  })
                }
                className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-bold text-gray-950 focus:ring-2 focus:ring-amber-500"
              />
              <select
                value={layoutCalc.unit}
                onChange={(e) =>
                  onUpdateLayoutCalc({
                    ...layoutCalc,
                    unit: e.target.value as any,
                  })
                }
                className="bg-white border border-gray-300 rounded-xl p-2 text-xs font-bold text-gray-950"
              >
                <option value="Acres">Acres</option>
                <option value="Guntas / Cents">Guntas</option>
                <option value="Sq. Yards">Sq. Yds</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
              Approach Road Width:
            </label>
            <select
              value={layoutCalc.roadWidth}
              onChange={(e) =>
                onUpdateLayoutCalc({
                  ...layoutCalc,
                  roadWidth: Number(e.target.value) as any,
                })
              }
              className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-950"
            >
              <option value={20}>20 Ft Road (22% deduction)</option>
              <option value={30}>30 Ft Road (28% deduction)</option>
              <option value={40}>40 Ft Master Plan (33% deduction)</option>
              <option value={60}>60 Ft Arterial (38% deduction)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
              Statutory Park / Open Space:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={5}
                max={20}
                value={layoutCalc.openSpacePercent}
                onChange={(e) =>
                  onUpdateLayoutCalc({
                    ...layoutCalc,
                    openSpacePercent: Number(e.target.value),
                  })
                }
                className="w-full accent-amber-500"
              />
              <span className="font-mono text-xs font-black text-gray-950 w-12 text-right">
                {layoutCalc.openSpacePercent}%
              </span>
            </div>
            <span className="text-[10px] text-gray-500 block mt-1">DTCP Mandate: Min 10%</span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-700 uppercase block mb-1">
              Average Target Selling Rate:
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">₹</span>
              <input
                type="number"
                value={layoutCalc.expectedRatePerSqYard || 18000}
                onChange={(e) =>
                  onUpdateLayoutCalc({
                    ...layoutCalc,
                    expectedRatePerSqYard: Number(e.target.value),
                  })
                }
                className="w-full bg-white border border-gray-300 rounded-xl p-2.5 pl-7 text-xs font-mono font-bold text-gray-950"
              />
            </div>
            <span className="text-[10px] text-emerald-600 font-bold block mt-1">
              Floor Rate: ₹17,000 Protected
            </span>
          </div>
        </div>

        {/* Calculated Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#F4F4F6] p-4 rounded-2xl">
            <span className="text-gray-500 text-[11px] font-bold uppercase block">Gross Parcel Area</span>
            <strong className="text-xl font-black text-gray-950 font-mono mt-0.5 block">
              {metrics.grossSqYards.toLocaleString('en-IN')} <span className="text-xs font-normal">Sq.Yds</span>
            </strong>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              {metrics.equivalentGuntas} Guntas • {metrics.equivalentCents} Cents
            </span>
          </div>

          <div className="bg-[#F4F4F6] p-4 rounded-2xl">
            <span className="text-gray-500 text-[11px] font-bold uppercase block">Roads & Park Deductions</span>
            <strong className="text-xl font-black text-red-600 font-mono mt-0.5 block">
              -{metrics.totalDeductions.toLocaleString('en-IN')} <span className="text-xs font-normal">Sq.Yds</span>
            </strong>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              Roads: {metrics.roadLossPercent}% + Parks: {layoutCalc.openSpacePercent}%
            </span>
          </div>

          <div className="bg-[#FFFDF0] p-4 rounded-2xl border border-amber-300">
            <span className="text-amber-800 text-[11px] font-bold uppercase block">Net Sellable Plotted Area</span>
            <strong className="text-xl font-black text-gray-950 font-mono mt-0.5 block">
              {metrics.netSellableSqYards.toLocaleString('en-IN')} <span className="text-xs font-normal">Sq.Yds</span>
            </strong>
            <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
              {metrics.netSellablePercent}% Plottable Yield
            </span>
          </div>

          <div className="bg-[#F4F4F6] p-4 rounded-2xl">
            <span className="text-gray-500 text-[11px] font-bold uppercase block">Venture Gross Revenue</span>
            <strong className="text-xl font-black text-emerald-700 font-mono mt-0.5 block">
              {formatIndianCompact(metrics.netSellableSqYards * (layoutCalc.expectedRatePerSqYard || 18000))}
            </strong>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              ~{metrics.estimatedPlotsOf200SqYds} Standard Plots (200 Sq.Yds)
            </span>
          </div>
        </div>
      </div>

      {/* 2. VENTURE MASTER LAYOUT GRID & ROADS (WITH FACING SPLITS & ON-SPOT TAP-TO-BOOK) */}
      <VentureLayoutMasterGrid
        plots={plots}
        project={project}
        layoutCalc={layoutCalc}
        firm={effectiveFirm}
        onSelectPlot={(plot) => setCustomerBookingPlot(plot)}
        floorRate={FLOOR_RATE_PER_SQYD}
        onUpdatePlot={onUpdatePlot}
      />

      {/* PLOT DETAIL & BOOKING MODAL */}
      {selectedPlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
              <h3 className="font-black text-gray-950 text-base">
                {selectedPlot.plotNumber} - Plot Booking & Rate Controls
              </h3>
              <button
                onClick={() => setSelectedPlot(null)}
                className="text-gray-900 font-bold p-1 rounded-full hover:bg-black/10"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePlotFormSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Plot Status:</label>
                  <select
                    value={selectedPlot.status}
                    onChange={(e) =>
                      setSelectedPlot({
                        ...selectedPlot,
                        status: e.target.value as PlotStatus,
                      })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 text-xs"
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved (Token Received)</option>
                    <option value="sold">Sold (Agreement Done)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">
                    Rate per Sq.Yard (Floor: ₹17,000):
                  </label>
                  <input
                    type="number"
                    value={selectedPlot.ratePerSqYard}
                    onChange={(e) =>
                      setSelectedPlot({
                        ...selectedPlot,
                        ratePerSqYard: Number(e.target.value),
                      })
                    }
                    className={`w-full bg-gray-50 border rounded-xl p-2.5 font-mono font-bold text-xs ${
                      selectedPlot.ratePerSqYard < FLOOR_RATE_PER_SQYD
                        ? 'border-red-500 text-red-600 bg-red-50'
                        : 'border-gray-300 text-gray-950'
                    }`}
                  />
                  {selectedPlot.ratePerSqYard < FLOOR_RATE_PER_SQYD && (
                    <span className="text-[10px] text-red-600 font-bold block mt-1">
                      Below Floor Rate! Will require 2-partner consensus sign-off.
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Buyer Name:</label>
                <input
                  type="text"
                  value={selectedPlot.buyerName || ''}
                  onChange={(e) =>
                    setSelectedPlot({ ...selectedPlot, buyerName: e.target.value })
                  }
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs text-gray-900"
                  placeholder="e.g. M. Anjaneyulu"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Buyer Phone:</label>
                  <input
                    type="text"
                    value={selectedPlot.buyerPhone || ''}
                    onChange={(e) =>
                      setSelectedPlot({ ...selectedPlot, buyerPhone: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs text-gray-900"
                    placeholder="98480 12345"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Advance Received (₹):</label>
                  <input
                    type="number"
                    value={selectedPlot.advanceReceived || 0}
                    onChange={(e) =>
                      setSelectedPlot({
                        ...selectedPlot,
                        advanceReceived: Number(e.target.value),
                      })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlot(null)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30"
                >
                  Save Plot Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCOUNT OVERRIDE ALERT MODAL */}
      {showDiscountModal && pendingDiscountPlot && (
        <DiscountAlertModal
          isOpen={showDiscountModal}
          onClose={() => {
            setShowDiscountModal(false);
            setPendingDiscountPlot(null);
          }}
          onConfirmDiscountSale={handleConfirmDiscountOverride}
          unitLabel={pendingDiscountPlot.plotNumber}
          attemptedRate={pendingDiscountPlot.ratePerSqYard}
          floorRate={FLOOR_RATE_PER_SQYD}
          unitExtent={pendingDiscountPlot.areaSqYards}
          extentUnit="Sq.Yd"
        />
      )}

      {/* Blueprint Fullscreen Lightbox Modal */}
      {showBlueprintModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex flex-col p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between text-white pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-gray-950 flex items-center justify-center font-black">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black truncate max-w-md sm:max-w-xl">
                  {activeBlueprintDoc?.title ||
                    `${project?.name || 'Venture'} - CRDA / DTCP Approved Master Layout Blueprint`}
                </h3>
                <p className="text-[11px] text-gray-400">
                  LP Number: {project?.lpOrReraNumber || 'Approved Layout Permit'} • {plots.length} Demarcated Plots •{' '}
                  {layoutCalc.totalExtentValue} {layoutCalc.unit}
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
              alt="Approved Master Layout Blueprint"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* FAST CUSTOMER ON-SPOT BOOKING & TOKEN VOUCHER MODAL */}
      {customerBookingPlot && (
        <CustomerPlotBookingModal
          isOpen={!!customerBookingPlot}
          plot={customerBookingPlot}
          project={project}
          firm={effectiveFirm}
          floorRate={FLOOR_RATE_PER_SQYD}
          firmAccounts={firmAccounts}
          onAddAccountTransaction={onAddAccountTransaction}
          onClose={() => setCustomerBookingPlot(null)}
          onConfirmBooking={(updatedPlot) => {
            onUpdatePlot(updatedPlot);
            setCustomerBookingPlot(null);
          }}
          onReleasePlot={(plotId) => {
            const plotToRelease = plots.find((p) => p.id === plotId);
            if (plotToRelease) {
              onUpdatePlot({
                ...plotToRelease,
                status: 'available',
                buyerName: undefined,
                buyerPhone: undefined,
                buyerAadhaar: undefined,
                advanceReceived: 0,
                paymentMode: undefined,
                paymentRefNumber: undefined,
                paymentMilestone: undefined,
                notes: 'Booking released back to available inventory.',
              });
            }
            setCustomerBookingPlot(null);
          }}
        />
      )}
    </div>
  );
};
