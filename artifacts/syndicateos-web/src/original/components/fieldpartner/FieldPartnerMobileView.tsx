import { MasterOptions, masterItems } from '../../../adapter/config';
import React, { useState, useMemo, useEffect } from 'react';
import {
  SyndicatePartner,
  FieldExpenseLog,
  Plot,
  ApartmentUnit,
  TenantFirm,
  Project,
  LayoutCalculation,
  FirmAccount,
  PartnerStockDraw,
  FirmAccountTransaction,
  ProjectExpense,
  LedgerMode,
  IndividualInvestmentRecord,
  AuthenticatedAppUser
} from '../../types';
import { formatINR, formatIndianCompact } from '../../utils/formatters';
import {
  Smartphone,
  Mic,
  Camera,
  Upload,
  Send,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Grid3X3,
  Building2,
  LogOut,
  Compass,
  LayoutDashboard,
  FileText,
  Landmark,
  Coins,
  Clock,
  ArrowUpRight,
  Receipt,
  FolderOpen,
  Check,
  Search,
  ShieldCheck,
  Wallet,
  Printer,
  Eye,
  X,
  User,
  Hash,
  Briefcase,
  Users,
  CreditCard,
  KeyRound
} from 'lucide-react';
import { OpenPlottingModule } from '../accountant/OpenPlottingModule';
import { ProjectStatementModule, type UnifiedProjectTransaction } from '../accountant/ProjectStatementModule';
import { CustomerPlotBookingModal } from '../modals/CustomerPlotBookingModal';
import { IndividualInvestmentModal, IndividualInvestmentData } from '../modals/IndividualInvestmentModal';
import { HeaderSlot } from '../HeaderSlot';
import { EntryDialog } from './EntryDialog';
import { EnrollExpenseModal } from '../modals/EnrollExpenseModal';
import { computePlotCounts, computeProjectBalance } from './partnerDashboardStats';

export type Language = 'en' | 'te';

export interface DrawingRequest {
  id: string;
  firmId?: string;
  projectId?: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  sourceAccountId?: string;
  sourceAccountName?: string;
  payoutMode: 'Bank Transfer' | 'Field Vault Cash' | 'Cheque';
  accountDetails?: string;
  destinationAccountDetails?: string;
  purpose: string;
  requestedAt: string;
  requestedByName?: string;
  status: 'pending_approval' | 'approved' | 'cleared';
  reviewedBy?: string;
  reviewedAt?: string;
  disbursedBy?: string;
  disbursedAt?: string;
}

export interface FieldPartnerMobileViewProps {
  firm: TenantFirm;
  firms: TenantFirm[];
  currentUser?: AuthenticatedAppUser | null;
  partners: SyndicatePartner[];
  plots: Plot[];
  apartmentUnits: ApartmentUnit[];
  fieldExpenses: FieldExpenseLog[];
  onSubmitExpense: (expense: FieldExpenseLog) => void | Promise<boolean>;
  drawingRequests?: DrawingRequest[];
  onSubmitDrawing?: (draw: DrawingRequest) => void | Promise<boolean>;
  onReviewDrawing?: (drawId: string, decision: 'approved' | 'rejected') => void;
  onBlockedAction?: (what: string) => void;
  session: { firmId: string; partnerId: string } | null;
  onLogin: (firmId: string, partnerId: string) => void;
  onLogout: () => void;
  onUpdatePlot?: (plot: Plot) => void | boolean | Promise<boolean>;
  onApproveBooking?: (receiptId: string) => boolean | Promise<boolean>;
  onSelectFirm?: (firmId: string) => void;
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  layoutCalc?: LayoutCalculation;
  onUpdateLayoutCalc?: (calc: LayoutCalculation) => void | boolean | Promise<boolean>;
  projectExpenses?: ProjectExpense[];
  onAddProjectExpense?: (expense: ProjectExpense) => void | boolean | Promise<boolean>;
  onUpdateProjectExpense?: (expense: ProjectExpense) => void | boolean | Promise<boolean>;
  firmAccounts?: FirmAccount[];
  partnerStockDraws?: PartnerStockDraw[];
  onAddAccountTransaction?: (accountId: string, tx: FirmAccountTransaction) => void | boolean | Promise<boolean>;
  onAddStockDraw?: (draw: PartnerStockDraw) => void | boolean | Promise<boolean>;
  onApproveExpense?: (expenseId: string, signoff?: string) => void;
  onRejectExpense?: (expenseId: string) => void;
  onReferBackFinancial?: (entry: UnifiedProjectTransaction, reason: string, requestId: string) => Promise<boolean>;
  onResubmitFinancial?: (entry: UnifiedProjectTransaction, data: Record<string, any>, requestId: string) => Promise<boolean>;
  ledgerMode?: LedgerMode;
  onUpdatePartner?: (partner: SyndicatePartner) => void | boolean | Promise<boolean>;
  individualInvestments?: IndividualInvestmentRecord[];
  onRecordIndividualInvestment?: (data: IndividualInvestmentData) => void | boolean | Promise<boolean>;
  onApproveIndividualInvestment?: (investmentId: string, approverName: string) => void;
  onRejectIndividualInvestment?: (investmentId: string, reason?: string) => void;
}

