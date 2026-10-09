import React, { useState, useEffect, useMemo } from 'react';
import {
  Role,
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
  IndividualInvestmentRecord,
  ProjectPartnerShare,
  AuthenticatedAppUser
} from './types';
import {
  INITIAL_FIRMS,
  INITIAL_PROJECTS,
  INITIAL_PLOTS,
  INITIAL_LAYOUT_CALC,
  INITIAL_PROJECT_EXPENSES,
  INITIAL_PRICE_MATRIX,
  INITIAL_APARTMENT_UNITS,
  INITIAL_PARTNERS,
  INITIAL_FIELD_EXPENSES,
  INITIAL_AUDIT_LOGS,
  INITIAL_LIQUOR_SETTLEMENTS,
  INITIAL_PARTNER_STOCK_DRAWS,
  INITIAL_FIRM_ACCOUNTS,
  INITIAL_INDIVIDUAL_INVESTMENTS
} from './data/initialData';
import { Header } from './components/Header';
import { ProductionAuthGate } from './components/auth/ProductionAuthGate';
import { SuperAdminView } from './components/superadmin/SuperAdminView';
import { AccountantDashboard } from './components/accountant/AccountantDashboard';
import { AccountantLoginGate } from './components/accountant/AccountantLoginGate';
import { FieldPartnerMobileView } from './components/fieldpartner/FieldPartnerMobileView';
import { MarketingPlotPortalModal } from './components/marketing/MarketingPlotPortalModal';
import { IndividualInvestmentData } from './components/modals/IndividualInvestmentModal';
import { Building2, Smartphone, Share2 } from 'lucide-react';
import {
  subscribeToCollection,
  subscribeToDocument,
  saveDocument,
  batchSaveDocuments,
  clearFirestoreCollection
} from './services/firestoreSync';
import {
  fetchErpDataFromSql,
  saveFirmToSql,
  deleteFirmFromSql,
  saveProjectToSql,
  deleteProjectFromSql,
  savePlotToSql,
  saveApartmentUnitToSql,
  saveFirmAccountToSql,
  addAccountTransactionToSql,
  saveProjectExpenseToSql,
  savePartnerToSql,
  saveIndividualInvestmentToSql,
  saveFieldExpenseToSql,
  addAuditLogToSql,
  resetSqlData
} from './services/sqlSync';

// LocalStorage persistence helpers to preserve custom firm sectors, projects, and accounts across refresh
const STORAGE_PREFIX = 'syndicate_os_v7_';

function getStoredState<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (!item) return defaultValue;
    return JSON.parse(item);
  } catch {
    return defaultValue;
  }
}

function setStoredState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in sandbox
  }
}

// Initial URL params & Clean Slate helper
interface InitialParams {
  role: Role | null;
  firmId: string | null;
  partnerId: string | null;
  standalone: boolean;
  portal: string | null;
  venture: string | null;
}

function getInitialParams(): InitialParams {
  if (typeof window === 'undefined') return { role: null, firmId: null, partnerId: null, standalone: false, portal: null, venture: null };
  try {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role') as Role | null;
    const firmIdParam = params.get('firmId');
    const partnerIdParam = params.get('partnerId');
    const standaloneParam = params.get('standalone') === 'true' || params.get('mode') === 'standalone';
    const portalParam = params.get('portal') || (params.get('view') === 'marketing' ? 'marketing' : null);
    const ventureParam = params.get('venture') || params.get('projectId');
    return {
      role: roleParam && ['super_admin', 'accountant', 'field_partner'].includes(roleParam) ? roleParam : null,
      firmId: firmIdParam,
      partnerId: partnerIdParam,
      standalone: standaloneParam,
      portal: portalParam,
      venture: ventureParam,
    };
  } catch {
    return { role: null, firmId: null, partnerId: null, standalone: false, portal: null, venture: null };
  }
}

// Sanitizers to clear any legacy auto-generated demo buyer bookings from user-created custom firms
function sanitizePlotsList(raw: Plot[]): Plot[] {
  return raw.map((p) => {
    if (p.firmId && p.firmId !== 'firm-1' && (p.buyerName === 'K. Rama Mohana Rao' || p.buyerName === 'B. Venkata Ramana')) {
      return {
        ...p,
        status: 'available',
        buyerName: undefined,
        buyerPhone: undefined,
        advanceReceived: undefined,
        paymentMilestone: undefined,
      };
    }
    return p;
  });
}

function sanitizeUnitsList(raw: ApartmentUnit[]): ApartmentUnit[] {
  return raw.map((u) => {
    if (u.firmId && u.firmId !== 'firm-1' && u.buyerName === 'Ch. Prasad' && u.advanceReceived === 1500000) {
      return {
        ...u,
        status: 'available',
        buyerName: undefined,
        buyerPhone: undefined,
        advanceReceived: 0,
        currentMilestone: undefined,
      };
    }
    return u;
  });
}

function isCleanSlateStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + 'clean_slate') === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const initialParams = getInitialParams();
  // Fresh mode by default: Database starts clean, users create their own firms
  const isFirmTargeted = Boolean(initialParams.firmId);
  const cleanSlate = true;

  // Standalone tester view mode (locks/hides other roles)
  const [isStandalone, setIsStandalone] = useState<boolean>(initialParams.standalone);

  // Marketing & Channel Partner Public Portal Mode
  const [isMarketingPortal, setIsMarketingPortal] = useState<boolean>(() => initialParams.portal === 'marketing');

  // Top Role Navigation state - defaults to super_admin so user can immediately onboard firms
  const [currentRole, setCurrentRole] = useState<Role>(() => {
    if (initialParams.role) return initialParams.role;
    return 'super_admin';
  });

  // Multi-Tenant Platform State (Persisted directly in Cloud SQL PostgreSQL)
  const [firms, setFirms] = useState<TenantFirm[]>(() => []);
  const [selectedFirmId, setSelectedFirmId] = useState<string>(() => initialParams.firmId || '');

  // Project Ventures State (Stored in Cloud SQL)
  const [projects, setProjects] = useState<Project[]>(() => []);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => initialParams.venture || '');

  // Dual Ledger Mode: "internal_syndicate" vs "official_tax"
  const [ledgerMode, setLedgerMode] = useState<LedgerMode>('internal_syndicate');

  // Sector A: Open Plotting Data (Stored in Cloud SQL)
  const [plots, setPlots] = useState<Plot[]>(() => []);
  const [layoutCalc, setLayoutCalc] = useState<LayoutCalculation>(() => ({
    totalExtentValue: 0,
    unit: 'Acres',
    roadWidth: 30,
    openSpacePercent: 10,
    floorRatePerSqYard: 0,
  }));
  const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>(() => []);

  // Sector B: Apartment Construction Data (Stored in Cloud SQL)
  const [apartmentUnits, setApartmentUnits] = useState<ApartmentUnit[]>(() => []);
  const [pricingMatrix, setPricingMatrix] = useState<ApartmentPricingMatrix>(INITIAL_PRICE_MATRIX);

  // Syndicate Capital & Dynamic Equity (Stored in Cloud SQL)
  const [partners, setPartners] = useState<SyndicatePartner[]>(() => []);
  const [splitMode, setSplitMode] = useState<EquitySplitMode>('fixed');
  const [fieldExpenses, setFieldExpenses] = useState<FieldExpenseLog[]>(() => []);

  // Production Authenticated User (Super Admin / Accountant / Partner)
  const [currentUser, setCurrentUser] = useState<AuthenticatedAppUser | null>(() => {
    try {
      const saved = localStorage.getItem('syndicate_production_auth_session');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Field Partner Authenticated Session (Scoped strictly to chosen firm)
  const [fieldPartnerSession, setFieldPartnerSession] = useState<{
    firmId: string;
    partnerId: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('syndicate_production_auth_session');
      if (saved) {
        const u = JSON.parse(saved);
        if ((u.role === 'field_partner' || u.role === 'managing_partner') && u.firmId && u.partnerId) {
          return { firmId: u.firmId, partnerId: u.partnerId };
        }
      }
    } catch {}
    if (initialParams.firmId && initialParams.partnerId) {
      return { firmId: initialParams.firmId, partnerId: initialParams.partnerId };
    }
    return null;
  });

  // Firm Accountant Authenticated Session (Scoped strictly to chosen firm)
  const [accountantSession, setAccountantSession] = useState<{
    firmId: string;
    accountantName: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('syndicate_production_auth_session');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role === 'accountant' && u.firmId) {
          return { firmId: u.firmId, accountantName: u.name };
        }
      }
    } catch {}
    try {
      const saved = sessionStorage.getItem('syndicate_accountant_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!initialParams.firmId || parsed.firmId === initialParams.firmId) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  // Effective partner session computed from currentUser or fieldPartnerSession
  const effectivePartnerSession = useMemo(() => {
    if (currentUser && (currentUser.role === 'field_partner' || currentUser.role === 'managing_partner')) {
      return {
        firmId: currentUser.firmId || selectedFirmId || firms[0]?.id || '',
        partnerId: currentUser.partnerId || `partner-${currentUser.phone}`,
      };
    }
    return fieldPartnerSession;
  }, [currentUser, selectedFirmId, firms, fieldPartnerSession]);

  const handleLoginSuccess = (user: AuthenticatedAppUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('syndicate_production_auth_session', JSON.stringify(user));
    } catch {}

    if (user.role === 'super_admin') {
      setCurrentRole('super_admin');
    } else if (user.role === 'accountant') {
      setCurrentRole('accountant');
      if (user.firmId) {
        setSelectedFirmId(user.firmId);
        const session = { firmId: user.firmId, accountantName: user.name };
        setAccountantSession(session);
        try {
          sessionStorage.setItem('syndicate_accountant_session', JSON.stringify(session));
        } catch {}
      }
    } else {
      setCurrentRole('field_partner');
      if (user.firmId && user.partnerId) {
        setSelectedFirmId(user.firmId);
        setFieldPartnerSession({
          firmId: user.firmId,
          partnerId: user.partnerId,
        });
      }
    }
    showToast(`✓ Welcome, ${user.name}! Authenticated into your dashboard.`);
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem('syndicate_production_auth_session');
      sessionStorage.clear();
    } catch {}
    setCurrentUser(null);
    setAccountantSession(null);
    setFieldPartnerSession(null);
    showToast('Signed out of session.');
  };

  // Immutable Audit Logs & Compliance Trail (Stored in Cloud SQL)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => []);

  // Sector C: Liquor Vends Settlements & Partner Stock Draws
  const [liquorSettlements, setLiquorSettlements] = useState<LiquorDailySettlement[]>(() => []);
  const [partnerStockDraws, setPartnerStockDraws] = useState<PartnerStockDraw[]>(() => []);

  // Project Bank Accounts & Multi-Bank Treasury Ledgers (Stored in Cloud SQL)
  const [firmAccounts, setFirmAccounts] = useState<FirmAccount[]>(() => []);

  // Individual Partner Investments (Dual Cash & Bank Contributions - Stored in Cloud SQL)
  const [individualInvestments, setIndividualInvestments] = useState<IndividualInvestmentRecord[]>(() => []);

  // Clean address bar: No internal role or firm query parameters exposed to testers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('role') || url.searchParams.has('firmId') || url.searchParams.has('standalone')) {
        url.searchParams.delete('role');
        url.searchParams.delete('firmId');
        url.searchParams.delete('standalone');
        window.history.replaceState({}, '', url.pathname);
      }
    } catch {
      // Ignore URL sync errors
    }
  }, []);

  // One-time startup sweep: Purge any legacy browser localStorage cache so that the Cloud SQL database is the sole source of truth
  useEffect(() => {
    try {
      const keys = [
        'firms', 'selectedFirmId', 'projects', 'selectedProjectId',
        'firmAccounts', 'plots', 'apartmentUnits', 'partners',
        'fieldExpenses', 'auditLogs', 'individualInvestments', 'clean_slate'
      ];
      keys.forEach((k) => localStorage.removeItem(STORAGE_PREFIX + k));
    } catch {}
  }, []);

  // Initial and reactive load from Cloud SQL PostgreSQL database
  useEffect(() => {
    let isMounted = true;
    async function loadFromCloudSql() {
      try {
        const sqlData = await fetchErpDataFromSql();
        if (!isMounted || !sqlData) return;
        const cloudFirms = sqlData.firms || [];
        setFirms(cloudFirms);
        if (cloudFirms.length > 0) {
          if (initialParams.firmId && cloudFirms.some((f) => f.id === initialParams.firmId)) {
            setSelectedFirmId(initialParams.firmId);
          } else {
            setSelectedFirmId((prev) => (prev && cloudFirms.some((f) => f.id === prev) ? prev : cloudFirms[0].id));
          }
        } else {
          setSelectedFirmId('');
        }

        const cloudProjects = sqlData.projects || [];
        setProjects(cloudProjects);
        if (cloudProjects.length > 0) {
          if (initialParams.venture && cloudProjects.some((p) => p.id === initialParams.venture)) {
            setSelectedProjectId(initialParams.venture);
          } else {
            setSelectedProjectId((prev) => (prev && cloudProjects.some((p) => p.id === prev) ? prev : cloudProjects[0].id));
          }
        } else {
          setSelectedProjectId('');
        }

        setPlots(sqlData.plots || []);
        setApartmentUnits(sqlData.apartmentUnits || []);
        setFirmAccounts(sqlData.firmAccounts || []);
        setProjectExpenses(sqlData.projectExpenses || []);
        
        const cloudPartners = [...(sqlData.partners || [])];
        const existingPartnerIds = new Set(cloudPartners.map((p) => p.id));
        const existingPartnerNames = new Set(cloudPartners.map((p) => p.name.trim().toLowerCase()));

        // Also harvest any partners registered directly inside projects
        (sqlData.projects || []).forEach((proj) => {
          (proj.partners || []).forEach((ps: any) => {
            if (!existingPartnerIds.has(ps.partnerId) && !existingPartnerNames.has(ps.name.trim().toLowerCase())) {
              existingPartnerIds.add(ps.partnerId);
              existingPartnerNames.add(ps.name.trim().toLowerCase());
              const harvestedPartner: SyndicatePartner = {
                id: ps.partnerId,
                firmId: proj.firmId,
                name: ps.name,
                phone: ps.phone || '+91 ',
                roleDescription: ps.roleInProject || 'Investor Partner',
                avatarColor: ps.avatarColor || 'bg-indigo-600',
                initialCapital: ps.initialCapital || 0,
                actualInvested: ps.actualInvested || 0,
                fixedEquityPercent: ps.equityPercent || 0,
                drawings: ps.drawings || 0,
                shareOfFieldExpenses: ps.shareOfFieldExpenses || 0,
                userRole: ps.roleInProject?.toLowerCase().includes('managing') ? 'managing_partner' : 'field_partner',
                userStatus: 'active',
                pinCode: '1234',
                dailySpendingLimit: 50000,
              };
              cloudPartners.push(harvestedPartner);
              savePartnerToSql(harvestedPartner);
            }
          });
        });
        setPartners(cloudPartners);
        setIndividualInvestments(sqlData.individualInvestments || []);
        setFieldExpenses(sqlData.fieldExpenses || []);
        setAuditLogs(sqlData.auditLogs || []);
      } catch (err) {
        console.error('Failed to load ERP state from Cloud SQL:', err);
      }
    }
    loadFromCloudSql();
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time Firestore Cloud Synchronization across multiple devices / locations
  useEffect(() => {
    let hasLoadedFirms = false;
    let isCleanSlateActive = cleanSlate;

    // Listen to global system state (clean slate vs demo mode across all devices)
    const unsubMeta = subscribeToDocument<{ cleanSlate?: boolean; hasCustomData?: boolean }>('system_meta', 'global_state', (meta) => {
      if (meta?.cleanSlate === true && !meta?.hasCustomData) {
        isCleanSlateActive = true;
        setFirms([]);
        setSelectedFirmId('');
        setProjects([]);
        setSelectedProjectId('');
        setPlots([]);
        setApartmentUnits([]);
        setPartners([]);
        setFieldExpenses([]);
        setFirmAccounts([]);
        setIndividualInvestments([]);
        setAuditLogs([]);
        try {
          localStorage.setItem(STORAGE_PREFIX + 'clean_slate', 'true');
        } catch {}
      } else if (meta?.cleanSlate === false || meta?.hasCustomData) {
        isCleanSlateActive = false;
        try {
          localStorage.removeItem(STORAGE_PREFIX + 'clean_slate');
        } catch {}
      }
    });

    const unsubFirms = subscribeToCollection<TenantFirm>('firms', (cloudFirms) => {
      if (cloudFirms && cloudFirms.length > 0) {
        setFirms((prev) => {
          const merged = [...prev];
          cloudFirms.forEach((cf) => {
            const idx = merged.findIndex((f) => f.id === cf.id);
            if (idx >= 0) merged[idx] = { ...merged[idx], ...cf };
            else merged.push(cf);
          });
          return merged;
        });
        setSelectedFirmId((prev) => {
          if (initialParams.firmId && cloudFirms.some((f) => f.id === initialParams.firmId)) {
            return initialParams.firmId;
          }
          return prev && cloudFirms.some((f) => f.id === prev) ? prev : cloudFirms[0].id;
        });
      }
      hasLoadedFirms = true;
    });

    const unsubProjects = subscribeToCollection<Project>('projects', (cloudProjects) => {
      if (cloudProjects && cloudProjects.length > 0) {
        setProjects((prev) => {
          const merged = [...prev];
          cloudProjects.forEach((cp) => {
            const idx = merged.findIndex((p) => p.id === cp.id);
            if (idx >= 0) merged[idx] = { ...merged[idx], ...cp };
            else merged.push(cp);
          });
          return merged;
        });
        if (initialParams.venture && cloudProjects.some((p) => p.id === initialParams.venture)) {
          setSelectedProjectId(initialParams.venture);
        }
      }
    });

    const unsubPartners = subscribeToCollection<SyndicatePartner>('partners', (cloudPartners) => {
      if (cloudPartners && cloudPartners.length > 0) {
        setPartners((prev) => {
          const merged = [...cloudPartners];
          const seenIds = new Set(merged.map((p) => String(p.id)));
          const seenNames = new Set(merged.map((p) => p.name.trim().toLowerCase()));
          prev.forEach((p) => {
            if (!seenIds.has(String(p.id)) && !seenNames.has(p.name.trim().toLowerCase())) {
              merged.push(p);
              seenIds.add(String(p.id));
              seenNames.add(p.name.trim().toLowerCase());
            }
          });
          return merged;
        });
      }
    });

    const unsubAccounts = subscribeToCollection<FirmAccount>('firmAccounts', (cloudAccounts) => {
      if (!cloudAccounts || cloudAccounts.length === 0) return;
      setFirmAccounts((prev) => {
        const merged = [...prev];
        cloudAccounts.forEach((ca) => {
          const idx = merged.findIndex((a) => a.id === ca.id);
          if (idx >= 0) {
            const prevTxns = merged[idx].recentTransactions || [];
            const caTxns = ca.recentTransactions || [];
            const txMap = new Map<string, FirmAccountTransaction>();
            prevTxns.forEach((t) => txMap.set(t.id, t));
            caTxns.forEach((t) => txMap.set(t.id, t));
            const allTx = Array.from(txMap.values()).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            const totalCreds = allTx.filter((t) => t.type === 'credit' && t.status !== 'pending').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const totalDebs = allTx.filter((t) => t.type === 'debit' && t.status !== 'pending').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const bal = (Number(merged[idx].openingBalance) || 0) + totalCreds - totalDebs;
            merged[idx] = {
              ...merged[idx],
              ...ca,
              currentBalance: allTx.length > 0 ? bal : (ca.currentBalance ?? merged[idx].currentBalance),
              recentTransactions: allTx,
            };
          } else {
            merged.push(ca);
          }
        });
        return merged;
      });
    });

    const unsubInvestments = subscribeToCollection<IndividualInvestmentRecord>(
      'individualInvestments',
      (cloudInvestments) => {
        if (cloudInvestments && cloudInvestments.length > 0) {
          setIndividualInvestments(cloudInvestments);
        }
      }
    );

    const unsubExpenses = subscribeToCollection<FieldExpenseLog>('fieldExpenses', (cloudExpenses) => {
      if (cloudExpenses && cloudExpenses.length > 0) {
        setFieldExpenses(cloudExpenses);
      }
    });

    const unsubPlots = subscribeToCollection<Plot>('plots', (cloudPlots) => {
      if (cloudPlots && cloudPlots.length > 0) {
        setPlots(sanitizePlotsList(cloudPlots));
      }
    });

    const unsubUnits = subscribeToCollection<ApartmentUnit>('apartmentUnits', (cloudUnits) => {
      if (cloudUnits && cloudUnits.length > 0) {
        setApartmentUnits(sanitizeUnitsList(cloudUnits));
      }
    });

    const unsubAudit = subscribeToCollection<AuditLogEntry>('auditLogs', (cloudAudit) => {
      if (cloudAudit && cloudAudit.length > 0) {
        setAuditLogs(cloudAudit);
      }
    });

    return () => {
      unsubMeta();
      unsubFirms();
      unsubProjects();
      unsubPartners();
      unsubAccounts();
      unsubInvestments();
      unsubExpenses();
      unsubPlots();
      unsubUnits();
      unsubAudit();
    };
  }, []);

  const handleAddFirmAccount = (newAccount: FirmAccount) => {
    setFirmAccounts((prev) => [newAccount, ...prev.filter((a) => a.id !== newAccount.id)]);
    saveDocument('firmAccounts', newAccount.id, newAccount);
    saveFirmAccountToSql(newAccount);
    recordAudit(
      'FIRM_ACCOUNT_REGISTERED',
      `Registered new ${newAccount.accountType.replace('_', ' ').toUpperCase()} account "${newAccount.accountName}" (${newAccount.bankName} - A/C ${newAccount.accountNumber}) with initial ledger balance of ₹${newAccount.openingBalance.toLocaleString('en-IN')}.`,
      'Internal Syndicate'
    );
    showToast(`Registered firm account: ${newAccount.accountName}`);
  };

  const handleUpdateFirmAccount = (updatedAccount: FirmAccount) => {
    setFirmAccounts((prev) =>
      prev.map((acc) => (acc.id === updatedAccount.id ? updatedAccount : acc))
    );
    saveDocument('firmAccounts', updatedAccount.id, updatedAccount);
    saveFirmAccountToSql(updatedAccount);
  };

  const handleAddAccountTransaction = (accountId: string, tx: FirmAccountTransaction) => {
    // 1. Locate or construct the target account
    const existing = firmAccounts.find((a) => a.id === accountId);
    const existingTxns: FirmAccountTransaction[] = existing?.recentTransactions || [];
    const filteredTxns = existingTxns.filter((t) => t.id !== tx.id);

    // 2. Compute accurate balance from opening balance and all verified transactions
    const candidateTxns = [tx, ...filteredTxns];
    const totalCredits = candidateTxns
      .filter((t) => t.type === 'credit' && t.status !== 'pending')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalDebits = candidateTxns
      .filter((t) => t.type === 'debit' && t.status !== 'pending')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    const openingBal = existing ? (Number(existing.openingBalance) || 0) : 0;
    const accurateBalance = openingBal + totalCredits - totalDebits;

    const txWithBalance: FirmAccountTransaction = {
      ...tx,
      balanceAfter: accurateBalance,
    };
    const finalTxns = [txWithBalance, ...filteredTxns];

    const targetAccount: FirmAccount = existing
      ? {
          ...existing,
          currentBalance: accurateBalance,
          recentTransactions: finalTxns,
        }
      : {
          id: accountId,
          firmId: selectedFirmId || currentFirm?.id || '',
          linkedProjectId: selectedProjectId,
          accountName: accountId.includes('cash') ? 'Project Cash Safe Vault & Imprest' : 'Syndicate Capital Pool Account',
          bankName: accountId.includes('cash') ? 'Cash in Hand (Safe Vault)' : 'Commercial Bank Account',
          accountNumber: accountId.includes('cash') ? 'CASH-VAULT-01' : 'BANK-ACC-01',
          accountType: accountId.includes('cash') ? 'field_petty_cash' : 'rera_escrow',
          ifscCode: accountId.includes('cash') ? 'CASH0000001' : 'BANK0001',
          branchName: 'Main Site / Registered Office',
          city: 'Amaravati / Regional Hub',
          isPrimary: false,
          status: 'active',
          authorizedSignatories: [currentFirm?.managingPartnerName || 'Managing Partner'],
          createdDate: new Date().toISOString().split('T')[0],
          currentBalance: accurateBalance,
          openingBalance: 0,
          notes: 'Auto-provisioned syndicate depository for partner capital inflows and disbursements.',
          recentTransactions: finalTxns,
        };

    // 3. Update React state immediately
    setFirmAccounts((prev) => {
      const existsInPrev = prev.some((a) => a.id === accountId);
      if (existsInPrev) {
        return prev.map((a) => (a.id === accountId ? targetAccount : a));
      } else {
        return [targetAccount, ...prev];
      }
    });

    // 4. Persist to Cloud SQL and Firestore
    saveDocument('firmAccounts', accountId, targetAccount);
    saveFirmAccountToSql(targetAccount);
    addAccountTransactionToSql(txWithBalance);

    recordAudit(
      'ACCOUNT_TRANSACTION_RECORDED',
      `${tx.type === 'credit' ? 'Credit / Deposit' : 'Debit / Payout'} of ₹${tx.amount.toLocaleString('en-IN')} recorded in A/C ID ${accountId}. Ref: ${tx.referenceNo || 'N/A'}. New Balance: ₹${accurateBalance.toLocaleString('en-IN')}`,
      'Internal Syndicate'
    );
    showToast(`Recorded ${tx.type === 'credit' ? 'deposit' : 'payout'} of ₹${tx.amount.toLocaleString('en-IN')}`);
  };

  // Notification / Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Helper to record immutable audit log
  const recordAudit = (
    action: string,
    notes: string,
    ledgerType: 'Internal Syndicate' | 'Official Tax Books' | 'System Governance' = ledgerMode === 'internal_syndicate' ? 'Internal Syndicate' : 'Official Tax Books'
  ) => {
    const newEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      actorName: currentRole === 'accountant' ? 'K. S. Narayana (Accountant)' : currentRole === 'super_admin' ? 'Super Admin (System Owner)' : 'Field Partner',
      actorRole: currentRole === 'accountant' ? 'Accountant' : currentRole === 'super_admin' ? 'Super Admin' : 'Field Partner',
      action,
      deviceId: 'WEB-SESSION (SHA-256 SIGNED)',
      notes,
      ledgerType,
      verified: true,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
    saveDocument('auditLogs', newEntry.id, newEntry);
    addAuditLogToSql(newEntry);
  };

  // Reset demo data
  const handleRestoreDemoData = () => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + 'clean_slate');
      const keys = [
        'firms', 'selectedFirmId', 'projects', 'selectedProjectId',
        'firmAccounts', 'plots', 'apartmentUnits', 'partners',
        'fieldExpenses', 'auditLogs', 'individualInvestments'
      ];
      keys.forEach((k) => localStorage.removeItem(STORAGE_PREFIX + k));
    } catch {
      // Ignore
    }
    setFirms(INITIAL_FIRMS);
    setSelectedFirmId(INITIAL_FIRMS[0].id);
    setProjects(INITIAL_PROJECTS);
    setSelectedProjectId(INITIAL_PROJECTS[0].id);
    setPlots(INITIAL_PLOTS);
    setLayoutCalc(INITIAL_LAYOUT_CALC);
    setProjectExpenses(INITIAL_PROJECT_EXPENSES);
    setApartmentUnits(INITIAL_APARTMENT_UNITS);
    setPricingMatrix(INITIAL_PRICE_MATRIX);
    setPartners(INITIAL_PARTNERS);
    setSplitMode('fixed');
    setFieldExpenses(INITIAL_FIELD_EXPENSES);
    setFieldPartnerSession(null);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setLiquorSettlements(INITIAL_LIQUOR_SETTLEMENTS);
    setPartnerStockDraws(INITIAL_PARTNER_STOCK_DRAWS);
    setFirmAccounts(INITIAL_FIRM_ACCOUNTS);
    setIndividualInvestments(INITIAL_INDIVIDUAL_INVESTMENTS);
    setCurrentRole('accountant');

    // Cloud SQL & Firestore Sync
    resetSqlData(false);
    saveDocument('system_meta', 'global_state', { cleanSlate: false, updatedAt: new Date().toISOString() });
    batchSaveDocuments('firms', INITIAL_FIRMS);
    batchSaveDocuments('projects', INITIAL_PROJECTS);
    batchSaveDocuments('partners', INITIAL_PARTNERS);
    batchSaveDocuments('firmAccounts', INITIAL_FIRM_ACCOUNTS);
    batchSaveDocuments('plots', INITIAL_PLOTS);
    batchSaveDocuments('apartmentUnits', INITIAL_APARTMENT_UNITS);
    batchSaveDocuments('individualInvestments', INITIAL_INDIVIDUAL_INVESTMENTS);

    showToast('Platform data reset to initial AP/Telangana syndicate state.');
  };

  // Wipe all mock data: Clean Slate for client testing
  const handleWipeMockData = () => {
    try {
      const keys = [
        'firms', 'selectedFirmId', 'projects', 'selectedProjectId',
        'firmAccounts', 'plots', 'apartmentUnits', 'partners',
        'fieldExpenses', 'auditLogs', 'individualInvestments'
      ];
      keys.forEach((k) => localStorage.removeItem(STORAGE_PREFIX + k));
      localStorage.setItem(STORAGE_PREFIX + 'clean_slate', 'true');
    } catch {
      // Ignore
    }

    // Reset sessions
    sessionStorage.removeItem('syndicate_accountant_session');
    sessionStorage.removeItem('syndicate_partner_session');
    setAccountantSession(null);
    setFieldPartnerSession(null);

    setFirms([]);
    setSelectedFirmId('');
    setProjects([]);
    setSelectedProjectId('');
    setPlots([]);
    setApartmentUnits([]);
    setPartners([]);
    setFieldExpenses([]);
    setFirmAccounts([]);
    setIndividualInvestments([]);
    setAuditLogs([]);
    setLiquorSettlements([]);
    setPartnerStockDraws([]);
    setCurrentRole('super_admin');

    // Cloud SQL & Firestore Sync
    resetSqlData(true);
    saveDocument('system_meta', 'global_state', { cleanSlate: true, hasCustomData: false, updatedAt: new Date().toISOString() });
    clearFirestoreCollection('firms');
    clearFirestoreCollection('projects');
    clearFirestoreCollection('partners');
    clearFirestoreCollection('firmAccounts');
    clearFirestoreCollection('individualInvestments');
    clearFirestoreCollection('fieldExpenses');
    clearFirestoreCollection('plots');
    clearFirestoreCollection('apartmentUnits');
    clearFirestoreCollection('auditLogs');

    showToast('🧹 All mock data wiped across devices. Clean slate ready! You are in Super Admin to create your first firm.');
  };

  // Firm switch handler - automatically switches active project to that firm's project matching active sectors
  const handleFirmChange = (newFirmId: string) => {
    setSelectedFirmId(newFirmId);
    if (accountantSession && accountantSession.firmId !== newFirmId) {
      setAccountantSession(null);
      try {
        sessionStorage.removeItem('syndicate_accountant_session');
      } catch {}
    }
    if (fieldPartnerSession && fieldPartnerSession.firmId !== newFirmId) {
      setFieldPartnerSession(null);
      try {
        sessionStorage.removeItem('syndicate_partner_session');
      } catch {}
    }
    const targetFirm = firms.find((f) => f.id === newFirmId);
    const firmProjects = projects.filter(
      (p) => p.firmId === newFirmId && (!targetFirm || targetFirm.sectors.includes(p.sector))
    );
    if (firmProjects.length > 0) {
      setSelectedProjectId(firmProjects[0].id);
    } else {
      setSelectedProjectId('');
    }
  };

  // Project Creation Handler (invoked from Accountant Dashboard "+ Add Projects")
  const handleAddProject = (
    newProject: Project,
    initialPlots?: Plot[],
    initialUnits?: ApartmentUnit[]
  ) => {
    setProjects((prev) => [newProject, ...prev]);
    setSelectedProjectId(newProject.id);
    saveDocument('projects', newProject.id, newProject);
    saveProjectToSql(newProject);

    if (initialPlots && initialPlots.length > 0) {
      setPlots((prev) => [...initialPlots, ...prev]);
      batchSaveDocuments('plots', initialPlots);
      initialPlots.forEach((pl) => savePlotToSql(pl));
    }
    if (initialUnits && initialUnits.length > 0) {
      setApartmentUnits((prev) => [...initialUnits, ...prev]);
      batchSaveDocuments('apartmentUnits', initialUnits);
      initialUnits.forEach((u) => saveApartmentUnitToSql(u));
    }

    // Automatically synchronize any new partner shares into master syndicate partners if needed
    if (newProject.partners && newProject.partners.length > 0) {
      setPartners((prevPartners) => {
        const existingIds = new Set(prevPartners.map((p) => p.id));
        const existingNames = new Set(prevPartners.map((p) => p.name.toLowerCase()));
        const toAdd: SyndicatePartner[] = [];

        newProject.partners.forEach((p) => {
          if (!existingIds.has(p.partnerId) && !existingNames.has(p.name.toLowerCase())) {
            const partnerEntry: SyndicatePartner = {
              id: p.partnerId,
              firmId: newProject.firmId,
              name: p.name,
              phone: p.phone,
              roleDescription: p.roleInProject,
              avatarColor: p.avatarColor,
              initialCapital: p.initialCapital,
              fixedEquityPercent: p.equityPercent,
              drawings: p.drawings,
              shareOfFieldExpenses: p.shareOfFieldExpenses,
              userRole: 'field_partner',
              userStatus: 'active',
              pinCode: '1234',
              dailySpendingLimit: 50000,
            };
            toAdd.push(partnerEntry);
            savePartnerToSql(partnerEntry);
          }
        });
        if (toAdd.length > 0) {
          batchSaveDocuments('partners', toAdd);
          return [...prevPartners, ...toAdd];
        }
        return prevPartners;
      });
    }

    recordAudit(
      `Venture Project Created: [${newProject.code}]`,
      `Accountant added project "${newProject.name}" (Extent: ${newProject.extentValue} ${newProject.extentUnit}, Road: ${newProject.roadWidth || 30}ft, Outlay: ₹${(newProject.totalEstimatedOutlay || 0).toLocaleString('en-IN')}) with ${newProject.partners.length} assigned partners.`
    );
    showToast(`Project "${newProject.name}" created with ${newProject.partners.length} assigned partners.`);
  };

  // Super Admin: Add new firm
  const handleAddFirm = (newFirm: TenantFirm) => {
    setFirms((prev) => [newFirm, ...prev]);
    setSelectedFirmId(newFirm.id);
    saveDocument('firms', newFirm.id, newFirm);
    saveFirmToSql(newFirm);
    saveDocument('system_meta', 'global_state', { cleanSlate: false, hasCustomData: true, updatedAt: new Date().toISOString() });

    // Reset accountant session so tester must enter credentials
    sessionStorage.removeItem('syndicate_accountant_session');
    setAccountantSession(null);

    recordAudit(
      `Tenant Provisioned: [${newFirm.code}]`,
      `Created firm ${newFirm.name} with isolated schema partition. Accountant tester can now configure bank accounts and projects.`,
      'System Governance'
    );
    showToast(`New syndicate firm "${newFirm.name}" provisioned with isolated schema.`);
  };

  // Super Admin: Update firm details (e.g. sectors, name, location, etc.)
  const handleUpdateFirm = (updatedFirm: TenantFirm) => {
    setFirms((prev) => prev.map((f) => (f.id === updatedFirm.id ? updatedFirm : f)));
    saveDocument('firms', updatedFirm.id, updatedFirm);
    saveFirmToSql(updatedFirm);

    // Also synchronize projects belonging to this firm: if a project's sector is no longer in the firm's active sectors, align it!
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.firmId === updatedFirm.id && !updatedFirm.sectors.includes(p.sector)) {
          const aligned = {
            ...p,
            sector: updatedFirm.sectors[0] || 'real_estate_open_plotting',
          };
          saveDocument('projects', aligned.id, aligned);
          saveProjectToSql(aligned);
          return aligned;
        }
        return p;
      });
      return next;
    });

    // If the updated firm is the currently selected firm, ensure selectedProjectId is in a valid active sector
    if (updatedFirm.id === selectedFirmId) {
      const firmValidProjects = projects.filter(
        (p) => p.firmId === updatedFirm.id && updatedFirm.sectors.includes(p.sector)
      );
      if (firmValidProjects.length > 0 && !firmValidProjects.some((p) => p.id === selectedProjectId)) {
        setSelectedProjectId(firmValidProjects[0].id);
      }
    }
    recordAudit(
      `Tenant Firm Updated: [${updatedFirm.code}]`,
      `Product Owner updated firm "${updatedFirm.name}". Active Sectors: ${updatedFirm.sectors.join(', ')} | Status: ${updatedFirm.status.toUpperCase()}`,
      'System Governance'
    );
    showToast(`Syndicate firm "${updatedFirm.name}" updated successfully.`);
  };

  // Super Admin: Toggle firm active/inactive status
  const handleToggleFirmStatus = (firmId: string) => {
    let updatedFirmToSave: TenantFirm | undefined;
    setFirms((prev) => {
      const target = prev.find((f) => f.id === firmId);
      if (!target) return prev;
      const newStatus: TenantFirm['status'] = target.status === 'active' ? 'inactive' : 'active';
      const next = prev.map((f) => (f.id === firmId ? { ...f, status: newStatus } : f));
      updatedFirmToSave = next.find((f) => f.id === firmId);
      return next;
    });
    if (updatedFirmToSave) {
      saveDocument('firms', firmId, updatedFirmToSave);
      saveFirmToSql(updatedFirmToSave);
      const newStatus = updatedFirmToSave.status === 'active' ? 'ACTIVE' : 'INACTIVE';
      recordAudit(
        `Tenant Lifecycle Changed: [${updatedFirmToSave.code}]`,
        `Product Owner toggled status of firm "${updatedFirmToSave.name}" to ${newStatus}.`,
        'System Governance'
      );
      showToast(`Firm "${updatedFirmToSave.name}" marked as ${newStatus}.`);
    }
  };

  // Super Admin: Toggle feature flags (and synchronize enabled sectors)
  const handleUpdateFirmFlags = (firmId: string, flags: Partial<TenantFirm['featureFlags']>) => {
    let updatedTargetFirm: TenantFirm | undefined;
    setFirms((prev) => {
      const next = prev.map((f) => {
        if (f.id !== firmId) return f;
        let newSectors = [...f.sectors];
        if (flags.enableApartmentMatrix !== undefined) {
          if (flags.enableApartmentMatrix && !newSectors.includes('real_estate_construction')) {
            newSectors.push('real_estate_construction');
          } else if (!flags.enableApartmentMatrix) {
            newSectors = newSectors.filter((s) => s !== 'real_estate_construction');
          }
        }
        if (flags.enablePlotGrid !== undefined) {
          if (flags.enablePlotGrid && !newSectors.includes('real_estate_open_plotting')) {
            newSectors.push('real_estate_open_plotting');
          } else if (!flags.enablePlotGrid) {
            newSectors = newSectors.filter((s) => s !== 'real_estate_open_plotting');
          }
        }
        const updated = {
          ...f,
          sectors: newSectors,
          featureFlags: { ...f.featureFlags, ...flags },
        };
        updatedTargetFirm = updated;
        return updated;
      });

      // If currently selected firm was updated, ensure selected project is valid
      if (firmId === selectedFirmId) {
        const targetFirm = next.find((f) => f.id === firmId);
        if (targetFirm) {
          const firmValidProjects = projects.filter(
            (p) => p.firmId === firmId && targetFirm.sectors.includes(p.sector)
          );
          if (firmValidProjects.length > 0 && !firmValidProjects.some((p) => p.id === selectedProjectId)) {
            setSelectedProjectId(firmValidProjects[0].id);
          }
        }
      }

      return next;
    });

    if (updatedTargetFirm) {
      saveDocument('firms', firmId, updatedTargetFirm);
      saveFirmToSql(updatedTargetFirm);
      const targetFirm = updatedTargetFirm;
      setProjects((prev) => {
        const next = prev.map((p) => {
          if (p.firmId === firmId && !targetFirm.sectors.includes(p.sector)) {
            const aligned = {
              ...p,
              sector: targetFirm.sectors[0] || 'real_estate_open_plotting',
            };
            saveDocument('projects', aligned.id, aligned);
            saveProjectToSql(aligned);
            return aligned;
          }
          return p;
        });
        return next;
      });
    }

    recordAudit(
      'Tenant Feature Flags Modified',
      `Updated module flags for firm ${firmId}: ${JSON.stringify(flags)}`,
      'System Governance'
    );
    showToast('Tenant feature flags and active sectors synchronized.');
  };

  // Open Plotting updates
  const handleUpdatePlot = (updatedPlot: Plot) => {
    setPlots(plots.map((p) => (p.id === updatedPlot.id ? updatedPlot : p)));
    saveDocument('plots', updatedPlot.id, updatedPlot);
    savePlotToSql(updatedPlot);
    recordAudit(
      `Plot Updated: ${updatedPlot.plotNumber}`,
      `Status: ${updatedPlot.status.toUpperCase()} | Rate: ₹${updatedPlot.ratePerSqYard}/Sq.Yd | Buyer: ${updatedPlot.buyerName || 'None'}${updatedPlot.discountApprovedBy ? ` | Discount Signoff: ${updatedPlot.discountApprovedBy}` : ''}`
    );
    showToast(`${updatedPlot.plotNumber} updated: Status is now ${updatedPlot.status.toUpperCase()}.`);
  };

  const handleUpdateLayoutCalc = (newCalc: LayoutCalculation) => {
    setLayoutCalc(newCalc);
  };

  const handleAddProjectExpense = (newExpense: ProjectExpense) => {
    setProjectExpenses([...projectExpenses, newExpense]);
    saveProjectExpenseToSql(newExpense);
    recordAudit(
      `Venture Cost Head Added: ${newExpense.category}`,
      `Budgeted: ₹${newExpense.estimatedBudget.toLocaleString('en-IN')} | Actual Spent: ₹${newExpense.actualSpent.toLocaleString('en-IN')} | Notes: ${newExpense.vendorNotes}`
    );
    showToast(`Cost head "${newExpense.category}" added to project budget tracker.`);
  };

  const handleUpdateProjectExpense = (updatedExpense: ProjectExpense) => {
    setProjectExpenses(
      projectExpenses.map((e) => (e.id === updatedExpense.id ? updatedExpense : e))
    );
    saveProjectExpenseToSql(updatedExpense);
  };

  // Construction updates
  const handleUpdateApartmentUnit = (updatedUnit: ApartmentUnit) => {
    setApartmentUnits(apartmentUnits.map((u) => (u.id === updatedUnit.id ? updatedUnit : u)));
    saveDocument('apartmentUnits', updatedUnit.id, updatedUnit);
    saveApartmentUnitToSql(updatedUnit);
    recordAudit(
      `Apartment Unit Updated: Flat #${updatedUnit.unitNumber}`,
      `Floor ${updatedUnit.floor} | Status: ${updatedUnit.status.toUpperCase()} | Base Rate: ₹${updatedUnit.baseRate}/Sft | Buyer: ${updatedUnit.buyerName || 'None'}`
    );
    showToast(`Unit ${updatedUnit.unitNumber} updated: Status is now ${updatedUnit.status.toUpperCase()}.`);
  };

  const handleUpdatePricingMatrix = (matrix: ApartmentPricingMatrix) => {
    setPricingMatrix(matrix);
    recordAudit(
      'Apartment Pricing Matrix Recalculated',
      `Base Rate: ₹${matrix.baseSqFtRate}/Sft | Floor Rise: +₹${matrix.floorRisePerFloor} | East: +₹${matrix.eastPremium}`
    );
    showToast('Apartment price matrix recalculated across all tower units.');
  };

  // Syndicate partner updates
  const handleUpdatePartner = (updatedPartner: SyndicatePartner) => {
    const cleanUpdatedPhone = (updatedPartner.phone || '').replace(/\D/g, '').slice(-10);

    setPartners((prev) => {
      const idx = prev.findIndex(
        (p) =>
          String(p.id) === String(updatedPartner.id) ||
          (cleanUpdatedPhone && (p.phone || '').replace(/\D/g, '').slice(-10) === cleanUpdatedPhone) ||
          p.name.trim().toLowerCase() === updatedPartner.name.trim().toLowerCase()
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...updatedPartner };
        return next;
      }
      return [...prev, updatedPartner];
    });

    saveDocument('partners', updatedPartner.id, updatedPartner);
    savePartnerToSql(updatedPartner);

    // Synchronize into all projects partner list where this partner exists
    setProjects((prevProjects) =>
      prevProjects.map((proj) => {
        let hasMatch = false;
        const updatedPartnerShares = (proj.partners || []).map((ps) => {
          const matchId = String(ps.partnerId) === String(updatedPartner.id);
          const matchName = ps.name.trim().toLowerCase() === updatedPartner.name.trim().toLowerCase();
          const matchPhone = cleanUpdatedPhone && (ps.phone || '').replace(/\D/g, '').slice(-10) === cleanUpdatedPhone;

          if (matchId || matchName || matchPhone) {
            hasMatch = true;
            return {
              ...ps,
              name: updatedPartner.name,
              phone: updatedPartner.phone,
              equityPercent: updatedPartner.fixedEquityPercent,
              initialCapital: updatedPartner.initialCapital,
              actualInvested: updatedPartner.actualInvested,
              drawings: updatedPartner.drawings,
              shareOfFieldExpenses: updatedPartner.shareOfFieldExpenses,
              userStatus: updatedPartner.userStatus,
              pinCode: updatedPartner.pinCode,
              mustChangePin: updatedPartner.mustChangePin,
            };
          }
          return ps;
        });

        if (hasMatch) {
          const updatedProj = {
            ...proj,
            partners: updatedPartnerShares,
            totalInvestedCapital: updatedPartnerShares.reduce((sum, p) => sum + (p.actualInvested || 0), 0),
          };
          saveDocument('projects', updatedProj.id, updatedProj);
          saveProjectToSql(updatedProj);
          return updatedProj;
        }
        return proj;
      })
    );

    recordAudit(
      `Partner Capital/Draw Adjusted: ${updatedPartner.name}`,
      `Capital: ₹${updatedPartner.initialCapital.toLocaleString('en-IN')} | Drawings: ₹${updatedPartner.drawings.toLocaleString('en-IN')} | Share: ${updatedPartner.fixedEquityPercent}%`
    );
    showToast(`Ledger adjusted for ${updatedPartner.name}.`);
  };

  // Firm Accountant: Provision firm member as a field partner user
  const handleAddPartnerMember = (newPartner: SyndicatePartner) => {
    const partnerWithFirm: SyndicatePartner = {
      ...newPartner,
      firmId: selectedFirmId,
    };
    setPartners((prev) => [partnerWithFirm, ...prev]);
    saveDocument('partners', partnerWithFirm.id, partnerWithFirm);
    savePartnerToSql(partnerWithFirm);

    // If an active project is currently selected, also assign this partner into that project's partner shares
    if (selectedProjectId) {
      setProjects((prev) =>
        prev.map((proj) => {
          if (proj.id === selectedProjectId) {
            const alreadyAssigned = (proj.partners || []).some(
              (p) => p.partnerId === partnerWithFirm.id || p.name.toLowerCase() === partnerWithFirm.name.toLowerCase()
            );
            if (!alreadyAssigned) {
              const newShare: ProjectPartnerShare = {
                partnerId: partnerWithFirm.id,
                name: partnerWithFirm.name,
                phone: partnerWithFirm.phone,
                roleInProject: partnerWithFirm.roleDescription || 'Syndicate Partner',
                equityPercent: partnerWithFirm.fixedEquityPercent || 0,
                initialCapital: partnerWithFirm.initialCapital || 0,
                drawings: partnerWithFirm.drawings || 0,
                shareOfFieldExpenses: partnerWithFirm.shareOfFieldExpenses || 0,
                avatarColor: partnerWithFirm.avatarColor || 'bg-indigo-600',
              };
              const updatedProj = { ...proj, partners: [...(proj.partners || []), newShare] };
              saveDocument('projects', updatedProj.id, updatedProj);
              saveProjectToSql(updatedProj);
              return updatedProj;
            }
          }
          return proj;
        })
      );
    }

    const firm = firms.find((f) => f.id === selectedFirmId) || firms[0];
    recordAudit(
      `Firm Member User Added: [${partnerWithFirm.name}]`,
      `Accountant added ${partnerWithFirm.name} (${partnerWithFirm.roleDescription}) under firm [${firm.code} - ${firm.name}]. Mobile PIN: ${partnerWithFirm.pinCode || '1234'} | Daily Limit: ₹${(partnerWithFirm.dailySpendingLimit || 50000).toLocaleString('en-IN')}`,
      'Internal Syndicate'
    );
    showToast(`Field Partner "${partnerWithFirm.name}" added under ${firm.name}.`);
  };

  // Field Partner: Authentication & session handlers
  const handleFieldPartnerLogin = (firmId: string, partnerId: string) => {
    setFieldPartnerSession({ firmId, partnerId });
    setSelectedFirmId(firmId);
    const firm = firms.find((f) => f.id === firmId);
    const partner = partners.find((p) => p.id === partnerId);
    if (firm && partner) {
      recordAudit(
        `Field Partner Logged In: [${partner.name}]`,
        `${partner.name} logged into ${firm.name} (${firm.code}) ground operations via 4-digit PIN authentication.`,
        'Internal Syndicate'
      );
      showToast(`Welcome ${partner.name.split(':')[0]}! Logged into ${firm.name}.`);
    }
  };

  const handleFieldPartnerLogout = () => {
    setFieldPartnerSession(null);
    showToast('Signed out of Field Partner session. Select a firm to sign in.');
  };

  const handleToggleSplitMode = (mode: EquitySplitMode) => {
    setSplitMode(mode);
    recordAudit(
      'Surplus Equity Split Formula Toggled',
      `Formula changed to ${mode === 'fixed' ? 'Fixed Agreed Share %' : 'Proportional to Capital Estimated Invest Value'}.`
    );
    showToast(`Equity split formula switched to ${mode === 'fixed' ? 'Fixed Agreed Share %' : 'Proportional to Capital Estimated Invest Value'}.`);
  };

  // Dual Ledger Toggle handler
  const handleToggleLedgerMode = (mode: LedgerMode) => {
    setLedgerMode(mode);
    recordAudit(
      `Active Ledger View Toggled: ${mode === 'internal_syndicate' ? 'Internal Syndicate Ledger' : 'Official Tax Books'}`,
      `Auditor switched views. Official books filter cash transactions and present bank-cleared receipts.`,
      mode === 'internal_syndicate' ? 'Internal Syndicate' : 'Official Tax Books'
    );
    showToast(`Switched view to ${mode === 'internal_syndicate' ? 'Internal Syndicate Confidential Ledger' : 'Official Tax Books (Tally Reconciled)'}.`);
  };

  // Field Expense Actions
  const handleApproveExpense = (expenseId: string, signoff?: string) => {
    const expense = fieldExpenses.find((e) => e.id === expenseId);
    if (!expense) return;

    const updatedExpense: FieldExpenseLog = {
      ...expense,
      status: 'approved',
      reconciledDate: new Date().toISOString().split('T')[0],
      reconciledBy: signoff ? `Multi-Partner Consensus [${signoff}]` : 'K. S. Narayana (Accountant)',
      approvalSignatures: signoff ? [signoff] : ['K. S. Narayana (Accountant)'],
    };
    saveDocument('fieldExpenses', expenseId, updatedExpense);
    saveFieldExpenseToSql(updatedExpense);

    setFieldExpenses(
      fieldExpenses.map((e) => (e.id === expenseId ? updatedExpense : e))
    );

    // Reconcile into Partner's verified share of field expenses
    setPartners(
      partners.map((p) => {
        if (p.id === expense.partnerId) {
          const updatedPartner = { ...p, shareOfFieldExpenses: p.shareOfFieldExpenses + expense.amount };
          saveDocument('partners', updatedPartner.id, updatedPartner);
          savePartnerToSql(updatedPartner);
          return updatedPartner;
        }
        return p;
      })
    );

    // Reconcile into Project Expenses actual spent
    setProjectExpenses((prev) => {
      const matchIndex = prev.findIndex(
        (pe) =>
          (expense.category === 'Labor Wages' && pe.category === 'Layout Earthwork') ||
          (expense.category === 'Fuel' && pe.category === 'Layout Earthwork') ||
          (expense.category === 'Material' && pe.category === 'BT/CC Roads')
      );
      if (matchIndex >= 0) {
        const updated = [...prev];
        updated[matchIndex] = {
          ...updated[matchIndex],
          actualSpent: updated[matchIndex].actualSpent + expense.amount,
        };
        saveProjectExpenseToSql(updated[matchIndex]);
        return updated;
      }
      return prev;
    });

    // If expense was paid from project bank account, debit the bank account
    if (expense.paymentSource === 'project_bank') {
      const targetAcc =
        firmAccounts.find((a) => a.id === expense.bankAccountId) ||
        firmAccounts.find((a) => a.firmId === selectedFirmId) ||
        firmAccounts[0];
      if (targetAcc) {
        const debitTx: FirmAccountTransaction = {
          id: `tx-exp-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          accountId: targetAcc.id,
          date: expense.date || new Date().toISOString().split('T')[0],
          type: 'debit',
          amount: expense.amount,
          description: `Site Expense: ${expense.category} - ${expense.note}`,
          referenceNo: `EXP-${expense.id.slice(-6).toUpperCase()}`,
          category: 'vendor_payout',
          partnerName: expense.partnerName,
          projectName: projects.find((p) => p.id === (expense.projectId || selectedProjectId))?.name || 'Project Venture',
          balanceAfter: targetAcc.currentBalance - expense.amount,
          enrolledBy: expense.enrolledBy || expense.partnerName,
          approvedBy: signoff || currentFirm?.managingPartnerName || 'Managing Partner',
          status: 'approved',
          paymentMode: expense.paymentMode || 'Bank Transfer',
          notes: expense.vendorName ? `Paid to: ${expense.vendorName}` : undefined,
        };
        handleAddAccountTransaction(targetAcc.id, debitTx);
      }
    }

    recordAudit(
      `Expense Approved: ₹${expense.amount.toLocaleString('en-IN')}`,
      `Category: ${expense.category} | Logged by: ${expense.partnerName}${signoff ? ` | High-Value Dual Signoff: ${signoff}` : ''}`
    );

    showToast(`Expense of ₹${expense.amount.toLocaleString('en-IN')} approved and reconciled into partner ledger.`);
  };

  const handleRejectExpense = (expenseId: string) => {
    const expense = fieldExpenses.find((e) => e.id === expenseId);
    if (expense) {
      const rejected = { ...expense, status: 'rejected' as const };
      saveDocument('fieldExpenses', expenseId, rejected);
      saveFieldExpenseToSql(rejected);
    }
    setFieldExpenses(
      fieldExpenses.map((e) =>
        e.id === expenseId ? { ...e, status: 'rejected' } : e
      )
    );
    if (expense) {
      recordAudit(
        `Expense Rejected: ₹${expense.amount.toLocaleString('en-IN')}`,
        `Rejected claim for ${expense.category} submitted by ${expense.partnerName}`
      );
    }
    showToast('Expense flagged as rejected.');
  };

  // Field Partner: Submit new expense
  const handleSubmitFieldExpense = (newExpense: FieldExpenseLog, bankAccountId?: string) => {
    setFieldExpenses([newExpense, ...fieldExpenses]);
    saveDocument('fieldExpenses', newExpense.id, newExpense);
    saveFieldExpenseToSql(newExpense);

    // If submitted directly as approved and paymentSource is project_bank, debit bank immediately
    if (newExpense.status === 'approved' && newExpense.paymentSource === 'project_bank') {
      const targetAccId = bankAccountId || newExpense.bankAccountId;
      const targetAcc =
        firmAccounts.find((a) => a.id === targetAccId) ||
        firmAccounts.find((a) => a.firmId === selectedFirmId) ||
        firmAccounts[0];
      if (targetAcc) {
        const debitTx: FirmAccountTransaction = {
          id: `tx-exp-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          accountId: targetAcc.id,
          date: newExpense.date || new Date().toISOString().split('T')[0],
          type: 'debit',
          amount: newExpense.amount,
          description: `Site Expense: ${newExpense.category} - ${newExpense.note}`,
          referenceNo: `EXP-${newExpense.id.slice(-6).toUpperCase()}`,
          category: 'vendor_payout',
          partnerName: newExpense.partnerName,
          projectName: projects.find((p) => p.id === (newExpense.projectId || selectedProjectId))?.name || 'Project Venture',
          balanceAfter: targetAcc.currentBalance - newExpense.amount,
          enrolledBy: newExpense.enrolledBy || newExpense.partnerName,
          approvedBy: newExpense.approvedByPartners?.[0] || currentFirm?.managingPartnerName || 'Managing Partner',
          status: 'approved',
          paymentMode: newExpense.paymentMode || 'Bank Transfer',
          notes: newExpense.vendorName ? `Paid to: ${newExpense.vendorName}` : undefined,
        };
        handleAddAccountTransaction(targetAcc.id, debitTx);
      }
    }

    recordAudit(
      newExpense.status === 'approved'
        ? `Project Expense Enrolled: ₹${newExpense.amount.toLocaleString('en-IN')}`
        : `Spot Field Expense Dispatched: ₹${newExpense.amount.toLocaleString('en-IN')}`,
      `Logged by ${newExpense.partnerName} | Category: ${newExpense.category} | Source: ${newExpense.paymentSource === 'project_bank' ? 'Project Bank Account' : 'Individual Personal Funds'}`
    );
    showToast(
      newExpense.status === 'approved'
        ? `✓ Expense ₹${newExpense.amount.toLocaleString('en-IN')} approved & debited to project statement!`
        : `Spot field expense ₹${newExpense.amount.toLocaleString('en-IN')} dispatched to Accountant verification queue.`
    );
  };

  // Sector C: Liquor Vends handlers
  const handleAddLiquorSettlement = (settlement: LiquorDailySettlement) => {
    setLiquorSettlements([settlement, ...liquorSettlements]);
    recordAudit(
      `Liquor Daily Settlement Logged: ${settlement.counterName}`,
      `Date: ${settlement.date} | Gross Sales: ₹${settlement.grossSalesValue.toLocaleString('en-IN')} | Cash: ₹${settlement.cashCollected.toLocaleString('en-IN')} | UPI: ₹${settlement.upiCollected.toLocaleString('en-IN')} | Shortage: ₹${settlement.counterShortage}`
    );
    showToast(`Counter settlement logged for ${settlement.counterName}.`);
  };

  const handleAddStockDraw = (draw: PartnerStockDraw) => {
    setPartnerStockDraws([draw, ...partnerStockDraws]);

    // Automatically deduct from partner's cash drawings in equity ledger
    if (draw.deductedFromPayout) {
      setPartners(
        partners.map((p) =>
          p.id === draw.partnerId
            ? { ...p, drawings: p.drawings + draw.retailValuation }
            : p
        )
      );
    }

    recordAudit(
      `Partner Stock Draw Deducted: ₹${draw.retailValuation.toLocaleString('en-IN')}`,
      `Partner: ${draw.partnerName} | Items: ${draw.stockDetails} (${draw.bottlesCount} bottles) | Added to drawings debit.`
    );
    showToast(`Stock draw of ₹${draw.retailValuation.toLocaleString('en-IN')} deducted from ${draw.partnerName}'s payout balance.`);
  };

  // Individual Partner Investment Handlers (Dual Cash & Bank)
  const handleRecordIndividualInvestment = (data: IndividualInvestmentData) => {
    const newRecord: IndividualInvestmentRecord = {
      id: `inv-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      firmId: selectedFirmId,
      projectId: selectedProjectId,
      partnerId: data.partnerId,
      partnerName: data.partnerName,
      amount: data.amount,
      accountId: data.accountId,
      accountName: data.accountName,
      accountType: data.accountType,
      date: data.date,
      purpose: data.purpose,
      paymentMode: data.paymentMode,
      referenceNo: data.referenceNo,
      notes: data.notes,
      status: data.status,
      enrolledBy: data.partnerName,
      approvedBy: data.approvedBy,
      approvedAt: data.approvedAt,
      coSignatory: data.coSignatory,
      witnessName: data.witnessName,
      cashVaultLocation: data.cashVaultLocation,
    };

    setIndividualInvestments((prev) => [newRecord, ...prev]);
    saveDocument('individualInvestments', newRecord.id, newRecord);
    saveIndividualInvestmentToSql(newRecord);

    if (data.status === 'approved') {
      // 1. Credit the bank or cash account
      const targetAcc = firmAccounts.find((a) => a.id === data.accountId);
      const balanceAfter = targetAcc ? targetAcc.currentBalance + data.amount : data.amount;
      const creditTx: FirmAccountTransaction = {
        id: `tx-inv-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        accountId: data.accountId,
        date: data.date,
        type: 'credit',
        amount: data.amount,
        description: `Partner Capital: ${data.purpose} by ${data.partnerName}`,
        referenceNo: data.referenceNo,
        category: 'partner_capital',
        partnerName: data.partnerName,
        projectName: projects.find((p) => p.id === selectedProjectId)?.name || 'Project Venture',
        balanceAfter,
        enrolledBy: data.partnerName,
        approvedBy: data.approvedBy || currentFirm?.managingPartnerName || 'Proprietor',
        status: 'approved',
        paymentMode: data.paymentMode,
        notes: data.notes,
      };
      handleAddAccountTransaction(data.accountId, creditTx);

      // 2. Update partner's actualInvested across partners and project partners
      const targetPartner = partners.find(
        (p) => String(p.id) === String(data.partnerId) || p.name.trim().toLowerCase() === data.partnerName.trim().toLowerCase()
      );
      if (targetPartner) {
        const currentInv = targetPartner.actualInvested !== undefined ? targetPartner.actualInvested : 0;
        const newActual = currentInv + data.amount;
        handleUpdatePartner({
          ...targetPartner,
          actualInvested: newActual,
        });
      }

      // Also ensure project.partners has updated actualInvested and totalInvestedCapital
      setProjects((prevProjects) =>
        prevProjects.map((proj) => {
          if (proj.id === selectedProjectId) {
            const updatedShares = proj.partners.map((ps) => {
              if (String(ps.partnerId) === String(data.partnerId) || ps.name.trim().toLowerCase() === data.partnerName.trim().toLowerCase()) {
                const currentPsInv = ps.actualInvested !== undefined ? ps.actualInvested : 0;
                return {
                  ...ps,
                  actualInvested: currentPsInv + data.amount,
                };
              }
              return ps;
            });
            const updatedProj = {
              ...proj,
              partners: updatedShares,
              totalInvestedCapital: updatedShares.reduce((sum, p) => sum + (p.actualInvested || 0), 0),
            };
            saveDocument('projects', updatedProj.id, updatedProj);
            saveProjectToSql(updatedProj);
            return updatedProj;
          }
          return proj;
        })
      );

      showToast(`✓ Investment of ₹${data.amount.toLocaleString('en-IN')} by ${data.partnerName} recorded & credited!`);
    } else {
      showToast(`⏳ Investment of ₹${data.amount.toLocaleString('en-IN')} by ${data.partnerName} submitted for Managing Partner sign-off!`);
    }

    recordAudit(
      data.status === 'approved' ? 'RECORD_INDIVIDUAL_INVESTMENT' : 'SUBMIT_INVESTMENT_APPROVAL',
      `Individual Investment of ₹${data.amount.toLocaleString('en-IN')} (${data.accountType === 'cash' ? 'Cash Vault' : 'Bank'}) for ${data.purpose}. Status: ${data.status.toUpperCase()}`,
      'Internal Syndicate'
    );
  };

  const handleApproveIndividualInvestment = (investmentId: string, approverName: string) => {
    const inv = individualInvestments.find((i) => i.id === investmentId);
    if (!inv || inv.status === 'approved') return;

    const approvedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const approvedInv = { ...inv, status: 'approved' as const, approvedBy: approverName, approvedAt };
    saveDocument('individualInvestments', investmentId, approvedInv);
    saveIndividualInvestmentToSql(approvedInv);
    setIndividualInvestments((prev) =>
      prev.map((i) =>
        i.id === investmentId ? approvedInv : i
      )
    );

    // Credit the account
    const targetAcc = firmAccounts.find((a) => a.id === inv.accountId);
    const balanceAfter = targetAcc ? targetAcc.currentBalance + inv.amount : inv.amount;
    const creditTx: FirmAccountTransaction = {
      id: `tx-inv-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      accountId: inv.accountId,
      date: inv.date,
      type: 'credit',
      amount: inv.amount,
      description: `Partner Capital: ${inv.purpose} by ${inv.partnerName}`,
      referenceNo: inv.referenceNo,
      category: 'partner_capital',
      partnerName: inv.partnerName,
      projectName: projects.find((p) => p.id === (inv.projectId || selectedProjectId))?.name || 'Project Venture',
      balanceAfter,
      enrolledBy: inv.enrolledBy,
      approvedBy: approverName,
      status: 'approved',
      paymentMode: inv.paymentMode,
      notes: inv.notes,
    };
    handleAddAccountTransaction(inv.accountId, creditTx);

    // Update partner's actualInvested across partners and project partners
    const targetPartner = partners.find(
      (p) => String(p.id) === String(inv.partnerId) || p.name.trim().toLowerCase() === inv.partnerName.trim().toLowerCase()
    );
    if (targetPartner) {
      const currentInv = targetPartner.actualInvested !== undefined ? targetPartner.actualInvested : 0;
      const newActual = currentInv + inv.amount;
      handleUpdatePartner({
        ...targetPartner,
        actualInvested: newActual,
      });
    }

    setProjects((prevProjects) =>
      prevProjects.map((proj) => {
        if (proj.id === (inv.projectId || selectedProjectId)) {
          const updatedShares = proj.partners.map((ps) => {
            if (String(ps.partnerId) === String(inv.partnerId) || ps.name.trim().toLowerCase() === inv.partnerName.trim().toLowerCase()) {
              const currentPsInv = ps.actualInvested !== undefined ? ps.actualInvested : 0;
              return {
                ...ps,
                actualInvested: currentPsInv + inv.amount,
              };
            }
            return ps;
          });
          const updatedProj = {
            ...proj,
            partners: updatedShares,
            totalInvestedCapital: updatedShares.reduce((sum, p) => sum + (p.actualInvested || 0), 0),
          };
          saveDocument('projects', updatedProj.id, updatedProj);
          saveProjectToSql(updatedProj);
          return updatedProj;
        }
        return proj;
      })
    );

    showToast(`✓ Investment of ₹${inv.amount.toLocaleString('en-IN')} approved by ${approverName}!`);
    recordAudit(
      'APPROVE_INDIVIDUAL_INVESTMENT',
      `Investment of ₹${inv.amount.toLocaleString('en-IN')} by ${inv.partnerName} approved by ${approverName}. Credited to ${inv.accountName}`,
      'Internal Syndicate'
    );
  };

  const handleRejectIndividualInvestment = (investmentId: string, reason?: string) => {
    const inv = individualInvestments.find((i) => i.id === investmentId);
    if (inv) {
      const rejectedInv = {
        ...inv,
        status: 'rejected' as const,
        rejectionReason: reason || 'Rejected during consensus review'
      };
      saveDocument('individualInvestments', investmentId, rejectedInv);
      saveIndividualInvestmentToSql(rejectedInv);
    }
    setIndividualInvestments((prev) =>
      prev.map((i) =>
        i.id === investmentId
          ? { ...i, status: 'rejected', rejectionReason: reason || 'Rejected during consensus review' }
          : i
      )
    );
    showToast('Investment claim marked as rejected.');
    recordAudit('REJECT_INDIVIDUAL_INVESTMENT', `Investment claim ${investmentId} rejected: ${reason || 'Consensus review'}`);
  };

  const currentFirm = firms.find((f) => f.id === selectedFirmId) || (!initialParams.firmId ? firms[0] : undefined);
  const pendingExpensesCount = fieldExpenses.filter((e) => e.status === 'pending').length;

  // Direct Public Marketing & Channel Partner Portal View
  if (isMarketingPortal) {
    const marketingFirm =
      firms.find((f) => f.id === initialParams.firmId) ||
      firms.find((f) => f.id === selectedFirmId) ||
      firms[0];
    const marketingProject =
      projects.find(
        (p) =>
          p.firmId === marketingFirm?.id &&
          (p.id === initialParams.venture || p.id === selectedProjectId)
      ) ||
      projects.find((p) => p.firmId === marketingFirm?.id) ||
      projects[0];
    const marketingPlots = marketingFirm
      ? plots.filter(
          (p) =>
            p.firmId === marketingFirm.id &&
            (!marketingProject || p.projectId === marketingProject.id || (!p.projectId && marketingFirm.id === 'firm-1'))
        )
      : [];

    if (!marketingFirm) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
              <Share2 className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-black text-white">Venture Marketing Portal</h3>
            <p className="text-xs text-slate-400">Loading venture plot layout and firm data...</p>
          </div>
        </div>
      );
    }

    return (
      <MarketingPlotPortalModal
        isOpen={true}
        isStandalone={true}
        onClose={() => {
          setIsMarketingPortal(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('portal');
          url.searchParams.delete('venture');
          window.history.replaceState({}, '', url.toString());
        }}
        project={marketingProject}
        firm={marketingFirm}
        plots={marketingPlots}
        floorRate={marketingProject?.floorRatePerSqYard || 17000}
        onSubmitProposal={(plotId, proposal) => {
          const targetPlot = plots.find((p) => p.id === plotId);
          if (targetPlot) {
            handleUpdatePlot({
              ...targetPlot,
              marketingRequest: proposal,
            });
            showToast(`✓ Booking proposal submitted for Plot #${targetPlot.plotNumber}!`);
          }
        }}
      />
    );
  }

  // Synthesized partners for active firm (merging firm-level partners + project-assigned partners)
  const currentFirmPartners = useMemo(() => {
    if (!currentFirm) return [];
    const list: SyndicatePartner[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    partners
      .filter((p) => p.firmId === currentFirm.id)
      .forEach((p) => {
        list.push(p);
        seenIds.add(String(p.id));
        seenNames.add(p.name.trim().toLowerCase());
      });

    projects
      .filter((p) => p.firmId === currentFirm.id)
      .forEach((proj) => {
        (proj.partners || []).forEach((ps) => {
          if (!seenIds.has(String(ps.partnerId)) && !seenNames.has(ps.name.trim().toLowerCase())) {
            seenIds.add(String(ps.partnerId));
            seenNames.add(ps.name.trim().toLowerCase());
            list.push({
              id: ps.partnerId,
              firmId: currentFirm.id,
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

    return list;
  }, [currentFirm, partners, projects]);

  if (!currentUser) {
    return (
      <ProductionAuthGate
        onLoginSuccess={handleLoginSuccess}
        availableFirmsCount={firms.length}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Top Header with Role Switcher & Tenant Info */}
      <Header
        currentRole={currentRole}
        onRoleChange={(role) => {
          if (currentUser?.role === 'super_admin') {
            setCurrentRole(role);
          }
        }}
        firms={firms}
        selectedFirmId={selectedFirmId}
        onFirmChange={handleFirmChange}
        onWipeMockData={handleWipeMockData}
        onRestoreDemoData={handleRestoreDemoData}
        pendingExpensesCount={pendingExpensesCount}
        firmAccountsCount={firmAccounts.filter((a) => a.firmId === selectedFirmId).length}
        isStandalone={isStandalone}
        onToggleStandalone={() => setIsStandalone((prev) => !prev)}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {currentRole === 'super_admin' && (
          <SuperAdminView
            firms={firms}
            onAddFirm={handleAddFirm}
            onUpdateFirm={handleUpdateFirm}
            onToggleFirmStatus={handleToggleFirmStatus}
            onUpdateFirmFlags={handleUpdateFirmFlags}
            onSwitchRole={(role, firmId) => {
              if (firmId) setSelectedFirmId(firmId);
              setCurrentRole(role);
            }}
          />
        )}

        {currentRole === 'accountant' && (
          currentFirm ? (
            !accountantSession || accountantSession.firmId !== currentFirm.id ? (
              <AccountantLoginGate
                firm={currentFirm}
                isStandalone={isStandalone}
                onLoginSuccess={(accountantName) => {
                  const newSession = { firmId: currentFirm.id, accountantName };
                  setAccountantSession(newSession);
                  try {
                    sessionStorage.setItem('syndicate_accountant_session', JSON.stringify(newSession));
                  } catch {}
                  recordAudit('ACCOUNTANT_AUTHENTICATED', `Accountant ${accountantName} authenticated into console for [${currentFirm.code}].`);
                  showToast(`✓ Welcome ${accountantName}! Signed in to ${currentFirm.name}.`);
                }}
              />
            ) : (
              <AccountantDashboard
                firm={currentFirm}
                projects={projects.filter(
                  (p) => p.firmId === currentFirm.id && currentFirm.sectors.includes(p.sector)
                )}
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                onAddProject={handleAddProject}
                plots={plots.filter((p) => p.firmId === currentFirm.id)}
                onUpdatePlot={handleUpdatePlot}
                layoutCalc={layoutCalc}
                onUpdateLayoutCalc={handleUpdateLayoutCalc}
                projectExpenses={projectExpenses.filter((pe) => projects.some((p) => p.id === pe.projectId && p.firmId === currentFirm.id))}
                onAddProjectExpense={handleAddProjectExpense}
                onUpdateProjectExpense={handleUpdateProjectExpense}
                apartmentUnits={apartmentUnits.filter((u) => u.firmId === currentFirm.id)}
                onUpdateApartmentUnit={handleUpdateApartmentUnit}
                pricingMatrix={pricingMatrix}
                onUpdatePricingMatrix={handleUpdatePricingMatrix}
                partners={currentFirmPartners}
                onUpdatePartner={handleUpdatePartner}
                onAddPartnerMember={handleAddPartnerMember}
                splitMode={splitMode}
                onToggleSplitMode={handleToggleSplitMode}
                fieldExpenses={fieldExpenses.filter((e) => !e.firmId || e.firmId === currentFirm.id)}
                onApproveExpense={handleApproveExpense}
                onRejectExpense={handleRejectExpense}
                onEnrollExpense={handleSubmitFieldExpense}
                ledgerMode={ledgerMode}
                onToggleLedgerMode={handleToggleLedgerMode}
                auditLogs={auditLogs}
                liquorSettlements={liquorSettlements.filter((s) => !s.firmId || s.firmId === currentFirm.id)}
                onAddLiquorSettlement={handleAddLiquorSettlement}
                partnerStockDraws={partnerStockDraws.filter((d) => !d.firmId || d.firmId === currentFirm.id)}
                onAddStockDraw={handleAddStockDraw}
                firmAccounts={firmAccounts.filter((a) => !a.firmId || a.firmId === currentFirm.id)}
                onAddFirmAccount={handleAddFirmAccount}
                onAddAccountTransaction={handleAddAccountTransaction}
                individualInvestments={individualInvestments.filter((i) => !i.firmId || i.firmId === currentFirm.id)}
                onRecordIndividualInvestment={handleRecordIndividualInvestment}
                onApproveIndividualInvestment={handleApproveIndividualInvestment}
                onRejectIndividualInvestment={handleRejectIndividualInvestment}
                onSignOut={handleSignOut}
              />
            )
          ) : (
            selectedFirmId && firms.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-amber-300 text-center max-w-lg mx-auto my-12 shadow-xl space-y-4 animate-pulse">
                <div className="w-12 h-12 rounded-2xl bg-[#FFB800] text-gray-950 flex items-center justify-center mx-auto shadow-md">
                  <Building2 className="w-6 h-6 animate-bounce" />
                </div>
                <h3 className="text-base font-black text-gray-950">Synchronizing Firm Workspace...</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Connecting to live cloud datastore and mounting schema for firm <code>{selectedFirmId}</code>...
                </p>
              </div>
            ) : selectedFirmId && firms.length > 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-red-200 text-center max-w-lg mx-auto my-12 shadow-xl space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto shadow-md">
                  <Building2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-gray-950">Tenant Firm Not Found</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  No tenant firm matching ID <code>{selectedFirmId}</code> exists in the current system. It may have been wiped or not yet saved.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      if (firms[0]) {
                        setSelectedFirmId(firms[0].id);
                      } else {
                        setCurrentRole('super_admin');
                      }
                    }}
                    className="px-6 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full text-xs shadow-md"
                  >
                    {firms.length > 0 ? `Switch to ${firms[0].name}` : 'Go to Super Admin Console'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-10 border border-amber-300 text-center max-w-lg mx-auto my-12 shadow-xl space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[#FFB800] text-gray-950 flex items-center justify-center mx-auto shadow-md">
                  <Building2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-gray-950">No Firm Provisioned Yet (Clean Slate Mode)</h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  All mock data has been wiped for client testing. To start, open the <strong>Super Admin Console</strong> to provision your first firm account and copy the direct link for your Firm Accountant tester.
                </p>
                <button
                  onClick={() => setCurrentRole('super_admin')}
                  className="px-6 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full text-xs shadow-md"
                >
                  Go to Super Admin Console
                </button>
              </div>
            )
          )
        )}

        {currentRole === 'field_partner' && (
          currentFirm ? (
            <FieldPartnerMobileView
              firm={currentFirm}
              firms={firms}
              currentUser={currentUser}
              onSelectFirm={(firmId) => {
                setSelectedFirmId(firmId);
              }}
              partners={partners}
              plots={plots.filter((p) => p.firmId === currentFirm.id)}
              apartmentUnits={apartmentUnits.filter((u) => u.firmId === currentFirm.id)}
              fieldExpenses={fieldExpenses.filter((e) => !e.firmId || e.firmId === currentFirm.id)}
              onSubmitExpense={handleSubmitFieldExpense}
              session={effectivePartnerSession}
              onLogin={handleFieldPartnerLogin}
              onLogout={handleSignOut}
              onUpdatePlot={handleUpdatePlot}
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              layoutCalc={layoutCalc}
              onUpdateLayoutCalc={handleUpdateLayoutCalc}
              projectExpenses={projectExpenses.filter((pe) => projects.some((p) => p.id === pe.projectId && p.firmId === currentFirm.id))}
              onAddProjectExpense={handleAddProjectExpense}
              onUpdateProjectExpense={handleUpdateProjectExpense}
              firmAccounts={firmAccounts.filter((a) => !a.firmId || a.firmId === currentFirm.id)}
              partnerStockDraws={partnerStockDraws.filter((d) => !d.firmId || d.firmId === currentFirm.id)}
              onAddAccountTransaction={handleAddAccountTransaction}
              onAddStockDraw={handleAddStockDraw}
              onApproveExpense={handleApproveExpense}
              onRejectExpense={handleRejectExpense}
              ledgerMode={ledgerMode}
              onUpdatePartner={handleUpdatePartner}
              individualInvestments={individualInvestments.filter((i) => !i.firmId || i.firmId === currentFirm.id)}
              onRecordIndividualInvestment={handleRecordIndividualInvestment}
              onApproveIndividualInvestment={handleApproveIndividualInvestment}
              onRejectIndividualInvestment={handleRejectIndividualInvestment}
            />
          ) : (
            <div className="bg-white rounded-3xl p-10 border border-amber-300 text-center max-w-lg mx-auto my-12 shadow-xl space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#FFB800] text-gray-950 flex items-center justify-center mx-auto shadow-md">
                <Smartphone className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-gray-950">No Syndicate Firm Available</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                A firm account must first be created by the Super Admin before partner access is activated.
              </p>
              <button
                onClick={() => setCurrentRole('super_admin')}
                className="px-6 py-2.5 bg-[#FFB800] hover:bg-amber-400 text-gray-950 font-black rounded-full text-xs shadow-md"
              >
                Go to Super Admin Console
              </button>
            </div>
          )
        )}
      </main>

      {/* Floating Interactive Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#111827] border border-amber-500/80 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs max-w-md animate-fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFB800] animate-ping shrink-0" />
          <span className="font-bold text-gray-100">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-gray-400 hover:text-white ml-auto"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
