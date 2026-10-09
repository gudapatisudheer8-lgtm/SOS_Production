import React, { useState, useMemo } from 'react';
import {
  SyndicatePartner,
  FieldExpenseLog,
  EquitySplitMode,
  TenantFirm,
  LedgerMode,
  PartnerStockDraw,
  Project,
  Plot,
  ApartmentUnit,
  LayoutCalculation,
  FirmAccount,
  IndividualInvestmentRecord
} from '../../types';
import { formatINR, formatIndianCompact } from '../../utils/formatters';
import {
  PieChart,
  TrendingUp,
  Coins,
  Layers,
  Plus,
  UserPlus,
  X,
  Share2,
  Copy,
  Check,
  Smartphone,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import {
  resetPartnerPinInSql,
  togglePartnerStatusInSql
} from '../../services/sqlSync';

interface SyndicateEquityModuleProps {
  firm: TenantFirm;
  project?: Project;
  plots?: Plot[];
  apartmentUnits?: ApartmentUnit[];
  layoutCalc?: LayoutCalculation;
  totalProjectEstimatedValue?: number;
  totalProjectInvestedValue?: number;
  partners: SyndicatePartner[];
  onUpdatePartner: (partner: SyndicatePartner) => void;
  onAddPartnerMember?: (partner: SyndicatePartner) => void;
  splitMode: EquitySplitMode;
  onToggleSplitMode: (mode: EquitySplitMode) => void;
  fieldExpenses?: FieldExpenseLog[];
  onApproveExpense?: (expenseId: string, signoffDetails?: string) => void;
  onRejectExpense?: (expenseId: string) => void;
  projectSurplusEstimate: number;
  ledgerMode?: LedgerMode;
  partnerStockDraws?: PartnerStockDraw[];
  firmAccounts?: FirmAccount[];
  individualInvestments?: IndividualInvestmentRecord[];
}

export const SyndicateEquityModule: React.FC<SyndicateEquityModuleProps> = ({
  firm,
  project,
  plots = [],
  apartmentUnits = [],
  layoutCalc,
  totalProjectEstimatedValue,
  totalProjectInvestedValue,
  partners,
  onUpdatePartner,
  onAddPartnerMember,
  splitMode,
  onToggleSplitMode,
  fieldExpenses = [],
  projectSurplusEstimate,
  partnerStockDraws = [],
  firmAccounts = [],
  individualInvestments = [],
}) => {
  const [selectedPartnerForAdjust, setSelectedPartnerForAdjust] = useState<SyndicatePartner | null>(null);
  const [isAddPartnerModalOpen, setIsAddPartnerModalOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('+91 ');
  const [newPartnerRole, setNewPartnerRole] = useState('Investor Partner');
  const [newPartnerEquity, setNewPartnerEquity] = useState<number>(10);
  const [newPartnerCapital, setNewPartnerCapital] = useState<number>(0);
  const [newPartnerPin, setNewPartnerPin] = useState('1234');
  const [addPartnerError, setAddPartnerError] = useState('');

  // Partner Reset PIN and Active/Inactive Status State
  const [partnerForPinReset, setPartnerForPinReset] = useState<SyndicatePartner | null>(null);
  const [isResettingPin, setIsResettingPin] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleConfirmPinReset = async (targetPartner: SyndicatePartner) => {
    setIsResettingPin(true);
    try {
      const updated: SyndicatePartner = {
        ...targetPartner,
        pinCode: '9999',
        mustChangePin: true,
      };

      onUpdatePartner(updated);
      await resetPartnerPinInSql(targetPartner.phone, targetPartner.id);

      setPartnerForPinReset(null);
      showToast(`✓ PIN for ${targetPartner.name} reset to default 9999. User will be prompted to set a new PIN on next login.`);
    } catch (err) {
      showToast('Error resetting PIN. Please try again.');
    } finally {
      setIsResettingPin(false);
    }
  };

  const handleTogglePartnerStatus = async (targetPartner: SyndicatePartner) => {
    const newStatus: 'active' | 'inactive' = targetPartner.userStatus === 'inactive' ? 'active' : 'inactive';
    const updated: SyndicatePartner = {
      ...targetPartner,
      userStatus: newStatus,
    };

    onUpdatePartner(updated);
    await togglePartnerStatusInSql(targetPartner.phone, targetPartner.id, newStatus);

    showToast(
      newStatus === 'active'
        ? `✓ ${targetPartner.name} marked as ACTIVE. Access restored.`
        : `⚠ ${targetPartner.name} marked as INACTIVE. Access suspended.`
    );
  };

  // Filter partners and expenses belonging strictly to this firm (or active project partners)
  const firmPartners = useMemo(() => {
    if (project && partners.length > 0) return partners;
    return partners.filter(
      (p) => p.firmId === firm.id || (!p.firmId && firm.id === 'firm-1')
    );
  }, [partners, project, firm.id]);

  // Auto-calculate dynamic actual invested capital for each partner:
  // 1. Initial actual capital explicitly enrolled/deposited (partner.actualInvested || 0)
  // 2. Plus approved partner capital deposits / bank credit entries recorded in firm bank accounts
  // 3. Plus any recorded partner drawings debited in firm bank accounts
  const getPartnerLedgerStats = (partner: SyndicatePartner) => {
    // Only count actual capital explicitly enrolled/deposited, NOT the estimated target commitment
    const baseInitial = partner.actualInvested || 0;

    // Check all approved transactions across firm accounts for this partner
    const cleanName = partner.name.toLowerCase().replace(/^partner\s+[a-z]:\s*/i, '').trim();
    const partnerIdStr = String(partner.id).toLowerCase();
    let ledgerInflows = 0;
    let ledgerOutflows = 0;

    (firmAccounts || []).forEach((acc) => {
      (acc.recentTransactions || []).forEach((tx) => {
        const txPartner = (tx.partnerName || tx.description || '').toLowerCase();
        const isMatch =
          txPartner.includes(partnerIdStr) ||
          txPartner.includes(partner.name.toLowerCase()) ||
          (cleanName.length > 2 && txPartner.includes(cleanName));

        if (isMatch) {
          if (
            (tx.category === 'partner_capital' || tx.description?.toLowerCase().includes('capital deposit')) &&
            tx.type === 'credit'
          ) {
            ledgerInflows += tx.amount;
          } else if (
            (tx.category === 'partner_draw' || tx.description?.toLowerCase().includes('partner draw')) &&
            tx.type === 'debit'
          ) {
            ledgerOutflows += tx.amount;
          }
        }
      });
    });

    // Check individual investments for this partner
    const approvedInvs = (individualInvestments || []).filter(
      (inv) =>
        (String(inv.partnerId) === String(partner.id) ||
          inv.partnerName.trim().toLowerCase() === partner.name.trim().toLowerCase() ||
          (cleanName.length > 2 && inv.partnerName.toLowerCase().includes(cleanName))) &&
        inv.status === 'approved' &&
        (!inv.firmId || inv.firmId === firm.id) &&
        (!project || !inv.projectId || inv.projectId === project.id)
    );
    const individualInvsTotal = approvedInvs.reduce((sum, i) => sum + i.amount, 0);

    const totalActualInvested = Math.max(baseInitial, individualInvsTotal, baseInitial + ledgerInflows);
    const totalDrawings = (partner.drawings || 0) + ledgerOutflows;
    const capitalDifference = totalActualInvested - partner.initialCapital;

    return {
      totalActualInvested,
      baseInitial,
      ledgerInflows,
      totalDrawings,
      ledgerOutflows,
      capitalDifference,
    };
  };

  // Totals across this firm's syndicate
  const totalEstimatedCapital = firmPartners.reduce((acc, p) => acc + (p.initialCapital || 0), 0);
  const totalActualInvested = firmPartners.reduce(
    (acc, p) => acc + getPartnerLedgerStats(p).totalActualInvested,
    0
  );
  const totalVariance = totalActualInvested - totalEstimatedCapital;
  const totalCapital = totalEstimatedCapital;
  const totalDrawings = firmPartners.reduce((acc, p) => acc + getPartnerLedgerStats(p).totalDrawings, 0);
  const totalFieldExpenses = firmPartners.reduce((acc, p) => acc + (p.shareOfFieldExpenses || 0), 0);

  // Filtered field expenses based on ledger mode and firm isolation
  const firmFieldExpenses = fieldExpenses.filter(
    (e) => e.firmId === firm.id || (!e.firmId && firm.id === 'firm-1')
  );

  // Calculate dynamic equity % for each partner
  const getPartnerEquityPercent = (partner: SyndicatePartner): number => {
    if (splitMode === 'fixed') {
      return partner.fixedEquityPercent;
    }
    return totalCapital > 0 ? (partner.initialCapital / totalCapital) * 100 : 0;
  };

  // Calculate Net Position / Receivable
  // Net Balance = actualInvested + shareOfFieldExpenses - drawings - partnerDrawsValuation
  const getPartnerNetBalance = (partner: SyndicatePartner): number => {
    const partnerDrawsValuation = partnerStockDraws
      .filter((d) => d.partnerId === partner.id)
      .reduce((sum, d) => sum + d.retailValuation, 0);
    const { totalActualInvested, totalDrawings } = getPartnerLedgerStats(partner);
    return totalActualInvested + (partner.shareOfFieldExpenses || 0) - totalDrawings - partnerDrawsValuation;
  };

  // 1. Total Sellable Area in Yards (Based on layout & demarcated plot entries)
  const totalSellableYards = useMemo(() => {
    if (!project) return 0;
    if (plots && plots.length > 0) {
      const sum = plots.reduce((acc, p) => acc + (p.areaSqYards || 0), 0);
      if (sum > 0) return sum;
    }
    const extent = project.extentValue || layoutCalc?.totalExtentValue || 0;
    if (extent <= 0) return 0;
    const unit = project.extentUnit || layoutCalc?.unit || 'Acres';
    let totalExtentSqYards = extent;
    if (unit === 'Acres') totalExtentSqYards = extent * 4840;
    else if (unit === 'Guntas / Cents') totalExtentSqYards = extent * 121;
    const roadAndOpenSpace = (layoutCalc?.roadWidth ? 30 : 30) + (layoutCalc?.openSpacePercent || 10);
    return Math.round(totalExtentSqYards * (1 - roadAndOpenSpace / 100));
  }, [plots, project, layoutCalc]);

  // 2. Benchmark rate benchmark placed per square yard
  const benchmarkRatePerSqYard =
    project?.floorRatePerSqYard || layoutCalc?.floorRatePerSqYard || 0;

  // 3. Total Project Estimated Value
  const computedProjectEstimatedValue = useMemo(() => {
    if (!project) return 0;
    if (totalProjectEstimatedValue && totalProjectEstimatedValue > 0) {
      return totalProjectEstimatedValue;
    }
    if (plots && plots.length > 0) {
      const sum = plots.reduce(
        (acc, p) => acc + (p.areaSqYards || 0) * (p.ratePerSqYard || benchmarkRatePerSqYard),
        0
      );
      if (sum > 0) return sum;
    }
    return totalSellableYards * benchmarkRatePerSqYard;
  }, [project, totalProjectEstimatedValue, plots, totalSellableYards, benchmarkRatePerSqYard]);

  // 4. Actual Total Project Invested Value Till This Day
  const actualTotalProjectInvested = project ? (totalProjectInvestedValue || totalActualInvested) : 0;

  // 5. Expected Profit for this Project
  const expectedProjectProfit = !project
    ? 0
    : Math.max(
        0,
        projectSurplusEstimate > 0
          ? projectSurplusEstimate
          : computedProjectEstimatedValue - actualTotalProjectInvested
      );

  // 6. Expected Profit Margin per square yard based on rate placed
  const expectedProfitPerSqYard =
    totalSellableYards > 0 ? Math.round(expectedProjectProfit / totalSellableYards) : 0;

  return (
    <div className="space-y-6">
      {/* 1. DYNAMIC SPLIT TABLE & CONTROLS */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-gray-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-[#FFB800]" />
              <h3 className="text-lg font-black text-gray-950">
                Partner Capital &amp; Dynamic Equity Engine
              </h3>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Live partner ledger tracking capital commitments, equity share, allotted sellable area, expected project profit, and drawings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Add Partner Member Button */}
            {onAddPartnerMember && (
              <button
                type="button"
                onClick={() => {
                  setNewPartnerName('');
                  setNewPartnerPhone('+91 ');
                  setNewPartnerRole('Investor Partner');
                  setNewPartnerEquity(10);
                  setNewPartnerCapital(0);
                  setNewPartnerPin('1234');
                  setAddPartnerError('');
                  setIsAddPartnerModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-xs transition-all border border-amber-600/30 cursor-pointer active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Partner to Project</span>
              </button>
            )}

            {/* Split Mode Toggle Button */}
            <div className="flex items-center bg-[#F4F4F6] p-1 rounded-full border border-gray-200 text-xs font-bold">
              <span className="text-gray-500 px-3">Formula:</span>
              <button
                id="btn-split-fixed"
                type="button"
                onClick={() => onToggleSplitMode('fixed')}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  splitMode === 'fixed'
                    ? 'bg-[#111827] text-white shadow'
                    : 'text-gray-600 hover:text-gray-950'
                }`}
              >
                Fixed Share %
              </button>
              <button
                id="btn-split-proportional"
                type="button"
                onClick={() => onToggleSplitMode('proportional')}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  splitMode === 'proportional'
                    ? 'bg-[#111827] text-white shadow'
                    : 'text-gray-600 hover:text-gray-950'
                }`}
              >
                Capital-Weighted
              </button>
            </div>
          </div>
        </div>

        {/* Aggregate Syndicate Capital Cards - Rephrased with Realizable Values, Total Sellable Yards & Expected Profit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Project Estimated Value */}
          <div className="bg-[#F4F4F6] p-4 rounded-2xl border border-gray-200 flex flex-col justify-between">
            <span className="text-gray-500 text-[11px] font-bold uppercase block flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              <span>Total Project Estimated Value</span>
            </span>
            <div className="my-1.5">
              <strong className="text-gray-950 text-xl sm:text-2xl font-black font-mono block">
                {formatIndianCompact(computedProjectEstimatedValue)}
              </strong>
              <span className="text-xs text-amber-800 font-mono font-bold block">
                {formatINR(computedProjectEstimatedValue)}
              </span>
            </div>
            <span className="text-[10px] text-gray-500 block">
              Realizable sales at benchmark rate
            </span>
          </div>

          {/* Card 2: Actual Total Project Invested Value Till This Day */}
          <div className="bg-[#F4F4F6] p-4 rounded-2xl border border-gray-200 flex flex-col justify-between">
            <span className="text-gray-500 text-[11px] font-bold uppercase block flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-blue-600" />
              <span>Actual Total Project Invested Value Till This Day</span>
            </span>
            <div className="my-1.5">
              <strong className="text-gray-950 text-xl sm:text-2xl font-black font-mono block">
                {formatIndianCompact(actualTotalProjectInvested)}
              </strong>
              <span className="text-xs text-blue-800 font-mono font-bold block">
                {formatINR(actualTotalProjectInvested)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">
                {firmPartners.length} partners capital invested
              </span>
              {totalVariance !== 0 && (
                <span className={`font-mono font-bold ${totalVariance > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {totalVariance > 0 ? `+${formatIndianCompact(totalVariance)}` : formatIndianCompact(totalVariance)} diff
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Based on Entries Total Sellable Area in Yards */}
          <div className="bg-[#F4F4F6] p-4 rounded-2xl border border-gray-200 flex flex-col justify-between">
            <span className="text-gray-500 text-[11px] font-bold uppercase block flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Total Sellable Area in Yards</span>
            </span>
            <div className="my-1.5">
              <strong className="text-gray-950 text-xl sm:text-2xl font-black font-mono block">
                {totalSellableYards.toLocaleString('en-IN')} <span className="text-sm font-sans font-bold">Sq.Yds</span>
              </strong>
              <span className="text-xs text-indigo-800 font-bold block">
                {((totalSellableYards / 4840)).toFixed(2)} Acres Net Area
              </span>
            </div>
            <span className="text-[10px] text-gray-500 block">
              Based on {plots && plots.length > 0 ? `${plots.length} layout plot entries` : 'project layout master plan'}
            </span>
          </div>

          {/* Card 4: Expected Profit as Rate Placed Per Square Yard */}
          <div className="bg-[#FFFDF0] p-4 rounded-2xl border border-amber-300 flex flex-col justify-between">
            <span className="text-amber-800 text-[11px] font-bold uppercase block flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-emerald-600" />
              <span>Expected Profit (As Rate Placed Per Sq.Yd)</span>
            </span>
            <div className="my-1.5">
              <strong className="text-emerald-700 text-xl sm:text-2xl font-black font-mono block">
                +{formatIndianCompact(expectedProjectProfit)}
              </strong>
              <span className="text-xs text-emerald-800 font-mono font-bold block">
                +{formatINR(expectedProfitPerSqYard)}/Sq.Yd Margin
              </span>
            </div>
            <span className="text-[10px] text-amber-900 font-bold block">
              Floor Rate Benchmark: {formatINR(benchmarkRatePerSqYard)}/Sq.Yd
            </span>
          </div>
        </div>

        {/* Partners Table with Allotted Sellable Area, Actual Invested, Difference, and Expected Profit Columns */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="pb-3 px-3">Partner Name &amp; Role</th>
                <th className="pb-3 px-3">Actual Estimated Value per Partner (₹)</th>
                <th className="pb-3 px-3 bg-amber-50/80 text-amber-950 border-l border-amber-200">Actual Invested (₹)</th>
                <th className="pb-3 px-3 bg-amber-50/80 text-amber-950 border-r border-amber-200">Difference (+ / -)</th>
                <th className="pb-3 px-3">Percentage Share (%)</th>
                <th className="pb-3 px-3">Expected Allotted Sellable Area as per Share</th>
                <th className="pb-3 px-3">Expected Profit as per Share for this Project</th>
                <th className="pb-3 px-3">Drawings (₹)</th>
                <th className="pb-3 px-3">Net Balance (₹)</th>
                <th className="pb-3 px-3 text-right min-w-[270px]">Actions (Status & PIN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {firmPartners.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs">
                        <PieChart className="w-6 h-6 text-amber-600" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-gray-950">No Partners Assigned to this Project</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Syndicate partners and dynamic equity stakes are project-specific. Click below to add your first partner to {project ? project.name : 'this project'}.
                        </p>
                      </div>
                      {onAddPartnerMember && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewPartnerName('');
                            setNewPartnerPhone('+91 ');
                            setNewPartnerRole('Investor Partner');
                            setNewPartnerEquity(10);
                            setNewPartnerCapital(0);
                            setNewPartnerPin('1234');
                            setAddPartnerError('');
                            setIsAddPartnerModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-xs transition-all border border-amber-600/30 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Add Partner to this Project</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                firmPartners.map((partner) => {
                const equityPct = getPartnerEquityPercent(partner);
                const {
                  totalActualInvested,
                  baseInitial,
                  ledgerInflows,
                  capitalDifference
                } = getPartnerLedgerStats(partner);
                const netBalance = getPartnerNetBalance(partner);
                const partnerAllottedYards = Math.round((equityPct / 100) * totalSellableYards);
                const partnerExpectedProfit = Math.round((equityPct / 100) * expectedProjectProfit);

                return (
                  <tr key={partner.id} className="hover:bg-gray-50 transition-colors">
                    {/* Partner Name */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-xs ${partner.avatarColor}`}
                        >
                          {partner.name.split(':')[0].replace('Partner ', '')}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-950 flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black">{partner.name}</span>
                            {partner.pinCode && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 border font-mono font-bold rounded-md ${
                                  partner.mustChangePin || partner.pinCode === '9999'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-stone-100 text-stone-800 border-stone-300'
                                }`}
                                title={`Field Login PIN: ${partner.pinCode}`}
                              >
                                PIN: {partner.pinCode}
                                {partner.mustChangePin || partner.pinCode === '9999' ? ' (Reset Req)' : ''}
                              </span>
                            )}
                            {partner.userStatus === 'inactive' && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-black rounded-md">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 font-medium truncate">
                            {partner.roleDescription}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 font-mono text-[11px] font-bold text-amber-950" title="Partner Login Mobile (Unique User ID)">
                              <Smartphone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="text-[9px] uppercase tracking-wider text-amber-800 font-black">User ID:</span>
                              <span>{partner.phone || 'No Mobile Registered'}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Actual Estimated Value per Partner (Capital Invested Estimate) */}
                    <td className="py-3.5 px-3 font-mono font-bold text-gray-900">
                      {formatINR(partner.initialCapital)}
                      <span className="text-[10px] text-gray-500 block font-sans">
                        ({formatIndianCompact(partner.initialCapital)})
                      </span>
                    </td>

                    {/* Actual Invested (₹) Column - Auto-calculated from initial project setup & ledger entries */}
                    <td className="py-3.5 px-3 font-mono font-bold bg-amber-50/30 border-l border-amber-100">
                      <span className="text-gray-950 font-black text-xs block">{formatINR(totalActualInvested)}</span>
                      <span className="text-[10px] text-gray-500 block font-sans">
                        ({formatIndianCompact(totalActualInvested)})
                      </span>
                      {ledgerInflows > 0 && (
                        <span className="text-[9px] text-emerald-700 font-sans font-bold block mt-0.5" title={`Includes ${formatINR(ledgerInflows)} in approved capital deposit entries`}>
                          +{formatIndianCompact(ledgerInflows)} ledger entries
                        </span>
                      )}
                    </td>

                    {/* Difference (+ / -) Column */}
                    <td className="py-3.5 px-3 font-mono bg-amber-50/30 border-r border-amber-100">
                      {capitalDifference === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                          ₹0 (On Target)
                        </span>
                      ) : capitalDifference > 0 ? (
                        <div>
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            +{formatINR(capitalDifference)}
                          </span>
                          <span className="text-[9px] text-emerald-700 font-sans font-bold block mt-0.5">
                            + Added to Net Bal
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            {formatINR(capitalDifference)}
                          </span>
                          <span className="text-[9px] text-rose-700 font-sans font-bold block mt-0.5">
                            - Deducted from Net Bal
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Percentage Share % */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-gray-950 text-sm">
                          {equityPct.toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {splitMode === 'fixed' ? '(Agreed)' : '(Capital)'}
                        </span>
                      </div>
                      <div className="w-20 bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-[#FFB800] h-full rounded-full"
                          style={{ width: `${Math.min(100, equityPct * 2)}%` }}
                        />
                      </div>
                    </td>

                    {/* Expected Allotted Sellable Area as per Percentage Share */}
                    <td className="py-3.5 px-3 font-mono">
                      <span className="text-gray-950 font-bold text-xs block">
                        {partnerAllottedYards.toLocaleString('en-IN')} <span className="font-sans text-[11px] text-gray-600">Sq.Yards</span>
                      </span>
                      <span className="text-[10px] text-indigo-700 font-medium block">
                        {((partnerAllottedYards / 4840)).toFixed(2)} Acres ({equityPct.toFixed(1)}% share)
                      </span>
                    </td>

                    {/* Expected Profit as per Share for this Project */}
                    <td className="py-3.5 px-3 font-mono">
                      <span className="text-emerald-700 font-black text-xs block">
                        +{formatINR(partnerExpectedProfit)}
                      </span>
                      <span className="text-[10px] text-emerald-800 font-medium block">
                        (+{formatIndianCompact(partnerExpectedProfit)})
                      </span>
                    </td>

                    {/* Drawings */}
                    <td className="py-3.5 px-3 font-mono text-red-600 font-bold">
                      -{formatINR(partner.drawings)}
                    </td>

                    {/* Net Balance (Difference is reflected here) */}
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-sm font-black text-gray-950 block">
                        {formatINR(netBalance)}
                      </span>
                      <div className="flex flex-col gap-0.5 mt-0.5">
                        <span className={`text-[10px] font-bold ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {netBalance >= 0 ? 'Receivable' : 'Due to Syndicate'}
                        </span>
                        {capitalDifference !== 0 && (
                          <span className={`text-[9px] font-mono font-bold ${capitalDifference > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            ({capitalDifference > 0 ? `+${formatIndianCompact(capitalDifference)}` : formatIndianCompact(capitalDifference)} diff)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions Column: Active/Inactive, Reset PIN, Adjust */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* 1. Active / Inactive Partner Status Toggle */}
                        <button
                          type="button"
                          onClick={() => handleTogglePartnerStatus(partner)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer border shadow-2xs ${
                            partner.userStatus === 'inactive'
                              ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                          }`}
                          title={
                            partner.userStatus === 'inactive'
                              ? 'Partner is currently Inactive. Click to Activate'
                              : 'Partner is currently Active. Click to Deactivate'
                          }
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              partner.userStatus === 'inactive'
                                ? 'bg-rose-500'
                                : 'bg-emerald-500 animate-pulse'
                            }`}
                          />
                          <span>{partner.userStatus === 'inactive' ? 'Inactive' : 'Active'}</span>
                        </button>

                        {/* 2. Reset PIN Button */}
                        <button
                          type="button"
                          onClick={() => setPartnerForPinReset(partner)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 rounded-xl border border-amber-300 text-[11px] font-black transition-all cursor-pointer shadow-2xs"
                          title="Reset security PIN to default 9999. Partner will automatically get prompted to reset PIN on next login."
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Reset PIN (9999)</span>
                        </button>

                        {/* 3. Adjust Ledger Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedPartnerForAdjust({ ...partner })}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl border border-gray-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          title="Adjust Capital & Equity Parameters"
                        >
                          Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>

      </div>

      {/* RESET PIN CONFIRMATION MODAL */}
      {partnerForPinReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-amber-300 max-w-sm w-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-[#FFB800] p-5 border-b border-amber-500/40 text-gray-950">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gray-950 text-amber-400 flex items-center justify-center shadow-md">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Reset Partner PIN</h3>
                  <p className="text-[11px] text-gray-900 font-semibold">{partnerForPinReset.name}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-gray-600">Partner User ID (Mobile):</span>
                  <strong className="text-gray-950 font-bold">{partnerForPinReset.phone}</strong>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-gray-600">New Default PIN:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-xs font-mono">9999</span>
                </div>
              </div>

              <div className="text-gray-600 leading-relaxed text-[11px] bg-gray-50 p-3 rounded-xl border border-gray-200">
                <p className="font-bold text-gray-900 mb-1">
                  ⚡ Accountant PIN Reset Procedure:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-gray-700">
                  <li>Partner PIN will automatically reset to <strong>9999</strong>.</li>
                  <li>On their next login, the partner will be <strong>automatically prompted to set a new PIN</strong> before entering the portal.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPartnerForPinReset(null)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmPinReset(partnerForPinReset)}
                  disabled={isResettingPin}
                  className="px-4 py-2 rounded-xl bg-gray-950 hover:bg-black text-[#FFB800] font-black cursor-pointer shadow-md text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{isResettingPin ? 'Resetting...' : 'Confirm Reset (9999)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-60 bg-gray-950 border-2 border-[#FFB800] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold">{toastMsg}</span>
        </div>
      )}

      {/* ADJUST PARTNER MODAL */}
      {selectedPartnerForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
              <div>
                <h3 className="font-black text-gray-950 text-base">
                  Adjust Ledger: {selectedPartnerForAdjust.name}
                </h3>
                <p className="text-[11px] text-gray-900 font-medium">
                  Update estimated capital, actual invested amount, and equity parameters
                </p>
              </div>
              <button
                onClick={() => setSelectedPartnerForAdjust(null)}
                className="text-gray-900 font-bold p-1 rounded-full hover:bg-black/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdatePartner(selectedPartnerForAdjust);
                setSelectedPartnerForAdjust(null);
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  Actual Estimated Value per Partner (₹):
                </label>
                <input
                  type="number"
                  value={selectedPartnerForAdjust.initialCapital}
                  onChange={(e) =>
                    setSelectedPartnerForAdjust({
                      ...selectedPartnerForAdjust,
                      initialCapital: Number(e.target.value),
                    })
                  }
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-bold"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Committed base capital: {formatINR(selectedPartnerForAdjust.initialCapital)} ({formatIndianCompact(selectedPartnerForAdjust.initialCapital)})
                </span>
              </div>

              {/* Auto-Calculated Actual Invested Ledger Breakdown */}
              {(() => {
                const stats = getPartnerLedgerStats(selectedPartnerForAdjust);
                const diff = stats.totalActualInvested - selectedPartnerForAdjust.initialCapital;
                const previewNet =
                  stats.totalActualInvested +
                  (selectedPartnerForAdjust.shareOfFieldExpenses || 0) -
                  (stats.totalDrawings || 0);

                return (
                  <div className="space-y-3">
                    <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-300 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                          <span>Actual Invested Capital</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-sans font-bold">
                            Auto-Calculated
                          </span>
                        </span>
                        <strong className="text-sm font-black font-mono text-gray-950">
                          {formatINR(stats.totalActualInvested)}
                        </strong>
                      </div>
                      <div className="space-y-1 text-[11px] text-gray-600 pt-1 border-t border-amber-200/80">
                        <div className="flex justify-between">
                          <span>• Initial Project Setup Allocation:</span>
                          <span className="font-mono font-bold text-gray-900">{formatINR(stats.baseInitial)}</span>
                        </div>
                        {stats.ledgerInflows > 0 ? (
                          <div className="flex justify-between text-emerald-800 font-medium">
                            <span>• Bank Capital Deposits (Ledger Entries):</span>
                            <span className="font-mono font-bold">+{formatINR(stats.ledgerInflows)}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between text-gray-500">
                            <span>• Bank Capital Deposits:</span>
                            <span className="font-mono">₹0 (No subsequent entries)</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-amber-900 font-medium pt-1 border-t border-amber-200/60 leading-relaxed">
                        Values auto-calculate from initial project creation allocations and verified capital deposit vouchers recorded in <strong>Project Accounts</strong> or <strong>Passbook</strong>.
                      </p>
                    </div>

                    {/* Dynamic Live Difference & Net Balance Calculation Card */}
                    <div className="bg-[#FFFDF0] p-3 rounded-2xl border border-amber-300 space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-700 font-bold">Invested vs Estimated Difference:</span>
                        <span
                          className={`font-mono font-black text-xs ${
                            diff > 0
                              ? 'text-emerald-700'
                              : diff < 0
                              ? 'text-rose-700'
                              : 'text-gray-700'
                          }`}
                        >
                          {diff > 0
                            ? `+${formatINR(diff)} (+ added to Net Balance)`
                            : diff < 0
                            ? `${formatINR(diff)} (- subtracted from Net Balance)`
                            : '₹0 (Exact match)'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-amber-200">
                        <span className="text-gray-900 font-extrabold">Projected Net Balance:</span>
                        <span className="font-mono font-black text-sm text-gray-950">
                          {formatINR(previewNet)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-gray-700 font-bold mb-1">Agreed Fixed Share %:</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedPartnerForAdjust.fixedEquityPercent}
                  onChange={(e) =>
                    setSelectedPartnerForAdjust({
                      ...selectedPartnerForAdjust,
                      fixedEquityPercent: Number(e.target.value),
                    })
                  }
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Cumulative Partner Drawings (₹):</label>
                <input
                  type="number"
                  value={selectedPartnerForAdjust.drawings}
                  onChange={(e) =>
                    setSelectedPartnerForAdjust({
                      ...selectedPartnerForAdjust,
                      drawings: Number(e.target.value),
                    })
                  }
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-bold text-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPartnerForAdjust(null)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30 cursor-pointer"
                >
                  Save Partner Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PARTNER TO PROJECT MODAL */}
      {isAddPartnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-gray-950" />
                <h3 className="font-black text-gray-950 text-base">
                  Add Partner to {project ? project.name : 'Project'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPartnerModalOpen(false)}
                className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-gray-950 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAddPartnerError('');
                if (!newPartnerName.trim()) {
                  setAddPartnerError('Please provide a partner name.');
                  return;
                }
                const cleanPhoneDigits = newPartnerPhone.replace(/\D/g, '').slice(-10);
                if (!cleanPhoneDigits || cleanPhoneDigits.length < 10) {
                  setAddPartnerError('Please provide a valid 10-digit mobile number. The mobile number serves as the partner User ID.');
                  return;
                }
                const newPartner: SyndicatePartner = {
                  id: `partner-${Date.now()}`,
                  firmId: firm.id,
                  name: newPartnerName.trim(),
                  phone: cleanPhoneDigits,
                  roleDescription: newPartnerRole.trim() || 'Syndicate Partner',
                  avatarColor: 'bg-indigo-600',
                  initialCapital: Number(newPartnerCapital) || 0,
                  actualInvested: Number(newPartnerCapital) || 0,
                  fixedEquityPercent: Number(newPartnerEquity) || 0,
                  drawings: 0,
                  shareOfFieldExpenses: 0,
                  userRole: 'field_partner',
                  userStatus: 'active',
                  pinCode: newPartnerPin || '9999',
                  dailySpendingLimit: 50000,
                };
                if (onAddPartnerMember) {
                  onAddPartnerMember(newPartner);
                }
                setIsAddPartnerModalOpen(false);
              }}
              className="p-6 space-y-4 text-xs"
            >
              {addPartnerError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-bold">
                  {addPartnerError}
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-bold mb-1">Partner Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. K. Rama Rao"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Mobile Number (User ID) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile (e.g. 9848012345)"
                    value={newPartnerPhone}
                    onChange={(e) => setNewPartnerPhone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-bold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Field Login PIN *</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="9999"
                    value={newPartnerPin}
                    onChange={(e) => setNewPartnerPin(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-bold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    4-digit PIN for partner portal (default: 9999)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-[11px] text-amber-950">
                <Smartphone className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Automatic Partner Mobile User Enrollment:</strong>
                  <span>When added to this project, the partner's mobile number ({newPartnerPhone || 'mobile'}) is automatically registered into the system as their unique Login User ID across this project and firm with default PIN ({newPartnerPin || '9999'}).</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Project Role / Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Managing Partner / Civil Contractor"
                  value={newPartnerRole}
                  onChange={(e) => setNewPartnerRole(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-semibold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Equity Share (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={newPartnerEquity}
                    onChange={(e) => setNewPartnerEquity(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-bold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Capital Invested (₹)</label>
                  <input
                    type="number"
                    step="50000"
                    min="0"
                    value={newPartnerCapital}
                    onChange={(e) => setNewPartnerCapital(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-mono font-bold text-gray-950 focus:bg-white focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddPartnerModalOpen(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full shadow border border-amber-600/30 cursor-pointer active:scale-95"
                >
                  Add Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
