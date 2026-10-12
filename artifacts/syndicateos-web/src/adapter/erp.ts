// Maps Spring API workspace/ERP payloads into the original UI types, and wraps mutations.
import { api, newRequestId } from './api';
import { sectorUiCode } from './config';
import type {
  TenantFirm, Project, Plot, ApartmentUnit, SyndicatePartner, FieldExpenseLog, AuditLogEntry,
  FirmAccount, FirmAccountTransaction, IndividualInvestmentRecord, LiquorDailySettlement,
  PartnerStockDraw, ProjectExpense, DrawingRequest, SectorType, LayoutCalculation, ApartmentPricingMatrix, EquitySplitMode,
} from '../original/types';

export function sectorTypeFromCode(code: string = ''): SectorType {
  const ui = sectorUiCode(code);
  if (!ui) throw new Error(`Sector "${code}" has no matching sector_types master (matchTokens).`);
  return ui as SectorType;
}

export interface RecordMeta { id: string; kind: string; revision: number; projectId: string; status: string }

export interface LoadedData {
  workspace: any;
  firms: TenantFirm[];
  projects: Project[];
  plots: Plot[];
  units: ApartmentUnit[];
  partners: SyndicatePartner[];
  fieldExpenses: FieldExpenseLog[];
  audit: AuditLogEntry[];
  accounts: FirmAccount[];
  investments: IndividualInvestmentRecord[];
  settlements: LiquorDailySettlement[];
  stockDraws: PartnerStockDraw[];
  projectExpenses: ProjectExpense[];
  drawings: DrawingRequest[];
  erpByProject: Record<string, any>;
  meta: Map<string, RecordMeta>;
  plotIds: Map<number, string>; // original Plot.id is numeric
  settings: { layoutCalc?: LayoutCalculation; pricingMatrix?: ApartmentPricingMatrix; splitMode?: EquitySplitMode };
  loadErrors: string[];
}

const num = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v));

