import { MasterOptions, masterNumber } from '../../../adapter/config';
import React, { useState } from 'react';
import { Plot, LayoutCalculation, ProjectExpense, PlotStatus, LedgerMode, Project, PlanUploadDocument, TenantFirm, FirmAccount, FirmAccountTransaction } from '../../types';
import { formatINR } from '../../utils/formatters';
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
import { VentureLayoutMasterGrid } from './VentureLayoutMasterGrid';
import { CustomerPlotBookingModal } from '../modals/CustomerPlotBookingModal';

interface OpenPlottingModuleProps {
  plots: Plot[];
  onUpdatePlot: (plot: Plot) => void | boolean | Promise<boolean>;
  layoutCalc: LayoutCalculation;
  onUpdateLayoutCalc: (calc: LayoutCalculation) => void | boolean | Promise<boolean>;
  projectExpenses?: ProjectExpense[];
  onAddExpense?: (expense: ProjectExpense) => void;
  onUpdateExpense?: (expense: ProjectExpense) => void;
  ledgerMode?: LedgerMode;
  project?: Project;
  firm?: TenantFirm;
  firmAccounts?: FirmAccount[];
  onAddAccountTransaction?: (accountId: string, tx: FirmAccountTransaction) => void | boolean | Promise<boolean>;
}

export const OpenPlottingModule: React.FC<OpenPlottingModuleProps> = ({
  plots,
  onUpdatePlot,
  layoutCalc,
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
    id: project?.firmId || '',
    name: project?.name || '',
    code: project?.code || '',
    location: project?.location || '',
    state: '' as TenantFirm['state'],
    sectors: [],
    subscriptionPlan: '' as TenantFirm['subscriptionPlan'],
    mrrAmount: 0,
    status: 'active',
    createdDate: '',
    managingPartnerName: '',
    managingPartnerPhone: '',
    reraNumber: project?.lpOrReraNumber || '',
    accountantName: '',
    accountantPhone: '',
    featureFlags: {
      enablePlotGrid: true,
      enableApartmentMatrix: false,
      enableWhatsAppAlerts: false,
      enableTallyExport: false,
      enableVoiceNotes: false,
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
      : '';

  // Floor Price Protection Modal state
  const FLOOR_RATE_PER_SQYD = project?.floorRatePerSqYard ?? layoutCalc.floorRatePerSqYard ?? 0;
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [pendingDiscountPlot, setPendingDiscountPlot] = useState<Plot | null>(null);

  // Read-only summary: saved selected-project values only
  const isSaved = (v: unknown) => v !== undefined && v !== null && v !== '';
  const NOT_SPECIFIED = 'Not specified';
  const savedExtent = isSaved(project?.extentValue)
    ? `${Number(project?.extentValue).toLocaleString('en-IN', { maximumFractionDigits: 6 })}${isSaved(project?.extentUnit) ? ` ${project?.extentUnit}` : ''}`
    : NOT_SPECIFIED;
  const savedRoadWidth = isSaved(project?.roadWidth) ? `${project?.roadWidth} ft` : NOT_SPECIFIED;
  const savedOpenSpace = isSaved(project?.openSpacePercent) ? `${project?.openSpacePercent}%` : NOT_SPECIFIED;
  const savedFloorRate = isSaved(project?.floorRatePerSqYard)
    ? `₹${Number(project?.floorRatePerSqYard).toLocaleString('en-IN', { maximumFractionDigits: 6 })}/Sq.Yd`
    : NOT_SPECIFIED;
  const recordedPlotArea = plots.reduce((acc, p) => acc + (p.areaSqYards || 0), 0);

  // Plot summaries
  const totalPlots = plots.length;
  const availablePlots = plots.filter((p) => p.status === 'available');
  const reservedPlots = plots.filter((p) => p.status === 'reserved');
  const soldPlots = plots.filter((p) => p.status === 'sold');

  const totalRealizedSales = plots.reduce((acc, p) => acc + (p.advanceReceived || 0), 0);
  const totalProjectedValue = plots.reduce((acc, p) => {
    const rate = ledgerMode === 'official_tax' ? (masterNumber('ledger_policy', 'official_tax_rate_cap') !== undefined ? Math.min(p.ratePerSqYard, masterNumber('ledger_policy', 'official_tax_rate_cap') as number) : p.ratePerSqYard) : p.ratePerSqYard;
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

    void Promise.resolve(onUpdatePlot(selectedPlot)).then((ok) => { if (ok !== false) setSelectedPlot(null); });
  };

  const handleConfirmDiscountOverride = (approvedSignature: string) => {
    if (!pendingDiscountPlot) return;
    const updated = {
      ...pendingDiscountPlot,
      discountApprovedBy: approvedSignature,
      notes: `${pendingDiscountPlot.notes || ''} [Floor Rate Override: Authorized by ${approvedSignature}]`,
    };
    void Promise.resolve(onUpdatePlot(updated)).then((ok) => { if (ok !== false) { setPendingDiscountPlot(null); setSelectedPlot(null); } });
  };

  return (
    <div className="space-y-6">
      {/* 1. READ-ONLY PROJECT LAYOUT SUMMARY */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-200 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#FFB800]" />
              <h3 className="text-lg font-black text-gray-950">
                Project Layout Summary
              </h3>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Read-only values saved in project setup, alongside the plots recorded so far. Edit them from project setup.
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
              <strong className="text-gray-950 font-black">{savedFloorRate}</strong>
            </div>
          </div>
        </div>

        {/* Read-only saved project setup values */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="project-layout-summary">
          {[
            {
              label: 'Venture Extent',
              value: savedExtent,
              note: 'Saved at project setup',
            },
            {
              label: 'Approach Road Width',
              value: savedRoadWidth,
              note: 'Saved at project setup',
            },
            {
              label: 'Planned Open Space',
              value: savedOpenSpace,
              note: 'Saved at project setup',
            },
            {
              label: 'Protected Floor Rate',
              value: savedFloorRate,
              note: 'Saved at project setup',
            },
            {
              label: 'Recorded Plots',
              value: String(plots.length),
              note: 'Plots entered in this project',
            },
            {
              label: 'Recorded Plot Area',
              value: `${recordedPlotArea.toLocaleString('en-IN', { maximumFractionDigits: 6 })} Sq.Yds`,
              note: 'Sum of recorded plots; not the remaining venture land',
            },
          ].map((card, i) => (
            <div
              key={card.label}
              className={`p-3.5 rounded-2xl border ${i >= 4 ? 'bg-[#FFFDF0] border-amber-300' : 'bg-[#F4F4F6] border-gray-200'}`}
            >
              <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wide block">{card.label}</span>
              <strong className="text-base font-black text-gray-950 font-mono mt-1 block break-words">{card.value}</strong>
              <span className="text-[10px] text-gray-500 block mt-0.5">{card.note}</span>
            </div>
          ))}
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
                    <MasterOptions group="plot_statuses" />
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
                  {savedExtent}
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
          onConfirmBooking={(updatedPlot) => onUpdatePlot(updatedPlot)}
          onReleasePlot={(plotId) => {
            const plotToRelease = plots.find((p) => p.id === plotId);
            if (!plotToRelease) return false;
            {
              return onUpdatePlot({
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
          }}
        />
      )}
    </div>
  );
};
