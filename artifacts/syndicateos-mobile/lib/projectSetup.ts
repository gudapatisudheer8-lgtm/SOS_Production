/**
 * Project setup contract. Everything structural (sections, fields, options, limits, labels) is read from
 * `configuration.projectSetup`; nothing here supplies business defaults. Types are local and validated
 * because the generated client may lag behind the backend contract.
 */
export type SetupKind = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'multiline' | 'account' | 'partner' | 'inventory';
export interface SetupField {
  key: string; label: string; kind: SetupKind; required: boolean;
  min?: number; max?: number; options?: string[]; unit?: string; integer?: boolean; maxLength?: number;
  default?: unknown; visibleWhen?: { field: string; values: string[] };
  ui?: 'hidden' | 'advanced'; readOnly?: boolean; optionLabels?: Record<string, string>;
  pattern?: string; decimalPlaces?: number;
}
export interface SetupSection { key: string; title: string; fields: SetupField[] }
export interface SetupConfig {
  title: string;
  presentation?: string;
  sections: SetupSection[];
  inventory: { kind: string; fields: SetupField[]; mappings: Record<string, string>; rateField: string; maxRows: number } | null;
  partnerFields: SetupField[];
  accountFields: SetupField[];
  documentFields: SetupField[];
  settingsFields: SetupField[];
  labels: Record<string, string>;
  rules: { maxPartners?: number; maxAccounts?: number; [k: string]: unknown };
  quickTokens: number[];
}
export type Row = Record<string, unknown>;
export interface SetupDraft {
  values: Row; settings: Row; groups: Row[]; partners: Row[]; accounts: Row[]; documents: Row[];
}
export const emptyDraft = (): SetupDraft => ({ values: {}, settings: {}, groups: [], partners: [], accounts: [], documents: [] });

const KINDS: SetupKind[] = ['text', 'number', 'date', 'select', 'boolean', 'multiline', 'account', 'partner', 'inventory'];
const isObj = (x: unknown): x is Row => !!x && typeof x === 'object' && !Array.isArray(x);