export async function loadAll(role: string): Promise<LoadedData> {
  const ws = await api<any>('/workspace');
  const sectorById = new Map<string, any>((ws.sectors || []).map((s: any) => [String(s.id), s]));
  const sectorTypeOf = (sectorId: string, name?: string) => sectorTypeFromCode(sectorById.get(String(sectorId))?.code || name || '');

  const firms: TenantFirm[] = (ws.firms || []).map((f: any) => {
    const ifaces = (ws.interfaces || []).filter((i: any) => String(i.firmId) === String(f.id) && i.enabled);
    const sectors = Array.from(new Set(ifaces.map((i: any) => sectorTypeOf(i.sectorId, i.sectorName)))) as SectorType[];
    const acc = (f.accountants || [])[0];
    return {
      id: String(f.id), name: f.name, code: f.clientCode, location: f.metadata?.location || '', state: (f.metadata?.state || '') as any, sectors,
      gstin: f.metadata?.gstin, panNumber: f.metadata?.panNumber, reraNumber: f.metadata?.reraNumber,
      officeAddress: f.metadata?.officeAddress, proprietorPhone: f.metadata?.proprietorPhone,
      subscriptionPlan: '' as any, mrrAmount: 0,
      status: f.status === 'ACTIVE' ? 'active' : f.status === 'SUSPENDED' ? 'suspended' : 'inactive',
      createdDate: '', managingPartnerName: '', managingPartnerPhone: f.metadata?.proprietorPhone || '',
      accountantName: acc?.displayName || '', accountantPhone: acc?.mobile || '',
      featureFlags: {
        enablePlotGrid: sectors.includes('real_estate_open_plotting'),
        enableApartmentMatrix: sectors.includes('real_estate_construction'),
        enableWhatsAppAlerts: false, enableTallyExport: false, enableVoiceNotes: false, enableAuditLock: false,
      },
      __revision: f.revision,
    } as TenantFirm;
  });

  // Uploaded plans require a draft before finalization. Drafts have no live ERP
  // ledger yet and must not be treated as operational projects by polling.
  const projects: Project[] = (ws.projects || []).filter((p: any) => p.setupState !== 'DRAFT').map((p: any) => ({
    ...(p.details || {}),
    id: String(p.id), firmId: String(p.firmId), name: p.name, location: p.location || '',
    code: p.details?.projectCode || p.details?.code || '',
    sector: sectorTypeOf(p.sectorId),
    status: p.details?.developmentStage || p.details?.status || (p.status === 'COMPLETED' ? 'completed' : 'active_sales'),
    startDate: p.details?.startDate || '', extentValue: num(p.details?.extentValue), extentUnit: p.details?.extentUnit || '',
    partners: (p.partners || []).map((m: any) => ({
      partnerId: String(m.identityId), name: m.displayName, phone: m.mobile || '', roleInProject: 'Partner',
      equityPercent: 0, initialCapital: 0, drawings: 0, shareOfFieldExpenses: 0, avatarColor: 'bg-amber-500', enabled: m.enabled,
    })),
    __sectorId: String(p.sectorId), __revision: p.revision, __setupState: p.setupState,
  } as Project));

  const out: LoadedData = {
    workspace: ws, firms, projects, plots: [], units: [], partners: [], fieldExpenses: [], audit: [], accounts: [],
    investments: [], settlements: [], stockDraws: [], projectExpenses: [], drawings: [], erpByProject: {}, meta: new Map(),
    plotIds: new Map(), settings: {}, loadErrors: [],
  };
  if (role === 'super_admin') return out;

  let plotSeq = 1;
  for (const p of projects) {
    let erp: any;
    try { erp = await api<any>(`/erp/${p.id}`); } catch (e: any) { out.loadErrors.push(`${p.name}: ${e.message}`); continue; }
    out.erpByProject[p.id] = erp;
    const documentRecords = (erp.records || []).filter((r: any) => r.kind === 'documents' && r.status === 'approved');
    if (documentRecords.length) {
      try {
        const attachments = await api<any[]>(`/erp/${p.id}/attachments`);
        p.planDocuments = documentRecords.map((r: any) => {
          const file = attachments.find((a) => String(a.id) === String(r.data.attachmentId));
          if (!file) throw new Error(`An attachment is missing for project document "${r.data.title}".`);
          return {
            id: String(file.id), title: r.data.title, category: r.data.category,
            fileName: file.fileName, fileType: file.contentType, fileSize: Number(file.size),
            uploadedAt: String(file.uploadedAt),
          };
        });
      } catch (e: any) { out.loadErrors.push(`${p.name} documents: ${e.message}`); }
    }
    const base = { firmId: p.firmId, projectId: p.id };
    const balance = new Map<string, number>((erp.balances || []).map((b: any) => [String(b.accountId), Number(b.balance)]));
    const recs: any[] = erp.records || [];
    p.financialStatement = (erp.statement || []).map((entry: any) => ({ ...entry, amount: num(entry.amount) }));
    p.financialForms = Object.fromEntries((erp.resources || []).map((r: any) => [r.kind, r.fields]));
    p.canRecordDrawings = !!(erp.resources || []).find((r: any) => r.kind === 'drawings')?.canCreate;
    p.reviewableRecordIds = erp.reviewableRecordIds || [];
    // Workspace membership is identity/access data, not the project's capital
    // allocation. Read each project's approved profile instead of displaying
    // the membership projection's initial zero commitments.
    p.partners = (erp.partners || []).map((m: any) => {
      const profile = recs.find((r) => r.kind === 'partner-profiles' && r.status === 'approved'
        && String(r.data?.partnerId) === String(m.id))?.data || {};
      return {
        partnerId: String(m.id), name: m.name || '', phone: m.mobile || '',
        roleInProject: profile.roleDescription || 'Partner',
        equityPercent: num(profile.fixedEquityPercent ?? m.equityPercent),
        initialCapital: num(profile.initialCapital), actualInvested: num(m.invested),
        drawings: num(m.drawings), shareOfFieldExpenses: num(m.expenses),
        avatarColor: 'bg-amber-500', enabled: m.enabled,
      };
    });
    for (const r of recs) out.meta.set(String(r.id), { id: String(r.id), kind: r.kind, revision: r.revision, projectId: p.id, status: r.status });
    const status = (s: string) => (s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending');
    for (const r of recs) {
      const d = r.data || {}; const id = String(r.id);
      switch (r.kind) {
        case 'plots': {
          const n = plotSeq++; out.plotIds.set(n, id);
          const pending = recs.find((receipt) => receipt.kind === 'bookings' && receipt.status === 'pending'
            && String(receipt.data?.inventoryId) === id);
          const receipt = pending?.data || {};
          out.plots.push({
            ...d, ...base, id: n, status: d.status || 'available',
            ...(pending ? {
              pendingBookingId: String(pending.id),
              buyerName: receipt.buyerName, buyerPhone: receipt.buyerPhone,
              ratePerSqYard: num(receipt.ratePerSqYard), advanceReceived: num(receipt.advanceReceived),
              paymentMode: receipt.paymentMode, paymentRefNumber: receipt.paymentRefNumber,
              paymentMilestone: receipt.paymentMilestone, bookingAccountId: receipt.accountId,
              bookedAt: receipt.date, notes: receipt.notes,
            } : {}),
          });
          break;
        }
        case 'units': out.units.push({ ...d, ...base, id, status: d.status || 'available' }); break;
        case 'accounts': {
          let running = 0;
          const txs: FirmAccountTransaction[] = (erp.statement || [])
            .filter((t: any) => t.affectsCash && String(t.accountId) === id)
            .map((t: any) => {
              const amount = num(t.amount);
              running += t.type === 'credit' ? amount : -amount;
              return { ...t, accountId: id, amount, balanceAfter: running, status: 'approved' };
            });
          out.accounts.push({ ...d, firmId: p.firmId, id, linkedProjectId: p.id, openingBalance: num(d.openingBalance),
            bankName: String(d.bankName ?? ''), accountNumber: String(d.accountNumber ?? ''),
            ifscCode: String(d.ifscCode ?? ''), branchName: String(d.branchName ?? ''), city: String(d.city ?? ''),
            currentBalance: balance.has(id) ? (balance.get(id) as number) : 0, isPrimary: !!d.isPrimary,
            status: r.status === 'approved' ? 'active' : 'frozen',
            authorizedSignatories: Array.isArray(d.authorizedSignatories) ? d.authorizedSignatories
              : d.authorizedSignatories ? [String(d.authorizedSignatories)] : [],
            createdDate: r.createdAt, recentTransactions: txs } as FirmAccount);
          break;
        }
        case 'expenses': out.fieldExpenses.push({ ...d, ...base, id,
          enrolledBy: r.createdByName, partnerName: (erp.partners || []).find((m: any) => String(m.id) === String(d.partnerId))?.name || r.createdByName,
          bankAccountId: d.accountId,
          bankAccountName: recs.find((a: any) => a.kind === 'accounts' && String(a.id) === String(d.accountId))?.data?.accountName,
          amount: num(d.amount), status: status(r.status), approvedByPartners: r.votes || [] } as FieldExpenseLog); break;
        case 'investments': {
          const account = recs.find((a: any) => a.kind === 'accounts' && String(a.id) === String(d.accountId))?.data;
          out.investments.push({ ...d, ...base, id, amount: num(d.amount), status: status(r.status),
            partnerName: (erp.partners || []).find((m: any) => String(m.id) === String(d.partnerId))?.name || '',
            accountName: account?.accountName || '', accountType: account?.isDefaultCash ? 'cash' : 'bank',
            enrolledBy: r.createdByName } as IndividualInvestmentRecord);
          break;
        }
        case 'settlements': out.settlements.push({ ...d, firmId: p.firmId, id } as LiquorDailySettlement); break;
        case 'stock-draws': out.stockDraws.push({ ...d, firmId: p.firmId, id } as PartnerStockDraw); break;
        case 'budgets': out.projectExpenses.push({ ...d, ...base, id, estimatedBudget: num(d.estimatedBudget), actualSpent: num(d.actualSpent) } as ProjectExpense); break;
      }
    }
    for (const m of erp.partners || []) {
      const pid = String(m.id);
      if (out.partners.some((x) => x.id === pid)) continue;
      const profile = recs.find((r) => r.kind === 'partner-profiles' && String(r.data?.partnerId) === pid)?.data || {};
      out.partners.push({
        ...profile,
        id: pid, firmId: p.firmId, name: m.name ?? '', phone: m.mobile ?? '', roleDescription: profile.roleDescription ?? 'Partner',
        avatarColor: 'bg-amber-500', initialCapital: num(profile.initialCapital), actualInvested: num(m.invested),
         fixedEquityPercent: num(profile.fixedEquityPercent ?? m.equityPercent), drawings: num(m.drawings), shareOfFieldExpenses: num(m.expenses),
        userRole: 'field_partner', userStatus: m.enabled === false ? 'inactive' : 'active',
        __projectId: p.id, __revision: m.revision, __profileRevision: recs.find((r) => r.kind === 'partner-profiles' && String(r.data?.partnerId) === pid)?.revision,
      } as any);
    }
    for (const r of recs.filter((x) => x.kind === 'drawings')) {
      const d = r.data || {};
      out.drawings.push({ ...d, id: String(r.id), firmId: p.firmId, projectId: p.id, amount: num(d.amount),
        partnerName: (erp.partners || []).find((m: any) => String(m.id) === String(d.partnerId))?.name || 'Project partner',
        sourceAccountId: d.accountId, sourceAccountName: out.accounts.find((a) => a.id === String(d.accountId))?.accountName,
        requestedByName: r.createdByName, requestedAt: r.createdAt,
        status: r.status === 'approved' ? 'cleared' : r.status === 'rejected' ? ('rejected' as any) : 'pending_approval' } as DrawingRequest);
    }
    for (const a of erp.audit || []) out.audit.push({ id: String(a.id), timestamp: a.timestamp, actorName: a.actor, action: a.event, deviceId: '', notes: `${p.name}`, ledgerType: 'System Governance', verified: true });
    const s = erp.settings || {};
    for (const key of ['floorPlans', 'amenities', 'plotDistribution', 'layoutAmenities', 'autoGenerateInventory'] as const) {
      if (Object.prototype.hasOwnProperty.call(s, key)) (p as any)[key] = s[key];
    }
    if (s.layoutCalculation) out.settings.layoutCalc = s.layoutCalculation;
    if (s.pricingMatrix) out.settings.pricingMatrix = s.pricingMatrix;
    if (s.equitySplitMode) out.settings.splitMode = s.equitySplitMode;
  }
  return out;
}

// UI-computed or identity keys the original components attach; never business input.
const UI_KEYS = new Set(['id', 'firmId', 'projectId', 'status', 'recentTransactions', 'currentBalance', 'balanceAfter',
  'createdDate', 'requestedAt', 'submittedAt', 'avatarColor', 'enrolledBy', 'approvedBy', 'approvedAt', 'partnerName',
  'accountName', 'sourceAccountName', 'bankAccountName', 'projectName', 'deviceId', 'addedDate', 'addedBy', 'isDefaultCash']);

// Keep only configured fields. Financially significant non-empty values with no configured
// field are rejected (never silently dropped).
export function pickConfigured(fields: any[], data: Record<string, any>, label: string, aliases: Record<string, string> = {}) {
  const keys = new Set<string>((fields || []).map((f: any) => f.key));
  const out: Record<string, any> = {};
  const rejected: string[] = [];
  for (const [k0, v] of Object.entries(data)) {
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
    if (empty) continue;
    const k = keys.has(k0) ? k0 : aliases[k0] && keys.has(aliases[k0]) ? aliases[k0] : k0;
    if (keys.has(k)) {
      const field = fields.find((f: any) => f.key === k);
      // Domain dates must remain dates, even when the original UI supplies
      // a persisted SQL/ISO timestamp. Leave invalid values for validation.
      out[k] = field?.type === 'date' && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]/.test(v)
        ? v.slice(0, 10)
        : field?.type === 'text' && Array.isArray(v) && v.every((item) => typeof item === 'string')
          ? v.join(', ') : v;
      continue;
    }
    if (UI_KEYS.has(k0) || v === 0 || v === false) continue;
    rejected.push(k0);
  }
  if (rejected.length) {
    throw new Error(`Not saved: the configured "${label}" form has no field for ${rejected.join(', ')}. Clear these values or have the owner add them to the sector release.`);
  }
  return out;
}

