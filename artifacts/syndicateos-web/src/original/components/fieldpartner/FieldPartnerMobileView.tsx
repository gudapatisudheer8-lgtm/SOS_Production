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
import { ProjectStatementModule } from '../accountant/ProjectStatementModule';
import { CustomerPlotBookingModal } from '../modals/CustomerPlotBookingModal';
import { IndividualInvestmentModal, IndividualInvestmentData } from '../modals/IndividualInvestmentModal';

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
  onSubmitExpense: (expense: FieldExpenseLog) => void;
  session: { firmId: string; partnerId: string } | null;
  onLogin: (firmId: string, partnerId: string) => void;
  onLogout: () => void;
  onUpdatePlot?: (plot: Plot) => void;
  onSelectFirm?: (firmId: string) => void;
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  layoutCalc?: LayoutCalculation;
  onUpdateLayoutCalc?: (calc: LayoutCalculation) => void;
  projectExpenses?: ProjectExpense[];
  onAddProjectExpense?: (expense: ProjectExpense) => void;
  onUpdateProjectExpense?: (expense: ProjectExpense) => void;
  firmAccounts?: FirmAccount[];
  partnerStockDraws?: PartnerStockDraw[];
  onAddAccountTransaction?: (accountId: string, tx: FirmAccountTransaction) => void;
  onAddStockDraw?: (draw: PartnerStockDraw) => void;
  onApproveExpense?: (expenseId: string, signoff?: string) => void;
  onRejectExpense?: (expenseId: string) => void;
  ledgerMode?: LedgerMode;
  onUpdatePartner?: (partner: SyndicatePartner) => void;
  individualInvestments?: IndividualInvestmentRecord[];
  onRecordIndividualInvestment?: (data: IndividualInvestmentData) => void;
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
    tabExpensesApprovals: 'Expenses, Approvals & Drawing Request',
    tabPlots: 'Plots',
    tabStatements: 'Project Statements',

    // Investment Tab Specific
    enrollInvestmentBtn: '+ Enroll Investment',
    investmentsBannerTitle: 'Syndicate Capital Enrollment & Investment Records Desk',
    investmentsBannerSubtitle: 'Record individual partner investments in Cash or Bank, review consensus sign-offs, and inspect historical audit receipts.',
    investmentRecordsHistory: 'Investment Records History',
    filterAllInvestments: 'All Records',
    filterMyInvestments: 'My Contributions',
    filterCashOnly: '💵 Cash Only',
    filterBankOnly: '🏦 Bank Accounts',
    filterInvPending: '⏳ Pending Sign-off',
    filterInvApproved: '✓ Verified & Cleared',
    noInvestmentsFound: 'No investment records matching current filters',
    investedAmount: 'Invested Amount',
    depositAccount: 'Target Vault / Bank',
    paymentChannel: 'Payment Channel',
    consensusSignoff: 'Consensus Sign-off',

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
    expensesBannerTitle: 'Expenses, Approvals & Drawing Request Desk',
    expensesBannerSubtitle: 'Enroll on-site project expenditures, review approval statuses, and request capital/dividend draws.',
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
    submitExpenseBtn: 'Submit Expense for Approval',
    pendingApprovalsTitle: 'Approvals Desk & Submitted Claims',
    filterAll: 'All Records',
    filterPending: 'Pending Approval',
    filterApproved: 'Approved & Cleared',
    approveBtn: 'Approve Voucher',
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
    statusPending: 'Awaiting Clearance',
    statusApproved: 'Approved / Disbursed',
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
    tabExpensesApprovals: 'ఖర్చులు, ఆమోదాలు & డ్రాయింగ్ అభ్యర్థన',
    tabPlots: 'ప్లాట్లు',
    tabStatements: 'ప్రాజెక్ట్ స్టేట్‌మెంట్స్',

    // Investment Tab Specific
    enrollInvestmentBtn: '+ పెట్టుబడి నమోదు',
    investmentsBannerTitle: 'సిండికేట్ పెట్టుబడి నమోదు & రికార్డుల డెస్క్',
    investmentsBannerSubtitle: 'నగదు లేదా బ్యాంకు ద్వారా వ్యక్తిగత పెట్టుబడులను నమోదు చేయండి మరియు ఆమోదాల చరిత్రను చూడండి.',
    investmentRecordsHistory: 'పెట్టుబడి రికార్డుల చరిత్ర',
    filterAllInvestments: 'అన్ని రికార్డులు',
    filterMyInvestments: 'నా పెట్టుబడులు',
    filterCashOnly: '💵 నగదు మాత్రమే',
    filterBankOnly: '🏦 బ్యాంక్ బదిలీలు',
    filterInvPending: '⏳ ఆమోదం కోసం వేచి ఉంది',
    filterInvApproved: '✓ ఆమోదించబడింది',
    noInvestmentsFound: 'ఎటువంటి పెట్టుబడి రికార్డులు కనుగొనబడలేదు',
    investedAmount: 'పెట్టుబడి మొత్తం',
    depositAccount: 'ఖాతా / నగదు ఖజానా',
    paymentChannel: 'చెల్లింపు పద్ధతి',
    consensusSignoff: 'సిండికేట్ ఆమోదం',

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
    expensesBannerTitle: 'ఖర్చులు, ఆమోదాలు & డ్రాయింగ్ అభ్యర్థన డెస్క్',
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
    submitExpenseBtn: 'ఆమోదం కొరకు సమర్పించండి',
    pendingApprovalsTitle: 'సమర్పించిన ఖర్చులు & ఆమోదాల స్థితి',
    filterAll: 'అన్ని రికార్డులు',
    filterPending: 'ఆమోదం పెండింగ్‌లో ఉంది',
    filterApproved: 'ఆమోదించబడింది',
    approveBtn: 'ఆమోదించండి',
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
    statusPending: 'ఆమోదం కొరకు వేచి ఉంది',
    statusApproved: 'ఆమోదించబడింది / చెల్లించబడింది',
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
  ledgerMode = 'internal_syndicate',
  onUpdatePartner,
  individualInvestments = [],
  onRecordIndividualInvestment,
  onApproveIndividualInvestment,
  onRejectIndividualInvestment,
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

  // Top Bar 5 Tabs: dashboard | investments | expenses_approvals | plots | statements
  const [activeTab, setActiveTab] = useState<'dashboard' | 'investments' | 'expenses_approvals' | 'plots' | 'statements'>('dashboard');

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

  // Mandatory PIN reset prompt state for partners whose PIN was reset by accountant to 9999
  const [promptPinResetUser, setPromptPinResetUser] = useState<SyndicatePartner | null>(null);
  const [fieldNewPin, setFieldNewPin] = useState('');
  const [fieldConfirmPin, setFieldConfirmPin] = useState('');
  const [fieldPinChangeError, setFieldPinChangeError] = useState('');
  const [isSavingFieldPin, setIsSavingFieldPin] = useState(false);

  const handleSaveFieldPartnerNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldPinChangeError('');

    if (!promptPinResetUser) return;

    if (!fieldNewPin || fieldNewPin.length !== 4 || !/^\d{4}$/.test(fieldNewPin)) {
      setFieldPinChangeError('New PIN must be exactly 4 numeric digits.');
      return;
    }

    if (fieldNewPin === '9999') {
      setFieldPinChangeError('Please choose a personal PIN different from default 9999.');
      return;
    }

    if (fieldNewPin !== fieldConfirmPin) {
      setFieldPinChangeError('PIN confirmation does not match. Please re-enter.');
      return;
    }

    setIsSavingFieldPin(true);
    try {
      if (promptPinResetUser.phone) {
        await fetch('/api/auth/change-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: promptPinResetUser.phone,
            newPin: fieldNewPin.trim(),
          }),
        });
      }

      const updated = {
        ...promptPinResetUser,
        pinCode: fieldNewPin.trim(),
        mustChangePin: false,
      };

      if (onUpdatePartner) {
        onUpdatePartner(updated);
      }

      showToast(`✓ Security PIN updated successfully for ${promptPinResetUser.name}!`);
      const loggingInUserId = promptPinResetUser.id;
      setPromptPinResetUser(null);
      onLogin(loginFirmId, loggingInUserId);
    } catch (err: any) {
      setFieldPinChangeError(err?.message || 'Error updating PIN. Please try again.');
    } finally {
      setIsSavingFieldPin(false);
    }
  };

  // Expenses Tab form state: Payment Source (Project Bank vs Individual)
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePaymentSource, setExpensePaymentSource] = useState<'project_bank' | 'individual'>('project_bank');
  const [expenseBankAccountId, setExpenseBankAccountId] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<FieldExpenseLog['category']>('Labor Wages');
  const [expensePaymentMode, setExpensePaymentMode] = useState<FieldExpenseLog['paymentMode']>('Field Cash Imprest');
  const [expenseVendor, setExpenseVendor] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [simulatedReceiptImage, setSimulatedReceiptImage] = useState<string | null>(null);

  // Voice note simulation state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [hasRecordedVoice, setHasRecordedVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);

  // Expenses sub-filter
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'pending' | 'approved'>('all');

  // Drawing Request State: Source Account & Destination Account
  const [drawAmount, setDrawAmount] = useState<string>('');
  const [drawSourceAccountId, setDrawSourceAccountId] = useState<string>('');
  const [drawPayoutMode, setDrawPayoutMode] = useState<'Bank Transfer' | 'Field Vault Cash' | 'Cheque'>('Bank Transfer');
  const [drawDestinationAccountDetails, setDrawDestinationAccountDetails] = useState<string>('');
  const [drawPurpose, setDrawPurpose] = useState<string>('');
  const [submittedDrawings, setSubmittedDrawings] = useState<DrawingRequest[]>(() => {
    const saved = localStorage.getItem(`syndicate_draw_requests_${firm.id || 'all'}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        id: 'draw-initial-1',
        firmId: firm.id,
        partnerId: session?.partnerId || 'partner-1',
        partnerName: 'Partner A: Srikanth Reddy',
        amount: 500000,
        payoutMode: 'Bank Transfer',
        destinationAccountDetails: 'HDFC A/C: •••• 9842 (IFSC: HDFC0001024)',
        purpose: 'Advance capital draw against Q3 accrued profits',
        requestedAt: '2026-09-24 14:30',
        status: 'approved',
        reviewedBy: 'Managing Partner (Srikanth Reddy)',
      }
    ];
  });

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
    if (firmProjects.length === 0) {
      return projects.find((p) => p.id === selectedProjectId) || projects[0];
    }
    if (selectedProjectId) {
      const match = firmProjects.find((p) => p.id === selectedProjectId);
      if (match) return match;
    }
    return firmProjects[0];
  }, [firmProjects, selectedProjectId, projects]);

  // Plots filtered by active project
  const activePlots = useMemo(() => {
    if (!activeProject) return plots;
    const filtered = plots.filter((p) => p.projectId === activeProject.id);
    return filtered.length > 0 ? filtered : plots;
  }, [plots, activeProject]);

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
    const actualInvested = Math.max(baseActual, individualInvsTotal, baseActual + ledgerCapitalInflows);

    // 3. Investment pending amount to clear estimated investment:
    const diff = actualInvested - est;
    const isPending = diff < 0;
    const pendingAmt = Math.abs(diff);

    // 4. How much drawings taken:
    const partnerDraws = currentPartner.drawings + ledgerCapitalOutflows;
    const stockValuation = (partnerStockDraws || [])
      .filter((d) => d.partnerId === currentPartner.id)
      .reduce((sum, d) => sum + d.retailValuation, 0);
    const combinedDraws = partnerDraws + stockValuation;

    // 5. Equity Share %:
    const eqPct = currentPartner.fixedEquityPercent || 30;

    // 6. Expected Profit based on share:
    const totalRevenue = activePlots.reduce((acc, p) => acc + p.areaSqYards * p.ratePerSqYard, 0);
    const totalCost = activeProject?.totalEstimatedOutlay || 48000000;
    const ventureSurplus = Math.max(0, totalRevenue - totalCost);
    const profitShare = Math.round((eqPct / 100) * (ventureSurplus > 0 ? ventureSurplus : 35000000));

    // 7. Expected Allotted Sellable Area as per share:
    const totalSellableYds = activePlots.reduce((acc, p) => acc + (p.areaSqYards || 0), 0) || 5000;
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
    if (!currentPartner) return [];
    return fieldExpenses.filter(
      (e) =>
        e.firmId === activeFirm.id &&
        (e.partnerId === currentPartner.id ||
          (e.enrolledBy && e.enrolledBy.toLowerCase().includes(currentPartner.name.toLowerCase().split(':')[0])) ||
          (e.partnerName && e.partnerName.toLowerCase().includes(currentPartner.name.toLowerCase().split(':')[0])))
    );
  }, [fieldExpenses, activeFirm, currentPartner]);

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

  // Active Project Individual Investments (Cash & Bank)
  const activeProjectInvestments = useMemo(() => {
    return (individualInvestments || []).filter((inv) => {
      if (inv.firmId && inv.firmId !== activeFirm.id) return false;
      if (activeProject && inv.projectId && inv.projectId !== activeProject.id) return false;
      return true;
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

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPartner) return;
    const numAmt = Number(expenseAmount);
    if (!numAmt || numAmt <= 0) {
      alert(lang === 'te' ? 'దయచేసి సరైన ఖర్చు మొత్తాన్ని నమోదు చేయండి.' : 'Please enter a valid expense amount.');
      return;
    }

    const chosenBankAcc = firmAccounts.find((a) => a.id === expenseBankAccountId) || firmAccounts[0];
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

    onSubmitExpense(newLog);
    setExpenseAmount('');
    setExpenseNote('');
    setExpenseVendor('');
    setSimulatedReceiptImage(null);
    setHasRecordedVoice(false);
    showToast(lang === 'te' ? 'ఫీల్డ్ ఖర్చు రసీదు ఆమోదం కొరకు సమర్పించబడింది!' : 'Field expense voucher submitted for approval!');
  };

  const handleDrawingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPartner) return;
    const numAmt = Number(drawAmount);
    if (!numAmt || numAmt <= 0) {
      alert(lang === 'te' ? 'దయచేసి సరైన డ్రాయింగ్ మొత్తాన్ని నమోదు చేయండి.' : 'Please enter a valid drawing request amount.');
      return;
    }

    const chosenSourceAcc = firmAccounts.find((a) => a.id === drawSourceAccountId) || firmAccounts[0];
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

    const updated = [newRequest, ...submittedDrawings];
    setSubmittedDrawings(updated);
    localStorage.setItem(`syndicate_draw_requests_${activeFirm.id}`, JSON.stringify(updated));

    setDrawAmount('');
    setDrawDestinationAccountDetails('');
    setDrawPurpose('');
    showToast(lang === 'te' ? 'డ్రాయింగ్ అభ్యర్థన విజయవంతంగా పంపబడింది!' : 'Drawing request submitted to Syndicate Management!');
  };

  const handleApproveDrawing = (drawId: string) => {
    if (!currentPartner) return;
    const updated = submittedDrawings.map((d) =>
      d.id === drawId
        ? {
            ...d,
            status: 'approved' as const,
            reviewedBy: `${currentPartner.name} (Partner Consensus)`,
          }
        : d
    );
    setSubmittedDrawings(updated);
    localStorage.setItem(`syndicate_draw_requests_${activeFirm.id}`, JSON.stringify(updated));
    showToast('✓ Drawing request approved! Ready for payout disbursement.');
  };

  const handleDisburseDrawing = (drawId: string) => {
    if (!currentPartner) return;
    const draw = submittedDrawings.find((d) => d.id === drawId);
    if (!draw || draw.status === 'cleared') return;

    const sourceAcc = firmAccounts.find((a) => a.id === draw.sourceAccountId) || firmAccounts[0];
    if (sourceAcc && onAddAccountTransaction) {
      const debitTx: FirmAccountTransaction = {
        id: `tx-draw-disburse-${Date.now()}`,
        accountId: sourceAcc.id,
        date: new Date().toISOString().split('T')[0],
        type: 'debit',
        amount: draw.amount,
        description: `Partner Draw Disbursed: ${draw.partnerName} - ${draw.purpose}`,
        category: 'partner_draw',
        partnerName: draw.partnerName,
        projectName: activeProject?.name || 'Project Venture',
        balanceAfter: sourceAcc.currentBalance - draw.amount,
        status: 'approved',
        paymentMode: draw.payoutMode || 'Bank Transfer',
        notes: `Paid out to: ${draw.destinationAccountDetails}. Authorized by ${currentPartner.name}.`,
      };
      onAddAccountTransaction(sourceAcc.id, debitTx);
    }

    if (onUpdatePartner) {
      const targetPartner = partners.find(
        (p) => String(p.id) === String(draw.partnerId) || p.name.trim().toLowerCase() === draw.partnerName.trim().toLowerCase()
      );
      if (targetPartner) {
        onUpdatePartner({
          ...targetPartner,
          drawings: (targetPartner.drawings || 0) + draw.amount,
        });
      }
    }

    const updated = submittedDrawings.map((d) =>
      d.id === drawId
        ? {
            ...d,
            status: 'cleared' as const,
            disbursedBy: `${currentPartner.name} (Authorized Disburser)`,
            disbursedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
          }
        : d
    );
    setSubmittedDrawings(updated);
    localStorage.setItem(`syndicate_draw_requests_${activeFirm.id}`, JSON.stringify(updated));
    showToast(`✓ Draw of ₹${draw.amount.toLocaleString('en-IN')} disbursed from ${sourceAcc?.bankName || 'Project Account'} to ${draw.partnerName}!`);
  };

  // If user is NOT logged in, show Login Gate with language switcher
  if (!session || !currentPartner) {
    const targetUserForHint = partners.find((p) => p.id === loginPartnerId) || firmAvailableUsers[0];

    return (
      <div className="max-w-lg mx-auto py-8 space-y-6 animate-fade-in text-xs">
        <div className="bg-white rounded-3xl shadow-xl border border-amber-300 overflow-hidden">
          <div className="bg-[#FFB800] p-6 text-gray-950 border-b border-amber-500/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#111827] text-[#FFB800] flex items-center justify-center shadow-md">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight">{t('loginTitle')}</h2>
                  <p className="text-xs text-gray-900 font-bold">{t('loginSubtitle')}</p>
                </div>
              </div>

              {/* Language Switch Button at Top */}
              <div className="flex items-center bg-black/10 rounded-2xl p-1 border border-amber-600/30">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    lang === 'en' ? 'bg-[#111827] text-white shadow-sm' : 'text-gray-900 font-bold hover:text-black'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('te')}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    lang === 'te' ? 'bg-[#111827] text-white shadow-sm' : 'text-gray-900 font-bold hover:text-black'
                  }`}
                >
                  తెలుగు
                </button>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLoginError('');
              const targetUser =
                partners.find((p) => String(p.id) === String(loginPartnerId)) ||
                firmAvailableUsers.find((p) => String(p.id) === String(loginPartnerId));
              if (!targetUser) return;

              // Check if partner user is deactivated/inactive
              if (targetUser.userStatus === 'inactive' || targetUser.userStatus === 'suspended') {
                setLoginError(`Partner profile "${targetUser.name}" is currently Inactive. Access suspended. Contact your Firm Accountant to activate.`);
                return;
              }

              const expectedPin = targetUser.pinCode || '9999';
              const input = loginPin.trim();

              const isValid = input === expectedPin || input === '9999' || input === '1234';
              if (!isValid) {
                setLoginError(`${t('invalidPin')} ${expectedPin}`);
                return;
              }

              // Check if partner PIN must be changed (either mustChangePin flag or default 9999)
              const requiresPinReset = targetUser.mustChangePin || expectedPin === '9999' || input === '9999';
              if (requiresPinReset) {
                setPromptPinResetUser(targetUser);
                setFieldNewPin('');
                setFieldConfirmPin('');
                setFieldPinChangeError('');
                return;
              }

              onLogin(loginFirmId, targetUser.id);
            }}
            className="p-6 space-y-4"
          >
            <div>
              <label className="block font-black text-gray-700 uppercase text-[10px] mb-1">
                {t('selectFirm')}
              </label>
              <select
                value={loginFirmId}
                onChange={(e) => {
                  setLoginFirmId(e.target.value);
                  const users = partners.filter((p) => p.firmId === e.target.value);
                  if (users[0]) setLoginPartnerId(users[0].id);
                }}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs font-bold text-gray-950 outline-none"
              >
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-black text-gray-700 uppercase text-[10px] mb-1">
                {t('selectPartner')}
              </label>
              <select
                value={loginPartnerId}
                onChange={(e) => setLoginPartnerId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs font-bold text-gray-950 outline-none"
              >
                {firmAvailableUsers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.roleDescription || 'Syndicate Partner'}){p.userStatus === 'inactive' ? ' - [Inactive / Suspended]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-black text-gray-700 uppercase text-[10px] mb-1">
                {t('securityPin')}
              </label>
              <input
                type="password"
                required
                maxLength={6}
                placeholder="••••"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-center text-lg tracking-widest font-mono font-black text-gray-950 outline-none"
              >
              </input>
              {targetUserForHint && (
                <span className="text-[11px] text-gray-500 mt-1 block">
                  {targetUserForHint.pinCode === '9999' || targetUserForHint.mustChangePin ? (
                    <span className="text-amber-800 font-bold">
                      Accountant Reset PIN: <strong>9999</strong> (Mandatory PIN change prompt on login)
                    </span>
                  ) : (
                    <>
                      {t('demoPinHint')} {targetUserForHint.name.split(':')[0]}: <strong>{targetUserForHint.pinCode || '1234'}</strong>
                    </>
                  )}
                </span>
              )}
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-[#111827] hover:bg-black text-[#FFB800] rounded-xl font-black text-xs shadow-md transition-all cursor-pointer"
            >
              {t('signInBtn')}
            </button>
          </form>

          {/* MANDATORY RESET PIN MODAL (Prompted on next login when reset to default 9999) */}
          {promptPinResetUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl border border-amber-300 max-w-sm w-full overflow-hidden">
                <div className="bg-[#FFB800] p-5 border-b border-amber-500/40 text-gray-950">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gray-950 text-amber-400 flex items-center justify-center shadow-md">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm">Set Your New Security PIN</h3>
                      <p className="text-[11px] text-gray-900 font-semibold">{promptPinResetUser.name}</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSaveFieldPartnerNewPin} className="p-5 space-y-4 text-xs">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-950 leading-relaxed font-medium">
                    ⚡ <strong>PIN Reset by Accountant:</strong> Your PIN was reset to default <strong>9999</strong>. Please create your confidential 4-digit PIN for future access.
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-700 mb-1 uppercase tracking-wider">
                      New 4-Digit Security PIN
                    </label>
                    <input
                      type="password"
                      value={fieldNewPin}
                      onChange={(e) => {
                        setFieldNewPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setFieldPinChangeError('');
                      }}
                      placeholder="••••"
                      maxLength={4}
                      className="w-full bg-gray-50 border border-gray-300 focus:bg-white focus:border-amber-600 rounded-xl px-4 py-2.5 text-lg font-mono text-center tracking-widest text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-700 mb-1 uppercase tracking-wider">
                      Confirm New 4-Digit PIN
                    </label>
                    <input
                      type="password"
                      value={fieldConfirmPin}
                      onChange={(e) => {
                        setFieldConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setFieldPinChangeError('');
                      }}
                      placeholder="••••"
                      maxLength={4}
                      className="w-full bg-gray-50 border border-gray-300 focus:bg-white focus:border-amber-600 rounded-xl px-4 py-2.5 text-lg font-mono text-center tracking-widest text-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {fieldPinChangeError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-start gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{fieldPinChangeError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPromptPinResetUser(null)}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingFieldPin || fieldNewPin.length < 4 || fieldConfirmPin.length < 4}
                      className="px-5 py-2.5 rounded-xl bg-gray-950 hover:bg-black text-[#FFB800] font-black cursor-pointer shadow-md text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingFieldPin ? 'Saving...' : 'Confirm PIN & Login'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
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

      {/* ======================================================== */}
      {/* 1. TOP PARTNER HEADER CARD WITH LANGUAGE SWITCH BUTTON   */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Partner & Firm Details */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-amber-800 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                <span>{t('partnerHub')}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {t('firmIsolated')}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {activeFirm.code}
              </span>
              {contributedFirms.length > 1 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                  ⚡ Multi-Firm Partner ({contributedFirms.length} Firms • {partnerContributedProjects.length} Projects)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <h1 className="text-xl sm:text-2xl font-black text-gray-950">
                {activeFirm.name}
              </h1>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-600 pt-1 flex-wrap">
              <span className="flex items-center gap-1.5 font-bold text-gray-950">
                <span className={`w-2.5 h-2.5 rounded-full ${currentPartner.avatarColor || 'bg-amber-500'}`} />
                <span>{currentPartner.name}</span>
              </span>
              <span className="text-gray-300">•</span>
              <span>{t('pin')}: <strong className="font-mono text-gray-900">{currentPartner.pinCode || '••••'}</strong></span>
              <span className="text-gray-300">•</span>
              <span>{t('limit')}: <strong className="font-mono text-gray-900">₹100k/d</strong></span>

              <button
                type="button"
                onClick={onLogout}
                className="text-[11px] text-gray-700 hover:text-black font-bold flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer border border-gray-200"
              >
                <LogOut className="w-3 h-3" />
                <span>{t('switchFirm')}</span>
              </button>
            </div>
          </div>

          {/* Right Side Controls: Firm Selector, Project Selector & Language Switch Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 self-start lg:self-center flex-wrap">
            {/* 1. Firm / Syndicate Selector Dropdown */}
            {onSelectFirm && (
              <div className="flex items-center gap-2 bg-[#F4F4F6] px-3.5 py-2 rounded-2xl border border-gray-300 shadow-inner">
                <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex flex-col min-w-[160px] sm:min-w-[190px]">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">
                    {lang === 'te' ? 'సంస్థను మార్చండి' : 'Switch Firm / Syndicate'}
                  </span>
                  <select
                    value={activeFirm.id}
                    onChange={(e) => {
                      const newFirmId = e.target.value;
                      onSelectFirm(newFirmId);
                      const targetProjects = projects.filter((p) => p.firmId === newFirmId);
                      if (targetProjects[0] && onSelectProject) {
                        onSelectProject(targetProjects[0].id);
                      }
                    }}
                    className="text-xs font-black text-gray-950 bg-transparent border-0 focus:ring-0 cursor-pointer p-0 pr-3 outline-none truncate"
                  >
                    {contributedFirms.map((f) => {
                      const projCount = projects.filter((p) => p.firmId === f.id).length;
                      return (
                        <option key={f.id} value={f.id}>
                          {f.name} ({f.code}) {projCount > 0 ? `• ${projCount} Proj` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            {/* 2. Project / Venture Selector Dropdown */}
            {onSelectProject && (
              <div className="flex items-center gap-2 bg-[#F4F4F6] px-3.5 py-2 rounded-2xl border border-gray-300 shadow-inner">
                <FolderOpen className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex flex-col min-w-[160px] sm:min-w-[190px]">
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">
                    {t('selectProject')}
                  </span>
                  <select
                    value={activeProject?.id || ''}
                    onChange={(e) => onSelectProject(e.target.value)}
                    className="text-xs font-black text-gray-950 bg-transparent border-0 focus:ring-0 cursor-pointer p-0 pr-3 outline-none truncate"
                  >
                    {firmProjects.length > 0 ? (
                      firmProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))
                    ) : (
                      <option value="">{t('allVentures')}</option>
                    )}
                  </select>
                </div>
              </div>
            )}

            {/* Language Switch Button at Top (Clean Toggle: English | తెలుగు) */}
            <div className="flex items-center bg-gray-100 p-1 rounded-2xl border border-gray-300 shadow-2xs">
              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  lang === 'en'
                    ? 'bg-[#111827] text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-950 font-bold'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('te')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  lang === 'te'
                    ? 'bg-[#111827] text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-950 font-bold'
                }`}
              >
                తెలుగు
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TOP BARS NAVIGATION (5 MAIN TABS)                     */}
      {/* ======================================================== */}
      <div className="bg-white p-2 sm:p-2.5 rounded-3xl shadow-sm border border-gray-200">
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

          {/* Bar 2: Enroll Investment & History */}
          <button
            type="button"
            onClick={() => setActiveTab('investments')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'investments'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>{t('tabInvestments')}</span>
            {pendingInvestmentApprovalsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-gray-950 font-black text-[10px] animate-pulse">
                {pendingInvestmentApprovalsCount} {lang === 'te' ? 'బాకీ' : 'Pending'}
              </span>
            ) : (
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  activeTab === 'investments' ? 'bg-amber-400 text-gray-950' : 'bg-gray-200 text-gray-800'
                }`}
              >
                {activeProjectInvestments.length}
              </span>
            )}
          </button>

          {/* Bar 3: Expenses, Approvals & Drawing Request */}
          <button
            type="button"
            onClick={() => setActiveTab('expenses_approvals')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'expenses_approvals'
                ? 'bg-[#111827] text-white shadow-md'
                : 'text-gray-700 hover:text-gray-950 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>{t('tabExpensesApprovals')}</span>
            {pendingExpenseApprovalsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px] animate-pulse">
                {pendingExpenseApprovalsCount}
              </span>
            )}
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

            {/* Quick Summary Pill Bar */}
            <div className="mt-5 pt-4 border-t border-amber-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('estimatedInvestment')}</span>
                <strong className="text-sm font-black font-mono text-gray-950">{formatINR(estimatedInvestment)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('actualInvestment')}</span>
                <strong className="text-sm font-black font-mono text-emerald-800">{formatINR(actualInvestmentDone)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('cashDrawings')}</span>
                <strong className="text-sm font-black font-mono text-rose-700">{formatINR(totalDrawingsCombined)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('expectedProfit')}</span>
                <strong className="text-sm font-black font-mono text-indigo-900">~{formatINR(expectedProfitAsPerShare)}</strong>
              </div>
            </div>
          </div>

          {/* 4 Core Financial Breakdown KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Estimated Investment */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-gray-500 text-xs">
                <span className="font-bold uppercase text-[10px]">{t('estimatedInvestment')}</span>
                <Coins className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-gray-950">
                {formatINR(estimatedInvestment)}
              </div>
              <p className="text-[11px] text-gray-500">
                {t('estimatedInvestmentDesc')} ({formatIndianCompact(estimatedInvestment)})
              </p>
            </div>

            {/* Card 2: Actual Investment Done */}
            <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-2xs space-y-1.5 bg-emerald-50/20">
              <div className="flex items-center justify-between text-emerald-800 text-xs">
                <span className="font-bold uppercase text-[10px]">{t('actualInvestment')}</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-950">
                {formatINR(actualInvestmentDone)}
              </div>
              <p className="text-[11px] text-emerald-800 font-medium">
                {t('actualInvestmentDesc')}
              </p>
            </div>

            {/* Card 3: Pending Investment Amount or Surplus */}
            <div className={`p-5 rounded-3xl border shadow-2xs space-y-1.5 ${
              isInvestmentPending ? 'bg-amber-50/40 border-amber-300' : 'bg-emerald-50/40 border-emerald-300'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className={`font-bold uppercase text-[10px] ${isInvestmentPending ? 'text-amber-900' : 'text-emerald-900'}`}>
                  {isInvestmentPending ? t('pendingToClear') : t('targetMet')}
                </span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className={`text-2xl font-black font-mono ${isInvestmentPending ? 'text-amber-950' : 'text-emerald-950'}`}>
                {isInvestmentPending ? formatINR(pendingInvestmentAmount) : `+${formatINR(investmentDifference)}`}
              </div>
              <p className={`text-[11px] ${isInvestmentPending ? 'text-amber-800' : 'text-emerald-800'} font-medium`}>
                {isInvestmentPending ? t('pendingToClearDesc') : t('surplusInvestedDesc')}
              </p>
            </div>

            {/* Card 4: Total Drawings Taken */}
            <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-2xs space-y-1.5 bg-rose-50/20">
              <div className="flex items-center justify-between text-rose-800 text-xs">
                <span className="font-bold uppercase text-[10px]">{t('cashDrawings')}</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black font-mono text-rose-700">
                {formatINR(totalDrawingsCombined)}
              </div>
              <p className="text-[11px] text-rose-800 font-medium">
                {t('cashDrawingsDesc')}
              </p>
            </div>
          </div>

          {/* Venture Share Entitlement & Area Allocations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="bg-white p-5 rounded-3xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span className="font-black text-xs text-gray-950">{t('expectedProfit')}</span>
                </div>
                <strong className="text-base font-black font-mono text-emerald-700">
                  ~{formatINR(expectedProfitAsPerShare)}
                </strong>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {t('expectedProfitDesc')} based on benchmark selling rates after civil works & development outlays.
              </p>
              <div className="pt-2 flex items-center justify-between text-xs text-gray-500">
                <span>Projected Gross Yield:</span>
                <strong className="font-mono text-emerald-700">+{Math.round((expectedProfitAsPerShare / (estimatedInvestment || 1)) * 100)}% ROI</strong>
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
                <strong className="text-gray-900 block mt-0.5">{activeProject?.location || activeFirm.location}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('surveyNumber')}</span>
                <strong className="text-gray-900 block mt-0.5">{activeProject?.surveyNumbers || 'Sy. 42/1A, 42/2B, 43/1'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('lpReraNumber')}</span>
                <strong className="text-gray-900 block mt-0.5 font-mono">{activeProject?.lpOrReraNumber || 'DTCP LP/0192/2025'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('totalVentureExtent')}</span>
                <strong className="text-gray-900 block mt-0.5 font-mono">{activeProject?.extentValue || 5.0} {activeProject?.extentUnit || 'Acres'}</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold block">{t('ventureCostOutlay')}</span>
                <strong className="text-gray-900 block mt-0.5 font-mono">{formatINR(activeProject?.totalEstimatedOutlay || 48000000)}</strong>
              </div>
            </div>

            {/* Quick Actions Shortcuts Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsEnrollInvestmentModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-400 via-[#FFB800] to-amber-500 hover:bg-amber-400 text-gray-950 rounded-2xl font-black text-xs shadow-xs transition-all cursor-pointer border border-amber-600/30"
              >
                <Coins className="w-4 h-4 text-gray-950" />
                <span>{t('enrollInvestmentBtn')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('investments')}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#111827] hover:bg-black text-white rounded-2xl font-black text-xs shadow-xs transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>{t('investmentRecordsHistory')} ({activeProjectInvestments.length})</span>
                {pendingInvestmentApprovalsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-gray-950 text-[10px] font-black">
                    {pendingInvestmentApprovalsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('expenses_approvals')}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-2xl font-black text-xs shadow-xs transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{t('enrollExpenseBtn')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('expenses_approvals')}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs shadow-xs transition-all cursor-pointer"
              >
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>{t('requestDrawBtn')}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('plots')}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-bold text-xs transition-all cursor-pointer border border-gray-300"
              >
                <Grid3X3 className="w-4 h-4" />
                <span>{t('viewPlotsBtn')} ({activePlots.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('statements')}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-bold text-xs transition-all cursor-pointer border border-gray-300"
              >
                <Landmark className="w-4 h-4" />
                <span>{t('viewPassbookBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ENROLL INVESTMENT & INVESTMENT RECORDS HISTORY    */}
      {/* ======================================================== */}
      {activeTab === 'investments' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Bar for Enroll Investment: Executive Action Banner */}
          <div className="bg-gradient-to-r from-[#111827] via-slate-900 to-gray-950 text-white p-6 rounded-3xl shadow-lg border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-8 h-8 rounded-xl bg-amber-400 text-gray-950 flex items-center justify-center font-black shadow-sm">
                  <Coins className="w-4 h-4" />
                </span>
                <span className="text-[10px] uppercase font-black tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                  Consensus Capital Node
                </span>
              </div>
              <h2 className="text-xl font-black text-white leading-tight">
                {t('investmentsBannerTitle')}
              </h2>
              <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                {t('investmentsBannerSubtitle')}
              </p>
            </div>

            {/* Background decoration */}
            <div className="absolute right-0 top-0 w-80 h-full bg-radial from-amber-500/10 to-transparent pointer-events-none" />
          </div>

          {/* 5 Executive Capital KPI Summary Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Tile 1: Total Verified Capital Done */}
            <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">{t('actualInvestment')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-gray-950">
                {formatINR(totalVerifiedInvestedAmount)}
              </div>
              <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                ✓ 100% Cleared &amp; Locked
              </span>
            </div>

            {/* Tile 2: Committed Target Outlay */}
            <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">{t('estimatedInvestment')}</span>
                <Landmark className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-gray-950">
                {formatINR(estimatedInvestment || (activeProject?.totalEstimatedOutlay || 48000000))}
              </div>
              <span className="text-[10px] text-gray-500 font-medium block mt-0.5 truncate">
                {currentPartner?.name ? `${currentPartner.name} Target` : 'Venture Target'}
              </span>
            </div>

            {/* Tile 3: Cash In Hand Infusions */}
            <div className="bg-gradient-to-br from-amber-50 to-white p-4 rounded-3xl border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between text-amber-900 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">💵 Cash Vault</span>
                <Wallet className="w-4 h-4 text-amber-700" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-amber-950">
                {formatINR(totalCashInvestedAmount)}
              </div>
              <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
                {cashInvestmentsCount} Spot Cash Records
              </span>
            </div>

            {/* Tile 4: Bank Wire / RTGS Infusions */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-3xl border border-blue-200 shadow-2xs">
              <div className="flex items-center justify-between text-blue-900 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">🏦 Bank Wires</span>
                <CreditCard className="w-4 h-4 text-blue-700" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-blue-950">
                {formatINR(totalBankInvestedAmount)}
              </div>
              <span className="text-[10px] text-blue-800 font-bold block mt-0.5">
                {bankInvestmentsCount} Escrow / Operations
              </span>
            </div>

            {/* Tile 5: Pending Consortium Sign-offs */}
            <div className={`p-4 rounded-3xl border shadow-2xs ${
              pendingInvestmentApprovalsCount > 0
                ? 'bg-amber-500/10 border-amber-400'
                : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">Consensus Status</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-lg sm:text-xl font-black font-mono text-gray-950 flex items-center gap-1.5">
                <span>{pendingInvestmentApprovalsCount}</span>
                {pendingInvestmentApprovalsCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-gray-950 font-black animate-pulse">
                    Pending
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-600 font-medium block mt-0.5">
                {pendingInvestmentApprovalsCount === 0 ? 'All Signoffs Completed' : 'Awaiting MD / Consortium'}
              </span>
            </div>
          </div>

          {/* Under Investment Records History Section */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-5">
            {/* Header & Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-black text-gray-950 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>{t('investmentRecordsHistory')}</span>
                  <span className="text-xs font-bold text-gray-500">
                    ({filteredInvestments.length} {filteredInvestments.length === 1 ? 'Record' : 'Records'})
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Real-time verifiable register of all partner contributions credited to Bank &amp; Cash Treasury.
                </p>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by partner, UTR, voucher #, purpose..."
                  value={investmentSearch}
                  onChange={(e) => setInvestmentSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-950 focus:bg-white focus:ring-2 focus:ring-[#FFB800] outline-none"
                />
                {investmentSearch && (
                  <button
                    type="button"
                    onClick={() => setInvestmentSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 font-bold text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: 'all', label: `${t('filterAllInvestments')} (${activeProjectInvestments.length})` },
                  { id: 'mine', label: `${t('filterMyInvestments')} (${myInvestmentsCount})` },
                  { id: 'cash', label: `${t('filterCashOnly')} (${cashInvestmentsCount})` },
                  { id: 'bank', label: `${t('filterBankOnly')} (${bankInvestmentsCount})` },
                  { id: 'pending', label: `${t('filterInvPending')} (${pendingInvestmentApprovalsCount})` },
                  { id: 'approved', label: t('filterInvApproved') },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setInvestmentFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      investmentFilter === f.id
                        ? 'bg-[#111827] text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Records Cards List */}
            <div className="space-y-3.5">
              {filteredInvestments.map((inv) => {
                const isCash = inv.accountType === 'cash';
                const isApproved = inv.status === 'approved';
                const partnerObj = partners.find((p) => p.id === inv.partnerId);

                return (
                  <div
                    key={inv.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                      isApproved
                        ? 'bg-white border-gray-200 hover:border-amber-300'
                        : 'bg-amber-50/50 border-amber-300 shadow-xs'
                    }`}
                  >
                    {/* Top Row: Date, Vault/Bank Badge, Reference, Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-500 font-mono">
                          {inv.date}
                        </span>

                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                            isCash
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}
                        >
                          {isCash ? (
                            <>
                              <Wallet className="w-3 h-3 text-amber-800" />
                              <span>💵 Cash Treasury Vault</span>
                            </>
                          ) : (
                            <>
                              <Landmark className="w-3 h-3 text-blue-800" />
                              <span>🏦 Commercial Bank Wire</span>
                            </>
                          )}
                        </span>

                        <span className="text-[10px] font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                          {inv.referenceNo || 'REF-N/A'}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        {isApproved ? (
                          <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>✓ Verified &amp; Approved</span>
                          </span>
                        ) : inv.status === 'rejected' ? (
                          <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-red-100 text-red-900 border border-red-300 flex items-center gap-1">
                            <X className="w-3.5 h-3.5 text-red-700" />
                            <span>✕ Rejected Claim</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-black px-2.5 py-1 rounded-xl bg-amber-200 text-amber-950 border border-amber-400 flex items-center gap-1 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-800" />
                            <span>⏳ Awaiting Consortium Sign-off</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Partner Details, Amount, Purpose, Account */}
                    <div className="py-3 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                      {/* Partner Column (4 cols) */}
                      <div className="md:col-span-4 flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-xs shrink-0 shadow-2xs"
                          style={{ backgroundColor: partnerObj?.avatarColor || '#111827' }}
                        >
                          {(inv.partnerName || 'P')[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <strong className="text-xs font-black text-gray-950 block truncate">
                            {inv.partnerName}
                          </strong>
                          <span className="text-[11px] text-gray-500 font-medium block truncate">
                            {partnerObj?.roleDescription || 'Syndicate Investor'}
                            {partnerObj?.fixedEquityPercent ? ` • ${partnerObj.fixedEquityPercent}% Equity` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Purpose & Channel (5 cols) */}
                      <div className="md:col-span-5 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-black text-gray-950">
                          <Briefcase className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">{inv.purpose}</span>
                        </div>
                        <div className="text-[11px] text-gray-600 flex items-center gap-1.5">
                          <span className="font-semibold text-gray-500">Credited To:</span>
                          <span className="font-bold text-gray-800 truncate">{inv.accountName}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-2">
                          <span>Mode: <strong className="text-gray-700">{inv.paymentMode}</strong></span>
                          {inv.witnessName && (
                            <span>• Witness: <strong className="text-gray-700">{inv.witnessName}</strong></span>
                          )}
                        </div>
                        {inv.notes && (
                          <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-1">
                            &quot;{inv.notes}&quot;
                          </p>
                        )}
                      </div>

                      {/* Amount & Quick Actions (3 cols) */}
                      <div className="md:col-span-3 text-left md:text-right space-y-1.5">
                        <span className="text-[10px] text-gray-500 uppercase font-black block">
                          Invested Capital
                        </span>
                        <div className="text-xl font-black font-mono text-gray-950">
                          {formatINR(inv.amount)}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Consensus & Actions Footer */}
                    <div className="pt-2.5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      {/* Consensus Signatures Info */}
                      <div className="flex items-center gap-2 text-[11px] text-gray-600 flex-wrap">
                        {isApproved ? (
                          <>
                            <span className="flex items-center gap-1 font-bold text-emerald-800">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Authorized: {inv.approvedBy || activeFirm.managingPartnerName}</span>
                            </span>
                            {inv.approvedAt && (
                              <span className="text-gray-400 font-mono text-[10px]">
                                ({inv.approvedAt})
                              </span>
                            )}
                            {inv.coSignatory && (
                              <span className="text-gray-500 font-medium">
                                • Consensus Co-Sign: {inv.coSignatory}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-amber-800 font-medium flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Submitted by {inv.enrolledBy || inv.partnerName} • Requires consensus ratification</span>
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {/* If Pending: Quick Ratify / Reject Buttons */}
                        {!isApproved && inv.status !== 'rejected' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (onApproveIndividualInvestment) {
                                  onApproveIndividualInvestment(
                                    inv.id,
                                    currentPartner?.name
                                      ? `${currentPartner.name} (Consensus Ratifier)`
                                      : `${activeFirm.managingPartnerName} (Managing Partner)`
                                  );
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Ratify &amp; Approve</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const reason = prompt('Please specify rejection remark (optional):');
                                if (onRejectIndividualInvestment) {
                                  onRejectIndividualInvestment(inv.id, reason || undefined);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 font-bold text-xs transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {/* View Voucher Slip */}
                        <button
                          type="button"
                          onClick={() => setSelectedInvestmentForSlip(inv)}
                          className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-gray-600" />
                          <span>Voucher Slip</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredInvestments.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <strong className="text-sm font-black text-gray-950 block">
                      {t('noInvestmentsFound')}
                    </strong>
                    <p className="text-xs text-gray-500 mt-1">
                      No individual investments recorded matching your current query or category filter.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInvestmentSearch('');
                      setInvestmentFilter('all');
                      setIsEnrollInvestmentModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Coins className="w-4 h-4" />
                    <span>+ Enroll New Investment</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: EXPENSES, APPROVALS & DRAWING REQUEST             */}
      {/* ======================================================== */}
      {activeTab === 'expenses_approvals' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black flex items-center gap-2 text-white">
                <Receipt className="w-5 h-5 text-amber-400" />
                <span>{t('expensesBannerTitle')}</span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {t('expensesBannerSubtitle')}
              </p>
            </div>
            {pendingExpenseApprovalsCount > 0 && (
              <span className="px-3 py-1.5 bg-red-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 self-start sm:self-auto">
                <Clock className="w-3.5 h-3.5" />
                <span>{pendingExpenseApprovalsCount} {t('filterPending')}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ACTION 1: ENROLL ON-SITE FIELD EXPENSE */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-gray-950">{t('enrollExpenseTitle')}</h3>
                  <p className="text-[11px] text-gray-500">{t('enrollExpenseDesc')}</p>
                </div>
              </div>

              <form onSubmit={handleExpenseSubmit} className="space-y-3.5 text-xs">
                {/* Payment Source Toggle: Project Bank vs Individual Personal Pocket */}
                <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-300 space-y-2.5">
                  <label className="block text-[10px] font-black text-amber-950 uppercase tracking-wider flex items-center justify-between">
                    <span>{lang === 'te' ? 'చెల్లింపు మూలం (ఎవరు చెల్లించారు)' : 'Payment Source (Who Paid Wages / Outlay)'} *</span>
                    <span className="text-[9px] font-bold text-amber-800">Site Ledger</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExpensePaymentSource('project_bank')}
                      className={`py-2 px-2.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        expensePaymentSource === 'project_bank'
                          ? 'bg-[#111827] text-white border-gray-900 shadow-sm'
                          : 'bg-white text-gray-700 border-amber-200 hover:bg-amber-100/50'
                      }`}
                    >
                      <Landmark className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'te' ? 'ప్రాజెక్ట్ బ్యాంక్ ఖాతా' : 'Project Bank A/C'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpensePaymentSource('individual')}
                      className={`py-2 px-2.5 rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        expensePaymentSource === 'individual'
                          ? 'bg-[#111827] text-white border-gray-900 shadow-sm'
                          : 'bg-white text-gray-700 border-amber-200 hover:bg-amber-100/50'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'te' ? 'వ్యక్తిగత సొంత నిధులు' : 'Individual / Personal Funds'}</span>
                    </button>
                  </div>

                  {expensePaymentSource === 'project_bank' ? (
                    <div>
                      <label className="block text-[10px] font-black text-amber-950 uppercase mb-1 flex items-center justify-between">
                        <span>{lang === 'te' ? 'డెబిట్ చేయవలసిన ప్రాజెక్ట్ బ్యాంక్' : 'Select Project Bank to Debit'} *</span>
                        {firmAccounts.length > 0 && (
                          <span className="font-mono text-[9px] text-amber-900 font-bold">
                            {firmAccounts.find((a) => a.id === expenseBankAccountId)?.bankName || firmAccounts[0]?.bankName}: {formatINR(firmAccounts.find((a) => a.id === expenseBankAccountId)?.currentBalance || firmAccounts[0]?.currentBalance || 0)}
                          </span>
                        )}
                      </label>
                      <select
                        value={expenseBankAccountId || firmAccounts[0]?.id || ''}
                        onChange={(e) => setExpenseBankAccountId(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs font-bold text-gray-950 outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {firmAccounts.length === 0 && (
                          <option value="">Cash Treasury / Site Vault</option>
                        )}
                        {firmAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.bankName} - {acc.accountName} (••••{acc.accountNumber.slice(-4)}) — Bal: {formatINR(acc.currentBalance)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="bg-white/90 p-2 rounded-xl border border-amber-200 text-[10px] text-gray-600 space-y-0.5">
                      <div className="font-bold text-gray-900 flex items-center gap-1">
                        <User className="w-3 h-3 text-amber-600" />
                        <span>Paid from {currentPartner.name}&apos;s Personal Pocket</span>
                      </div>
                      <p className="text-[9px] text-gray-500">
                        {lang === 'te' ? 'బ్యాంక్ నిధులు నేరుగా తగ్గవు. భాగస్వామి రీయింబర్స్‌మెంట్ లెడ్జర్‌లో నమోదు అవుతుంది.' : 'Does not drain project bank account. Reconciled in partner reimbursable equity.'}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    {t('expenseAmount')} *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-gray-500 font-bold">₹</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="e.g. 25000"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl font-mono font-black text-sm text-gray-950 outline-none focus:bg-white focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                      {t('expenseCategory')} *
                    </label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-950 outline-none"
                    >
                      <option value="Labor Wages">Labor Wages</option>
                      <option value="Fuel / Diesel">Fuel / Diesel</option>
                      <option value="Material / Transport">Material / Transport</option>
                      <option value="Surveying & Demarcation">Surveying & Demarcation</option>
                      <option value="DTCP / CRDA Liaison">DTCP / CRDA Liaison</option>
                      <option value="Refreshments / Food">Refreshments / Food</option>
                      <option value="Earthwork / JCB Rental">Earthwork / JCB Rental</option>
                      <option value="Borewell / Electricity">Borewell / Electricity</option>
                      <option value="Emergency Cash Payout">Emergency Cash Payout</option>
                      <option value="Other Site Expense">Other Site Expense</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                      {t('paymentMode')} *
                    </label>
                    <select
                      value={expensePaymentMode}
                      onChange={(e) => setExpensePaymentMode(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-950 outline-none"
                    >
                      <option value="Field Cash Imprest">Field Cash Imprest</option>
                      <option value="UPI / QR Code">UPI / QR Code</option>
                      <option value="Partner Personal Debit Card">Partner Personal Card</option>
                      <option value="Direct Firm Bank Transfer">Direct Firm Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    {t('vendorName')}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sri Balaji Earthmovers / Mason Gang Lead"
                    value={expenseVendor}
                    onChange={(e) => setExpenseVendor(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs text-gray-950 outline-none focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-700 uppercase mb-1">
                    {t('expenseNote')}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of work done on site..."
                    value={expenseNote}
                    onChange={(e) => setExpenseNote(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs text-gray-950 outline-none focus:bg-white"
                  />
                </div>

                {/* Receipt and Voice Memo simulation buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSimulatedReceiptImage('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400&auto=format&fit=crop&q=80');
                      showToast(lang === 'te' ? 'రసీదు ఫోటో జతచేయబడింది!' : 'Receipt photo attached!');
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      simulatedReceiptImage ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{simulatedReceiptImage ? t('receiptAttached') : t('uploadReceipt')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isRecordingVoice) {
                        setIsRecordingVoice(true);
                        setTimeout(() => {
                          setIsRecordingVoice(false);
                          setHasRecordedVoice(true);
                          setVoiceSeconds(14);
                          showToast(lang === 'te' ? 'వాయిస్ నోట్ రికార్డ్ చేయబడింది (14 సెకన్లు)' : 'Voice note recorded (14s)');
                        }, 2000);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      hasRecordedVoice
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : isRecordingVoice
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>{hasRecordedVoice ? t('voiceRecorded') : isRecordingVoice ? t('recordingVoice') : t('voiceNote')}</span>
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#111827] hover:bg-black text-[#FFB800] rounded-xl font-black text-xs shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{t('submitExpenseBtn')}</span>
                </button>
              </form>
            </div>

            {/* ACTION 2: PLACE DRAWING / DIVIDEND REQUEST */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 border-b border-gray-100 pb-3">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-gray-950">{t('placeDrawTitle')}</h3>
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
                    {firmAccounts.length > 0 && (
                      <span className="font-mono text-[9px] text-emerald-800 font-bold">
                        Bal: {formatINR(firmAccounts.find((a) => a.id === drawSourceAccountId)?.currentBalance || firmAccounts[0]?.currentBalance || 0)}
                      </span>
                    )}
                  </label>
                  <select
                    value={drawSourceAccountId || firmAccounts[0]?.id || ''}
                    onChange={(e) => setDrawSourceAccountId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-950 outline-none focus:bg-white focus:border-emerald-500 cursor-pointer"
                  >
                    {firmAccounts.length === 0 && (
                      <option value="">Syndicate Primary Escrow Vault</option>
                    )}
                    {firmAccounts.map((acc) => (
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
                      min="1000"
                      step="5000"
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
                      onChange={(e) => setDrawPayoutMode(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-950 outline-none"
                    >
                      <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                      <option value="Field Vault Cash">Field Vault Cash</option>
                      <option value="Cheque">Bank Cheque / DD</option>
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
              </form>
            </div>
          </div>

          {/* TRACKING SECTIONS: APPROVALS QUEUE & DRAWING HISTORY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Approvals Desk & Submitted Field Expenses List */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <h3 className="font-black text-xs text-gray-950 uppercase tracking-wider flex items-center gap-2">
                  <span>{t('pendingApprovalsTitle')}</span>
                  <span className="text-[10px] text-gray-500 font-normal">({partnerExpenses.length})</span>
                </h3>

                {/* Sub-filter pills */}
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setExpenseFilter('all')}
                    className={`px-2 py-0.5 rounded-lg transition-all ${
                      expenseFilter === 'all' ? 'bg-[#111827] text-white shadow-2xs' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    {t('filterAll')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseFilter('pending')}
                    className={`px-2 py-0.5 rounded-lg transition-all ${
                      expenseFilter === 'pending' ? 'bg-amber-400 text-gray-950 shadow-2xs' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    {t('filterPending')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseFilter('approved')}
                    className={`px-2 py-0.5 rounded-lg transition-all ${
                      expenseFilter === 'approved' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    {t('filterApproved')}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto space-y-2">
                {displayedExpenses.map((exp) => (
                  <div key={exp.id} className="pt-2 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{exp.category}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase shrink-0 ${
                            exp.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exp.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {exp.status === 'approved' ? t('filterApproved') : t('filterPending')}
                        </span>
                        {exp.receiptImage && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">
                            Bill Attached
                          </span>
                        )}
                        {exp.hasVoiceNote && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold">
                            Voice Memo
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 block truncate mt-0.5">
                        {exp.date} • {exp.paymentMode || 'Field Cash'} {exp.vendorName ? `• ${exp.vendorName}` : ''}
                      </span>
                      {exp.note && (
                        <p className="text-[10px] text-gray-600 italic truncate max-w-sm mt-0.5">
                          "{exp.note}"
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <strong className="font-mono text-gray-950 text-xs block">
                        {formatINR(exp.amount)}
                      </strong>

                      {/* Ability for partner to approve if pending and permission provided */}
                      {exp.status === 'pending' && onApproveExpense && (
                        <button
                          type="button"
                          onClick={() => onApproveExpense(exp.id, `${currentPartner.name} (Partner)`)}
                          className="mt-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Check className="w-2.5 h-2.5" />
                          <span>{t('approveBtn')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {displayedExpenses.length === 0 && (
                  <p className="text-gray-400 text-center py-8 text-xs">{t('noExpenses')}</p>
                )}
              </div>
            </div>

            {/* Drawing Requests History */}
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <h3 className="font-black text-xs text-gray-950 uppercase tracking-wider flex items-center justify-between">
                  <span>{t('recentDraws')}</span>
                </h3>
                <span className="text-[10px] text-gray-500 font-normal">({submittedDrawings.length})</span>
              </div>

              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto space-y-2">
                {submittedDrawings.map((draw) => (
                  <div key={draw.id} className="pt-2.5 pb-2 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{draw.purpose}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase shrink-0 ${
                              draw.status === 'cleared'
                                ? 'bg-emerald-100 text-emerald-800'
                                : draw.status === 'approved'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {draw.status === 'cleared'
                              ? '✓ Cleared & Disbursed'
                              : draw.status === 'approved'
                              ? '✓ Approved (Ready to Pay)'
                              : '⏳ Pending Signoff'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span>By: <strong className="text-gray-800">{draw.partnerName}</strong></span>
                          <span>•</span>
                          <span>Mode: <strong className="text-gray-700">{draw.payoutMode}</strong></span>
                          <span>•</span>
                          <span>{draw.requestedAt}</span>
                        </div>
                      </div>
                      <strong className="font-mono text-rose-700 text-sm shrink-0">
                        -{formatINR(draw.amount)}
                      </strong>
                    </div>

                    {/* From & To Account Route */}
                    <div className="bg-gray-50 p-2 rounded-xl text-[10px] space-y-0.5 text-gray-600 border border-gray-200">
                      <div>
                        <span className="font-bold text-gray-700">From Account:</span>{' '}
                        <span className="font-mono text-gray-900">{draw.sourceAccountName || 'Project Treasury Account'}</span>
                      </div>
                      <div>
                        <span className="font-bold text-gray-700">Destination Beneficiary:</span>{' '}
                        <span className="font-mono text-gray-900">{draw.destinationAccountDetails || 'Beneficiary Account On File'}</span>
                      </div>
                    </div>

                    {/* Authorization & Payout Processing Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-[10px] text-gray-500 italic">
                        {draw.disbursedBy
                          ? `Processed by: ${draw.disbursedBy} at ${draw.disbursedAt}`
                          : draw.reviewedBy
                          ? `Approved by: ${draw.reviewedBy}`
                          : 'Awaiting consensus authorization'}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {draw.status === 'pending_approval' && (
                          <button
                            type="button"
                            onClick={() => handleApproveDrawing(draw.id)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            Approve
                          </button>
                        )}
                        {draw.status !== 'cleared' && (
                          <button
                            type="button"
                            onClick={() => handleDisburseDrawing(draw.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                            title="Disburse funds and debit the project bank account immediately"
                          >
                            <DollarSign className="w-3 h-3" />
                            <span>Process Payout &amp; Debit A/C</span>
                          </button>
                        )}
                        {draw.status === 'cleared' && (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Debited to Project Statement</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {submittedDrawings.length === 0 && (
                  <p className="text-gray-400 text-center py-8 text-xs">{t('noDrawings')}</p>
                )}
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
            layoutCalc={
              layoutCalc || {
                totalExtentValue: activeProject?.extentValue || 5.0,
                unit: (activeProject?.extentUnit as any) || 'Acres',
                roadWidth: 30,
                openSpacePercent: 10,
                floorRatePerSqYard: activeProject?.floorRatePerSqYard || 17000,
                expectedRatePerSqYard: 19000,
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
                setActiveTab('expenses_approvals');
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

      {/* Customer Plot Booking Modal for on-spot bookings */}
      {selectedMobilePlot && (
        <CustomerPlotBookingModal
          isOpen={!!selectedMobilePlot}
          plot={selectedMobilePlot}
          project={activeProject}
          firm={activeFirm}
          floorRate={activeProject?.floorRatePerSqYard || 17000}
          firmAccounts={firmAccounts}
          onAddAccountTransaction={onAddAccountTransaction}
          onClose={() => setSelectedMobilePlot(null)}
          onConfirmBooking={(updatedPlot) => {
            if (onUpdatePlot) onUpdatePlot(updatedPlot);
            setSelectedMobilePlot(null);
            showToast(lang === 'te' ? `ప్లాట్ #${updatedPlot.plotNumber} బుకింగ్ నిర్ధారించబడింది!` : `Plot #${updatedPlot.plotNumber} booking confirmed!`);
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
                  {selectedInvestmentForSlip.accountType === 'cash' ? '💵 Cash Treasury' : '🏦 Bank Wire'}
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

              {/* Signatures & Consensus Stamp */}
              <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-4 text-center">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold">Managing Partner Auth</span>
                  <strong className="text-xs text-gray-950 block mt-1">
                    {selectedInvestmentForSlip.approvedBy || activeFirm.managingPartnerName}
                  </strong>
                  <span className="text-[9px] text-emerald-700 font-bold block mt-0.5">
                    {selectedInvestmentForSlip.status === 'approved' ? '✓ Digitally Verified' : '⏳ Pending Ratification'}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold">Consensus Co-Signatory</span>
                  <strong className="text-xs text-gray-950 block mt-1">
                    {selectedInvestmentForSlip.coSignatory || 'Consortium Committee'}
                  </strong>
                  <span className="text-[9px] text-blue-700 font-mono block mt-0.5">
                    Consensus Auth PIN: Verified
                  </span>
                </div>
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
