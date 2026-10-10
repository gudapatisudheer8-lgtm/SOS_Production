import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Role, TenantFirm, Project, Plot, LayoutCalculation, ProjectExpense, ApartmentUnit, ApartmentPricingMatrix,
  SyndicatePartner, FieldExpenseLog, EquitySplitMode, LedgerMode, LiquorDailySettlement, PartnerStockDraw,
  FirmAccount, FirmAccountTransaction, AuthenticatedAppUser, DrawingRequest,
} from './original/types';
import { Header } from './original/components/Header';
import { ProductionAuthGate } from './original/components/auth/ProductionAuthGate';
import { SuperAdminView } from './original/components/superadmin/SuperAdminView';
import { AccountantDashboard } from './original/components/accountant/AccountantDashboard';
import { FieldPartnerMobileView } from './original/components/fieldpartner/FieldPartnerMobileView';
import type { IndividualInvestmentData } from './original/components/modals/IndividualInvestmentModal';
import { Building2, Smartphone } from 'lucide-react';
import { api, getToken, setToken, toAppUser, newRequestId } from './adapter/api';
import { loadAll, erpSave, erpReview, command, filterFields, pickConfigured, describeAccess, type LoadedData } from './adapter/erp';

const EMPTY_LAYOUT: LayoutCalculation = { totalExtentValue: 0, unit: 'Acres', roadWidth: 30, openSpacePercent: 10, floorRatePerSqYard: 0 };
const EMPTY_MATRIX: ApartmentPricingMatrix = { baseSqFtRate: 0, eastPremium: 0, northPremium: 0, cornerPremium: 0, floorRisePerFloor: 0, carParkingFee: 0, amenitiesFee: 0, floorRatePerSqFt: 0 };

// Original-UI actions with no backing endpoint in the Spring API. Shown visibly, never faked.
const BLOCKED_ACTIONS = [
  'Owner sign-in into accountant / partner consoles (owner has no ERP scope)',
  'Feature flags: WhatsApp, Tally export, voice notes, audit lock, dual ledger',
  'Partner profile edits (role, PIN, spending limit) beyond partner.add',
  'Marketing agent plot portal',
  'Partner activation/deactivation',
  'Separate drawing disbursement (ledger posts on approval)',
  'Plan document / receipt uploads',
  'Firm GSTIN, PAN, RERA, office address, proprietor details',
  'Project floor plans, plot distribution and amenity layouts during setup',
  'Partner capital/equity on quick “add partner” (use project setup or investments)',
];