export const badKinds: string[] = [];
function parseField(x: unknown): SetupField | null {
  if (!isObj(x) || typeof x.key !== 'string' || typeof x.label !== 'string') return null;
  if (!KINDS.includes(x.kind as SetupKind)) { badKinds.push(`${x.key}: ${String(x.kind)}`); return null; }
  const kind = x.kind as SetupKind;
  const f: SetupField = { key: x.key, label: x.label, kind, required: x.required === true };
  if (typeof x.min === 'number') f.min = x.min;
  if (typeof x.max === 'number') f.max = x.max;
  if (typeof x.unit === 'string') f.unit = x.unit;
  if (x.integer === true) f.integer = true;
  if (typeof x.maxLength === 'number') f.maxLength = x.maxLength;
  if (x.default !== undefined) f.default = x.default;
  if (x.ui === 'hidden' || x.ui === 'advanced') f.ui = x.ui;
  if (typeof x.readOnly === 'boolean') f.readOnly = x.readOnly;
  if (typeof x.pattern === 'string') f.pattern = x.pattern;
  if (typeof x.decimalPlaces === 'number') f.decimalPlaces = x.decimalPlaces;
  if (isObj(x.optionLabels)) f.optionLabels = Object.fromEntries(Object.entries(x.optionLabels).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  if (Array.isArray(x.options)) f.options = x.options.filter((o): o is string => typeof o === 'string');
  const v = x.visibleWhen;
  if (isObj(v) && typeof v.field === 'string' && Array.isArray(v.values)) f.visibleWhen = { field: v.field, values: v.values.filter((o): o is string => typeof o === 'string') };
  return f;
}
const parseFields = (x: unknown): SetupField[] => (Array.isArray(x) ? x.map(parseField).filter((f): f is SetupField => !!f) : []);

/** Reads the assigned release's setup definition. Returns an error string instead of a fallback. */
export function readSetupConfig(configuration: unknown): { config: SetupConfig | null; error: string | null } {
  badKinds.length = 0;
  const raw = isObj(configuration) ? configuration.projectSetup : undefined;
  if (!isObj(raw)) return { config: null, error: 'This sector release has no project setup definition. The owner must publish one before projects can be created.' };
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).flatMap((s) => (isObj(s) && typeof s.key === 'string' && typeof s.title === 'string' ? [{ key: s.key, title: s.title, fields: parseFields(s.fields) }] : []));
  if (!sections.length) return { config: null, error: 'The project setup definition has no sections.' };
  const inv = isObj(raw.inventory) ? raw.inventory : null;
  const maxRows = inv && typeof inv.maxRows === 'number' ? inv.maxRows : 0;
  const wf = isObj(raw.workflow) ? raw.workflow : {};
  const labels: Record<string, string> = {};
  if (isObj(raw.labels)) for (const [k, v] of Object.entries(raw.labels)) if (typeof v === 'string') labels[k] = v;
  const rules = isObj(raw.rules) ? (raw.rules as SetupConfig['rules']) : {};
  const resources = isObj(configuration) && Array.isArray(configuration.resources) ? configuration.resources : [];
  const documents = resources.find((r) => isObj(r) && r.kind === 'documents');
  const documentFields = parseFields(isObj(documents) ? documents.fields : []);
  if (badKinds.length) return { config: null, error: `Project setup uses unsupported field kinds (${badKinds.join(', ')}). Update the app or the release configuration.` };
  const all = [...sections.flatMap((x) => x.fields), ...parseFields(raw.partnerFields), ...parseFields(raw.accountFields), ...parseFields(raw.settingsFields), ...parseFields(isObj(raw.inventory) ? raw.inventory.fields : []), ...documentFields];
  const noOpt = all.filter((f) => f.kind === 'select' && !(f.options && f.options.length)).map((f) => f.key);
  if (noOpt.length) return { config: null, error: `Configuration error: select field(s) ${noOpt.join(', ')} have no options defined.` };
  badKinds.length = 0;
  return {
    error: null,
    config: {
      title: typeof raw.title === 'string' ? raw.title : 'Project setup',
      presentation: typeof raw.presentation === 'string' ? raw.presentation : undefined,
      sections,
      inventory: inv ? { kind: String(inv.kind ?? ''), fields: parseFields(inv.fields), mappings: isObj(inv.mappings) ? (inv.mappings as Record<string, string>) : {}, rateField: String(inv.rateField ?? ''), maxRows } : null,
      partnerFields: parseFields(raw.partnerFields),
      accountFields: parseFields(raw.accountFields),
      documentFields,
      settingsFields: parseFields(raw.settingsFields),
      labels, rules,
      quickTokens: Array.isArray(wf.quickTokens) ? wf.quickTokens.filter((n): n is number => typeof n === 'number') : [],
    },
  };
}

export function isVisible(f: SetupField, row: Row): boolean {
  if (!f.visibleWhen) return true;
  const v = row[f.visibleWhen.field];
  return f.visibleWhen.values.includes(v === undefined || v === null ? '' : String(v));
}

