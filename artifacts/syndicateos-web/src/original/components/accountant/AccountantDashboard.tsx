import React, { useState, useEffect } from 'react';
import {
  TenantFirm,
  Project,
  Plot,
  LayoutCalculation,
  ProjectExpense,
  ApartmentUnit,
  ApartmentPricingMatrix,
  SyndicatePartner,
  FieldExpenseLog,
  EquitySplitMode,
  LedgerMode,
  AuditLogEntry,
  LiquorDailySettlement,
  PartnerStockDraw,
  FirmAccount,
  FirmAccountTransaction,
  IndividualInvestmentRecord
} from '../../types';
import { OpenPlottingModule } from './OpenPlottingModule';
import { ConstructionModule } from './ConstructionModule';
import { SyndicateEquityModule } from './SyndicateEquityModule';
import { LiquorVendSettlementModule } from './LiquorVendSettlementModule';
import { ProjectStatementModule } from './ProjectStatementModule';
import { AddProjectModal } from '../modals/AddProjectModal';
import { FirmAccountsBar } from './FirmAccountsBar';
import { AddFirmAccountModal } from '../modals/AddFirmAccountModal';
import { FirmAccountStatementModal } from '../modals/FirmAccountStatementModal';
import { RecordLedgerTransactionModal } from '../modals/RecordLedgerTransactionModal';
import { EnrollExpenseModal } from '../modals/EnrollExpenseModal';
import { IndividualInvestmentModal, IndividualInvestmentData } from '../modals/IndividualInvestmentModal';
import {
  Compass,
  Building,
  PieChart,
  Wine,
  Hammer,
  ShieldCheck,
  CheckCircle2,
  FolderOpen,
  PlusCircle,
  Coins,
  MapPin,
  TrendingUp,
  LayoutDashboard,
  Receipt,
  Landmark,
  ArrowRight,
  Sparkles,
  Layers,
  AlertCircle,
  FileCheck,
  Building2,
  Calendar,
  Check,
  X,
  CreditCard,
  FileText,
  Plus,
  Search,
  Filter,
  Clock,
  User,
  Tag,
  Printer,
  ChevronRight,
  CheckSquare,
  LogOut
} from 'lucide-react';
import { formatINR, formatIndianCompact } from '../../utils/formatters';

interface AccountantDashboardProps {
  firm: TenantFirm;
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onAddProject: (newProject: Project, initialPlots?: Plot[], initialUnits?: ApartmentUnit[]) => void;
  plots: Plot[];
  onUpdatePlot: (plot: Plot) => void;
  layoutCalc: LayoutCalculation;
  onUpdateLayoutCalc: (calc: LayoutCalculation) => void;
  projectExpenses: ProjectExpense[];
  onAddProjectExpense: (expense: ProjectExpense) => void;
  onUpdateProjectExpense: (expense: ProjectExpense) => void;
  apartmentUnits: ApartmentUnit[];
  onUpdateApartmentUnit: (unit: ApartmentUnit) => void;
  pricingMatrix: ApartmentPricingMatrix;
  onUpdatePricingMatrix: (matrix: ApartmentPricingMatrix) => void;
  partners: SyndicatePartner[];
  onUpdatePartner: (partner: SyndicatePartner) => void;
  onAddPartnerMember?: (partner: SyndicatePartner) => void;
  splitMode: EquitySplitMode;
  onToggleSplitMode: (mode: EquitySplitMode) => void;
  fieldExpenses: FieldExpenseLog[];
  onApproveExpense: (expenseId: string, signoff?: string) => void;
  onRejectExpense: (expenseId: string) => void;
  ledgerMode: LedgerMode;
  onToggleLedgerMode: (mode: LedgerMode) => void;
  auditLogs: AuditLogEntry[];
  liquorSettlements: LiquorDailySettlement[];
  onAddLiquorSettlement: (settlement: LiquorDailySettlement) => void;
  partnerStockDraws: PartnerStockDraw[];
  onAddStockDraw: (draw: PartnerStockDraw) => void;
  firmAccounts?: FirmAccount[];
  onAddFirmAccount?: (account: FirmAccount) => void;
  onAddAccountTransaction?: (accountId: string, tx: FirmAccountTransaction) => void;
  onEnrollExpense?: (expense: FieldExpenseLog) => void;
  individualInvestments?: IndividualInvestmentRecord[];
  onRecordIndividualInvestment?: (data: IndividualInvestmentData) => void;
  onApproveIndividualInvestment?: (investmentId: string, approverName: string) => void;
  onRejectIndividualInvestment?: (investmentId: string, reason?: string) => void;
  onSignOut?: () => void;
}

export type TopBarTab =
  | 'dashboard'
  | 'partners'
  | 'open_plotting'
  | 'construction'
  | 'liquor_infra'
  | 'accounts'
  | 'expenses'
  | 'project_statement';