const translations = {
  en: {
    // Portal & Top Header
    partnerHub: 'Partner Dashboard',
    partnerSubtitle: 'Executive Syndicate Investor & Field Node',
    firmIsolated: 'Firm Isolated',
    switchFirm: 'Switch Session',
    logout: 'Logout',
    pin: 'Security PIN',
    limit: 'Daily Imprest Limit',
    selectProject: 'Select Project / Venture:',
    allVentures: 'All Firm Ventures',
    noActiveProjects: 'No active projects available for this firm',

    // Top Bar 5 Tabs
    tabDashboard: 'Dashboard',
    tabInvestments: 'Enroll Investment & History',
    tabExpensesApprovals: 'Expenses & Drawing Request',
    tabPlots: 'Plots',
    tabStatements: 'Project Statements',

    // Investment Tab Specific
    enrollInvestmentBtn: '+ Enroll Investment',
    investmentsBannerTitle: 'Syndicate Capital Enrollment & Investment Records Desk',
    investmentsBannerSubtitle: 'Record individual partner investments in Cash or Bank, and inspect historical audit receipts.',
    investmentRecordsHistory: 'Investment Records History',
    filterAllInvestments: 'All Records',
    filterMyInvestments: 'My Contributions',
    filterCashOnly: 'Cash Only',
    filterBankOnly: 'Bank Accounts',
    filterInvPending: 'Not posted (historical)',
    filterInvApproved: 'Recorded',
    noInvestmentsFound: 'No investment records matching current filters',
    investedAmount: 'Invested Amount',
    depositAccount: 'Target Vault / Bank',
    paymentChannel: 'Payment Channel',
    consensusSignoff: 'Posting',

    // Dashboard - Net Share & KPIs
    netShareBalance: 'My Net Share Balance',
    netReceivable: 'Receivable from Syndicate',
    netPayable: 'Due to Syndicate',
    agreedEquity: 'Agreed Syndicate Equity',
    
    // Requested Metrics in Prompt
    estimatedInvestment: 'Total Estimated Investment',
    estimatedInvestmentDesc: 'Committed base capital for this venture',
    actualInvestment: 'Actual Investment Done',
    actualInvestmentDesc: 'Auto-calculated from project setup & verified bank vouchers',
    pendingToClear: 'Pending to Clear Estimated Investment',
    pendingToClearDesc: 'Amount needed to reach committed investment target',
    targetMet: 'Committed Investment Fully Cleared',
    surplusInvested: 'Surplus Capital Injected',
    surplusInvestedDesc: 'Additional equity injected beyond committed target',
    cashDrawings: 'Total Drawings Taken',
    cashDrawingsDesc: 'Bank transfers, field cash & retail stock withdrawals',
    expectedProfit: 'Expected Profit as per Share',
    expectedProfitDesc: 'Projected venture surplus distribution yield',
    allottedSellableArea: 'Expected Allotted Land Area',
    allottedSellableAreaDesc: 'Demarcated sellable land share calculated as per equity',
    equivalentPlots: 'Equivalent Plots',
    projectOverview: 'Venture & Syndicate Summary',
    projectLocation: 'Location',
    surveyNumber: 'Survey Numbers',
    lpReraNumber: 'Approval & LP / RERA No.',
    totalVentureExtent: 'Total Venture Extent',
    ventureCostOutlay: 'Estimated Cost Outlay',
    quickActions: 'Quick Navigation',
    enrollExpenseBtn: 'Enroll Project Expenses',
    requestDrawBtn: 'Place Drawing Request',
    viewPlotsBtn: 'Browse Venture Plots',
    viewPassbookBtn: 'Open Project Statements',

    // Expenses, Approvals & Drawing Request
    expensesBannerTitle: 'Expenses & Drawing Request Desk',
    expensesBannerSubtitle: 'Enroll on-site project expenditures, see what is recorded, and request capital/dividend draws.',
    enrollExpenseTitle: 'Enroll Project Expenses',
    enrollExpenseDesc: 'Instant spot entry with photo receipt attachment and voice narration note',
    expenseAmount: 'Expense Amount (₹)',
    expenseCategory: 'Category / Cost Head',
    paymentMode: 'Payment Channel',
    vendorName: 'Payee / Contractor Name',
    expenseNote: 'Voucher Narration / Note',
    uploadReceipt: 'Attach Photo Voucher / Bill',
    receiptAttached: 'Bill Voucher Attached (✓)',
    voiceNote: 'Record Voice Memo',
    voiceRecorded: 'Voice Memo (14s ✓)',
    recordingVoice: 'Recording voice...',
    submitExpenseBtn: 'Record Expense',
    pendingApprovalsTitle: 'Recorded Claims',
    filterAll: 'All Records',
    filterPending: 'Not posted (historical)',
    filterApproved: 'Recorded',
    approveBtn: 'Voucher',
    noExpenses: 'No expense records found',

    // Drawing Request
    placeDrawTitle: 'Place Partner Drawing / Dividend Request',
    placeDrawDesc: 'Request profit withdrawal or capital draw to your registered bank account',
    drawAmount: 'Requested Amount (₹)',
    payoutMode: 'Disbursement Method',
    bankAccount: 'Bank Account / UPI ID',
    drawPurpose: 'Purpose / Reason of Withdrawal',
    submitDrawBtn: 'Submit Drawing Request',
    availableBalance: 'Available Net Balance',
    priorDraws: 'Prior Cumulative Draws',
    recentDraws: 'Drawing Requests History',
    statusPending: 'Not posted (historical)',
    statusApproved: 'Recorded',
    noDrawings: 'No drawing requests submitted yet',

    // Plots Tab
    plotsInventory: 'Venture Master Layout & Demarcated Plots',
    plotsSubtitle: 'Live layout grid recreated from accountant dashboard with directional facings, rates, and customer bookings',
    totalPlots: 'Total Plots',

    // Statements Tab
    statementsTitle: 'Project Passbook & Live Bank Statements',
    statementsSubtitle: 'Real-time ledger audit trail recreated from accountant dashboard for escrow, operations, and partner distributions',
    liveLedger: 'Live Bank Ledger',

    // Login Gate
    loginTitle: 'Partner Dashboard Portal',
    loginSubtitle: 'Secure Syndicate Partner Node',
    selectFirm: 'Select Operating Syndicate Firm:',
    selectPartner: 'Select Partner Identity:',
    securityPin: 'Field Partner Security PIN:',
    demoPinHint: 'Demo PIN for',
    signInBtn: 'Sign In to Partner Dashboard',
    invalidPin: 'Invalid PIN. Demo PIN is:',
  },
  te: {
    // Portal & Top Header
    partnerHub: 'పార్టనర్ డాష్‌బోర్డ్',
    partnerSubtitle: 'సిండికేట్ ఇన్వెస్టర్ & ఫీల్డ్ పోర్టల్',
    firmIsolated: 'సంస్థ భద్రత యాక్టివ్',
    switchFirm: 'సెషన్ మార్చండి',
    logout: 'లాగౌట్',
    pin: 'సెక్యూరిటీ పిన్',
    limit: 'రోజువారీ పరిమితి',
    selectProject: 'ప్రాజెక్ట్ / వెంచర్ ఎంచుకోండి:',
    allVentures: 'అన్ని ప్రాజెక్టులు',
    noActiveProjects: 'ఈ సంస్థకు ప్రాజెక్టులు ఏవీ లేవు',

    // Top Bar 5 Tabs
    tabDashboard: 'డాష్‌బోర్డ్',
    tabInvestments: 'పెట్టుబడి నమోదు & రికార్డులు',
    tabExpensesApprovals: 'ఖర్చులు & డ్రాయింగ్ అభ్యర్థన',
    tabPlots: 'ప్లాట్లు',
    tabStatements: 'ప్రాజెక్ట్ స్టేట్‌మెంట్స్',

    // Investment Tab Specific
    enrollInvestmentBtn: '+ పెట్టుబడి నమోదు',
    investmentsBannerTitle: 'సిండికేట్ పెట్టుబడి నమోదు & రికార్డుల డెస్క్',
    investmentsBannerSubtitle: 'నగదు లేదా బ్యాంకు ద్వారా వ్యక్తిగత పెట్టుబడులను నమోదు చేయండి మరియు ఆమోదాల చరిత్రను చూడండి.',
    investmentRecordsHistory: 'పెట్టుబడి రికార్డుల చరిత్ర',
    filterAllInvestments: 'అన్ని రికార్డులు',
    filterMyInvestments: 'నా పెట్టుబడులు',
    filterCashOnly: 'నగదు మాత్రమే',
    filterBankOnly: 'బ్యాంక్ బదిలీలు',
    filterInvPending: 'నమోదు కాని పాత రికార్డులు',
    filterInvApproved: 'నమోదైంది',
    noInvestmentsFound: 'ఎటువంటి పెట్టుబడి రికార్డులు కనుగొనబడలేదు',
    investedAmount: 'పెట్టుబడి మొత్తం',
    depositAccount: 'ఖాతా / నగదు ఖజానా',
    paymentChannel: 'చెల్లింపు పద్ధతి',
    consensusSignoff: 'పోస్టింగ్',

    // Dashboard - Net Share & KPIs
    netShareBalance: 'నా నికర వాటా బ్యాలెన్స్',
    netReceivable: 'సిండికేట్ నుండి రావాల్సిన మొత్తం',
    netPayable: 'సిండికేట్‌కు చెల్లించాల్సిన మొత్తం',
    agreedEquity: 'ఒప్పందం ప్రకారం వాటా శాతం',

    // Requested Metrics in Prompt
    estimatedInvestment: 'ప్రాజెక్ట్ అంచనా పెట్టుబడి',
    estimatedInvestmentDesc: 'ఈ వెంచర్‌కు కేటాయించిన ప్రారంభ మూలధనం',
    actualInvestment: 'వాస్తవంగా పెట్టిన పెట్టుబడి',
    actualInvestmentDesc: 'ప్రాజెక్ట్ ఏర్పాటు మరియు బ్యాంకు రసీదుల ఆధారంగా లెక్కించబడింది',
    pendingToClear: 'క్లియర్ చేయాల్సిన అంచనా పెట్టుబడి బాకీ',
    pendingToClearDesc: 'అంచనా పెట్టుబడి లక్ష్యాన్ని చేరుకోవడానికి చెల్లించాల్సిన మొత్తం',
    targetMet: 'అంచనా పెట్టుబడి పూర్తిగా క్లియర్ చేయబడింది',
    surplusInvested: 'అదనంగా సమకూర్చిన మూలధనం',
    surplusInvestedDesc: 'అంచనా వేసిన మూలధనం కంటే అదనంగా డిపాజిట్ చేయబడింది',
    cashDrawings: 'తీసుకున్న మొత్తం డ్రాయింగ్స్',
    cashDrawingsDesc: 'నగదు, బ్యాంకు బదిలీలు మరియు స్టాక్ డ్రాయింగ్స్',
    expectedProfit: 'వాటా ప్రకారం ఆశించిన లాభం',
    expectedProfitDesc: 'ప్రాజెక్ట్ మిగులు నుండి రాగల లాభం',
    allottedSellableArea: 'కేటాయించబడే అమ్మకపు స్థలం',
    allottedSellableAreaDesc: 'వాటా ప్రకారం కేటాయించిన ప్లాట్ విస్తీర్ణం',
    equivalentPlots: 'సమానమైన ప్లాట్లు',
    projectOverview: 'ప్రాజెక్ట్ & సిండికేట్ వివరాలు',
    projectLocation: 'ప్రాంతం',
    surveyNumber: 'సర్వే నంబర్లు',
    lpReraNumber: 'అనుమతి / LP / RERA నంబర్',
    totalVentureExtent: 'మొత్తం విస్తీర్ణం',
    ventureCostOutlay: 'అంచనా వ్యయం',
    quickActions: 'శీఘ్ర చర్యలు',
    enrollExpenseBtn: 'ప్రాజెక్ట్ ఖర్చు నమోదు',
    requestDrawBtn: 'డ్రాయింగ్ అభ్యర్థన',
    viewPlotsBtn: 'ప్లాట్లు చూడండి',
    viewPassbookBtn: 'ప్రాజెక్ట్ స్టేట్‌మెంట్స్ చూడండి',

    // Expenses, Approvals & Drawing Request
    expensesBannerTitle: 'ఖర్చులు & డ్రాయింగ్ అభ్యర్థన డెస్క్',
    expensesBannerSubtitle: 'సైట్ ఖర్చులను నమోదు చేయండి, ఆమోదాల స్థితిని పరిశీలించండి మరియు డ్రాయింగ్ అభ్యర్థనలు పంపండి.',
    enrollExpenseTitle: 'ప్రాజెక్ట్ ఖర్చు నమోదు చేయండి',
    enrollExpenseDesc: 'ఫోటో రసీదు మరియు వాయిస్ నోట్‌తో తక్షణ ఖర్చు నమోదు',
    expenseAmount: 'ఖర్చు మొత్తం (₹)',
    expenseCategory: 'ఖర్చు వర్గం',
    paymentMode: 'చెల్లింపు విధానం',
    vendorName: 'కాంట్రాక్టర్ / వెండర్ పేరు',
    expenseNote: 'ఖర్చు వివరణ / నోట్స్',
    uploadReceipt: 'బిల్లు / రసీదు ఫోటో జతచేయండి',
    receiptAttached: 'రసీదు జతచేయబడింది (✓)',
    voiceNote: 'వాయిస్ నోట్ రికార్డ్ చేయండి',
    voiceRecorded: 'వాయిస్ నోట్ (14 సెకన్లు ✓)',
    recordingVoice: 'వాయిస్ రికార్డ్ అవుతోంది...',
    submitExpenseBtn: 'ఖర్చు నమోదు చేయండి',
    pendingApprovalsTitle: 'నమోదైన ఖర్చులు',
    filterAll: 'అన్ని రికార్డులు',
    filterPending: 'నమోదు కాని పాత రికార్డులు',
    filterApproved: 'నమోదైంది',
    approveBtn: 'రసీదు',
    noExpenses: 'ఖర్చుల రికార్డులు ఏవీ లేవు',

    // Drawing Request
    placeDrawTitle: 'పార్టనర్ డ్రాయింగ్ / డివిడెండ్ అభ్యర్థన',
    placeDrawDesc: 'మీ లాభం లేదా మూలధనం నుండి డ్రా కొరకు మీ బ్యాంకు ఖాతాకు అభ్యర్థించండి',
    drawAmount: 'కావలసిన మొత్తం (₹)',
    payoutMode: 'చెల్లింపు విధానం',
    bankAccount: 'బ్యాంకు ఖాతా / UPI ఐడీ',
    drawPurpose: 'డ్రాయింగ్ కారణం / ప్రయోజనం',
    submitDrawBtn: 'డ్రాయింగ్ అభ్యర్థన పంపండి',
    availableBalance: 'అందుబాటులో ఉన్న నికర బ్యాలెన్స్',
    priorDraws: 'గతంలో తీసుకున్న మొత్తం డ్రాయింగ్స్',
    recentDraws: 'డ్రాయింగ్ అభ్యర్థనల చరిత్ర',
    statusPending: 'నమోదు కాని పాత రికార్డు',
    statusApproved: 'నమోదైంది',
    noDrawings: 'ఇంకా డ్రాయింగ్ అభ్యర్థనలు ఏవీ లేవు',

    // Plots Tab
    plotsInventory: 'వెంచర్ మాస్టర్ లేఅవుట్ & ప్లాట్లు',
    plotsSubtitle: 'అకౌంటెంట్ డాష్‌బోర్డ్ వలె దిశలవారీగా ప్లాట్లు, ధరలు మరియు ఆన్-స్పాట్ బుకింగ్ వివరాలు',
    totalPlots: 'మొత్తం ప్లాట్లు',

    // Statements Tab
    statementsTitle: 'ప్రాజెక్ట్ పాస్‌బుక్ & లైవ్ బ్యాంక్ స్టేట్‌మెంట్స్',
    statementsSubtitle: 'అకౌంటెంట్ డాష్‌బోర్డ్ వలె ఎస్క్రో, ఆపరేషనల్ ఖాతాలు మరియు పార్టనర్ చెల్లింపుల లెడ్జర్ వివరాలు',
    liveLedger: 'లైవ్ బ్యాంక్ లెడ్జర్',

    // Login Gate
    loginTitle: 'పార్టనర్ డాష్‌బోర్డ్ పోర్టల్',
    loginSubtitle: 'సురక్షిత సిండికేట్ పార్టనర్ లాగిన్',
    selectFirm: 'సంస్థను ఎంచుకోండి:',
    selectPartner: 'పార్టనర్ పేరు ఎంచుకోండి:',
    securityPin: 'పార్టనర్ సెక్యూరిటీ పిన్:',
    demoPinHint: 'డెమో పిన్:',
    signInBtn: 'పార్టనర్ పోర్టల్‌లోకి ప్రవేశించండి',
    invalidPin: 'తప్పుడు పిన్. సరైన డెమో పిన్:',
  }
};