function App() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedAppUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [data, setData] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFirmId, setSelectedFirmId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [ledgerMode, setLedgerMode] = useState<LedgerMode>('internal_syndicate');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [stickyNotice, setStickyNotice] = useState<string | null>(null);
  const [showGaps, setShowGaps] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 5000);
  }, []);

  const currentRole: Role = currentUser?.role === 'super_admin' ? 'super_admin'
    : currentUser?.role === 'accountant' ? 'accountant' : 'field_partner';

  const reload = useCallback(async (role: string) => {
    try {
      const d = await loadAll(role);
      setData(d);
      setLoadError(null);
      setSelectedFirmId((prev) => prev || d.firms[0]?.id || '');
      setSelectedProjectId((prev) => prev || d.projects[0]?.id || '');
      if (d.loadErrors.length) showToast(`Some project ledgers could not load: ${d.loadErrors.join('; ')}`);
    } catch (e: any) {
      setLoadError(e.message);
    }
  }, [showToast]);

  useEffect(() => {
    const onNotice = (e: Event) => setStickyNotice(String((e as CustomEvent).detail));
    window.addEventListener('sos-notice', onNotice);
    return () => window.removeEventListener('sos-notice', onNotice);
  }, []);

  // Restore session from bearer token
  useEffect(() => {
    if (!getToken()) { setBooting(false); return; }
    api<any>('/auth/me')
      .then((acc) => { const u = toAppUser(acc.account ?? acc); setCurrentUser(u); return reload(u.role); })
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, [reload]);

  const handleLoginSuccess = (user: AuthenticatedAppUser) => {
    setCurrentUser(user);
    if (user.firmId) setSelectedFirmId(user.firmId);
    reload(user.role);
  };

  const handleSignOut = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* token may already be invalid */ }
    setToken(null);
    setCurrentUser(null);
    setData(null);
    setSelectedFirmId('');
    setSelectedProjectId('');
  };

  // Every mutation: await backend, then reload. On failure, show the real error and keep state.
  // Resolves true only after the backend accepted the change; false on any error.
  const run = useCallback(async (label: string, fn: () => Promise<any>): Promise<boolean> => {
    try {
      await fn();
    } catch (e: any) {
      showToast(`✕ ${label} failed: ${e.message}`);
      return false;
    }
    showToast(`✓ ${label}`);
    if (currentUser) await reload(currentUser.role);
    return true;
  }, [currentUser, reload, showToast]);

  const unsupported = (what: string): false => { showToast(`✕ Not supported by backend: ${what}`); return false; };

  const firms = data?.firms ?? [];
  const projects = data?.projects ?? [];
  const currentFirm = firms.find((f) => f.id === selectedFirmId) || null;
  const erpOf = (projectId?: string) => (projectId ? data?.erpByProject[projectId] : undefined);
  const activeProjectId = selectedProjectId || projects[0]?.id || '';
  const metaOf = (id: string) => data?.meta.get(id);

  const pendingExpensesCount = useMemo(() => (data?.fieldExpenses ?? []).filter((e) => e.status === 'pending').length, [data]);

  // ---------- Owner ----------
  const handleAddFirm = (f: TenantFirm) => run(`Firm ${f.name} provisioned`, async () => {
    const ws = data?.workspace;
    const assignments = f.sectors.map((s) => {
      const sector = (ws?.sectors || []).find((x: any) => {
        const c = String(x.code).toLowerCase();
        return s === 'real_estate_open_plotting' ? c.includes('plot') : s === 'real_estate_construction' ? c.includes('constr')
          : s === 'liquor_vends' ? c.includes('liquor') : c.includes('infra') || c.includes('custom');
      });
      const release = sector?.releases?.find((r: any) => r.state === 'PUBLISHED');
      if (!sector || !release) throw new Error(`No published sector release for ${s}.`);
      return { sectorId: sector.id, releaseId: release.id };
    });
    const statutory = [['GSTIN', f.gstin], ['PAN', f.panNumber], ['RERA number', f.reraNumber], ['office address', f.officeAddress],
      ['proprietor', f.proprietorPhone]].filter(([, v]) => v && String(v).trim()).map(([k]) => k);
    if (statutory.length) throw new Error(`Not saved: the backend firm record has no field for ${statutory.join(', ')}. Clear these values to create the firm.`);
    if (!f.accountantName || !f.accountantPhone) throw new Error('Accountant name and mobile are required.');
    const r: any = await command('firm.create', {
      clientCode: f.code, name: f.name, accountantMobile: f.accountantPhone.replace(/\D/g, '').slice(-10),
      accountantName: f.accountantName, assignments,
    });
    const notice = describeAccess(r?.access);
    if (notice) setStickyNotice(`${f.name} (${f.code}) accountant — ${notice}`);
  });

  const handleUpdateFirm = (f: TenantFirm) => run(`Firm ${f.name} updated`, () =>
    command('firm.update', { firmId: f.id, name: f.name, status: f.status === 'active' ? 'ACTIVE' : 'SUSPENDED', revision: (firms.find((x) => x.id === f.id) as any)?.__revision }));

  const handleToggleFirmStatus = (firmId: string) => {
    const f = firms.find((x) => x.id === firmId) as any;
    if (!f) return;
    run(`Firm ${f.name} status changed`, () =>
      command('firm.update', { firmId, name: f.name, status: f.status === 'active' ? 'SUSPENDED' : 'ACTIVE', revision: f.__revision }));
  };

  const handleUpdateFirmFlags = () => unsupported('feature flags are configured through sector releases, not per-firm toggles.');

  // ---------- Accountant: projects & partners ----------
  const handleAddProject = (p: Project, initialPlots?: Plot[], initialUnits?: ApartmentUnit[]) => run(`Project ${p.name} created`, async () => {
    const iface = (data?.workspace?.interfaces || []).find((i: any) => String(i.firmId) === p.firmId &&
      (i.configuration?.projectSetup || true) && data?.workspace?.sectors?.find((s: any) => String(s.id) === String(i.sectorId)));
    const ifaces = (data?.workspace?.interfaces || []).filter((i: any) => String(i.firmId) === p.firmId);
    const match = ifaces.find((i: any) => {
      const n = String(i.sectorName).toLowerCase();
      return p.sector === 'real_estate_open_plotting' ? n.includes('plot') : p.sector === 'real_estate_construction' ? n.includes('constr')
        : p.sector === 'liquor_vends' ? n.includes('liquor') : n.includes('infra') || n.includes('custom');
    }) || iface;
    if (!match) throw new Error('No sector assignment for this firm matches the project sector.');
    const def = match.configuration?.projectSetup;
    if (!def?.sections) throw new Error('The owner has not published a project setup form for this sector.');
    const { id: _id, firmId: _f, partners, sector: _s, status: _st, code, ...rest } = p as any;
    const allFields = def.sections.flatMap((sec: any) => sec.fields || []);
    // Nested plan structures (floor plans, plot distribution, amenities, documents) are not setup fields.
    const { floorPlans, plotDistribution, layoutAmenities, amenities, planDocuments, ...flat } = rest;
    if (planDocuments?.length) throw new Error('Not saved: plan document upload is not available through the API yet. Remove attached plans.');
    const values = pickConfigured(allFields, { ...flat, projectCode: code }, 'Project setup');
    const partnerRows = (partners || []).map((sh: any) => pickConfigured(def.partnerFields || [], {
      name: sh.name, mobile: String(sh.phone).replace(/\D/g, '').slice(-10),
      fixedEquityPercent: sh.equityPercent, initialCapital: sh.initialCapital, roleDescription: sh.roleInProject,
    }, 'Project partner'));
    const setup = { values, settings: {}, groups: [], documents: [], accounts: [], partners: partnerRows };
    void floorPlans; void plotDistribution; void layoutAmenities; void amenities;
    const saved: any = await command('project.setup-save', { requestId: newRequestId(), sectorId: match.sectorId, setup });
    const ent = saved?.entity || {};
    const fin: any = await command('project.setup-finalize', { requestId: newRequestId(), projectId: ent.id, revision: ent.revision });
    const notice = describeAccess(fin?.entity?.access);
    if (notice) setStickyNotice(`${p.name} partners — ${notice}`);
    const rows = (initialPlots?.length ? initialPlots : initialUnits) as any[] | undefined;
    if (rows?.length) {
      const kind = initialPlots?.length ? 'plots' : 'units';
      const erp = await api<any>(`/erp/${ent.id}`);
      await command('erp.bulk-save', { projectId: ent.id, kind, requestId: newRequestId(), records: rows.map((r) => filterFields(erp, kind, r)) });
    }
  });

  const handleAddPartnerMember = (m: SyndicatePartner) => run(`Partner ${m.name} added`, async () => {
    if (!activeProjectId) throw new Error('Select a project first.');
    if (m.initialCapital || m.fixedEquityPercent) throw new Error('Not saved: quick add partner cannot store capital or equity. Clear them, or add the partner through project setup.');
    const r: any = await command('partner.add', { projectId: activeProjectId, name: m.name, mobile: m.phone.replace(/\D/g, '').slice(-10) });
    const notice = describeAccess(r?.access);
    if (notice) setStickyNotice(`${m.name} — ${notice}`);
  });

  const handleUpdatePartner = () => unsupported('partner profile edits (no partner.update command).');

  // ---------- Inventory ----------
  const handleUpdatePlot = (plot: Plot) => {
    const id = data?.plotIds.get(plot.id); const meta = id ? metaOf(id) : undefined;
    if (!meta) return unsupported('plot is not a saved backend record.');
    const prev = data?.plots.find((x) => x.id === plot.id);
    if (prev?.status === 'available' && plot.status !== 'available' && plot.buyerName) {
      return run(`Booking for plot ${plot.plotNumber} submitted`, () => erpSave(erpOf(meta.projectId), meta.projectId, 'bookings', { ...plot, inventoryId: meta.id }));
    }
    return run(`Plot ${plot.plotNumber} saved`, () => erpSave(erpOf(meta.projectId), meta.projectId, 'plots', plot, meta));
  };

  const handleUpdateApartmentUnit = (u: ApartmentUnit) => {
    const meta = metaOf(u.id);
    if (!meta) return unsupported('unit is not a saved backend record.');
    return run(`Unit ${u.unitNumber} saved`, () => erpSave(erpOf(meta.projectId), meta.projectId, 'units', u, meta));
  };

  const saveSettings = (label: string, settings: Record<string, any>) => run(label, () => {
    if (!activeProjectId) throw new Error('Select a project first.');
    return command('erp.settings', { projectId: activeProjectId, settings });
  });
  const handleUpdateLayoutCalc = (c: LayoutCalculation) => saveSettings('Layout calculation saved', { layoutCalculation: c });
  const handleUpdatePricingMatrix = (m: ApartmentPricingMatrix) => saveSettings('Pricing matrix saved', { pricingMatrix: m });
  const handleToggleSplitMode = (mode: EquitySplitMode) => saveSettings('Equity split mode saved', { equitySplitMode: mode });
  // Ledger mode is a view filter in the original UI (not persisted business data).
  const handleToggleLedgerMode = (mode: LedgerMode) => setLedgerMode(mode);

  // ---------- Budgets ----------
  const handleAddProjectExpense = (e: ProjectExpense) => {
    const pid = e.projectId || activeProjectId;
    return run(`Budget head ${e.category} saved`, () => erpSave(erpOf(pid), pid, 'budgets', e));
  };
  const handleUpdateProjectExpense = (e: ProjectExpense) => {
    const meta = metaOf(e.id);
    if (!meta) return unsupported('budget head is not a saved backend record.');
    return run(`Budget head ${e.category} updated`, () => erpSave(erpOf(meta.projectId), meta.projectId, 'budgets', e, meta));
  };

  // ---------- Treasury ----------
  const handleAddFirmAccount = (a: FirmAccount) => {
    const pid = a.linkedProjectId && a.linkedProjectId !== 'all' ? a.linkedProjectId : activeProjectId;
    return run(`Account ${a.accountName} submitted`, () => erpSave(erpOf(pid), pid, 'accounts', a));
  };
  const handleAddAccountTransaction = (accountId: string, tx: FirmAccountTransaction) => {
    const meta = metaOf(accountId);
    if (!meta) return unsupported('account is not a saved backend record.');
    return run('Ledger transaction submitted', () => erpSave(erpOf(meta.projectId), meta.projectId, 'transactions', { ...tx, accountId }));
  };

  // ---------- Expenses ----------
  const handleSubmitFieldExpense = (e: FieldExpenseLog, bankAccountId?: string) => {
    const pid = e.projectId || activeProjectId;
    return run('Expense submitted for approval', () => erpSave(erpOf(pid), pid, 'expenses', { ...e, accountId: bankAccountId || e.bankAccountId }));
  };
  const review = (id: string, decision: 'approved' | 'rejected', label: string, reason?: string) => {
    const meta = metaOf(id);
    if (!meta) return unsupported('record is not a saved backend record.');
    return run(label, () => erpReview(meta, decision, reason));
  };
  const handleApproveExpense = (id: string) => review(id, 'approved', 'Expense approval recorded');
  const handleRejectExpense = (id: string) => review(id, 'rejected', 'Expense rejected');

  // ---------- Investments ----------
  const handleRecordIndividualInvestment = (d: IndividualInvestmentData) => run('Investment submitted', () => {
    const meta = metaOf(d.accountId);
    const pid = meta?.projectId || activeProjectId;
    return erpSave(erpOf(pid), pid, 'investments', d as any);
  });
  const handleApproveIndividualInvestment = (id: string) => review(id, 'approved', 'Investment approval recorded');
  const handleRejectIndividualInvestment = (id: string, reason?: string) => review(id, 'rejected', 'Investment rejected', reason);

  // ---------- Drawings ----------
  const handleSubmitDrawing = (d: DrawingRequest) => {
    const pid = d.projectId || activeProjectId;
    return run('Drawing request submitted', () => erpSave(erpOf(pid), pid, 'drawings', { ...d, accountId: d.sourceAccountId }));
  };
  const handleReviewDrawing = (id: string, decision: 'approved' | 'rejected') => review(id, decision, decision === 'approved' ? 'Drawing approval recorded' : 'Drawing rejected');

  // ---------- Liquor ----------
  const handleAddLiquorSettlement = (s: LiquorDailySettlement) => run('Counter settlement submitted', () => erpSave(erpOf(activeProjectId), activeProjectId, 'settlements', s));
  const handleAddStockDraw = (d: PartnerStockDraw) => run('Stock draw submitted', () => erpSave(erpOf(activeProjectId), activeProjectId, 'stock-draws', d));

  if (booting) {
    return <div className="min-h-screen bg-[#FDFCF7]" />;
  }
  if (!currentUser) {
    return <ProductionAuthGate onLoginSuccess={handleLoginSuccess} />;
  }

  const partnerSession = currentUser.role === 'field_partner' && currentUser.firmId
    ? { firmId: currentUser.firmId, partnerId: currentUser.id } : null;

  return (
    <div className="min-h-screen bg-[#FDFCF7] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      <Header
        currentRole={currentRole}
        onRoleChange={() => unsupported('role switching; sign in with that role’s credentials.')}
        firms={firms}
        selectedFirmId={selectedFirmId}
        onFirmChange={setSelectedFirmId}
        pendingExpensesCount={pendingExpensesCount}
        firmAccountsCount={(data?.accounts ?? []).length}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-amber-900">
          Preview in progress — connected to the live SyndicateOS API. Some original workflows are not yet supported by the backend and will show a clear error instead of saving (see “unavailable actions”, bottom-left).
        </div>
      </div>

      {(loadError || stickyNotice) && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 space-y-2">
          {loadError && (
            <div className="bg-white border border-red-200 text-red-800 rounded-2xl px-4 py-3 text-xs font-bold flex items-center gap-3">
              <span>Could not load workspace: {loadError}</span>
              <button onClick={() => reload(currentUser.role)} className="ml-auto px-3 py-1 bg-[#FFB800] text-gray-950 rounded-full font-black">Retry</button>
            </div>
          )}
          {stickyNotice && (
            <div className="bg-white border border-amber-300 rounded-2xl px-4 py-3 text-xs font-bold text-gray-900 flex items-center gap-3">
              <span className="font-mono break-all">{stickyNotice}</span>
              <button onClick={() => setStickyNotice(null)} className="ml-auto text-gray-500">✕</button>
            </div>
          )}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {!data && !loadError ? (
          <div className="bg-white rounded-3xl p-10 border border-amber-300 text-center max-w-lg mx-auto my-12 shadow-xl space-y-4 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-[#FFB800] text-gray-950 flex items-center justify-center mx-auto shadow-md">
              <Building2 className="w-6 h-6 animate-bounce" />
            </div>
            <h3 className="text-base font-black text-gray-950">Synchronizing Firm Workspace...</h3>
          </div>
        ) : null}

        {data && currentRole === 'super_admin' && (
          <SuperAdminView
            firms={firms}
            onAddFirm={handleAddFirm}
            onUpdateFirm={handleUpdateFirm}
            onToggleFirmStatus={handleToggleFirmStatus}
            onUpdateFirmFlags={handleUpdateFirmFlags}
            onSwitchRole={() => unsupported('owners cannot enter firm consoles; sign in as the firm accountant.')}
          />
        )}

        {data && currentRole === 'accountant' && (currentFirm ? (
          <AccountantDashboard
            firm={currentFirm}
            projects={projects.filter((p) => p.firmId === currentFirm.id)}
            selectedProjectId={activeProjectId}
            onSelectProject={setSelectedProjectId}
            onAddProject={handleAddProject}
            plots={data.plots}
            onUpdatePlot={handleUpdatePlot}
            layoutCalc={data.settings.layoutCalc ?? EMPTY_LAYOUT}
            onUpdateLayoutCalc={handleUpdateLayoutCalc}
            projectExpenses={data.projectExpenses}
            onAddProjectExpense={handleAddProjectExpense}
            onUpdateProjectExpense={handleUpdateProjectExpense}
            apartmentUnits={data.units}
            onUpdateApartmentUnit={handleUpdateApartmentUnit}
            pricingMatrix={data.settings.pricingMatrix ?? EMPTY_MATRIX}
            onUpdatePricingMatrix={handleUpdatePricingMatrix}
            partners={data.partners}
            onUpdatePartner={handleUpdatePartner}
            onAddPartnerMember={handleAddPartnerMember}
            splitMode={data.settings.splitMode ?? 'fixed'}
            onToggleSplitMode={handleToggleSplitMode}
            fieldExpenses={data.fieldExpenses}
            onApproveExpense={handleApproveExpense}
            onRejectExpense={handleRejectExpense}
            onEnrollExpense={handleSubmitFieldExpense}
            ledgerMode={ledgerMode}
            onToggleLedgerMode={handleToggleLedgerMode}
            auditLogs={data.audit}
            liquorSettlements={data.settlements}
            onAddLiquorSettlement={handleAddLiquorSettlement}
            partnerStockDraws={data.stockDraws}
            onAddStockDraw={handleAddStockDraw}
            firmAccounts={data.accounts}
            onAddFirmAccount={handleAddFirmAccount}
            onAddAccountTransaction={handleAddAccountTransaction}
            individualInvestments={data.investments}
            onRecordIndividualInvestment={handleRecordIndividualInvestment}
            onApproveIndividualInvestment={handleApproveIndividualInvestment}
            onRejectIndividualInvestment={handleRejectIndividualInvestment}
            onSignOut={handleSignOut}
          />
        ) : (
          <div className="bg-white rounded-3xl p-10 border border-red-200 text-center max-w-lg mx-auto my-12 shadow-xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto shadow-md">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-gray-950">Tenant Firm Not Found</h3>
            <p className="text-xs text-gray-600 leading-relaxed">Your firm is not active or not visible to this account.</p>
          </div>
        ))}

        {data && currentRole === 'field_partner' && (currentFirm ? (
          <FieldPartnerMobileView
            firm={currentFirm}
            firms={firms}
            currentUser={currentUser}
            onSelectFirm={setSelectedFirmId}
            partners={data.partners}
            plots={data.plots}
            apartmentUnits={data.units}
            fieldExpenses={data.fieldExpenses}
            onSubmitExpense={handleSubmitFieldExpense}
            drawingRequests={data.drawings}
            onSubmitDrawing={handleSubmitDrawing}
            onReviewDrawing={handleReviewDrawing}
            onBlockedAction={unsupported}
            session={partnerSession}
            onLogin={() => undefined}
            onLogout={handleSignOut}
            onUpdatePlot={handleUpdatePlot}
            projects={projects}
            selectedProjectId={activeProjectId}
            onSelectProject={setSelectedProjectId}
            layoutCalc={data.settings.layoutCalc ?? EMPTY_LAYOUT}
            onUpdateLayoutCalc={handleUpdateLayoutCalc}
            projectExpenses={data.projectExpenses}
            onAddProjectExpense={handleAddProjectExpense}
            onUpdateProjectExpense={handleUpdateProjectExpense}
            firmAccounts={data.accounts}
            partnerStockDraws={data.stockDraws}
            onAddAccountTransaction={handleAddAccountTransaction}
            onAddStockDraw={handleAddStockDraw}
            onApproveExpense={handleApproveExpense}
            onRejectExpense={handleRejectExpense}
            ledgerMode={ledgerMode}
            onUpdatePartner={handleUpdatePartner}
            individualInvestments={data.investments}
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
          </div>
        ))}
      </main>

      {/* Visible list of original actions the backend cannot serve yet */}
      <div className="fixed bottom-5 left-5 z-40 max-w-sm">
        <button onClick={() => setShowGaps((v) => !v)} className="px-3 py-1.5 bg-white border border-stone-300 rounded-full text-[10px] font-black text-stone-700 shadow-xs">
          {showGaps ? 'Hide' : 'Show'} unavailable actions ({BLOCKED_ACTIONS.length})
        </button>
        {showGaps && (
          <ul className="mt-2 bg-white border border-stone-200 rounded-2xl p-3 text-[11px] text-stone-700 space-y-1 shadow-xl">
            {BLOCKED_ACTIONS.map((a) => <li key={a}>• {a}</li>)}
          </ul>
        )}
      </div>

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#111827] border border-amber-500/80 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs max-w-md animate-fade-in">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFB800] animate-ping shrink-0" />
          <span className="font-bold text-gray-100">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white ml-auto">✕</button>
        </div>
      )}
    </div>
  );
}

export default App;