export const AccountantDashboard: React.FC<AccountantDashboardProps> = ({
  firm,
  projects,
  selectedProjectId,
  onSelectProject,
  onAddProject,
  plots,
  onUpdatePlot,
  layoutCalc,
  onUpdateLayoutCalc,
  projectExpenses,
  onAddProjectExpense,
  onUpdateProjectExpense,
  apartmentUnits,
  onUpdateApartmentUnit,
  pricingMatrix,
  onUpdatePricingMatrix,
  partners,
  onUpdatePartner,
  onAddPartnerMember,
  splitMode,
  onToggleSplitMode,
  fieldExpenses,
  onApproveExpense,
  onRejectExpense,
  onEnrollExpense = () => {},
  ledgerMode,
  onToggleLedgerMode,
  auditLogs,
  liquorSettlements,
  onAddLiquorSettlement,
  partnerStockDraws,
  onAddStockDraw,
  firmAccounts = [],
  onAddFirmAccount = () => {},
  onAddAccountTransaction = () => {},
  individualInvestments = [],
  onRecordIndividualInvestment,
  onApproveIndividualInvestment,
  onRejectIndividualInvestment,
  onSignOut,
}) => {
  // Modal states
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isAddFirmAccountModalOpen, setIsAddFirmAccountModalOpen] = useState(false);
  const [statementAccount, setStatementAccount] = useState<FirmAccount | null>(null);
  const [isRecordTxModalOpen, setIsRecordTxModalOpen] = useState(false);
  const [isEnrollExpenseModalOpen, setIsEnrollExpenseModalOpen] = useState(false);
  const [isIndividualInvestmentModalOpen, setIsIndividualInvestmentModalOpen] = useState(false);
  const [selectedVoucherForSlip, setSelectedVoucherForSlip] = useState<FieldExpenseLog | null>(null);

  // Expenses Tab specific filter states
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseSubTab, setExpenseSubTab] = useState<'all' | 'pending' | 'approved' | 'budget_matrix'>('all');

  // Top Bar Tab state
  const [activeTab, setActiveTab] = useState<TopBarTab>('dashboard');

  // Filter projects belonging strictly to this firm AND matching firm's active business sectors
  const firmActiveProjects = projects.filter(
    (p) => p.firmId === firm.id && firm.sectors.includes(p.sector)
  );

  // Derive the active project strictly from active sector projects
  const activeProject: Project | null =
    firmActiveProjects.find((p) => p.id === selectedProjectId) ||
    firmActiveProjects[0] ||
    null;

  // If a tab belongs to a sector that is removed from the firm, gracefully fall back to dashboard
  useEffect(() => {
    if (activeTab === 'open_plotting' && !firm.sectors.includes('real_estate_open_plotting')) {
      setActiveTab('dashboard');
    } else if (activeTab === 'construction' && !firm.sectors.includes('real_estate_construction')) {
      setActiveTab('dashboard');
    } else if (
      activeTab === 'liquor_infra' &&
      !firm.sectors.includes('liquor_vends') &&
      !firm.sectors.includes('custom_infra')
    ) {
      setActiveTab('dashboard');
    }
  }, [firm.sectors, activeTab]);

  // Keep selectedProjectId in sync with firm's active business sectors
  useEffect(() => {
    if (activeProject && !firm.sectors.includes(activeProject.sector)) {
      if (firmActiveProjects.length > 0 && firmActiveProjects[0].id !== selectedProjectId) {
        onSelectProject(firmActiveProjects[0].id);
      }
    }
  }, [firm.sectors, activeProject?.sector, firmActiveProjects, selectedProjectId, onSelectProject]);

  // Filter Inventory strictly for the selected project
  const activePlots = activeProject
    ? plots.filter((p) => p.projectId === activeProject.id)
    : [];

  const activeUnits = activeProject
    ? apartmentUnits.filter((u) => u.projectId === activeProject.id)
    : [];

  const activeProjectExpenses = activeProject
    ? projectExpenses.filter((pe) => pe.projectId === activeProject.id)
    : [];

  // Dynamic Respective Partners for THIS project (partners vary from project to project)
  const activeProjectPartners: SyndicatePartner[] =
    activeProject && activeProject.partners && activeProject.partners.length > 0
      ? activeProject.partners.map((ps) => {
          const master = partners.find(
            (p) => String(p.id) === String(ps.partnerId) || p.name.trim().toLowerCase() === ps.name.trim().toLowerCase()
          );
          // Look up verified individual investments enrolled for this partner
          const partnerApprovedInvs = (individualInvestments || []).filter(
            (inv) =>
              (String(inv.partnerId) === String(ps.partnerId) ||
                inv.partnerName.trim().toLowerCase() === ps.name.trim().toLowerCase()) &&
              inv.status === 'approved' &&
              (!inv.firmId || inv.firmId === firm.id) &&
              (!activeProject || !inv.projectId || inv.projectId === activeProject.id)
          );
          const totalInvsRecorded = partnerApprovedInvs.reduce((sum, i) => sum + i.amount, 0);

          const actualInv =
            totalInvsRecorded > 0
              ? totalInvsRecorded
              : ps.actualInvested !== undefined
              ? ps.actualInvested
              : (master?.actualInvested !== undefined ? master.actualInvested : 0);

          return {
            id: ps.partnerId,
            firmId: firm.id,
            name: ps.name,
            phone: ps.phone,
            roleDescription: ps.roleInProject || (master ? master.roleDescription : 'Syndicate Partner'),
            avatarColor: ps.avatarColor || (master ? master.avatarColor : 'bg-indigo-600'),
            initialCapital: ps.initialCapital || 0,
            actualInvested: actualInv,
            fixedEquityPercent: ps.equityPercent || 0,
            drawings: ps.drawings ?? (master ? master.drawings : 0),
            shareOfFieldExpenses: ps.shareOfFieldExpenses ?? (master ? master.shareOfFieldExpenses : 0),
            userRole: ps.roleInProject.toLowerCase().includes('managing')
              ? 'managing_partner'
              : (master?.userRole || 'field_partner'),
            userStatus: (master?.userStatus as any) || (ps as any).userStatus || 'active',
            pinCode: master?.pinCode || (ps as any).pinCode || '9999',
            mustChangePin: master?.mustChangePin ?? (ps as any).mustChangePin ?? (master?.pinCode === '9999' || (ps as any).pinCode === '9999'),
            dailySpendingLimit: master?.dailySpendingLimit || 50000,
          };
        })
      : [];

  // Layout Calculations
  const activeLayoutCalc: LayoutCalculation = activeProject
    ? {
        totalExtentValue: activeProject.extentValue || 0,
        unit:
          activeProject.extentUnit === 'Units / Flats'
            ? 'Acres'
            : (activeProject.extentUnit as 'Acres' | 'Guntas / Cents' | 'Sq. Yards') || 'Acres',
        roadWidth: activeProject.roadWidth || 30,
        openSpacePercent: activeProject.openSpacePercent || 10,
        floorRatePerSqYard: activeProject.floorRatePerSqYard || 0,
      }
    : {
        totalExtentValue: 0,
        unit: 'Acres',
        roadWidth: 30,
        openSpacePercent: 10,
        floorRatePerSqYard: 0,
      };

  const activeProjectTotalCapital = activeProjectPartners.reduce((acc, p) => acc + (p.initialCapital || 0), 0);
  const activeProjectTotalActualInvested = activeProjectPartners.reduce(
    (acc, p) => acc + (p.actualInvested !== undefined ? p.actualInvested : 0),
    0
  );
  const activeProjectCost = activeProject?.totalEstimatedOutlay || 0;
  const isProjectCostInSync = activeProjectCost > 0 ? Math.abs(activeProjectTotalCapital - activeProjectCost) < 100 : true;
  const pendingExpensesCount = fieldExpenses.filter((e) => e.status === 'pending').length;

  // ==========================================
  // DASHBOARD KPI CALCULATIONS FOR QUICK VIEW
  // ==========================================
  const isPlotSector = activeProject ? activeProject.sector === 'real_estate_open_plotting' : false;
  const isConstructionSector = activeProject ? activeProject.sector === 'real_estate_construction' : false;

  // Plots inventory stats
  const totalPlotsCount = activePlots.length;
  const availablePlotsCount = activePlots.filter((p) => p.status === 'available').length;
  const bookedPlotsCount = activePlots.filter((p) => p.status === 'reserved').length;
  const soldPlotsCount = activePlots.filter((p) => p.status === 'sold').length;

  const totalPlotsSellableValue = activePlots.reduce((sum, p) => {
    const rate = p.ratePerSqYard || (activeProject ? activeProject.floorRatePerSqYard : 17000) || 17000;
    return sum + p.areaSqYards * rate;
  }, 0);
  const totalPlotAdvancesCollected = activePlots.reduce((sum, p) => sum + (p.advanceReceived || 0), 0);

  // Construction units stats
  const totalUnitsCount = activeUnits.length;
  const availableUnitsCount = activeUnits.filter((u) => u.status === 'available').length;
  const bookedUnitsCount = activeUnits.filter((u) => u.status === 'booked').length;
  const registeredUnitsCount = activeUnits.filter((u) => u.status === 'registered').length;

  const totalUnitsSellableValue = activeUnits.reduce((sum, u) => {
    const rate =
      (u.baseRate || (activeProject ? activeProject.baseSqFtRate : 4600) || 4600) + (u.facingPremium || 0) + (u.floorRise || 0);
    return sum + u.sftArea * rate + (u.parkingFee || 0) + (u.amenitiesFee || 0);
  }, 0);
  const totalUnitAdvancesCollected = activeUnits.reduce((sum, u) => sum + (u.advanceReceived || 0), 0);

  // Unified figures for the active project
  const totalInventoryCount = isPlotSector ? totalPlotsCount : isConstructionSector ? totalUnitsCount : 0;
  const availableInventoryCount = isPlotSector ? availablePlotsCount : isConstructionSector ? availableUnitsCount : 0;
  const bookedInventoryCount = isPlotSector ? bookedPlotsCount : isConstructionSector ? bookedUnitsCount : 0;
  const soldInventoryCount = isPlotSector ? soldPlotsCount : isConstructionSector ? registeredUnitsCount : 0;

  const totalActualEstimatedValue = !activeProject
    ? 0
    : isPlotSector
    ? totalPlotsSellableValue > 0
      ? totalPlotsSellableValue
      : activeProjectCost * 1.35
    : isConstructionSector
    ? totalUnitsSellableValue > 0
      ? totalUnitsSellableValue
      : activeProjectCost * 1.32
    : activeProjectCost * 1.25;

  const totalAdvancesCollected = isPlotSector ? totalPlotAdvancesCollected : totalUnitAdvancesCollected;
  const totalPendingReceivables = Math.max(0, totalActualEstimatedValue - totalAdvancesCollected);
  const projectedSurplus = activeProject ? totalActualEstimatedValue - activeProjectCost : 0;
  const projectedRoiPercent =
    activeProjectCost > 0 ? Math.round((projectedSurplus / activeProjectCost) * 100) : 0;

  // Project Accounts - strictly scoped to active project + shared cash account
  const projectAccounts = activeProject
    ? firmAccounts.filter(
        (acc) =>
          acc.firmId === firm.id &&
          (acc.linkedProjectId === activeProject.id || acc.accountType === 'field_petty_cash')
      )
    : [];
  const totalProjectLiquidity = projectAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* 1. TOP HEADER: Firm Console & Project Dropdown Selector */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FFB800] text-gray-950">
              Firm Accountant Operations Console
            </span>
            <span className="text-xs text-gray-500 font-mono">Firm ID: {firm.code}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-2xl font-black text-gray-950">{firm.name}</h2>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 border border-gray-200 hover:border-red-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                title="Sign out of Accountant Portal"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {firm.location} • Managing Partner: <strong className="text-gray-800">{firm.managingPartnerName}</strong> •
            Firm Accountant: <strong className="text-gray-800">{firm.accountantName}</strong>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Independent operations &amp; treasury manager for project accounts, venture projects, partner allocations, and expenditure auditing.
          </p>
        </div>

        {/* PROJECT SELECTOR DROPDOWN & + ADD PROJECTS BUTTON */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2.5 bg-[#F4F4F6] px-4 py-2.5 rounded-2xl border border-gray-300 shadow-inner">
            <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="flex flex-col min-w-[220px] sm:min-w-[280px]">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                Select Project / Venture:
              </span>
              <select
                id="accountant-project-select"
                value={selectedProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
                className="text-xs font-black text-gray-950 bg-transparent border-0 focus:ring-0 cursor-pointer p-0 pr-4 outline-none truncate"
              >
                {firmActiveProjects.length > 0 ? (
                  firmActiveProjects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.code})
                    </option>
                  ))
                ) : (
                  <option value="">No Active Projects in Enabled Sectors</option>
                )}
              </select>
            </div>
          </div>

          {/* + Add Projects Button */}
          <button
            id="btn-add-project"
            onClick={() => setIsAddProjectModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md hover:shadow-lg transition-all border border-amber-500/40 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Add Projects</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TOP SIDE BARS / NAVIGATION TABS (SPLIT SECTIONS)      */}
      {/* ======================================================== */}
      <div className="bg-white p-2 sm:p-2.5 rounded-3xl shadow-sm border border-gray-200">
        <nav aria-label="Syndicate Top Bars" className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          {/* Bar 1: Dashboard & KPIs */}
          <button
            id="topbar-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-[#FFB800]" />
            <span>Dashboard</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'dashboard' ? 'bg-amber-400 text-gray-950' : 'bg-gray-200 text-gray-800'
              }`}
            >
              KPIs
            </span>
          </button>

          {/* Bar 2: Partners Info & Equity */}
          <button
            id="topbar-partners"
            onClick={() => setActiveTab('partners')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'partners'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <PieChart className="w-4 h-4 text-[#FFB800]" />
            <span>Partners &amp; Equity</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'partners' ? 'bg-amber-400 text-gray-950' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {activeProjectPartners.length}
            </span>
          </button>

          {/* Bar 3: Sector Engine (Open Plotting) */}
          {firm.sectors.includes('real_estate_open_plotting') && firm.featureFlags?.enablePlotGrid !== false && (
            <button
              id="topbar-open-plotting"
              onClick={() => setActiveTab('open_plotting')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'open_plotting'
                  ? 'bg-[#111827] text-white shadow-md'
                  : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
              }`}
            >
              <Compass className="w-4 h-4 text-[#FFB800]" />
              <span>Open Plotting</span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  activeTab === 'open_plotting' ? 'bg-amber-400 text-gray-950' : 'bg-gray-200 text-gray-800'
                }`}
              >
                {activePlots.length} Plots
              </span>
            </button>
          )}

          {/* Bar 4: Sector Engine (Apartments & Construction) */}
          {firm.sectors.includes('real_estate_construction') && firm.featureFlags?.enableApartmentMatrix !== false && (
            <button
              id="topbar-construction"
              onClick={() => setActiveTab('construction')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'construction'
                  ? 'bg-[#111827] text-white shadow-md'
                  : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
              }`}
            >
              <Building className="w-4 h-4 text-[#FFB800]" />
              <span>Apartments &amp; Construction</span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  activeTab === 'construction' ? 'bg-amber-400 text-gray-950' : 'bg-gray-200 text-gray-800'
                }`}
              >
                {activeUnits.length} Units
              </span>
            </button>
          )}

          {/* Bar 5: Liquor Vends / Custom Infra */}
          {(firm.sectors.includes('liquor_vends') || firm.sectors.includes('custom_infra')) && (
            <button
              id="topbar-liquor-infra"
              onClick={() => setActiveTab('liquor_infra')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
                activeTab === 'liquor_infra'
                  ? 'bg-[#111827] text-white shadow-md'
                  : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
              }`}
            >
              {firm.sectors.includes('liquor_vends') ? (
                <>
                  <Wine className="w-4 h-4 text-[#FFB800]" />
                  <span>Liquor Vends</span>
                </>
              ) : (
                <>
                  <Hammer className="w-4 h-4 text-[#FFB800]" />
                  <span>Custom Infra</span>
                </>
              )}
            </button>
          )}

          {/* Bar 6: Project Accounts & Treasury */}
          <button
            id="topbar-accounts"
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'accounts'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <Landmark className="w-4 h-4 text-[#FFB800]" />
            <span>Project Accounts</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'accounts' ? 'bg-amber-400 text-gray-950' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {projectAccounts.length}
            </span>
          </button>

          {/* Bar 7: Expenses & Approvals */}
          <button
            id="topbar-expenses"
            onClick={() => setActiveTab('expenses')}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'expenses'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <Receipt className="w-4 h-4 text-[#FFB800]" />
            <span>Expenses &amp; Approvals</span>
            {pendingExpensesCount > 0 && (
              <span className="px-2 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-black animate-pulse">
                {pendingExpensesCount}
              </span>
            )}
          </button>

          {/* Bar 8: Project Statement */}
          <button
            id="topbar-project-statement"
            onClick={() => setActiveTab('project_statement')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'project_statement'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Project Statement</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'project_statement' ? 'bg-emerald-400 text-gray-950' : 'bg-gray-200 text-gray-800'
              }`}
            >
              Passbook
            </span>
          </button>
        </nav>
      </div>

      {/* ======================================================== */}
      {/* 3. CONTENT AREA FOR ACTIVE TOP BAR                      */}
      {/* ======================================================== */}

      {/* ---------------------------------------------------- */}
      {/* TAB 1: DASHBOARD (ALL QUICK VIEWABLE DATA & KPIS)    */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'dashboard' && (
        !activeProject ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-500/10 via-white to-gray-50 rounded-3xl p-8 sm:p-12 text-center border border-amber-200/80 shadow-sm max-w-2xl mx-auto my-4 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-[#FFB800] text-gray-950 flex items-center justify-center mx-auto shadow-md">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-gray-900 text-amber-300">
                  {firm.code}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-gray-950 mt-2">
                  Welcome to {firm.name}!
                </h3>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                  All top bar operations, metrics, partner allocations, and project bank accounts sync with the selected project. As Firm Accountant, you manage the firm and project operations. To get started, please add your first project venture.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddProjectModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Add First Project Venture</span>
                </button>
              </div>
            </div>

            {/* 3-Step Project Workflow Guide (No mock numbers, no defaulted values) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-xs">
                  1
                </div>
                <h4 className="text-xs font-black text-gray-900">Create Project Venture</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Configure Open Plotting or Construction projects with survey numbers, extent, and estimated outlay.
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-black text-xs">
                  2
                </div>
                <h4 className="text-xs font-black text-gray-900">Assign Project Partners</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Allocate partner equity shares and capital investments specific to each project venture.
                </p>
              </div>
              <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-black text-xs">
                  3
                </div>
                <h4 className="text-xs font-black text-gray-900">Register Project Bank Accounts</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Open and link dedicated RERA escrow, operational, or cash accounts for each specific project.
                </p>
              </div>
            </div>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Project Dossier Banner */}
          <div className="bg-gradient-to-br from-amber-500/10 via-white to-gray-50 rounded-3xl p-5 sm:p-6 shadow-sm border border-amber-200/80">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-amber-200/60">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-lg bg-gray-900 text-amber-400 shadow-xs">
                    {activeProject.code}
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                    {activeProject.sector === 'real_estate_open_plotting'
                      ? 'Real Estate - Open Plotting'
                      : activeProject.sector === 'real_estate_construction'
                      ? 'Apartments & Construction'
                      : activeProject.sector === 'liquor_vends'
                      ? 'Liquor Retail Vends'
                      : 'Custom Infra Works'}
                  </span>
                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full capitalize ${
                      activeProject.status === 'active_sales'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeProject.status === 'development'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    ● {activeProject.status?.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-gray-950 flex items-center gap-2">
                  <span>{activeProject.name}</span>
                </h3>

                <p className="text-xs text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1 font-semibold text-gray-800">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    {activeProject.location}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>
                    Survey Nos: <strong className="text-gray-900 font-bold">{activeProject.surveyNumbers || 'Sy. No. 142/A'}</strong>
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>
                    Approval:{' '}
                    <strong className="text-gray-900 font-bold">
                      {activeProject.approvalAuthority} ({activeProject.lpOrReraNumber || 'Pending'})
                    </strong>
                  </span>
                </p>
              </div>

              {/* Quick Specs Badges */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="bg-white px-3.5 py-2 rounded-2xl border border-gray-200 shadow-2xs">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase">Parcel Extent</span>
                  <span className="text-xs font-black text-gray-900">
                    {activeProject.extentValue} {activeProject.extentUnit}
                  </span>
                </div>

                {activeProject.roadWidth && (
                  <div className="bg-white px-3.5 py-2 rounded-2xl border border-gray-200 shadow-2xs">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Road Width</span>
                    <span className="text-xs font-black text-gray-900">{activeProject.roadWidth} Ft</span>
                  </div>
                )}

                {activeProject.floorRatePerSqYard ? (
                  <div className="bg-white px-3.5 py-2 rounded-2xl border border-gray-200 shadow-2xs">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Floor Rate Lock</span>
                    <span className="text-xs font-black text-amber-600 font-mono">
                      {formatINR(activeProject.floorRatePerSqYard)}/Sq.Yd
                    </span>
                  </div>
                ) : activeProject.baseSqFtRate ? (
                  <div className="bg-white px-3.5 py-2 rounded-2xl border border-gray-200 shadow-2xs">
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Base Rate</span>
                    <span className="text-xs font-black text-amber-600 font-mono">
                      {formatINR(activeProject.baseSqFtRate)}/Sft
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Quick Venture Partners Ribbon */}
            <div className="pt-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-amber-600" />
                    <span>Respective Venture Partners ({activeProjectPartners.length})</span>
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-600 font-medium">
                    Enrolled Invested: <strong className="text-emerald-800 font-mono font-bold">{formatINR(activeProjectTotalActualInvested)}</strong>
                    <span className="text-gray-400 mx-1">/</span>
                    Target: <strong className="text-gray-900 font-mono">{formatINR(activeProjectTotalCapital)}</strong>
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                      activeProjectTotalActualInvested >= activeProjectTotalCapital && activeProjectTotalCapital > 0
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : activeProjectTotalActualInvested > 0
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {activeProjectTotalActualInvested >= activeProjectTotalCapital && activeProjectTotalCapital > 0
                      ? '✓ Fully Funded'
                      : activeProjectTotalActualInvested > 0
                      ? `Partially Enrolled (${Math.round((activeProjectTotalActualInvested / (activeProjectTotalCapital || 1)) * 100)}%)`
                      : 'Pending Initial Infusion'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    id="btn-top-bar-individual-investment"
                    type="button"
                    onClick={() => setIsIndividualInvestmentModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full text-xs shadow-xs transition-all border border-amber-600/30 cursor-pointer active:scale-95"
                    title="The single authorized enrollment desk for partner equity capital contributions and cash infusions."
                  >
                    <Coins className="w-3.5 h-3.5 text-gray-950" />
                    <span>+ Enroll Partner Investment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('partners')}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
                  >
                    <span>Manage Partner Equity Ledger</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Partner Chips Grid */}
              {activeProjectPartners.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white border border-dashed border-gray-300 text-center flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-left">
                    <p className="text-xs font-bold text-gray-800">No partners assigned to this project yet</p>
                    <p className="text-[11px] text-gray-500">Partners are project-specific. Add equity partners to allocate shares and track capital investments.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('partners')}
                    className="px-4 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    + Add Partner to Project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {activeProjectPartners.map((partner, idx) => (
                    <div
                      key={partner.id || idx}
                      className="bg-white/90 backdrop-blur-xs rounded-2xl p-3 border border-gray-200/90 shadow-2xs flex items-center justify-between gap-2 hover:border-amber-400 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl ${
                            partner.avatarColor || 'bg-amber-600'
                          } text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                        >
                          {partner.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-gray-950 truncate block">
                            {partner.name}
                          </span>
                          <span className="text-[10px] text-gray-500 truncate block">
                            {partner.roleDescription}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {partner.fixedEquityPercent}%
                        </span>
                        <span className="block text-[11px] text-emerald-800 font-bold font-mono mt-0.5">
                          Invested: {formatINR(partner.actualInvested || 0)}
                        </span>
                        <span className="block text-[9px] text-gray-500 font-medium">
                          Target: {formatIndianCompact(partner.initialCapital || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* THE 6 CORE KPI CARDS REQUESTED FOR RAPID VIEWABILITY    */}
          {/* ======================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* KPI Card 1: Total Project Estimated Cost */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span>Total Est. Project Cost</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                    Budget Outlay
                  </span>
                </div>
                <h4 className="text-2xl sm:text-3xl font-black text-gray-950 font-mono mt-2">
                  {formatINR(activeProjectCost)}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Statutory venture outlay for land, LP approval, civil earthwork &amp; development.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs flex-wrap gap-2">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Partner Target Commitment:</span>
                  <strong className="text-gray-900 font-mono font-bold">
                    {formatINR(activeProjectTotalCapital)}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Actual Invested:</span>
                  <strong className="text-emerald-700 font-mono font-bold">
                    {formatINR(activeProjectTotalActualInvested)}
                  </strong>
                </div>
              </div>
            </div>

            {/* KPI Card 2: Projected Gross Sales Realization */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Projected Gross Sales Realization</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Full Inventory Value
                  </span>
                </div>
                <h4 className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-2">
                  {formatINR(totalActualEstimatedValue)}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Projected revenue if all {totalInventoryCount} {isPlotSector ? 'plots' : isConstructionSector ? 'units' : 'units'} are sold at catalog rates.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs flex-wrap gap-2">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Realized to Date:</span>
                  <strong className="text-gray-900 font-mono font-bold">
                    {formatINR(totalAdvancesCollected)}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 block text-[10px] uppercase font-bold">Projected Net Surplus:</span>
                  <strong className="text-emerald-800 font-mono font-bold">
                    +{formatINR(projectedSurplus)} (+{projectedRoiPercent}%)
                  </strong>
                </div>
              </div>
            </div>

            {/* KPI Card 3: Respective Partners Summary */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    <span>Respective Partners</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                    Venture Syndicate
                  </span>
                </div>
                <h4 className="text-2xl sm:text-3xl font-black text-gray-950 mt-2">
                  {activeProjectPartners.length} {activeProjectPartners.length === 1 ? 'Partner' : 'Partners'}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  {activeProjectPartners.length === 0 ? (
                    <span className="text-amber-800 font-semibold">No partners assigned yet</span>
                  ) : (
                    <span>
                      Managing Partner:{' '}
                      <strong className="text-gray-800">
                        {activeProjectPartners.find((p) => p.userRole === 'managing_partner')?.name || activeProjectPartners[0].name}
                      </strong>{' '}
                      ({(activeProjectPartners.find((p) => p.userRole === 'managing_partner') || activeProjectPartners[0]).fixedEquityPercent}%)
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Equity Pool Allocation:</span>
                <strong className="text-indigo-900 font-mono font-bold">
                  {activeProjectPartners.reduce((acc, p) => acc + p.fixedEquityPercent, 0)}% Allocated
                </strong>
              </div>
            </div>

            {/* KPI Card 4: Inventory Status (Plots or Flats) */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>
                      {isPlotSector
                        ? 'Total Plots Inventory'
                        : isConstructionSector
                        ? 'Total Apartment Units'
                        : 'Venture Assets'}
                    </span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                    {totalInventoryCount} Total
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="bg-emerald-50 p-2 rounded-2xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 block">Available</span>
                    <span className="text-base font-black text-emerald-950">{availableInventoryCount}</span>
                  </div>
                  <div className="bg-amber-50 p-2 rounded-2xl border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-800 block">Booked</span>
                    <span className="text-base font-black text-amber-950">{bookedInventoryCount}</span>
                  </div>
                  <div className="bg-purple-50 p-2 rounded-2xl border border-purple-200">
                    <span className="text-[10px] font-bold text-purple-800 block">Sold / Reg</span>
                    <span className="text-base font-black text-purple-950">{soldInventoryCount}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Inventory Sell-Through:</span>
                <strong className="text-gray-950 font-bold">
                  {totalInventoryCount > 0
                    ? Math.round(((bookedInventoryCount + soldInventoryCount) / totalInventoryCount) * 100)
                    : 0}
                  % Committed
                </strong>
              </div>
            </div>

            {/* KPI Card 5: Realized Collections vs Pending Receivables */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Realized Inflows</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Advances Cleared
                  </span>
                </div>
                <h4 className="text-2xl sm:text-3xl font-black text-gray-950 font-mono mt-2">
                  {formatINR(totalAdvancesCollected)}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Customer booking advances and milestone payments deposited in escrow.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500">Pending Receivables:</span>
                <strong className="text-amber-700 font-mono font-bold">
                  {formatINR(totalPendingReceivables)}
                </strong>
              </div>
            </div>

            {/* KPI Card 6: Dedicated Project Bank Accounts & Liquidity */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm hover:border-amber-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-indigo-600" />
                    <span>Project Bank Accounts</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                    {projectAccounts.length} Dedicated A/Cs
                  </span>
                </div>
                <h4 className="text-2xl sm:text-3xl font-black text-gray-950 font-mono mt-2">
                  {formatINR(totalProjectLiquidity)}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Dedicated RERA escrow accounts, current operational accounts &amp; cash vaults.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsAddFirmAccountModalOpen(true)}
                  className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Add Project Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('accounts')}
                  className="text-gray-900 hover:underline font-bold"
                >
                  View Accounts &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Shortcuts */}
          <div className="bg-gray-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                Direct Module Shortcuts
              </span>
              <h4 className="text-lg font-black text-white mt-1">
                Explore {activeProject.name} Operations
              </h4>
              <p className="text-xs text-gray-400">
                Jump directly into inventory booking, partner distribution, banking, or cost tracking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {firm.sectors.includes('real_estate_open_plotting') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('open_plotting')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>Open Plot Grid ({activePlots.length})</span>
                </button>
              )}

              {firm.sectors.includes('real_estate_construction') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('construction')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-gray-950 font-bold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  <Building className="w-4 h-4" />
                  <span>Apartment Matrix ({activeUnits.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('partners')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs border border-gray-700 transition-colors cursor-pointer"
              >
                <PieChart className="w-4 h-4 text-amber-400" />
                <span>Partner Equity ({activeProjectPartners.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('accounts')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs border border-gray-700 transition-colors cursor-pointer"
              >
                <Landmark className="w-4 h-4 text-amber-400" />
                <span>Project Bank Accounts ({projectAccounts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('project_statement')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-200" />
                <span>Project Statement &amp; Passbook</span>
              </button>
            </div>
          </div>
        </div>
      )
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: PARTNERS INFO & EQUITY                        */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'partners' && (
        !activeProject ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm max-w-xl mx-auto my-6 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
              <PieChart className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-950">No Project Venture Selected</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                Syndicate partners, capital commitments, and dynamic equity stakes are configured per project venture. Please add your first project or select an active venture from the dropdown above to manage partner allocations and passbook ledgers.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add First Project Venture</span>
              </button>
            </div>
          </div>
        ) : (
          <SyndicateEquityModule
            firm={firm}
            project={activeProject}
            plots={activePlots}
            apartmentUnits={activeUnits}
            layoutCalc={activeLayoutCalc}
            totalProjectEstimatedValue={totalActualEstimatedValue}
            totalProjectInvestedValue={activeProjectTotalActualInvested}
            partners={activeProjectPartners}
            onUpdatePartner={onUpdatePartner}
            onAddPartnerMember={onAddPartnerMember}
            splitMode={splitMode}
            onToggleSplitMode={onToggleSplitMode}
            fieldExpenses={fieldExpenses}
            onApproveExpense={onApproveExpense}
            onRejectExpense={onRejectExpense}
            projectSurplusEstimate={projectedSurplus}
            ledgerMode={ledgerMode}
            partnerStockDraws={partnerStockDraws}
            firmAccounts={firmAccounts}
            individualInvestments={individualInvestments}
          />
        )
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: REAL ESTATE - OPEN PLOTTING                   */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'open_plotting' && (
        !activeProject ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm max-w-xl mx-auto my-6 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
              <Compass className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-950">No Open Plotting Venture Selected</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                Open plotting layout calculations, statutory DTCP/CRDA/HMDA road deductions, and plot inventory sync with specific open plotting ventures. Please add or select an Open Plotting project from the dropdown above to launch the layout engine.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add Open Plotting Project</span>
              </button>
            </div>
          </div>
        ) : (
          <OpenPlottingModule
            plots={activePlots}
            onUpdatePlot={onUpdatePlot}
            layoutCalc={activeLayoutCalc}
            onUpdateLayoutCalc={onUpdateLayoutCalc}
            projectExpenses={activeProjectExpenses}
            onAddExpense={onAddProjectExpense}
            onUpdateExpense={onUpdateProjectExpense}
            ledgerMode={ledgerMode}
            project={activeProject}
            firm={firm}
            firmAccounts={firmAccounts}
            onAddAccountTransaction={onAddAccountTransaction}
          />
        )
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: APARTMENTS & CONSTRUCTION                     */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'construction' && (
        !activeProject ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm max-w-xl mx-auto my-6 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
              <Building className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-950">No Construction Project Selected</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                Apartment construction floor matrices, flat units inventory, and milestone schedules sync with specific construction projects. Please select or add an Apartment &amp; Construction project above.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add Construction Project</span>
              </button>
            </div>
          </div>
        ) : (
          <ConstructionModule
            units={activeUnits}
            onUpdateUnit={onUpdateApartmentUnit}
            pricingMatrix={pricingMatrix}
            onUpdatePricingMatrix={onUpdatePricingMatrix}
            ledgerMode={ledgerMode}
            project={activeProject}
          />
        )
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 5: LIQUOR VENDS / CUSTOM INFRA                   */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'liquor_infra' && (
        !activeProject ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm max-w-xl mx-auto my-6 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
              <Wine className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-950">No Retail Vend Project Selected</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                Daily liquor vend counter reconciliation, stock draws, and cash passbooks sync with specific retail projects. Please select or add a project venture above.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add Project Venture</span>
              </button>
            </div>
          </div>
        ) : (
          <LiquorVendSettlementModule
            firm={firm}
            partners={activeProjectPartners}
            settlements={liquorSettlements}
            onAddSettlement={onAddLiquorSettlement}
            partnerStockDraws={partnerStockDraws}
            onAddStockDraw={onAddStockDraw}
          />
        )
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 6: PROJECT ACCOUNTS & TREASURY                   */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'accounts' && (
        !activeProject ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm max-w-xl mx-auto my-6 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
              <Landmark className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-950">No Project Venture Selected</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                Project bank accounts (RERA Escrow, Capital Pool, Operational Current, and Cash Vaults) belong strictly to specific project ventures. Please create or select a project from the dropdown above to manage its dedicated accounts.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add First Project Venture</span>
              </button>
            </div>
          </div>
        ) : (
          <FirmAccountsBar
            firm={firm}
            accounts={firmAccounts}
            projects={firmActiveProjects.length > 0 ? firmActiveProjects : projects}
            activeProjectId={activeProject.id}
            onOpenAddAccountModal={() => setIsAddFirmAccountModalOpen(true)}
            onOpenStatementModal={(acc) => setStatementAccount(acc)}
            onAddTransaction={onAddAccountTransaction}
          />
        )
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 7: EXPENSES & APPROVALS                          */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'expenses' && (
        !activeProject ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm max-w-xl mx-auto my-6 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-900 flex items-center justify-center mx-auto shadow-inner">
              <Receipt className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-950">No Project Venture Selected</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                Site petty cash expenses, vendor bills, and field partner expenditure vouchers are logged per project. Please select or add a project from the dropdown above to audit expenses.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add First Project Venture</span>
              </button>
            </div>
          </div>
        ) : (() => {
          // Project-scoped expense calculations
          const projectExpensesList = fieldExpenses.filter(
            (e) => e.projectId === activeProject.id && e.firmId === firm.id
          );
        const pendingExpenses = projectExpensesList.filter((e) => e.status === 'pending');
        const approvedExpenses = projectExpensesList.filter((e) => e.status === 'approved');
        const pendingExpensesSum = pendingExpenses.reduce((sum, e) => sum + e.amount, 0);
        const approvedExpensesSum = approvedExpenses.reduce((sum, e) => sum + e.amount, 0);
        const costHeadsSpentSum = activeProjectExpenses.reduce((sum, pe) => sum + pe.actualSpent, 0);
        const totalActualDisbursed = Math.max(costHeadsSpentSum, approvedExpensesSum);
        const budgetUtilizationPct =
          activeProjectCost > 0 ? Math.min(100, Math.round((totalActualDisbursed / activeProjectCost) * 100)) : 0;
        const remainingBudgetBuffer = Math.max(0, activeProjectCost - totalActualDisbursed);

        const displayedExpenses = projectExpensesList.filter((e) => {
          if (expenseSubTab === 'pending' && e.status !== 'pending') return false;
          if (expenseSubTab === 'approved' && e.status !== 'approved') return false;
          if (expenseCategoryFilter !== 'all' && e.category !== expenseCategoryFilter) return false;
          if (expenseSearchQuery.trim()) {
            const q = expenseSearchQuery.toLowerCase();
            const match =
              e.note.toLowerCase().includes(q) ||
              e.partnerName.toLowerCase().includes(q) ||
              (e.vendorName && e.vendorName.toLowerCase().includes(q)) ||
              (e.taxInvoiceNo && e.taxInvoiceNo.toLowerCase().includes(q)) ||
              e.category.toLowerCase().includes(q) ||
              (e.paymentMode && e.paymentMode.toLowerCase().includes(q));
            if (!match) return false;
          }
          return true;
        });

        const handleApproveAll = () => {
          pendingExpenses.forEach((exp) => {
            onApproveExpense(exp.id, `${firm.accountantName || 'Accountant'} (Accountant)`);
          });
        };

        return (
          <div className="space-y-6">
            {/* 1. Header Banner with Action: + Enroll Expense */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1">
                    <Receipt className="w-3 h-3 text-amber-700" />
                    <span>{activeProject ? activeProject.code : firm.code} Expense Ledger</span>
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {projectExpensesList.length} Total Site Vouchers
                  </span>
                </div>
                <h3 className="text-xl font-black text-gray-950 mt-1">
                  Expenses &amp; Approvals Control Desk
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Enroll civil and field disbursements, verify contractor bills, approve supervisor imprests, and reconcile cost heads for{' '}
                  <strong className="text-gray-950">{activeProject ? activeProject.name : firm.name}</strong>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* + Enroll Project Expenses Button */}
                <button
                  id="btn-enroll-expense-action"
                  type="button"
                  onClick={() => setIsEnrollExpenseModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-2xl shadow-md hover:shadow-lg transition-all border border-amber-600/30 active:scale-95 cursor-pointer text-xs"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Enroll Project Expenses</span>
                </button>

                {pendingExpenses.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApproveAll}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-sm text-xs transition-colors cursor-pointer"
                    title="Approve all currently pending site vouchers with one click"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Approve All ({pendingExpenses.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. Top 4 Financial KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Spent / Disbursed */}
              <div className="bg-[#F4F4F6] p-4 rounded-2xl border border-gray-200 flex flex-col justify-between">
                <span className="text-gray-500 text-[11px] font-bold uppercase block flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-amber-600" />
                  <span>Total Spent / Disbursed</span>
                </span>
                <div className="my-1.5">
                  <strong className="text-gray-950 text-xl sm:text-2xl font-black font-mono block">
                    {formatINR(totalActualDisbursed)}
                  </strong>
                  <span className="text-xs text-amber-800 font-bold block">
                    {approvedExpenses.length} Approved Vouchers Reconciled
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 block">
                  Ground civil, labor, machinery &amp; statutory fees
                </span>
              </div>

              {/* Card 2: Total Venture Budget Outlay */}
              <div className="bg-[#F4F4F6] p-4 rounded-2xl border border-gray-200 flex flex-col justify-between">
                <span className="text-gray-500 text-[11px] font-bold uppercase block flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-blue-600" />
                  <span>Venture Budget Outlay</span>
                </span>
                <div className="my-1.5">
                  <strong className="text-gray-950 text-xl sm:text-2xl font-black font-mono block">
                    {formatINR(activeProjectCost)}
                  </strong>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budgetUtilizationPct > 85 ? 'bg-red-500' : 'bg-[#FFB800]'
                      }`}
                      style={{ width: `${budgetUtilizationPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-blue-900 font-bold block">
                  {budgetUtilizationPct}% of estimated outlay consumed
                </span>
              </div>

              {/* Card 3: Pending Approvals Queue */}
              <div className="bg-[#FFFDF0] p-4 rounded-2xl border border-amber-300 flex flex-col justify-between">
                <span className="text-amber-800 text-[11px] font-bold uppercase block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Pending Approvals Desk</span>
                </span>
                <div className="my-1.5">
                  <strong className="text-amber-950 text-xl sm:text-2xl font-black font-mono block flex items-center gap-2">
                    <span>{pendingExpenses.length}</span>
                    <span className="text-xs font-sans font-bold text-amber-800">
                      Voucher{pendingExpenses.length === 1 ? '' : 's'}
                    </span>
                  </strong>
                  <span className="text-xs text-amber-900 font-mono font-bold block">
                    {formatINR(pendingExpensesSum)} awaiting sign-off
                  </span>
                </div>
                <span className="text-[10px] text-amber-900 block">
                  {pendingExpenses.length > 0 ? 'Requires accountant / partner clearance' : 'All claims verified & cleared'}
                </span>
              </div>

              {/* Card 4: Remaining Budget Buffer */}
              <div className="bg-[#F4F4F6] p-4 rounded-2xl border border-gray-200 flex flex-col justify-between">
                <span className="text-gray-500 text-[11px] font-bold uppercase block flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Remaining Budget Buffer</span>
                </span>
                <div className="my-1.5">
                  <strong className="text-emerald-700 text-xl sm:text-2xl font-black font-mono block">
                    {formatINR(remainingBudgetBuffer)}
                  </strong>
                  <span className="text-xs text-emerald-800 font-bold block">
                    Safe Contingency Margin
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 block">
                  Available before additional partner calls
                </span>
              </div>
            </div>

            {/* 3. Sub-Navigation & Filters Bar */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-200 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-200 pb-4">
                {/* Sub-tabs pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseSubTab('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      expenseSubTab === 'all'
                        ? 'bg-[#111827] text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All Enrolled Expenses ({projectExpensesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseSubTab('pending')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      expenseSubTab === 'pending'
                        ? 'bg-amber-500 text-gray-950 shadow font-black'
                        : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                    }`}
                  >
                    <span>Pending Verification</span>
                    <span className="px-1.5 py-0.2 bg-white/70 text-gray-950 rounded-full text-[10px]">
                      {pendingExpenses.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseSubTab('approved')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      expenseSubTab === 'approved'
                        ? 'bg-[#111827] text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Approved &amp; Reconciled ({approvedExpenses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseSubTab('budget_matrix')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      expenseSubTab === 'budget_matrix'
                        ? 'bg-[#111827] text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Venture Cost Heads Matrix ({activeProjectExpenses.length})
                  </button>
                </div>

                {/* Quick CTA */}
                <button
                  type="button"
                  onClick={() => setIsEnrollExpenseModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-full border border-amber-300 transition-colors self-start lg:self-auto cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>+ Enroll Project Expenses</span>
                </button>
              </div>

              {/* Search & Category Filter (only for voucher tabs) */}
              {expenseSubTab !== 'budget_matrix' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search expenses by vendor, enroller, work note, or voucher ref..."
                      value={expenseSearchQuery}
                      onChange={(e) => setExpenseSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={expenseCategoryFilter}
                      onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                      className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none cursor-pointer"
                    >
                      <option value="all">All Cost Categories</option>
                      <option value="Labor Wages">🔨 Labor Wages</option>
                      <option value="Material">🧱 Material</option>
                      <option value="Fuel">⛽ Fuel</option>
                      <option value="Tractor/Machinery">🚜 Tractor / Machinery</option>
                      <option value="Government/Fee">🏛️ Government / Fee</option>
                      <option value="Food & Batta">🍱 Food &amp; Batta</option>
                      <option value="Misc">📦 Misc</option>
                    </select>

                    {(expenseSearchQuery || expenseCategoryFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setExpenseSearchQuery('');
                          setExpenseCategoryFilter('all');
                        }}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Table / Content based on active sub-tab */}
              {expenseSubTab === 'budget_matrix' ? (
                /* Cost Heads Matrix Table */
                <div className="overflow-x-auto pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black text-gray-950 uppercase tracking-wide flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-amber-600" />
                      <span>Civil Cost Heads &amp; Statutory Budget Breakdown</span>
                    </h4>
                    <span className="text-xs text-gray-500 font-medium">
                      Total Budget Outlay: <strong className="text-gray-950 font-mono">{formatINR(activeProjectCost)}</strong>
                    </span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-400 uppercase text-[10px] font-black">
                        <th className="py-2.5 pr-4">Cost Category</th>
                        <th className="py-2.5 pr-4">Estimated Budget</th>
                        <th className="py-2.5 pr-4">Actual Spent</th>
                        <th className="py-2.5 pr-4">Consumption</th>
                        <th className="py-2.5 pr-4">Tax Invoiced</th>
                        <th className="py-2.5">Vendor &amp; Execution Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeProjectExpenses.map((exp) => {
                        const pct = exp.estimatedBudget > 0 ? Math.round((exp.actualSpent / exp.estimatedBudget) * 100) : 0;
                        return (
                          <tr key={exp.id} className="hover:bg-gray-50/80">
                            <td className="py-3 pr-4 font-bold text-gray-900">{exp.category}</td>
                            <td className="py-3 pr-4 font-mono font-semibold text-gray-800">
                              {formatINR(exp.estimatedBudget)}
                            </td>
                            <td className="py-3 pr-4 font-mono font-bold text-amber-700">
                              {formatINR(exp.actualSpent)}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : 'bg-amber-500'}`}
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[10px] font-bold text-gray-600">{pct}%</span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 font-mono text-gray-600">
                              {exp.officialTaxInvoicedAmount ? formatINR(exp.officialTaxInvoicedAmount) : '—'}
                            </td>
                            <td className="py-3 text-gray-500 max-w-xs truncate">{exp.vendorNotes}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Enrolled Expenses Ledger Table */
                <div className="overflow-x-auto pt-2">
                  {displayedExpenses.length === 0 ? (
                    <div className="py-12 text-center bg-gray-50 rounded-2xl border border-gray-200/80">
                      <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-gray-800">No project expenses found</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {expenseSearchQuery || expenseCategoryFilter !== 'all'
                          ? 'No vouchers match your search keywords or filter criteria.'
                          : 'No expenses enrolled yet for this project. Click "+ Enroll Expense" to record a site payment.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsEnrollExpenseModalOpen(true)}
                        className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full text-xs shadow-sm cursor-pointer border border-amber-600/30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Enroll Project Expenses</span>
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-400 uppercase text-[10px] font-black">
                          <th className="py-3 px-3">Date &amp; Ref</th>
                          <th className="py-3 px-3">Category</th>
                          <th className="py-3 px-3">Work Narration &amp; Payee</th>
                          <th className="py-3 px-3">Enrolled By</th>
                          <th className="py-3 px-3">Disbursement Mode</th>
                          <th className="py-3 px-3">Amount (₹)</th>
                          <th className="py-3 px-3">Approval Status</th>
                          <th className="py-3 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {displayedExpenses.map((exp) => {
                          const isPending = exp.status === 'pending';
                          const isApproved = exp.status === 'approved';
                          return (
                            <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                              {/* Date & Ref */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-gray-900">{exp.date}</div>
                                <div className="text-[10px] font-mono text-gray-500">
                                  {exp.taxInvoiceNo || `REF-${exp.id.slice(-6).toUpperCase()}`}
                                </div>
                              </td>

                              {/* Category */}
                              <td className="py-3 px-3">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                  <Tag className="w-2.5 h-2.5 text-amber-700" />
                                  <span>{exp.category}</span>
                                </span>
                              </td>

                              {/* Narration & Vendor */}
                              <td className="py-3 px-3 max-w-xs">
                                <div className="font-medium text-gray-900 line-clamp-2">{exp.note}</div>
                                {exp.vendorName && (
                                  <div className="text-[10px] text-gray-500 mt-0.5">
                                    Vendor: <strong className="text-gray-700">{exp.vendorName}</strong>
                                  </div>
                                )}
                              </td>

                              {/* Enrolled By */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-gray-900 text-[#FFB800] text-[9px] font-bold flex items-center justify-center">
                                    {exp.partnerName.charAt(0)}
                                  </div>
                                  <span className="font-bold text-gray-800 text-[11px] truncate max-w-[120px]">
                                    {exp.partnerName.split(':')[0]}
                                  </span>
                                </div>
                              </td>

                              {/* Payment Mode */}
                              <td className="py-3 px-3">
                                <span className="text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                                  {exp.paymentMode || 'Cash / Voucher'}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className="py-3 px-3 font-mono font-black text-gray-950 text-sm">
                                {formatINR(exp.amount)}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-3">
                                {isApproved ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                      <span>Approved &amp; Settled</span>
                                    </span>
                                    {exp.reconciledBy && (
                                      <div className="text-[9px] text-gray-500 mt-0.5">
                                        By: {exp.reconciledBy.replace('Multi-Partner Consensus ', '')}
                                      </div>
                                    )}
                                  </div>
                                ) : isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-700 animate-spin" />
                                    <span>Pending Sign-off</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
                                    <X className="w-3 h-3 text-red-700" />
                                    <span>Rejected</span>
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isPending ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onApproveExpense(
                                            exp.id,
                                            `${firm.accountantName || 'Accountant'} (Accountant)`
                                          )
                                        }
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                                        title="Approve & Reconcile"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>Approve</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onRejectExpense(exp.id)}
                                        className="px-2.5 py-1 bg-gray-100 hover:bg-red-100 hover:text-red-700 text-gray-600 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                        title="Reject Voucher"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedVoucherForSlip(exp)}
                                      className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <FileText className="w-3 h-3 text-gray-500" />
                                      <span>Voucher Slip</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })())}

      {/* ---------------------------------------------------- */}
      {/* TAB 8: PROJECT STATEMENT (APPROVED TXS & PASSBOOK)   */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'project_statement' && (
        !activeProject ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-gray-200 shadow-sm max-w-xl mx-auto my-6 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-900 flex items-center justify-center mx-auto shadow-inner">
              <FileText className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-950">No Project Venture Selected</h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed max-w-md mx-auto">
                The project treasury statement, customer advance tracking, and passbook reconciliation sync with respective venture projects. Select or create a project from the dropdown above to view its live passbook.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAddProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-md transition-all border border-amber-600/30 cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add First Project Venture</span>
              </button>
            </div>
          </div>
        ) : (
          <ProjectStatementModule
            project={activeProject}
            firm={firm}
            accounts={firmAccounts}
            fieldExpenses={fieldExpenses}
            plots={activePlots}
            apartmentUnits={activeUnits}
            partners={activeProjectPartners}
            individualInvestments={individualInvestments}
            onOpenRecordTransactionModal={() => setIsRecordTxModalOpen(true)}
            onOpenEnrollExpenseModal={() => setIsEnrollExpenseModalOpen(true)}
          />
        )
      )}

      {/* ======================================================== */}
      {/* MODALS                                                   */}
      {/* ======================================================== */}

      {/* Modal: + Record Ledger Transaction */}
      <RecordLedgerTransactionModal
        isOpen={isRecordTxModalOpen}
        onClose={() => setIsRecordTxModalOpen(false)}
        firm={firm}
        accounts={firmAccounts}
        projects={projects}
        preselectedAccountId={projectAccounts[0]?.id}
        onAddTransaction={onAddAccountTransaction}
      />

      {/* Modal: + Add Projects */}
      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        firm={firm}
        existingPartners={partners}
        onAddProject={onAddProject}
        firmAccounts={firmAccounts}
        onAddFirmAccount={onAddFirmAccount}
      />

      {/* Modal: + Add Project Account */}
      <AddFirmAccountModal
        isOpen={isAddFirmAccountModalOpen}
        onClose={() => setIsAddFirmAccountModalOpen(false)}
        firm={firm}
        projects={projects}
        activeProjectId={activeProject ? activeProject.id : ''}
        onAddAccount={onAddFirmAccount}
      />

      {/* Modal: Account Statement / Ledger */}
      {statementAccount && (
        <FirmAccountStatementModal
          isOpen={!!statementAccount}
          onClose={() => setStatementAccount(null)}
          account={statementAccount}
          firm={firm}
          onAddTransaction={onAddAccountTransaction}
        />
      )}

      {/* Modal: + Enroll Project Expense */}
      <EnrollExpenseModal
        isOpen={isEnrollExpenseModalOpen}
        onClose={() => setIsEnrollExpenseModalOpen(false)}
        firm={firm}
        project={activeProject || undefined}
        partners={activeProjectPartners}
        firmAccounts={firmAccounts}
        onEnrollExpense={(newExpense, bankAccountId) => {
          onEnrollExpense(newExpense);
          if (bankAccountId) {
            const targetAcc = firmAccounts.find((a) => a.id === bankAccountId);
            const balanceAfter = targetAcc ? targetAcc.currentBalance - newExpense.amount : 0;
            const debitTx: FirmAccountTransaction = {
              id: `tx-exp-${newExpense.id}`,
              accountId: bankAccountId,
              date: newExpense.date,
              type: 'debit',
              amount: newExpense.amount,
              description: `Project Expense: [${newExpense.category}] ${newExpense.note}${newExpense.vendorName ? ` (Vendor: ${newExpense.vendorName})` : ''}`,
              referenceNo: newExpense.taxInvoiceNo || `VCH-${newExpense.id.slice(-6).toUpperCase()}`,
              category: 'SITE_OPERATIONAL_EXPENSE',
              partnerName: newExpense.partnerName,
              projectName: activeProject ? activeProject.name : 'Firm Operational Outlay',
              balanceAfter,
              enrolledBy: newExpense.partnerName || `${firm.accountantName || 'Accountant'} (Accountant)`,
              approvedBy: newExpense.status === 'approved' ? `${firm.managingPartnerName || 'Managing Partner'}` : undefined,
              status: newExpense.status === 'approved' ? 'approved' : 'pending',
              paymentMode: newExpense.paymentMode,
            };
            onAddAccountTransaction(bankAccountId, debitTx);
          }
          if (newExpense.status === 'approved') {
            onApproveExpense(newExpense.id, `${firm.accountantName || 'Accountant'} (Accountant)`);
          }
        }}
      />

      {/* Modal: + Individual Investment */}
      <IndividualInvestmentModal
        isOpen={isIndividualInvestmentModalOpen}
        onClose={() => setIsIndividualInvestmentModalOpen(false)}
        firm={firm}
        project={activeProject || undefined}
        partners={activeProjectPartners}
        firmAccounts={firmAccounts}
        initiatorRole="accountant"
        onRecordInvestment={(data) => {
          if (onRecordIndividualInvestment) {
            onRecordIndividualInvestment(data);
          } else {
            const targetAcc = firmAccounts.find((a) => a.id === data.accountId);
            const balanceAfter = targetAcc ? targetAcc.currentBalance + data.amount : data.amount;
            const creditTx: FirmAccountTransaction = {
              id: `tx-inv-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
              accountId: data.accountId,
              date: data.date,
              type: 'credit',
              amount: data.amount,
              description: `Individual Partner Investment: ${data.purpose} by ${data.partnerName}`,
              referenceNo: data.referenceNo,
              category: 'PARTNER_CAPITAL_CALL',
              partnerName: data.partnerName,
              projectName: activeProject ? activeProject.name : 'Syndicate Capital Pool',
              balanceAfter,
              enrolledBy: `${firm.accountantName || 'Accountant'} (Accountant)`,
              approvedBy: `${firm.managingPartnerName || 'Managing Partner'}`,
              status: 'approved',
              paymentMode: data.paymentMode,
              notes: data.notes,
            };
            onAddAccountTransaction(data.accountId, creditTx);

            const target = partners.find((p) => p.id === data.partnerId);
            if (target) {
              const currentInv = target.actualInvested !== undefined ? target.actualInvested : 0;
              onUpdatePartner({
                ...target,
                actualInvested: currentInv + data.amount,
                initialCapital: Math.max(target.initialCapital, currentInv + data.amount),
              });
            }
          }
        }}
      />

      {/* Modal: Voucher Slip View & Print */}
      {selectedVoucherForSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-[#FFB800] p-5 flex items-center justify-between border-b border-amber-500/40">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-gray-950" />
                <h3 className="font-black text-gray-950 text-base">
                  Payment Disbursement Voucher
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucherForSlip(null)}
                className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-950 font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Slip Body */}
            <div className="p-6 space-y-4 text-xs font-sans">
              <div className="border-b border-gray-200 pb-3 flex justify-between items-start">
                <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Tenant Syndicate Firm</div>
                  <div className="font-black text-gray-950 text-sm">{firm.name} ({firm.code})</div>
                  <div className="text-gray-600 text-[11px] mt-0.5">Project: <strong>{activeProject ? `${activeProject.name} [${activeProject.code}]` : 'General Operations'}</strong></div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Voucher Ref</div>
                  <div className="font-mono font-bold text-amber-800 text-xs">
                    {selectedVoucherForSlip.taxInvoiceNo || `VCH-${selectedVoucherForSlip.id.slice(-6).toUpperCase()}`}
                  </div>
                  <div className="text-[11px] text-gray-600 font-bold">{selectedVoucherForSlip.date}</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold">Category:</span>
                  <span className="font-bold text-gray-900 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[11px]">
                    {selectedVoucherForSlip.category}
                  </span>
                </div>
                {selectedVoucherForSlip.vendorName && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 font-bold">Payee / Vendor:</span>
                    <span className="font-bold text-gray-950">{selectedVoucherForSlip.vendorName}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold">Payment Mode:</span>
                  <span className="font-bold text-gray-800">{selectedVoucherForSlip.paymentMode || 'Cash'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-bold">Enrolled By:</span>
                  <span className="font-bold text-gray-900">{selectedVoucherForSlip.partnerName}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-gray-700 font-black text-xs uppercase">Disbursed Amount:</span>
                  <span className="text-lg font-black text-gray-950 font-mono">
                    {formatINR(selectedVoucherForSlip.amount)}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Work Description &amp; Narration</div>
                <p className="text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs italic">
                  "{selectedVoucherForSlip.note}"
                </p>
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-600">
                <div>
                  <span className="text-[10px] text-gray-400 block font-bold uppercase">Approval Status</span>
                  <strong className={selectedVoucherForSlip.status === 'approved' ? 'text-emerald-700' : 'text-amber-700'}>
                    {selectedVoucherForSlip.status === 'approved'
                      ? `✓ Reconciled by ${selectedVoucherForSlip.reconciledBy || firm.accountantName || 'Accountant'}`
                      : '⏳ Pending Accountant Sign-off'}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase">System Auth</span>
                  <span className="font-mono text-[10px] text-gray-500">AES-256 Ledger Cleared</span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedVoucherForSlip(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#111827] hover:bg-gray-800 text-white font-bold rounded-full text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Print Slip</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