const cleanPhone = (ph: string) => (ph ? ph.replace(/\D/g, '').slice(-10) : '');

export const FieldPartnerMobileView: React.FC<FieldPartnerMobileViewProps> = ({
  firm,
  firms,
  currentUser,
  partners,
  plots,
  apartmentUnits,
  fieldExpenses,
  onSubmitExpense,
  session,
  onLogin,
  onLogout,
  onUpdatePlot,
  onApproveBooking,
  onSelectFirm,
  projects = [],
  selectedProjectId,
  onSelectProject,
  layoutCalc,
  onUpdateLayoutCalc,
  projectExpenses = [],
  onAddProjectExpense,
  onUpdateProjectExpense,
  firmAccounts = [],
  partnerStockDraws = [],
  onAddAccountTransaction,
  onAddStockDraw,
  onApproveExpense,
  onRejectExpense,
  onReferBackFinancial,
  onResubmitFinancial,
  ledgerMode = 'internal_syndicate',
  onUpdatePartner,
  individualInvestments = [],
  onRecordIndividualInvestment,
  onApproveIndividualInvestment,
  onRejectIndividualInvestment,
  drawingRequests = [],
  onSubmitDrawing,
  onReviewDrawing,
  onBlockedAction,
}) => {
  // Language Switcher State (stored in localStorage)
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('syndicate_partner_lang') as Language) || 'en';
  });

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('syndicate_partner_lang', newLang);
  };

  const t = (key: keyof typeof translations['en']): string => {
    return translations[lang]?.[key] || translations['en'][key] || String(key);
  };

  // Top Bar tabs: dashboard | plots | statements
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plots' | 'statements'>('dashboard');

  // Investment Tab & Modal State
  const [isEnrollInvestmentModalOpen, setIsEnrollInvestmentModalOpen] = useState(false);
  const [investmentSearch, setInvestmentSearch] = useState('');
  const [investmentFilter, setInvestmentFilter] = useState<'all' | 'mine' | 'cash' | 'bank' | 'pending' | 'approved'>('all');
  const [selectedInvestmentForSlip, setSelectedInvestmentForSlip] = useState<IndividualInvestmentRecord | null>(null);

  // Selected plot for customer booking modal
  const [selectedMobilePlot, setSelectedMobilePlot] = useState<Plot | null>(null);

  // Login Gate State (when session is null)
  const [loginFirmId, setLoginFirmId] = useState<string>(session?.firmId || firm.id || firms[0]?.id || '');

  // Keep loginFirmId in sync if firm loads asynchronously from cloud datastore
  useEffect(() => {
    if (firm?.id && firm.id !== loginFirmId) {
      setLoginFirmId(firm.id);
    }
  }, [firm?.id, loginFirmId]);

  const firmAvailableUsers = useMemo(() => {
    const list: SyndicatePartner[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    const targetFirmId = firm?.id || loginFirmId;

    // 1. Direct syndicate partners passed for this firm
    partners.forEach((p) => {
      const matchesFirm =
        !p.firmId ||
        !targetFirmId ||
        p.firmId === targetFirmId ||
        p.firmId === firm?.id ||
        (!p.firmId && targetFirmId === 'firm-1');
      if (matchesFirm) {
        const idKey = String(p.id);
        const nameKey = p.name.trim().toLowerCase();
        if (!seenIds.has(idKey) && !seenNames.has(nameKey)) {
          list.push(p);
          seenIds.add(idKey);
          seenNames.add(nameKey);
        }
      }
    });

    // 2. Partners registered directly within projects of this firm
    projects
      .filter((proj) => !proj.firmId || !targetFirmId || proj.firmId === targetFirmId || proj.firmId === firm?.id)
      .forEach((proj) => {
        (proj.partners || []).forEach((ps) => {
          const idKey = String(ps.partnerId);
          const nameKey = ps.name.trim().toLowerCase();
          if (!seenIds.has(idKey) && !seenNames.has(nameKey)) {
            seenIds.add(idKey);
            seenNames.add(nameKey);
            list.push({
              id: ps.partnerId,
              firmId: targetFirmId || proj.firmId,
              name: ps.name,
              phone: ps.phone || '+91 ',
              roleDescription: ps.roleInProject || 'Investor Partner',
              avatarColor: ps.avatarColor || 'bg-indigo-600',
              initialCapital: ps.initialCapital || 0,
              actualInvested: ps.actualInvested || 0,
              fixedEquityPercent: ps.equityPercent || 0,
              drawings: ps.drawings || 0,
              shareOfFieldExpenses: ps.shareOfFieldExpenses || 0,
              userRole: ps.roleInProject?.toLowerCase().includes('managing')
                ? 'managing_partner'
                : 'field_partner',
              userStatus: 'active',
              pinCode: '1234',
              dailySpendingLimit: 50000,
            });
          }
        });
      });

    // Fall back to all partners if empty
    if (list.length === 0 && partners.length > 0) {
      return partners;
    }

    return list;
  }, [partners, projects, loginFirmId, firm?.id]);

  const [loginPartnerId, setLoginPartnerId] = useState<string>(
    session?.partnerId || ''
  );

  useEffect(() => {
    if (session?.partnerId) {
      setLoginPartnerId(session.partnerId);
    } else if (!loginPartnerId || !firmAvailableUsers.some((u) => u.id === loginPartnerId)) {
      if (firmAvailableUsers[0]) {
        setLoginPartnerId(firmAvailableUsers[0].id);
      }
    }
  }, [session?.partnerId, firmAvailableUsers, loginPartnerId]);
  const [loginPin, setLoginPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Expenses Tab form state: Payment Source (Project Bank vs Individual)
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePaymentSource, setExpensePaymentSource] = useState<'project_bank' | 'individual'>('project_bank');
  const [expenseBankAccountId, setExpenseBankAccountId] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<FieldExpenseLog['category']>('Labor Wages');
  const [expensePaymentMode, setExpensePaymentMode] = useState<FieldExpenseLog['paymentMode']>(masterItems('expense_payment_modes')[0]?.key || '');
  const [expenseVendor, setExpenseVendor] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [simulatedReceiptImage, setSimulatedReceiptImage] = useState<string | null>(null);

  // Voice note simulation state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [hasRecordedVoice, setHasRecordedVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);

  // Expenses sub-filter
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isDrawingDialogOpen, setIsDrawingDialogOpen] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'pending' | 'approved'>('all');

  // Drawing Request State: Source Account & Destination Account
  const [drawAmount, setDrawAmount] = useState<string>('');
  const [drawSourceAccountId, setDrawSourceAccountId] = useState<string>('');
  const [drawPayoutMode, setDrawPayoutMode] = useState<'Bank Transfer' | 'Field Vault Cash' | 'Cheque'>('Bank Transfer');
  const [drawDestinationAccountDetails, setDrawDestinationAccountDetails] = useState<string>('');
  const [drawPurpose, setDrawPurpose] = useState<string>('');

  // Success toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Active Firm & Logged In Partner
  const activeFirm = firm || firms.find((f) => f.id === session?.firmId) || firms[0];
  const cleanCurrentPhone = cleanPhone(session?.partnerId ? (partners.find((p) => p.id === session.partnerId)?.phone || '') : '');
  const currentPartner = partners.find((p) => p.id === session?.partnerId || (cleanCurrentPhone && cleanPhone(p.phone) === cleanCurrentPhone)) || null;

  // Clean phone helper for partner matching across multiple firms
  const cleanPartnerPhone = currentPartner?.phone ? cleanPhone(currentPartner.phone) : '';

  // All projects across ALL firms where this partner is enrolled (by matching partnerId, phone, or name)
  const partnerContributedProjects = useMemo(() => {
    if (!currentPartner) return [];
    return projects.filter((proj) => {
      if (!Array.isArray(proj.partners)) return false;
      return proj.partners.some((ps) => {
        const matchesId = String(ps.partnerId) === String(currentPartner?.id);
        const matchesPhone = cleanPartnerPhone && cleanPhone(ps.phone || '') === cleanPartnerPhone;
        const matchesName = ps.name && currentPartner?.name && ps.name.trim().toLowerCase() === currentPartner.name.trim().toLowerCase();
        return matchesId || matchesPhone || matchesName;
      });
    });
  }, [projects, currentPartner, cleanPartnerPhone]);

  // Contributed firms (firms where this partner has projects or direct partner profile)
  const contributedFirms = useMemo(() => {
    const firmIds = new Set<string>();
    partnerContributedProjects.forEach((p) => {
      if (p.firmId) firmIds.add(p.firmId);
    });
    partners.forEach((p) => {
      if (p.firmId && (p.id === currentPartner?.id || (cleanPartnerPhone && cleanPhone(p.phone) === cleanPartnerPhone))) {
        firmIds.add(p.firmId);
      }
    });
    if (activeFirm?.id) firmIds.add(activeFirm.id);
    const matched = firms.filter((f) => firmIds.has(f.id));
    return matched.length > 0 ? matched : firms;
  }, [firms, partnerContributedProjects, partners, currentPartner, cleanPartnerPhone, activeFirm?.id]);

  // Active Project (matching firm and sector)
  const firmProjects = useMemo(() => {
    return projects.filter((p) => p.firmId === activeFirm.id);
  }, [projects, activeFirm.id]);

  const activeProject = useMemo(() => {
    // Never fall back to a project from a different firm.
    if (firmProjects.length === 0) return undefined;
    if (selectedProjectId) {
      const match = firmProjects.find((p) => p.id === selectedProjectId);
      if (match) return match;
    }
    return firmProjects[0];
  }, [firmProjects, selectedProjectId]);
  useEffect(() => { setSelectedMobilePlot(null); }, [activeProject?.id, activeFirm?.id]);

  // Plots filtered by active project
  const activePlots = useMemo(() => {
    if (!activeProject) return [];
    return plots.filter((p) => p.projectId === activeProject.id);
  }, [plots, activeProject]);

  // Accounts strictly linked to the active project (no fallback to firm-wide accounts)
  const projectAccounts = useMemo(() => {
    if (!activeProject) return [];
    return firmAccounts.filter((a) => a.firmId === activeFirm.id && a.linkedProjectId === activeProject.id);
  }, [firmAccounts, activeFirm.id, activeProject]);

  const plotCounts = useMemo(() => computePlotCounts(plots, activeProject?.id), [plots, activeProject?.id]);
  const projectBalance = useMemo(
    () => computeProjectBalance(firmAccounts, activeFirm.id, activeProject?.id),
    [firmAccounts, activeFirm.id, activeProject?.id]
  );

  // Drawing requests strictly scoped to the active project
  const submittedDrawings = useMemo(() => {
    if (!activeProject) return [];
    return drawingRequests.filter(
      (d) => d.projectId === activeProject.id && (!d.firmId || d.firmId === activeFirm.id)
    );
  }, [drawingRequests, activeProject, activeFirm.id]);

  // Derived financial computations for current logged-in partner
  const {
    estimatedInvestment,
    actualInvestmentDone,
    investmentDifference,
    isInvestmentPending,
    pendingInvestmentAmount,
    totalDrawingsCombined,
    equityPercent,
    expectedProfitAsPerShare,
    expectedAllottedYards,
    netShareBalance,
  } = useMemo(() => {
    if (!currentPartner) {
      return {
        estimatedInvestment: 0,
        actualInvestmentDone: 0,
        investmentDifference: 0,
        isInvestmentPending: false,
        pendingInvestmentAmount: 0,
        totalDrawingsCombined: 0,
        equityPercent: 0,
        expectedProfitAsPerShare: 0,
        expectedAllottedYards: 0,
        netShareBalance: 0,
      };
    }

    // 1. Estimated Investment committed on project creation
    const est = currentPartner.initialCapital || 0;

    // 2. Actual Investment you did (auto-calculated from initial baseline + verified capital deposits)
    const cleanName = currentPartner.name.toLowerCase().replace(/^partner\s+[a-z]:\s*/i, '').trim();
    const partnerIdStr = String(currentPartner.id).toLowerCase();
    let ledgerCapitalInflows = 0;
    let ledgerCapitalOutflows = 0;

    (firmAccounts || []).forEach((acc) => {
      (acc.recentTransactions || []).forEach((tx) => {
        const txPartner = (tx.partnerName || tx.description || '').toLowerCase();
        const isMatch =
          txPartner.includes(partnerIdStr) ||
          txPartner.includes(currentPartner.name.toLowerCase()) ||
          (cleanName.length > 2 && txPartner.includes(cleanName));

        if (isMatch) {
          if (
            (tx.category === 'partner_capital' || tx.description?.toLowerCase().includes('capital deposit')) &&
            tx.type === 'credit'
          ) {
            ledgerCapitalInflows += tx.amount;
          } else if (
            (tx.category === 'partner_draw' || tx.description?.toLowerCase().includes('partner draw')) &&
            tx.type === 'debit'
          ) {
            ledgerCapitalOutflows += tx.amount;
          }
        }
      });
    });

    // Also include verified individual investments for this partner
    const approvedIndividualInvs = (individualInvestments || []).filter(
      (inv) =>
        (String(inv.partnerId) === String(currentPartner.id) ||
          inv.partnerName.toLowerCase().trim() === currentPartner.name.toLowerCase().trim() ||
          (cleanName.length > 2 && inv.partnerName.toLowerCase().includes(cleanName))) &&
        inv.status === 'approved' &&
        (!inv.firmId || inv.firmId === activeFirm.id) &&
        (!activeProject || !inv.projectId || inv.projectId === activeProject.id)
    );
    const individualInvsTotal = approvedIndividualInvs.reduce((sum, inv) => sum + inv.amount, 0);

    const baseActual = currentPartner.actualInvested !== undefined ? currentPartner.actualInvested : 0;
    const actualInvested = baseActual;

    // 3. Investment pending amount to clear estimated investment:
    const diff = actualInvested - est;
    const isPending = diff < 0;
    const pendingAmt = Math.abs(diff);

    // 4. How much drawings taken:
    const partnerDraws = currentPartner.drawings;
    const stockValuation = (partnerStockDraws || [])
      .filter((d) => d.partnerId === currentPartner.id)
      .reduce((sum, d) => sum + d.retailValuation, 0);
    const combinedDraws = partnerDraws;

    // 5. Equity Share %:
    const eqPct = currentPartner.fixedEquityPercent || 0;

    // 6. Expected Profit based on share:
    const totalRevenue = activePlots.reduce((acc, p) => acc + p.areaSqYards * p.ratePerSqYard, 0);
    const totalCost = activeProject?.totalEstimatedOutlay || 0;
    const ventureSurplus = Math.max(0, totalRevenue - totalCost);
    const profitShare = Math.round((eqPct / 100) * ventureSurplus);

    // 7. Expected Allotted Sellable Area as per share:
    const totalSellableYds = activePlots.reduce((acc, p) => acc + (p.areaSqYards || 0), 0);
    const allottedYds = Math.round((eqPct / 100) * totalSellableYds);

    // 8. Net Share Balance:
    const netBal = actualInvested + (currentPartner.shareOfFieldExpenses || 0) - combinedDraws;

    return {
      estimatedInvestment: est,
      actualInvestmentDone: actualInvested,
      investmentDifference: diff,
      isInvestmentPending: isPending,
      pendingInvestmentAmount: pendingAmt,
      totalDrawingsCombined: combinedDraws,
      equityPercent: eqPct,
      expectedProfitAsPerShare: profitShare,
      expectedAllottedYards: allottedYds,
      netShareBalance: netBal,
    };
  }, [currentPartner, firmAccounts, partnerStockDraws, activePlots, activeProject, individualInvestments, activeFirm.id]);

  // Expenses submitted by this partner or for this firm
  const partnerExpenses = useMemo(() => {
    // All expenses of the selected project; approval eligibility comes from server reviewableRecordIds.
    if (!currentPartner || !activeProject) return [];
    return fieldExpenses.filter((e) => e.firmId === activeFirm.id && e.projectId === activeProject.id);
  }, [fieldExpenses, activeFirm.id, activeProject, currentPartner]);

  const displayedExpenses = useMemo(() => {
    if (expenseFilter === 'pending') {
      return partnerExpenses.filter((e) => e.status === 'pending');
    }
    if (expenseFilter === 'approved') {
      return partnerExpenses.filter((e) => e.status === 'approved');
    }
    return partnerExpenses;
  }, [partnerExpenses, expenseFilter]);

  const pendingExpenseApprovalsCount = partnerExpenses.filter((e) => e.status === 'pending').length;
  const pendingDrawingApprovalsCount = submittedDrawings.filter((d) => d.status === 'pending_approval').length;
  const pendingDeskApprovalsCount = pendingExpenseApprovalsCount + pendingDrawingApprovalsCount;

  // Active Project Individual Investments (Cash & Bank)
  const activeProjectInvestments = useMemo(() => {
    return (individualInvestments || []).filter((inv) => {
      if (!activeProject) return false;
      if (inv.firmId && inv.firmId !== activeFirm.id) return false;
      return inv.projectId === activeProject.id;
    });
  }, [individualInvestments, activeFirm.id, activeProject]);

  const pendingInvestmentApprovalsCount = activeProjectInvestments.filter((i) => i.status === 'pending').length;
  const cashInvestmentsCount = activeProjectInvestments.filter((i) => i.accountType === 'cash').length;
  const bankInvestmentsCount = activeProjectInvestments.filter((i) => i.accountType === 'bank').length;
  const myInvestmentsCount = activeProjectInvestments.filter(
    (i) =>
      currentPartner &&
      (String(i.partnerId) === String(currentPartner.id) ||
        i.partnerName.trim().toLowerCase() === currentPartner.name.trim().toLowerCase())
  ).length;
  
  const totalVerifiedInvestedAmount = useMemo(() => {
    return activeProjectInvestments
      .filter((i) => i.status === 'approved')
      .reduce((sum, i) => sum + i.amount, 0);
  }, [activeProjectInvestments]);

  const totalCashInvestedAmount = useMemo(() => {
    return activeProjectInvestments
      .filter((i) => i.accountType === 'cash' && i.status === 'approved')
      .reduce((sum, i) => sum + i.amount, 0);
  }, [activeProjectInvestments]);

  const totalBankInvestedAmount = useMemo(() => {
    return activeProjectInvestments
      .filter((i) => i.accountType === 'bank' && i.status === 'approved')
      .reduce((sum, i) => sum + i.amount, 0);
  }, [activeProjectInvestments]);

  const filteredInvestments = useMemo(() => {
    return activeProjectInvestments.filter((inv) => {
      if (investmentFilter === 'mine' && currentPartner && inv.partnerId !== currentPartner.id) return false;
      if (investmentFilter === 'cash' && inv.accountType !== 'cash') return false;
      if (investmentFilter === 'bank' && inv.accountType !== 'bank') return false;
      if (investmentFilter === 'pending' && inv.status !== 'pending') return false;
      if (investmentFilter === 'approved' && inv.status !== 'approved') return false;

      if (investmentSearch.trim()) {
        const q = investmentSearch.toLowerCase();
        const mName = (inv.partnerName || '').toLowerCase().includes(q);
        const mPurpose = (inv.purpose || '').toLowerCase().includes(q);
        const mRef = (inv.referenceNo || '').toLowerCase().includes(q);
        const mAcc = (inv.accountName || '').toLowerCase().includes(q);
        const mNotes = (inv.notes || '').toLowerCase().includes(q);
        if (!mName && !mPurpose && !mRef && !mAcc && !mNotes) return false;
      }

      return true;
    });
  }, [activeProjectInvestments, investmentFilter, investmentSearch, currentPartner]);

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPartner) return;
    const numAmt = Number(expenseAmount);
    if (!numAmt || numAmt <= 0) {
      alert(lang === 'te' ? 'దయచేసి సరైన ఖర్చు మొత్తాన్ని నమోదు చేయండి.' : 'Please enter a valid expense amount.');
      return;
    }

    const chosenBankAcc = projectAccounts.find((a) => a.id === expenseBankAccountId) || projectAccounts[0];
    const newLog: FieldExpenseLog = {
      id: `exp-${Date.now()}`,
      firmId: activeFirm.id,
      projectId: activeProject?.id,
      partnerId: currentPartner.id,
      partnerName: currentPartner.name,
      date: new Date().toISOString().split('T')[0],
      amount: numAmt,
      category: expenseCategory as any,
      note: expenseNote.trim() || `${expenseCategory} site expense recorded via Partner Dashboard`,
      hasVoiceNote: hasRecordedVoice,
      receiptImage: simulatedReceiptImage || undefined,
      status: 'pending',
      enrolledBy: currentPartner.name,
      paymentMode: expensePaymentMode,
      vendorName: expenseVendor.trim() || undefined,
      paymentSource: expensePaymentSource,
      bankAccountId: expensePaymentSource === 'project_bank' ? (chosenBankAcc?.id || undefined) : undefined,
      bankAccountName: expensePaymentSource === 'project_bank' ? (chosenBankAcc ? `${chosenBankAcc.bankName} (${chosenBankAcc.accountNumber.slice(-4)})` : 'Project Bank Account') : 'Partner Individual Funds',
    };

    // Keep the form intact unless the backend accepted the voucher.
    const accepted = await onSubmitExpense(newLog);
    if (accepted === false) return;
    setExpenseAmount('');
    setExpenseNote('');
    setExpenseVendor('');
    setSimulatedReceiptImage(null);
    setHasRecordedVoice(false);
    setIsExpenseDialogOpen(false);
    showToast(lang === 'te' ? 'ఫీల్డ్ ఖర్చు రసీదు నమోదు చేయబడింది.' : 'Field expense voucher recorded.');
  };

  const handleDrawingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPartner) return;
    const numAmt = Number(drawAmount);
    if (!numAmt || numAmt <= 0) {
      alert(lang === 'te' ? 'దయచేసి సరైన డ్రాయింగ్ మొత్తాన్ని నమోదు చేయండి.' : 'Please enter a valid drawing request amount.');
      return;
    }

    const eligible = firmAccounts.filter((a) => a.firmId === activeFirm.id && a.linkedProjectId === activeProject?.id && a.status === 'active'
      && !!(a as any).isDefaultCash === (drawPayoutMode === 'Field Vault Cash'));
    const chosenSourceAcc = eligible.find((a) => a.id === drawSourceAccountId) || eligible[0];
    if (!chosenSourceAcc) { alert('No active project account supports this payment method.'); return; }
    const newRequest: DrawingRequest = {
      id: `draw-${Date.now()}`,
      firmId: activeFirm.id,
      projectId: activeProject?.id,
      partnerId: currentPartner.id,
      partnerName: currentPartner.name,
      amount: numAmt,
      payoutMode: drawPayoutMode,
      sourceAccountId: chosenSourceAcc?.id,
      sourceAccountName: chosenSourceAcc ? `${chosenSourceAcc.bankName} (••••${chosenSourceAcc.accountNumber.slice(-4)})` : 'Project Treasury',
      destinationAccountDetails: drawDestinationAccountDetails.trim() || 'Partner Registered Bank Account',
      purpose: drawPurpose.trim() || 'Partner capital draw against accrued profit',
      requestedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'pending_approval',
    };

    if (!onSubmitDrawing) return;
    const accepted = await onSubmitDrawing(newRequest);
    if (accepted === false) return;

    setDrawAmount('');
    setDrawDestinationAccountDetails('');
    setDrawPurpose('');
    setIsDrawingDialogOpen(false);
  };


  // Sign-in is handled only by the production auth gate (server-verified). No local credential path exists here.
  if (!session || !currentPartner) {
    return (
      <div className="max-w-lg mx-auto py-8 text-xs">
        <div className="bg-white rounded-3xl border border-amber-300 p-8 text-center space-y-3">
          <p className="font-black text-gray-950 text-sm">Partner profile not found for this session</p>
          <p className="text-gray-600">Sign out and sign in again with your firm code, mobile number and PIN.</p>
          <button type="button" onClick={onLogout} className="px-4 py-2 bg-[#FFB800] text-gray-950 rounded-full font-black">Sign out</button>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-7xl w-full mx-auto space-y-5 animate-fade-in text-xs pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-60 bg-[#111827] border-2 border-[#FFB800] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Partner context controls live in the shared sticky Header (one combined bar). */}
      <HeaderSlot position="brand">
        <div className="text-[9px] leading-tight font-black uppercase tracking-wider text-amber-800 truncate"
          data-testid="text-partner-context"
          title={activeProject ? `${activeProject.name} as ${currentPartner.name}` : `Signed in as ${currentPartner.name}`}>
          {lang === 'te' ? 'పెట్టుబడి వాటా' : 'Your partner stake'} <span className="font-mono text-stone-400 normal-case">{activeFirm.code}</span>
        </div>
      </HeaderSlot>
      <HeaderSlot>
        <div className="flex flex-wrap items-center gap-2 min-w-0 lg:justify-end" data-testid="header-partner-stake">

          {onSelectFirm && contributedFirms.length > 0 && (
            <label className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-stone-300 min-w-0 flex-1 basis-[10rem] sm:max-w-[240px]">
              <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="sr-only">{lang === 'te' ? 'సంస్థను మార్చండి' : 'Switch Firm / Syndicate'}</span>
              <select
                data-testid="select-partner-firm"
                value={activeFirm.id}
                title={`Firm: ${activeFirm.name}`}
                onChange={(e) => {
                  const newFirmId = e.target.value;
                  onSelectFirm(newFirmId);
                  const targetProjects = projects.filter((p) => p.firmId === newFirmId);
                  if (targetProjects[0] && onSelectProject) {
                    onSelectProject(targetProjects[0].id);
                  }
                }}
                className="w-full min-w-0 text-xs font-black text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer p-0 pr-3 outline-none truncate disabled:cursor-default"
              >
                {!contributedFirms.some((f) => f.id === activeFirm.id) && <option value={activeFirm.id}>{activeFirm.name} ({activeFirm.code})</option>}
                {contributedFirms.map((f) => {
                  const projCount = projects.filter((p) => p.firmId === f.id).length;
                  return (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code}){projCount > 0 ? ` · ${projCount} Proj` : ''}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {onSelectProject && (
            <label className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-stone-300 min-w-0 flex-1 basis-[12rem] sm:max-w-[280px]">
              <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="sr-only">{t('selectProject')}</span>
              <select
                data-testid="select-partner-project"
                value={activeProject?.id || ''}
                onChange={(e) => onSelectProject(e.target.value)}
                className="w-full min-w-0 text-xs font-black text-slate-900 bg-transparent border-0 focus:ring-0 cursor-pointer p-0 pr-3 outline-none truncate"
              >
                {firmProjects.length > 0 ? (
                  firmProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))
                ) : (
                  <option value="">{t('allVentures')}</option>
                )}
              </select>
            </label>
          )}

          <div role="group" aria-label="Language" className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-300 shrink-0">
            {(['en', 'te'] as const).map((code) => (
              <button
                key={code}
                type="button"
                data-testid={`button-lang-${code}`}
                aria-pressed={lang === code}
                aria-label={code === 'en' ? 'English' : 'Telugu'}
                title={code === 'en' ? 'English' : 'తెలుగు (Telugu)'}
                onClick={() => handleLanguageChange(code)}
                className={`px-2 py-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                  lang === code ? 'bg-[#111827] text-white' : 'text-stone-700 hover:text-slate-950'
                }`}
              >
                {code === 'en' ? 'En' : 'Te'}
              </button>
            ))}
          </div>
        </div>
      </HeaderSlot>

      {/* ======================================================== */}
      {/* 2. TOP BARS NAVIGATION (5 MAIN TABS)                     */}
      {/* ======================================================== */}
      <div data-testid="module-navigation" style={{ top: 'var(--sos-header-height, 0px)' }} className="sticky z-30 bg-white p-2 sm:p-2.5 rounded-3xl shadow-sm border border-gray-200">
        <nav aria-label="Partner Top Bars" className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          {/* Bar 1: Dashboard */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-amber-400" />
            <span>{t('tabDashboard')}</span>
          </button>

          {/* Bar 4: Plots (Recreated same as in accountant dashboard) */}
          <button
            type="button"
            onClick={() => setActiveTab('plots')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'plots'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <Grid3X3 className="w-4 h-4 text-amber-400" />
            <span>{t('tabPlots')}</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'plots' ? 'bg-amber-400 text-gray-950' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {activePlots.length}
            </span>
            {activePlots.some((p) => p.pendingBookingId) && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white"
                aria-label={`${activePlots.filter((p) => p.pendingBookingId).length} historical unposted booking receipts`}>
                {activePlots.filter((p) => p.pendingBookingId).length} Unposted
              </span>
            )}
          </button>

          {/* Bar 5: Project Statements (Recreated same as in accountant dashboard) */}
          <button
            type="button"
            onClick={() => setActiveTab('statements')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'statements'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <Landmark className="w-4 h-4 text-amber-400" />
            <span>{t('tabStatements')}</span>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'statements' ? 'bg-emerald-400 text-gray-950' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {t('liveLedger')}
            </span>
          </button>
        </nav>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PARTNER DASHBOARD                                 */}
      {/* ======================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Main Net Share Balance Golden Card */}
          <div className="bg-gradient-to-br from-amber-50 via-white to-amber-100/60 p-6 rounded-3xl border-2 border-amber-300 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider block">
                  {t('netShareBalance')}
                </span>
                <div className="text-3xl sm:text-4xl font-black font-mono text-gray-950 mt-1">
                  {formatINR(netShareBalance)}
                </div>
                <span className="text-xs text-gray-600 block mt-1 font-bold">
                  {netShareBalance >= 0 ? t('netReceivable') : t('netPayable')} ({formatIndianCompact(netShareBalance)})
                </span>
              </div>

              <div className="bg-white/90 p-4 rounded-2xl border border-amber-200 text-center sm:text-right shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-gray-500 block">
                  {t('agreedEquity')}
                </span>
                <strong className="text-2xl font-black text-amber-900 font-mono block">
                  {equityPercent.toFixed(1)}%
                </strong>
                <span className="text-[10px] text-gray-500 font-semibold">
                  {activeProject?.name || activeFirm.name}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-amber-200/80" data-testid="grid-partner-share-summary">
              {([
                ['estimated', t('estimatedInvestment'), estimatedInvestment, 'text-gray-950'],
                ['actual', t('actualInvestment'), actualInvestmentDone, 'text-emerald-800'],
                ['drawings', t('cashDrawings'), totalDrawingsCombined, 'text-rose-700'],
                ['profit', t('expectedProfit'), expectedProfitAsPerShare, 'text-amber-900'],
              ] as const).map(([key, label, value, cls]) => (
                <div key={key} className="bg-white/80 rounded-2xl border border-amber-200 px-3 py-2.5 min-w-0" data-testid={`text-partner-summary-${key}`}>
                  <span className="text-[10px] font-bold uppercase text-gray-500 block leading-tight">{label}</span>
                  <strong className={`text-sm sm:text-base font-black font-mono block mt-1 truncate ${cls}`}>{formatINR(value)}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Two live venture cards: plot inventory and project account balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              data-testid="card-partner-plot-counts"
              onClick={() => setActiveTab('plots')}
              className="group text-left w-full bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs hover:border-amber-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-all cursor-pointer space-y-3"
            >
              <div className="flex items-center justify-between text-gray-500 text-xs">
                <span className="font-bold uppercase text-[10px]">{lang === 'te' ? 'ప్లాట్ల స్థితి' : 'Plot Inventory'}</span>
                <Grid3X3 className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black font-mono text-gray-950" data-testid="text-partner-plot-total">{plotCounts.total}</span>
                <span className="text-[11px] text-gray-500 font-bold">{t('totalPlots')}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {([
                  ['available', lang === 'te' ? 'అందుబాటులో' : 'Available', plotCounts.available, 'bg-emerald-50 border-emerald-200 text-emerald-900'],
                  ['booked', lang === 'te' ? 'బుక్' : 'Booked', plotCounts.booked, 'bg-sky-50 border-sky-200 text-sky-900'],
                  ['sold', lang === 'te' ? 'అమ్మబడింది' : 'Sold', plotCounts.sold, 'bg-gray-100 border-gray-300 text-gray-900'],
                  ['blocked', lang === 'te' ? 'బ్లాక్' : 'Blocked', plotCounts.blocked, 'bg-rose-50 border-rose-200 text-rose-900'],
                ] as const).map(([key, label, count, cls]) => (
                  <div key={key} className={`rounded-xl border px-1.5 py-2 ${cls}`} data-testid={`text-partner-plots-${key}`}>
                    <strong className="block text-base font-black font-mono">{count}</strong>
                    <span className="block text-[9px] font-bold uppercase tracking-wide truncate">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500">{lang === 'te' ? 'బుక్‌లో టోకెన్ రిజర్వేషన్లు కూడా ఉన్నాయి' : 'Booked includes token reservations'}</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 group-hover:text-amber-800">
                {t('viewPlotsBtn')} <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              data-testid="card-partner-project-balance"
              onClick={() => setActiveTab('statements')}
              className="group text-left w-full bg-white p-5 rounded-3xl border border-emerald-200 shadow-2xs hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all cursor-pointer space-y-3"
            >
              <div className="flex items-center justify-between text-emerald-800 text-xs">
                <span className="font-bold uppercase text-[10px]">{lang === 'te' ? 'ప్రాజెక్ట్ ఖాతా నికర బ్యాలెన్స్' : 'Project Account Balance'}</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <div className={`text-2xl font-black font-mono ${projectBalance.net < 0 ? 'text-rose-700' : 'text-emerald-950'}`} data-testid="text-partner-project-balance">
                {formatINR(projectBalance.net)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2" data-testid="text-partner-balance-bank">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500"><Landmark className="w-3 h-3" /> Bank</span>
                  <strong className="block font-mono font-black text-gray-950 truncate">{formatINR(projectBalance.bank)}</strong>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2" data-testid="text-partner-balance-cash">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500"><Coins className="w-3 h-3" /> Cash</span>
                  <strong className="block font-mono font-black text-gray-950 truncate">{formatINR(projectBalance.cash)}</strong>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 group-hover:text-emerald-800">
                {projectBalance.accountCount === 0
                  ? (lang === 'te' ? 'ఈ ప్రాజెక్ట్‌కు ఖాతాలు లేవు' : 'No accounts linked to this project')
                  : t('viewPassbookBtn')} <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>

          {/* Venture Share Entitlement & Area Allocations */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-600" />
                  <span className="font-black text-xs text-gray-950">{t('allottedSellableArea')}</span>
                </div>
                <strong className="text-base font-black font-mono text-gray-950">
                  {expectedAllottedYards.toLocaleString('en-IN')} Sq.Yds
                </strong>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {t('allottedSellableAreaDesc')} • {equityPercent}% of {activePlots.reduce((sum, p) => sum + p.areaSqYards, 0).toLocaleString('en-IN')} Sq.Yds (~{expectedAllottedYards * 9} Sq.Ft).
              </p>
              <div className="pt-2 flex items-center justify-between text-xs text-gray-500">
                <span>{t('equivalentPlots')}:</span>
                <strong className="font-mono text-gray-900">~{Math.round(expectedAllottedYards / 200)} Standard Plots (200 Yds)</strong>
              </div>
            </div>
          </div>

          {/* Venture Project Overview & Quick Shortcuts */}
          <div className="bg-white p-5 rounded-3xl border border-gray-200 space-y-4">
            <h3 className="font-black text-sm text-gray-950 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>{t('projectOverview')}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('projectLocation')}</span>
                <strong className="text-gray-900 block mt-0.5">{activeProject?.location || '—'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('surveyNumber')}</span>
                <strong className="text-gray-900 block mt-0.5">{activeProject?.surveyNumbers || '—'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('lpReraNumber')}</span>
                <strong className="text-gray-900 block mt-0.5 font-mono">{activeProject?.lpOrReraNumber || '—'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('totalVentureExtent')}</span>
                <strong className="text-gray-900 block mt-0.5 font-mono">{activeProject?.extentValue ? `${activeProject.extentValue} ${activeProject.extentUnit || ''}`.trim() : '—'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('ventureCostOutlay')}</span>
                <strong className="text-gray-900 block mt-0.5 font-mono">{activeProject?.totalEstimatedOutlay ? formatINR(activeProject.totalEstimatedOutlay) : '—'}</strong>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PLOTS (RECREATED SAME AS IN ACCOUNTANT DASHBOARD) */}
      {/* ======================================================== */}
      {activeTab === 'plots' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-amber-400" />
                <span>{t('plotsInventory')}</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {t('plotsSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-3 py-1 bg-amber-400 text-slate-950 font-black rounded-xl text-xs font-mono shadow-xs">
                {activePlots.length} {t('totalPlots')}
              </span>
            </div>
          </div>

          {/* Full Interactive OpenPlottingModule as in Accountant Dashboard */}
          <OpenPlottingModule
            plots={activePlots}
            onUpdatePlot={onUpdatePlot || (() => {})}
            onApproveBooking={onApproveBooking}
            layoutCalc={
              layoutCalc || {
                totalExtentValue: activeProject?.extentValue || 0,
                unit: (activeProject?.extentUnit as any) || 'Acres',
                roadWidth: 0 as any,
                openSpacePercent: 0,
                floorRatePerSqYard: activeProject?.floorRatePerSqYard || 0,
              }
            }
            onUpdateLayoutCalc={onUpdateLayoutCalc || (() => {})}
            projectExpenses={projectExpenses}
            onAddExpense={onAddProjectExpense}
            onUpdateExpense={onUpdateProjectExpense}
            ledgerMode={ledgerMode}
            project={activeProject}
            firm={activeFirm}
            firmAccounts={firmAccounts}
            onAddAccountTransaction={onAddAccountTransaction}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: PROJECT STATEMENTS (RECREATED AS IN ACCOUNTANT)   */}
      {/* ======================================================== */}
      {activeTab === 'statements' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-400" />
                <span>{t('statementsTitle')}</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {t('statementsSubtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-black rounded-xl text-xs font-mono shadow-xs">
                {t('liveLedger')}
              </span>
            </div>
          </div>

          {/* Full ProjectStatementModule as in Accountant Dashboard */}
          {activeProject ? (
            <ProjectStatementModule
              onReferBackFinancial={onReferBackFinancial}
              onResubmitFinancial={onResubmitFinancial}
              project={activeProject}
              firm={activeFirm}
              accounts={firmAccounts}
              fieldExpenses={fieldExpenses}
              plots={activePlots}
              apartmentUnits={apartmentUnits}
              partners={partners}
              individualInvestments={individualInvestments}
              onOpenRecordTransactionModal={() => {}}
              onOpenEnrollExpenseModal={() => {
                setIsExpenseDialogOpen(true);
              }}
              onOpenDrawingRequest={() => {
                setIsDrawingDialogOpen(true);
              }}
              onOpenIndividualInvestmentModal={() => {
                setIsEnrollInvestmentModalOpen(true);
              }}
            />
          ) : (
            <div className="bg-white p-8 rounded-3xl border border-gray-200 text-center text-gray-500">
              {t('noActiveProjects')}
            </div>
          )}
        </div>
      )}

      {/* Partner expense & drawing dialogs: rendered globally so statement actions work from any tab */}
      {activeProject && currentPartner && (
        <EnrollExpenseModal
          isOpen={isExpenseDialogOpen}
          onClose={() => setIsExpenseDialogOpen(false)}
          firm={activeFirm}
          project={activeProject}
          partners={[currentPartner]}
          firmAccounts={firmAccounts}
          onEnrollExpense={async (expense) => {
            const result = await onSubmitExpense({
              ...expense,
              partnerId: currentPartner.id,
              partnerName: currentPartner.name,
              enrolledBy: currentPartner.name,
            });
            return result !== false;
          }}
        />
      )}

            {/* ACTION 2: PLACE DRAWING / DIVIDEND REQUEST */}
            <EntryDialog
              open={isDrawingDialogOpen}
              onClose={() => setIsDrawingDialogOpen(false)}
              titleId="fp-drawing-dialog-title"
              closeLabel={lang === 'te' ? 'మూసివేయండి' : 'Close drawing dialog'}
            >
              <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3 pr-8">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="fp-drawing-dialog-title" className="font-black text-sm text-gray-950">{t('placeDrawTitle')}</h3>
                  <p className="text-[11px] text-gray-500">{t('placeDrawDesc')}</p>
                </div>
              </div>

              <form onSubmit={handleDrawingSubmit} className="space-y-3.5 text-xs">
                {/* 1. Debit Source Account */}
                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5 text-amber-600" />
                      <span>{lang === 'te' ? 'డెబిట్ చేయవలసిన ప్రాజెక్ట్ బ్యాంక్ ఖాతా' : 'Request Drawing From (Project Bank Account)'} *</span>
                    </span>
                    {projectAccounts.length > 0 && (
                      <span className="font-mono text-[9px] text-emerald-800 font-bold">
                        Bal: {formatINR(projectAccounts.find((a) => a.id === drawSourceAccountId)?.currentBalance || projectAccounts[0]?.currentBalance || 0)}
                      </span>
                    )}
                  </label>
                  <select
                    value={drawSourceAccountId || projectAccounts[0]?.id || ''}
                    onChange={(e) => setDrawSourceAccountId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-950 outline-none focus:bg-white focus:border-emerald-500 cursor-pointer"
                  >
                    {projectAccounts.length === 0 && (
                      <option value="">Syndicate Primary Escrow Vault</option>
                    )}
                    {projectAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bankName} - {acc.accountName} (••••{acc.accountNumber.slice(-4)}) — Bal: {formatINR(acc.currentBalance)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Amount */}
                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    {t('drawAmount')} *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-gray-500 font-bold">₹</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="e.g. 200000"
                      value={drawAmount}
                      onChange={(e) => setDrawAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-mono font-black text-sm text-gray-950 outline-none focus:bg-white focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                      {t('payoutMode')} *
                    </label>
                    <select
                      value={drawPayoutMode}
                      onChange={(e) => { setDrawPayoutMode(e.target.value as any); setDrawSourceAccountId(''); }}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-950 outline-none"
                    >
                      <MasterOptions group="drawing_payment_modes" />
                    </select>
                    <label className="block text-[10px] font-black text-gray-700 uppercase mt-3">Project account</label>
                    <select className="w-full rounded-xl border p-2.5 text-xs" value={drawSourceAccountId} onChange={(e) => setDrawSourceAccountId(e.target.value)}>
                      <option value="">Use first compatible project account</option>
                      {firmAccounts.filter((a) => a.firmId === activeFirm.id && a.linkedProjectId === activeProject?.id && a.status === 'active'
                        && !!(a as any).isDefaultCash === (drawPayoutMode === 'Field Vault Cash')).map((a) => <option key={a.id} value={a.id}>{a.accountName} — {formatINR(a.currentBalance)}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                      {lang === 'te' ? 'లబ్ధిదారు డెస్టినేషన్ బ్యాంక్ ఖాతా వివరాలు' : 'Destination Account Details (A/C / IFSC / UPI)'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. HDFC A/C 501004... IFSC HDFC0001024 or UPI"
                      value={drawDestinationAccountDetails}
                      onChange={(e) => setDrawDestinationAccountDetails(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs text-gray-950 outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    {t('drawPurpose')}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Capital draw / dividend against accrued profit"
                    value={drawPurpose}
                    onChange={(e) => setDrawPurpose(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs text-gray-950 outline-none focus:bg-white"
                  />
                </div>

                <div className="bg-[#FFFDF0] p-3 rounded-2xl border border-amber-300 text-[11px] text-gray-700 space-y-1">
                  <div className="flex justify-between">
                    <span>{t('availableBalance')}:</span>
                    <strong className="font-mono text-gray-950">{formatINR(netShareBalance)}</strong>
                  </div>
                  <div className="flex justify-between text-gray-500 text-[10px]">
                    <span>{t('priorDraws')}:</span>
                    <span className="font-mono">{formatINR(totalDrawingsCombined)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>{t('submitDrawBtn')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawingDialogOpen(false)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs border border-gray-200 cursor-pointer"
                >
                  {lang === 'te' ? 'రద్దు' : 'Cancel'}
                </button>
              </form>
            </EntryDialog>

      {/* Customer Plot Booking Modal for on-spot bookings */}
      {selectedMobilePlot && (
        <CustomerPlotBookingModal
          isOpen={!!selectedMobilePlot}
          plot={activePlots.find((p) => selectedMobilePlot.__recordId
            ? p.__recordId === selectedMobilePlot.__recordId : p.id === selectedMobilePlot.id) || selectedMobilePlot}
          project={activeProject}
          firm={activeFirm}
          floorRate={activeProject?.floorRatePerSqYard || 0}
          firmAccounts={firmAccounts}
          onAddAccountTransaction={onAddAccountTransaction}
          onApproveBooking={onApproveBooking}
          onClose={() => setSelectedMobilePlot(null)}
          onConfirmBooking={async (updatedPlot) => {
            if (!onUpdatePlot) return false;
            const ok = await onUpdatePlot(updatedPlot);
            if (ok === false) return false;
            showToast(`Plot #${updatedPlot.plotNumber} booking recorded`);
            return true;
          }}
          onReleasePlot={(plotId) => {
            const plotToRelease = plots.find((p) => p.id === plotId);
            if (plotToRelease && onUpdatePlot) {
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
            setSelectedMobilePlot(null);
          }}
        />
      )}

      {/* Individual Partner Investment Modal */}
      {activeProject && (
        <IndividualInvestmentModal
          isOpen={isEnrollInvestmentModalOpen}
          onClose={() => setIsEnrollInvestmentModalOpen(false)}
          firm={activeFirm}
          project={activeProject}
          partners={partners}
          firmAccounts={firmAccounts}
          preSelectedPartnerId={currentPartner?.id}
          initiatorRole="field_partner"
          onRecordInvestment={(data) => {
            if (onRecordIndividualInvestment) {
              onRecordIndividualInvestment(data);
            }
            setIsEnrollInvestmentModalOpen(false);
            showToast(
              lang === 'te'
                ? `పెట్టుబడి ₹${data.amount.toLocaleString('en-IN')} విజయవంతంగా నమోదు చేయబడింది!`
                : `Investment of ₹${data.amount.toLocaleString('en-IN')} by ${data.partnerName} recorded!`
            );
          }}
        />
      )}

      {/* Individual Investment Voucher Slip Modal */}
      {selectedInvestmentForSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-400 via-[#FFB800] to-amber-500 p-5 flex items-center justify-between border-b border-amber-600/30">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-gray-950" />
                <h3 className="font-black text-gray-950 text-base">
                  Capital Contribution Voucher
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvestmentForSlip(null)}
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
                  <div className="font-black text-sm text-gray-950">{activeFirm.name}</div>
                  <div className="text-[10px] text-gray-500">{activeFirm.location}, {activeFirm.state}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Voucher / Ref No</div>
                  <div className="font-mono font-bold text-gray-950">{selectedInvestmentForSlip.referenceNo}</div>
                  <div className="text-[10px] text-gray-500 font-mono">{selectedInvestmentForSlip.date}</div>
                </div>
              </div>

              {/* Amount Box */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-amber-900 uppercase">Capital Contribution Received</span>
                  <div className="text-2xl font-black font-mono text-gray-950">
                    {formatINR(selectedInvestmentForSlip.amount)}
                  </div>
                </div>
                <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase ${
                  selectedInvestmentForSlip.accountType === 'cash' ? 'bg-amber-200 text-amber-950' : 'bg-blue-100 text-blue-900'
                }`}>
                  {selectedInvestmentForSlip.accountType === 'cash' ? 'Cash Treasury' : 'Bank Wire'}
                </span>
              </div>

              {/* Breakdown Details */}
              <div className="space-y-2 bg-gray-50 p-4 rounded-2xl text-xs divide-y divide-gray-200/60">
                <div className="flex justify-between pb-1.5">
                  <span className="text-gray-500 font-medium">Investor / Contributing Partner:</span>
                  <span className="font-bold text-gray-950">{selectedInvestmentForSlip.partnerName}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500 font-medium">Venture Project:</span>
                  <span className="font-bold text-gray-950">{activeProject?.name || activeFirm.name}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500 font-medium">Credited To Account / Vault:</span>
                  <span className="font-bold text-gray-950 text-right">{selectedInvestmentForSlip.accountName}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500 font-medium">Payment Mode / Channel:</span>
                  <span className="font-bold text-gray-950">{selectedInvestmentForSlip.paymentMode}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-gray-500 font-medium">Purpose Head:</span>
                  <span className="font-bold text-gray-950 text-right">{selectedInvestmentForSlip.purpose}</span>
                </div>
                {selectedInvestmentForSlip.witnessName && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500 font-medium">Cash Handover Custodian:</span>
                    <span className="font-bold text-gray-950">{selectedInvestmentForSlip.witnessName}</span>
                  </div>
                )}
                {selectedInvestmentForSlip.notes && (
                  <div className="pt-1.5">
                    <span className="text-gray-500 font-medium block">Narration / Remarks:</span>
                    <span className="text-gray-800 italic block mt-0.5">{selectedInvestmentForSlip.notes}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-200 text-center p-2.5 bg-gray-50 rounded-xl">
                <span className="text-[10px] text-gray-500 block uppercase font-bold">Posting</span>
                <strong className="text-xs text-gray-950 block mt-1">
                  {selectedInvestmentForSlip.status === 'approved' ? 'Recorded' : selectedInvestmentForSlip.status === 'pending' ? 'Not posted (historical)' : 'Referred back'}
                </strong>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedInvestmentForSlip(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-gray-950 hover:bg-gray-800 text-amber-400 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
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