export function filterFields(erp: any, kind: string, data: Record<string, any>) {
  const res = (erp?.resources || []).find((r: any) => r.kind === kind);
  if (!res) throw new Error(`Not supported by backend: no "${kind}" resource is configured for this project's sector release.`);
  return pickConfigured(res.fields, data, res.title || kind);
}

// Temporary credentials come back as `access` (object, or array for project setup).
export function describeAccess(access: any): string | null {
  const list = Array.isArray(access) ? access : access ? [access] : [];
  const issued = list.filter((a: any) => a?.temporaryCredential);
  const reused = list.filter((a: any) => a?.reused);
  const parts = issued.map((a: any) => `${a.mobile}: ${a.temporaryCredential} (expires ${String(a.expiresAt).slice(0, 10)})`);
  if (reused.length) parts.push(`${reused.map((a: any) => a.mobile).join(', ')} already registered — existing PIN unchanged`);
  return parts.length ? `Temporary PINs (shown once): ${parts.join(' · ')}` : null;
}

export async function command<T = any>(action: string, body: Record<string, any>): Promise<T> {
  return api<T>(`/commands/${action}`, { body: { data: body } });
}

export async function erpSave(erp: any, projectId: string, kind: string, data: Record<string, any>, existing?: RecordMeta) {
  return command('erp.save', {
    projectId, kind, requestId: newRequestId(), data: filterFields(erp, kind, data),
    ...(existing ? { recordId: existing.id, revision: existing.revision } : {}),
  });
}

export async function erpReview(meta: RecordMeta, decision: 'approved' | 'rejected', reason?: string) {
  return command('erp.review', { projectId: meta.projectId, recordId: meta.id, revision: meta.revision, decision, ...(reason ? { reason } : {}) });
}