/** Returns an error message or null. Raw values are stored in the draft as entered (strings, booleans). */
export function fieldError(f: SetupField, raw: unknown): string | null {
  const blank = raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
  if (blank) return f.required ? `${f.label} is required.` : null;
  if (f.kind === 'number') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${f.label} must be a number.`;
    if (f.integer && !Number.isInteger(n)) return `${f.label} must be a whole number.`;
    if (f.min !== undefined && n < f.min) return `${f.label} must be at least ${f.min}.`;
    if (f.max !== undefined && n > f.max) return `${f.label} must be at most ${f.max}.`;
    if (f.decimalPlaces !== undefined && Math.abs(n - Number(n.toFixed(f.decimalPlaces))) > Number.EPSILON * Math.max(1, Math.abs(n))) return `${f.label} allows at most ${f.decimalPlaces} decimal places.`;
  } else if (f.kind === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return `${f.label} must be YYYY-MM-DD.`;
  } else if (f.kind === 'select') {
    if (f.options && !f.options.includes(String(raw))) return `Choose a valid ${f.label}.`;
  } else if (f.maxLength !== undefined && String(raw).length > f.maxLength) return `${f.label} is limited to ${f.maxLength} characters.`;
  if (f.pattern && !new RegExp(f.pattern).test(String(raw).trim().toUpperCase())) return `Enter a valid ${f.label}.`;
  return null;
}

/** Converts entered values to typed JSON for the command; hidden fields are dropped. */
export function typedRow(fields: SetupField[], row: Row, drop: string[] = []): Row {
  const out: Row = {};
  for (const f of fields) {
    if (!isVisible(f, row)) continue;
    const v = row[f.key];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
    if (f.kind === 'number' && !Number.isFinite(Number(v))) throw new Error(`Enter a valid number for ${f.label}.`);
    out[f.key] = f.kind === 'number' ? Number(v) : f.kind === 'boolean' ? v === true : v;
  }
  for (const d of drop) delete out[d];
  return out;
}

export function rowErrors(fields: SetupField[], row: Row, prefix: string): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of fields) {
    if (!isVisible(f, row)) continue;
    const m = fieldError(f, row[f.key]);
    if (m) e[`${prefix}.${f.key}`] = m;
  }
  return e;
}

export const CONFIRM_KEY = 'confirmAccountNumber';
const hasAcctNo = (c: SetupConfig) => c.rules.accountNumberConfirmation !== false && c.accountFields.some((f) => f.key === 'accountNumber');

/** All validation (client convenience; the server validates every root value again). */
export function validateAll(c: SetupConfig, d: SetupDraft, nameKey: string | null): Record<string, string> {
  let e: Record<string, string> = {};
  if (nameKey && !String(d.values[nameKey] ?? '').trim()) e[`values.${nameKey}`] = 'Project name is required.';
  for (const s of c.sections) e = { ...e, ...rowErrors(s.fields, d.values, 'values') };
  e = { ...e, ...rowErrors(c.settingsFields, d.settings, 'settings') };
  preparedGroups(c, d).forEach((g, i) => { e = { ...e, ...rowErrors(c.inventory?.fields ?? [], g, `groups.${i}`) }; });
  d.partners.forEach((p, i) => { e = { ...e, ...rowErrors(c.partnerFields, p, `partners.${i}`) }; });
  d.accounts.forEach((a, i) => {
    e = { ...e, ...rowErrors(c.accountFields, a, `accounts.${i}`) };
    if (hasAcctNo(c) && String(a.accountNumber ?? '') !== String(a[CONFIRM_KEY] ?? '')) e[`accounts.${i}.${CONFIRM_KEY}`] = 'Account numbers do not match.';
  });
  if (c.inventory && d.groups.length > c.inventory.maxRows) e.groups = `At most ${c.inventory.maxRows} rows are allowed.`;
  if (c.inventory && preparedGroups(c,d).reduce((sum,g)=>sum+num0(g[c.inventory!.mappings.count]),0)>c.inventory.maxRows) e.groups = `At most ${c.inventory.maxRows} ${c.inventory.kind} can be created.`;
  if (typeof c.rules.maxPartners === 'number' && d.partners.length > c.rules.maxPartners) e.partners = `At most ${c.rules.maxPartners} partners are allowed.`;
  if (typeof c.rules.maxAccounts === 'number' && d.accounts.length > c.rules.maxAccounts) e.accounts = `At most ${c.rules.maxAccounts} accounts are allowed.`;
  d.documents.forEach((x, i) => {
    e = { ...e, ...rowErrors(c.documentFields, x, `documents.${i}`) };
    if (!c.documentFields.length) e[`documents.${i}.category`] = 'Document fields are not configured for this release.';
  });
  const allocation = allocationPolicy(c);
  if (allocation) {
    const equity = d.partners.reduce((sum, p) => sum + num0(p[allocation.equityField]), 0);
    const capital = d.partners.reduce((sum, p) => sum + num0(p[allocation.capitalField]), 0);
    const budget = num0(d.values[allocation.budgetField]);
    if (equity > allocation.totalPercent + Number.EPSILON) e.partners = 'Partner equity exceeds the project total.';
    if (capital > budget + Number.EPSILON) e.partners = 'Planned partner capital exceeds the project cost.';
    if (d.partners.length && Math.abs(equity - allocation.totalPercent) > 0.000001) e.partners = 'Allocate the full project equity before creating the project.';
  }
  return e;
}

export function buildSetup(c: SetupConfig, d: SetupDraft) {
  const values: Row = {};
  for (const s of c.sections) Object.assign(values, typedRow(s.fields, d.values));
  for (const [k, v] of Object.entries(d.values)) if (!(k in values) && !c.sections.some((s) => s.fields.some((f) => f.key === k)) && typeof v === 'string' && v.trim()) values[k] = v.trim();
  return {
    values,
    settings: typedRow(c.settingsFields, applyDefaults(c.settingsFields, d.settings)),
    groups: preparedGroups(c, d).map((g) => typedRow(c.inventory?.fields ?? [], g)),
    partners: d.partners.map((p) => typedRow(c.partnerFields, p)),
    accounts: d.accounts.map((a) => typedRow(c.accountFields, a, [CONFIRM_KEY])),
    documents: d.documents.map((x) => typedRow(c.documentFields, x)),
  };
}

/** Rebuilds an editable draft from saved setupData; unknown shapes are ignored rather than guessed. */
export function hydrate(data: unknown, c: SetupConfig): SetupDraft {
  const d = emptyDraft();
  if (!isObj(data)) return d;
  const str = (r: Row) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v]));
  const rows = (x: unknown) => (Array.isArray(x) ? x.filter(isObj).map(str) : []);
  if (isObj(data.values)) d.values = str(data.values);
  if (isObj(data.settings)) d.settings = str(data.settings);
  d.groups = rows(data.groups); d.partners = rows(data.partners); d.documents = rows(data.documents);
  d.accounts = rows(data.accounts).map((a) => (hasAcctNo(c) ? { ...a, [CONFIRM_KEY]: a.accountNumber ?? '' } : a));
  return d;
}

export function applyDefaults(fields: SetupField[], row: Row): Row {
  const out = { ...row };
  for (const f of fields) if (out[f.key] === undefined && f.default !== undefined) out[f.key] = typeof f.default === 'number' ? String(f.default) : f.default;
  return out;
}

export interface SavedEntity { id: string; revision: number; setupState?: string }
export function readEntity(res: unknown): SavedEntity {
  const e = isObj(res) && isObj(res.entity) ? res.entity : null;
  if (!e || typeof e.id !== 'string' || typeof e.revision !== 'number') throw new Error('The server did not return the saved project.');
  return { id: e.id, revision: e.revision, setupState: typeof e.setupState === 'string' ? e.setupState : undefined };
}
export interface NewAccess { mobile: string; reused: boolean; temporaryCredential?: string; expiresAt?: string }
export function readAccess(res: unknown): NewAccess[] {
  const ent = isObj(res) && isObj(res.entity) ? res.entity : null;
  const a = ent && Array.isArray(ent.access) ? ent.access : [];
  return a.filter(isObj).filter((x) => typeof x.mobile === 'string').map((x) => ({ mobile: String(x.mobile), reused: x.reused === true, temporaryCredential: typeof x.temporaryCredential === 'string' ? x.temporaryCredential : undefined, expiresAt: typeof x.expiresAt === 'string' ? x.expiresAt : undefined }));
}
export function readSetupState(p: unknown): { state?: 'DRAFT' | 'READY'; data?: unknown } {
  const o = isObj(p) ? p : {};
  return { state: o.setupState === 'DRAFT' || o.setupState === 'READY' ? o.setupState : undefined, data: o.setupData };
}

/* ---------- live previews from configured mappings ---------- */
export interface InvPreview { rows: number; count: number; area: number; value: number | null }
export function inventoryPreview(c: SetupConfig, groups: Row[]): InvPreview | null {
  const m = c.inventory?.mappings;
  if (!c.inventory || !m || !m.count || !m.area) return null;
  let count = 0; let area = 0; let value = 0; let rated = false;
  for (const g of groups) {
    const n = Number(g[m.count]); const a = Number(g[m.area]); const r = Number(g[m.rate]);
    if (!Number.isFinite(n) || !Number.isFinite(a) || n <= 0 || a <= 0) continue;
    count += n; area += n * a;
    if (Number.isFinite(r) && r > 0) { value += n * a * r; rated = true; }
  }
  return { rows: groups.length, count, area, value: rated ? value : null };
}
export const num0 = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
interface AllocationPolicy {
  budgetField: string; capitalField: string; equityField: string; totalPercent: number; currencyScale: number;
}
export function allocationPolicy(c: SetupConfig): AllocationPolicy | null {
  const p = c.rules.capitalAllocation;
  if (!isObj(p) || p.mode !== 'equity-linked') return null;
  if (typeof p.budgetField !== 'string' || typeof p.capitalField !== 'string' || typeof p.equityField !== 'string' ||
      typeof p.totalPercent !== 'number' || p.totalPercent <= 0 || typeof p.currencyScale !== 'number' ||
      !Number.isInteger(p.currencyScale) || p.currencyScale < 0 || p.currencyScale > 6) throw new Error('The capital allocation configuration is invalid.');
  return p as unknown as AllocationPolicy;
}
/** Capital is a planned budget allocation, never a receipt or a ledger balance. */
export function reconcilePartnerCapital(c: SetupConfig, d: SetupDraft): SetupDraft {
  const p = allocationPolicy(c);
  if (!p) return d;
  const factor = 10 ** p.currencyScale;
  const budget = num0(d.values[p.budgetField]);
  const shares = d.partners.reduce((sum, row) => sum + num0(row[p.equityField]), 0);
  let used = 0;
  return { ...d, partners: d.partners.map((row, index) => {
    const raw = row[p.equityField];
    if (raw === undefined || raw === '' || !Number.isFinite(Number(raw))) return row;
    let amount = Math.round(budget * Number(raw) / p.totalPercent * factor);
    if (index === d.partners.length - 1 && Math.abs(shares - p.totalPercent) < 0.000001) amount = Math.round(budget * factor) - used;
    used += amount;
    return { ...row, [p.capitalField]: String(amount / factor) };
  }) };
}
export function updatePartnerAllocation(c: SetupConfig, d: SetupDraft, index: number, key: string, value: unknown): SetupDraft {
  const p = allocationPolicy(c);
  if (p && key === p.capitalField) return d; // calculated; the API also verifies this value
  return reconcilePartnerCapital(c, { ...d, partners: d.partners.map((r, i) => i === index ? { ...r, [key]: value } : r) });
}
/** Inactive matrix categories do not become inventory; invalid nonempty counts still validate. */
export function preparedGroups(c: SetupConfig, d: SetupDraft): Row[] {
  const inv = c.inventory;
  if (!inv || c.rules.inventoryNumbering !== 'sequential') return d.groups;
  let cursor = Number(inv.fields.find((f) => f.key === 'startNumber')?.default);
  if (!Number.isSafeInteger(cursor)) throw new Error('Configure the first inventory number.');
  return d.groups.filter((g) => {
    const n = g[inv.mappings.count];
    return n !== undefined && n !== '' && Number(n) !== 0;
  }).map((g) => {
    const row = applyDefaults(inv.fields, g);
    if (row[inv.mappings.rate] === undefined || row[inv.mappings.rate] === '') row[inv.mappings.rate] = d.values[inv.rateField];
    row.startNumber = String(cursor);
    const count = Number(row[inv.mappings.count]);
    if (Number.isSafeInteger(count) && count > 0) cursor += count;
    return row;
  });
}
/** Rounds so that shares sum exactly to total; the remainder goes to the last row. */
export function equalShares(n: number, total: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor((total / n) * 100) / 100;
  const out = Array<number>(n).fill(each);
  out[n - 1] = Math.round((total - each * (n - 1)) * 100) / 100;
  return out;
}
