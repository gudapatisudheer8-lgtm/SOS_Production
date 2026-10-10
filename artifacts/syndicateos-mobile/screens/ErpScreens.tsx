import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { ErpField, ErpRecord, ErpResource, Project, ProjectErp, SessionAccount } from '@workspace/api-client-react';
import { Badge, Banner, Btn, Card, Chips, Confirm, Empty, Field, Label, Skeleton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { T, type Lang, type TKey } from '@/lib/i18n';
import { newRequestId, useErp, useErpCommands } from '@/lib/erp';
import { errMessage } from '@/lib/session';
import { attachmentsSupported, fetchAttachmentBlob, pickFile, saveBlob, startRecording, uploadAttachment, type Recorder } from '@/lib/attachments';

/* ---------- language store (partner en/te) ---------- */
const ls = Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : null;
let lang: Lang = ls?.getItem('syndicate_partner_lang') === 'te' ? 'te' : 'en';
const subs = new Set<() => void>();
export const setLang = (l: Lang) => { lang = l; ls?.setItem('syndicate_partner_lang', l); subs.forEach((f) => f()); };
export function useLang() {
  const l = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => lang, () => lang);
  const strip = (x: string) => x.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u2713\u23F3]/gu, '').trim();
  return { lang: l, t: (k: TKey) => strip(((T[l] as Record<string, string>)[k]) || (T.en as Record<string, string>)[k] || String(k)) };
}
export function LangToggle() {
  const { lang: l } = useLang();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {(['en', 'te'] as Lang[]).map((x) => (
        <Pressable key={x} onPress={() => setLang(x)} accessibilityRole="button" style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: l === x ? '#FFB800' : '#e5e7eb' }}>
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 12, color: '#111827' }}>{x === 'en' ? 'English' : 'తెలుగు'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ---------- cross-screen navigation (partner quick actions) ---------- */
export interface NavIntent { kind: string; create?: boolean }
let navHandler: ((i: NavIntent) => boolean) | null = null;
let pendingIntent: NavIntent | null = null;
export const registerNav = (f: ((i: NavIntent) => boolean) | null) => { navHandler = f; };
export const navTo = (i: NavIntent): boolean => { pendingIntent = i.create ? i : null; const ok = navHandler ? navHandler(i) : false; if (!ok) pendingIntent = null; return ok; };
export const takeIntent = (kind: string): NavIntent | null => { if (pendingIntent && pendingIntent.kind === kind) { const i = pendingIntent; pendingIntent = null; return i; } return null; };

export interface ErpCtx { project: Project | null; account: SessionAccount; }

/* ---------- helpers ---------- */
export const FINANCIAL = ['transactions', 'investments', 'expenses', 'settlements', 'stock-draws', 'drawings'];
export const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
export const live = (r: ErpRecord) => r.status !== 'deleted';
export const tone = (s: string): 'ok' | 'warn' | 'bad' | 'muted' => (s === 'approved' || s === 'available' || s === 'registered' ? 'ok' : s === 'pending' || s === 'reserved' || s === 'booked' ? 'warn' : s === 'rejected' || s === 'blocked' || s === 'deleted' ? 'bad' : 'muted');
export const money = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : str(v); };

export function label(r: ErpRecord): string {
  const d = r.data;
  return str(d.name || d.accountName || d.number || d.plotNumber || d.unitNumber || d.title || d.description || d.category || r.id.slice(0, 8));
}
export function recLabel(recs: ErpRecord[], id: unknown): string {
  const r = recs.find((x) => x.id === id);
  return r ? label(r) : str(id);
}

export function csvOf(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
}
export function downloadText(name: string, text: string, mime: string): string | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 'File export is available on web only in this build.';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  return null;
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 12 }}>
        <View style={{ backgroundColor: c.card, borderRadius: 18, maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center', borderWidth: 1, borderColor: c.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
            <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 17, flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10}><Feather name="x" size={20} color={c.foreground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Stat({ l, v, sub }: { l: string; v: string; sub?: string }) {
  const c = useColors();
  return (
    <Card style={{ minWidth: 140, flexGrow: 1, marginBottom: 0 }}>
      <Text style={{ color: c.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' }}>{l}</Text>
      <Text style={{ color: c.foreground, fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{v}</Text>
      {sub ? <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{sub}</Text> : null}
    </Card>
  );
}


/* ---------- attachments (web uploads; native capture not implemented) ---------- */
export function AttachmentField({ projectId, label: lab, value, onChange, voice }: { projectId: string; label: string; value: string; onChange: (v: string) => void; voice?: boolean }) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [rec, setRec] = useState<Recorder | null>(null);
  const up = async (blob: Blob, n: string) => {
    setBusy(true); setErr(null);
    try { const a = await uploadAttachment(projectId, blob, n); onChange(a.id); setName(a.fileName); } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };
  if (!attachmentsSupported) return <View style={{ marginBottom: 10 }}><Label>{lab}</Label><Text style={{ color: c.mutedForeground, fontSize: 12 }}>Attachments can be added from the web app. Native capture is not implemented yet.</Text></View>;
  return (
    <View style={{ marginBottom: 12 }}>
      <Label>{lab}</Label>
      {value ? <Text style={{ color: c.success, marginBottom: 6 }}>Attached: {name ?? value.slice(0, 8)}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={value ? 'Replace file' : voice ? 'Upload audio' : 'Choose file'} variant="ghost" icon="paperclip" loading={busy} onPress={() => void pickFile(voice ? 'audio/*' : undefined).then((f) => f && up(f, f.name))} />
        {voice ? <Btn label={rec ? 'Stop and attach' : 'Record voice memo'} variant="ghost" icon="mic" onPress={() => { if (rec) { const r = rec; setRec(null); void r.stop().then((b) => up(b, 'voice-memo.webm')); } else startRecording().then(setRec).catch((e) => setErr(errMessage(e))); }} /> : null}
        {value ? <Btn label="Remove" variant="ghost" onPress={() => { onChange(''); setName(null); }} /> : null}
      </View>
      {err ? <Text style={{ color: c.destructive, fontSize: 12, marginTop: 4 }}>{err}</Text> : null}
    </View>
  );
}

export function AttachmentView({ projectId, id, label: lab }: { projectId: string; id: string; label: string }) {
  const c = useColors();
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = async () => {
    setBusy(true); setErr(null);
    try { const b = await fetchAttachmentBlob(projectId, id); setBlob(b); setType(b.type); if (attachmentsSupported) setUrl(URL.createObjectURL(b)); } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };
  return (
    <View style={{ marginBottom: 10 }}>
      <Label>{lab}</Label>
      {!blob ? <Btn label="Open attachment" variant="ghost" icon="paperclip" loading={busy} onPress={open} /> : null}
      {url && type.startsWith('image/') ? <Image source={{ uri: url }} style={{ width: '100%', height: 240, borderRadius: 10 }} resizeMode="contain" /> : null}
      {url && type.startsWith('audio/') && Platform.OS === 'web' ? React.createElement('audio', { src: url, controls: true, style: { width: '100%' } }) : null}
      {blob ? <Btn label="Download" variant="ghost" icon="download" onPress={() => saveBlob(blob, `${lab}-${id.slice(0, 8)}`)} /> : null}
      {err ? <Text style={{ color: c.destructive, fontSize: 12 }}>{err}</Text> : null}
    </View>
  );
}

/* ---------- record form (server field definitions) ---------- */
type Opt = { value: string; label: string };
type XField = ErpField & { ui?: string; readOnly?: boolean; optionLabels?: Record<string, string>; decimalPlaces?: number };
export function RecordForm({ erp, res, rec, ctx, onDone, fixed }: { erp: ProjectErp; res: ErpResource; rec?: ErpRecord; ctx: ErpCtx; onDone: () => void; fixed?: Record<string, string> }) {
  const c = useColors();
  const fields = useMemo<ErpField[]>(() => res.kind === 'expenses' ? [...res.fields, ...(['receiptAttachmentId', 'voiceAttachmentId'] as const).filter((k) => !res.fields.some((x) => x.key === k)).map((k) => ({ key: k, label: k === 'receiptAttachmentId' ? 'Photo voucher / bill' : 'Voice memo', kind: 'text' as const, required: false }))] : res.fields, [res]);
  const cmd = useErpCommands(erp.projectId);
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    fields.forEach((f) => {
      const v = rec?.data[f.key];
      const dv = !rec && f.default !== undefined && f.default !== null ? String(f.default) : '';
      o[f.key] = v === undefined || v === null ? (f.kind === 'partner' && !rec ? ctx.account.identityId : f.kind === 'date' && !rec && f.required ? new Date().toISOString().slice(0, 10) : dv) : String(v);
    });
    return { ...o, ...(fixed ?? {}) };
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reqId] = useState(() => newRequestId());
  const live_ = erp.records.filter(live);
  const optsFor = (f: ErpField): Opt[] => {
    if (f.kind === 'account') return live_.filter((r) => r.kind === 'accounts').map((r) => ({ value: r.id, label: label(r) }));
    if (f.kind === 'partner') return erp.partners.map((p) => ({ value: p.id, label: p.name }));
    if (f.kind === 'inventory') return live_.filter((r) => r.kind === 'plots' || r.kind === 'units').map((r) => ({ value: r.id, label: `${label(r)} (${r.kind === 'plots' ? 'plot' : 'unit'})` }));
    if (f.kind === 'select') return (f.options ?? []).map((o) => ({ value: o, label: (f as XField).optionLabels?.[o] ?? o }));
    if (f.kind === 'boolean') return [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];
    return [];
  };
  const [confirmNo, setConfirmNo] = useState('');
  const hidden = (f: ErpField) => { const w = (f as ErpField & { visibleWhen?: { field: string; values: string[] } }).visibleWhen; return !!w && !w.values.includes((vals[w.field] ?? '').trim()); };
  const KNOWN = ['text', 'number', 'date', 'select', 'boolean', 'multiline', 'account', 'partner', 'inventory'];
  const badField = fields.find((f) => !KNOWN.includes(f.kind) && !/attachmentid$/i.test(f.key)) ?? fields.find((f) => f.kind === 'select' && !(f.options && f.options.length));
  const psRules = ((erp.projectSetup as { rules?: Record<string, unknown> } | undefined)?.rules ?? {}) as Record<string, unknown>;
  const needsConfirm = res.kind === 'accounts' && fields.some((f) => f.key === 'accountNumber') && psRules.accountNumberConfirmation !== false;
  const alloc = res.kind === 'partner-profiles' ? (psRules.capitalAllocation as { budgetField?: string; capitalField?: string; equityField?: string; totalPercent?: number; currencyScale?: number } | undefined) : undefined;
  const eqKey = alloc?.equityField ?? 'fixedEquityPercent';
  const capKey = alloc?.capitalField ?? 'initialCapital';
  const budget = alloc?.budgetField ? Number((ctx.project?.details as Record<string, unknown> | undefined)?.[alloc.budgetField]) : NaN;
  const pctNow = Number(vals[eqKey]);
  const factor = typeof alloc?.currencyScale === 'number' ? 10 ** alloc.currencyScale : NaN;
  const capNow = alloc && Number.isFinite(budget) && Number.isFinite(pctNow) && Number.isFinite(factor) && alloc.totalPercent
    ? Math.round(budget * pctNow / alloc.totalPercent * factor) / factor : null;
  const othersPct = alloc ? erp.records.filter((r) => r.kind === 'partner-profiles' && live(r) && r.status === 'approved' && r.id !== rec?.id).reduce((n, r) => n + (Number(r.data[eqKey]) || 0), 0) : 0;
  const totalPct = alloc?.totalPercent ?? 100;
  const submit = async () => {
    const e: Record<string, string> = {};
    const data: Record<string, unknown> = {};
    if (needsConfirm && (vals.accountNumber ?? '').trim() !== confirmNo.trim()) e.confirmAccountNumber = 'Account numbers do not match.';
    if (alloc) {
      if (!Number.isFinite(budget) || budget <= 0) e[eqKey] = 'The project budget is not set, so capital cannot be calculated.';
      else if (Number.isFinite(pctNow) && othersPct + pctNow > totalPct + 0.001) e[eqKey] = `Equity would total ${Math.round((othersPct + pctNow) * 100) / 100}%, above ${totalPct}%. ${Math.max(0, Math.round((totalPct - othersPct) * 100) / 100)}% remains.`;
      const otherCapital = erp.records.filter((r) => r.kind === 'partner-profiles' && live(r) && r.status === 'approved' && r.id !== rec?.id).reduce((sum, r) => sum + (Number(r.data[capKey]) || 0), 0);
      if (capNow !== null && otherCapital + capNow > budget) e[eqKey] = 'Combined planned capital exceeds the project cost.';
    }
    for (const f of fields) {
      if (hidden(f)) continue;
      if (alloc && f.key === capKey) { if (capNow !== null) data[f.key] = capNow; continue; }
      const t = (vals[f.key] ?? '').trim();
      if (!t) { if (f.required && (f as XField).ui !== 'hidden') e[f.key] = `${f.label} is required.`; continue; }
      if (f.kind === 'number') {
        const n = Number(t);
        if (!Number.isFinite(n)) { e[f.key] = `${f.label} must be a number.`; continue; }
        if (f.min !== undefined && n < f.min) { e[f.key] = `At least ${f.min}.`; continue; }
        if (f.max !== undefined && n > f.max) { e[f.key] = `At most ${f.max}.`; continue; }
        const places = (f as XField).decimalPlaces;
        if (places !== undefined && Math.abs(n - Number(n.toFixed(places))) > Number.EPSILON * Math.max(1, Math.abs(n))) { e[f.key] = `Use at most ${places} decimal places.`; continue; }
        data[f.key] = n;
      } else if (f.kind === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) { e[f.key] = 'Use YYYY-MM-DD.'; continue; }
        data[f.key] = t;
      } else if (f.kind === 'boolean') data[f.key] = t === 'true';
      else data[f.key] = t;
    }
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true); setMsg(null);
    try {
      await cmd.save(res.kind, data, { requestId: reqId, recordId: rec?.id, revision: rec?.revision });
      onDone();
    } catch (x) { setMsg(errMessage(x)); } finally { setBusy(false); }
  };
  if (badField) return <Banner tone="error" title="Configuration error" text={`Field "${badField.label}" is ${badField.kind === 'select' ? 'a select with no options defined' : `of unsupported kind "${badField.kind}"`}. This form cannot be used until the configuration is fixed.`} />;
  return (
    <View>
      {FINANCIAL.includes(res.kind) && !rec ? <Banner tone="warn" title="Starts as pending" text="Financial records are reviewed before they count. Approved financial records cannot be edited or deleted." /> : null}
      {fixed ? <Banner tone="warn" title="Linked record" text={`This entry is tied to ${Object.keys(fixed).map((k) => fields.find((f) => f.key === k)?.label ?? k).join(', ')} and cannot be changed here.`} /> : null}
      {alloc ? <Banner tone="warn" title={`Equity remaining: ${Math.max(0, Math.round((totalPct - othersPct) * 100) / 100)}% of ${totalPct}%`} text={Number.isFinite(budget) ? `Capital is calculated from the project budget of ${money(budget)}. It cannot exceed the budget.` : 'Project budget is not set.'} /> : null}
      {fields.filter((f) => !hidden(f) && (f as XField).ui !== 'hidden' && !(fixed && f.key in fixed)).map((f) => {
        if (alloc && f.key === capKey) return <View key={f.key} style={{ marginBottom: 10 }}><Label>{f.label} (calculated)</Label><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', backgroundColor: c.muted, borderRadius: 10, padding: 10 }}>{capNow !== null ? money(capNow) : '-'}</Text></View>;
        if ((f as XField).readOnly) return <View key={f.key} style={{ marginBottom: 10 }}><Label>{f.label}</Label><Text style={{ color: c.foreground, backgroundColor: c.muted, borderRadius: 10, padding: 10 }}>{vals[f.key] || '-'}</Text></View>;
        if (/attachmentid$/i.test(f.key)) return <View key={f.key}><AttachmentField projectId={erp.projectId} label={f.label + (f.required ? ' *' : '')} value={vals[f.key] ?? ''} voice={/voice/i.test(f.key)} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />{errs[f.key] ? <Text style={{ color: c.destructive, fontSize: 12 }}>{errs[f.key]}</Text> : null}</View>;
        const o = optsFor(f);
        const lab = f.label + (f.required ? ' *' : '');
        if (o.length || f.kind === 'select' || f.kind === 'account' || f.kind === 'partner' || f.kind === 'inventory' || f.kind === 'boolean') {
          return (
            <View key={f.key}>
              {o.length ? <Chips label={lab} options={f.required ? o : [{ value: '', label: 'None' }, ...o]} value={vals[f.key] ?? ''} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} /> : <View><Label>{lab}</Label><Text style={{ color: c.mutedForeground, marginBottom: 10 }}>No options available in this project yet.</Text></View>}
              {errs[f.key] ? <Text style={{ color: c.destructive, fontSize: 12, marginBottom: 8 }}>{errs[f.key]}</Text> : null}
            </View>
          );
        }
        return <Field key={f.key} label={lab} value={vals[f.key] ?? ''} onChangeText={(v) => setVals((s) => ({ ...s, [f.key]: v }))} multiline={f.kind === 'multiline'} keyboardType={f.kind === 'number' ? 'numeric' : 'default'} error={errs[f.key]} hint={f.kind === 'date' ? 'YYYY-MM-DD' : undefined} />;
      })}
      {needsConfirm ? <Field label="Confirm account number *" value={confirmNo} onChangeText={setConfirmNo} error={errs.confirmAccountNumber} hint="Used only to check for typing mistakes; it is not stored." /> : null}
      {res.kind === 'expenses' && vals.accountId && !hidden({ key: 'accountId', visibleWhen: fields.find((f) => f.key === 'accountId')?.visibleWhen } as ErpField) ? (() => { const b = erp.balances.find((x) => x.accountId === vals.accountId); return <Banner tone="warn" title={`Cleared balance: ${b ? money(Number(b.balance)) : 'not available'}`} text="Only cleared money is counted. This expense stays pending until independently approved and does not change the balance now." />; })() : null}
      {msg ? <Banner tone="error" title="Not saved" text={msg} /> : null}
      <Btn label={rec ? 'Save changes' : `Create ${res.title}`} onPress={submit} loading={busy} />
    </View>
  );
}

const nice = (r: ErpResource) => (r.kind === 'accounts' ? 'project bank account' : r.kind === 'partner-profiles' ? 'partner allocation' : r.title);

/* ---------- record detail with review / delete ---------- */
export function RecordDetail({ erp, res, rec, ctx, onClose, footer }: { erp: ProjectErp; res: ErpResource; rec: ErpRecord; ctx: ErpCtx; onClose: () => void; footer?: React.ReactNode }) {
  const c = useColors();
  const cmd = useErpCommands(erp.projectId);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (f: () => Promise<unknown>, close = true) => {
    setBusy(true); setMsg(null);
    try { await f(); if (close) onClose(); } catch (e) { setMsg(errMessage(e)); setDel(false); } finally { setBusy(false); }
  };
  const creator = erp.partners.find((p) => p.id === rec.createdBy)?.name;
  const attKeys = ['attachmentId', 'receiptAttachmentId', 'voiceAttachmentId'].filter((k) => str(rec.data[k]));
  const show = (f: ErpField): string => {
    const v = rec.data[f.key];
    if (v === undefined || v === null || v === '') return '-';
    if (f.kind === 'account' || f.kind === 'inventory') return recLabel(erp.records, v);
    if (f.kind === 'partner') return erp.partners.find((p) => p.id === v)?.name ?? str(v);
    if (f.kind === 'boolean') return v ? 'Yes' : 'No';
    if (f.kind === 'select') return (f as XField).optionLabels?.[str(v)] ?? str(v);
    return str(v);
  };
  if (edit) return <Dialog title={`Edit ${nice(res)}`} onClose={() => setEdit(false)}><RecordForm erp={erp} res={res} rec={rec} ctx={ctx} onDone={onClose} /></Dialog>;
  const pending = rec.status === 'pending';
  const own = rec.createdBy === ctx.account.identityId || (ctx.account.role === 'PARTNER' && str(rec.data.partnerId) === ctx.account.identityId);
  const canRev = res.canReview && pending && !own;
  return (
    <Dialog title={`${res.title}: ${label(rec)}`} onClose={onClose}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}><Badge text={rec.status} tone={tone(rec.status)} />{rec.data.status ? <Badge text={str(rec.data.status)} tone={tone(str(rec.data.status))} /> : null}</View>
      {res.fields.filter((f) => !/attachmentid$/i.test(f.key) && (f as XField).ui !== 'hidden').map((f) => (
        <View key={f.key} style={{ marginBottom: 10 }}>
          <Label>{f.label}</Label>
          <Text style={{ color: c.foreground, fontSize: 15 }}>{show(f)}</Text>
        </View>
      ))}
      {attKeys.map((k) => <AttachmentView key={k} projectId={erp.projectId} id={str(rec.data[k])} label={k === 'voiceAttachmentId' ? 'Voice memo' : k === 'receiptAttachmentId' ? 'Photo voucher / bill' : 'Document'} />)}
      <Text style={{ color: c.mutedForeground, fontSize: 12, marginVertical: 6 }}>Created {rec.createdAt.slice(0, 16).replace('T', ' ')}{creator ? ` by ${creator}` : ''} · revision {rec.revision} · {rec.votes.length} vote{rec.votes.length === 1 ? '' : 's'}{rec.votes.length ? `: ${rec.votes.map((v) => erp.partners.find((p) => p.id === v)?.name ?? 'reviewer').join(', ')}` : ''}</Text>
      {msg ? <Banner tone="error" title="Action refused" text={msg} /> : null}
      {res.canReview && pending && own ? <Banner tone="warn" title="Your own record" text="You cannot review a record you created or that is booked to you. Another reviewer must approve it." /> : null}
      {canRev ? (
        <View style={{ marginTop: 8 }}>
          <Field label="Review note (optional, shown on rejection)" value={reason} onChangeText={setReason} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Btn label="Approve" icon="check" loading={busy} onPress={() => void act(() => cmd.review(rec.id, rec.revision, 'approved', reason.trim() || undefined))} /></View>
            <View style={{ flex: 1 }}><Btn label="Reject" variant="danger" icon="x" loading={busy} onPress={() => void act(() => cmd.review(rec.id, rec.revision, 'rejected', reason.trim() || undefined))} /></View>
          </View>
        </View>
      ) : null}
      {res.canManage && rec.status !== 'deleted' ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Btn label="Edit" variant="ghost" icon="edit-2" onPress={() => setEdit(true)} /></View>
          <View style={{ flex: 1 }}><Btn label="Delete" variant="ghost" icon="trash-2" onPress={() => setDel(true)} /></View>
        </View>
      ) : null}
      {footer}
      {del ? <Confirm title="Delete record?" text="The server rejects deletion of approved financial records." confirmLabel="Delete" danger onCancel={() => setDel(false)} onConfirm={() => void act(() => cmd.remove(rec.id, rec.revision))} /> : null}
    </Dialog>
  );
}

/* ---------- generic resource list / grid ---------- */
export function ResourceView({ erp, kind, ctx }: { erp: ProjectErp; kind: string; ctx: ErpCtx }) {
  const c = useColors();
  const res = erp.resources.find((r) => r.kind === kind);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('all');
  const [grid, setGrid] = useState(kind === 'plots' || kind === 'units');
  const [sel, setSel] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const inventory = kind === 'plots' || kind === 'units';
  const rows = useMemo(() => erp.records.filter((r) => r.kind === kind && live(r)).filter((r) => {
    const s = inventory ? str(r.data.status) : r.status;
    if (st !== 'all' && s !== st) return false;
    return !q.trim() || JSON.stringify(r.data).toLowerCase().includes(q.trim().toLowerCase());
  }), [erp.records, kind, q, st, inventory]);
  if (!res) return <Empty icon="slash" title="Not available" text={`"${kind}" is not exposed to your role for this project.`} />;
  const statuses = inventory ? (res.fields.find((f) => f.key === 'status')?.options ?? Array.from(new Set(erp.records.filter((r) => r.kind === kind).map((r) => str(r.data.status)).filter(Boolean)))) : ['pending', 'approved', 'rejected'];
  const cur = rows.find((r) => r.id === sel) ?? erp.records.find((r) => r.id === sel) ?? null;
  const exportCsv = () => {
    const head = ['id', 'status', ...res.fields.map((f) => f.label)];
    const body = rows.map((r) => [r.id, r.status, ...res.fields.map((f) => (f.kind === 'account' || f.kind === 'inventory' ? recLabel(erp.records, r.data[f.key]) : f.kind === 'partner' ? erp.partners.find((p) => p.id === r.data[f.key])?.name ?? str(r.data[f.key]) : str(r.data[f.key])))]);
    setNote(downloadText(`${kind}.csv`, csvOf([head, ...body]), 'text/csv'));
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 20 }}>{res.title} <Text style={{ color: c.mutedForeground, fontSize: 14 }}>({rows.length})</Text></Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {inventory ? <Btn label={grid ? 'Table' : 'Grid'} variant="ghost" icon={grid ? 'list' : 'grid'} onPress={() => setGrid(!grid)} /> : null}
          <Btn label="CSV" variant="ghost" icon="download" onPress={exportCsv} disabled={!rows.length} />
          {res.canCreate ? <Btn label="Add" icon="plus" onPress={() => setCreating(true)} /> : null}
        </View>
      </View>
      {note ? <Banner tone="warn" title={note} /> : null}
      {!res.canCreate && !res.canManage && !res.canReview ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>View only for your role.</Text> : null}
      <Field label="Search" value={q} onChangeText={setQ} placeholder="Filter records" />
      <Chips label="Status" options={[{ value: 'all', label: 'All' }, ...statuses.map((s) => ({ value: s, label: s }))]} value={st} onChange={setSt} />
      {rows.length === 0 ? <Empty icon="inbox" title={`No ${res.title.toLowerCase()} found`} text={erp.records.some((r) => r.kind === kind && live(r)) ? 'No record matches the filters.' : res.canCreate ? 'Use Add to create the first record.' : 'Nothing has been recorded yet.'} /> : grid ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {rows.map((r) => {
            const s = str(r.data.status);
            const bg = tone(s) === 'ok' ? c.successSurface : tone(s) === 'warn' ? c.warningSurface : tone(s) === 'bad' ? '#f6dedb' : c.muted;
            return (
              <Pressable key={r.id} onPress={() => setSel(r.id)} accessibilityRole="button" style={{ width: 96, padding: 10, borderRadius: 12, backgroundColor: bg, borderWidth: 1, borderColor: c.border }}>
                <Text numberOfLines={1} style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{label(r)}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{s || r.status}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : rows.map((r) => (
        <Pressable key={r.id} onPress={() => setSel(r.id)} accessibilityRole="button">
          <Card style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', flex: 1 }} numberOfLines={1}>{label(r)}</Text>
              <Badge text={inventory ? str(r.data.status) || r.status : r.status} tone={tone(inventory ? str(r.data.status) : r.status)} />
            </View>
            <Text style={{ color: c.mutedForeground, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
              {res.fields.filter((f) => f.kind === 'number' || f.kind === 'date').slice(0, 3).map((f) => `${f.label}: ${f.kind === 'number' ? money(r.data[f.key]) : str(r.data[f.key])}`).join('  ·  ')}
            </Text>
          </Card>
        </Pressable>
      ))}
      {creating ? <Dialog title={res.kind === 'accounts' ? 'New project bank account' : res.kind === 'partner-profiles' ? 'Partner allocation' : `New ${res.title}`} onClose={() => setCreating(false)}><RecordForm erp={erp} res={res} ctx={ctx} onDone={() => setCreating(false)} /></Dialog> : null}
      {cur ? <RecordDetail erp={erp} res={res} rec={cur} ctx={ctx} onClose={() => setSel(null)} /> : null}
    </View>
  );
}

/* ---------- dashboard ---------- */
export function Dashboard({ erp }: { erp: ProjectErp }) {
  const c = useColors();
  const { t } = useLang();
  const live_ = erp.records.filter(live);
  const plots = live_.filter((r) => r.kind === 'plots');
  const sum = (k: 'invested' | 'drawings' | 'expenses') => erp.partners.reduce((n, p) => n + (Number(p[k]) || 0), 0);
  const pend = live_.filter((r) => r.status === 'pending').length;
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <Stat l="Invested" v={money(sum('invested'))} />
        <Stat l="Expenses" v={money(sum('expenses'))} />
        <Stat l="Drawings" v={money(sum('drawings'))} />
        <Stat l="Pending review" v={String(pend)} />
        <Stat l={t('totalPlots')} v={String(plots.length)} sub={`${plots.filter((p) => p.data.status === 'sold').length} sold · ${plots.filter((p) => p.data.status === 'available').length} available`} />
      </View>
      <Card>
        <Label>PENDING APPROVALS</Label>
        {live_.filter((r) => r.status === 'pending').length === 0 ? <Text style={{ color: c.mutedForeground }}>Nothing is pending.</Text> : live_.filter((r) => r.status === 'pending').slice(0, 12).map((r) => {
          const who = erp.partners.find((p) => p.id === (r.data.partnerId ?? r.createdBy))?.name ?? erp.partners.find((p) => p.id === r.createdBy)?.name ?? 'Unknown submitter';
          const rs = erp.resources.find((x) => x.kind === r.kind);
          return <View key={r.id} style={{ paddingVertical: 5, borderTopWidth: 1, borderColor: c.border }}><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{rs?.title ?? r.kind}: {label(r)}</Text><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{who}{r.data.amount !== undefined ? ` · Rs ${money(r.data.amount)}` : ''} · {r.votes.length} sign-off(s)</Text></View>;
        })}
      </Card>
      <Card>
        <Label>ACCOUNT BALANCES</Label>
        {erp.balances.length === 0 ? <Text style={{ color: c.mutedForeground }}>No accounts yet.</Text> : erp.balances.map((b) => <View key={b.accountId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text style={{ color: c.foreground }}>{recLabel(erp.records, b.accountId)}</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{money(b.balance)}</Text></View>)}
      </Card>
    </View>
  );
}

/* ---------- equity ---------- */
export function Equity({ erp }: { erp: ProjectErp }) {
  const c = useColors();
  return (
    <View>
      <Text style={{ color: c.mutedForeground, marginBottom: 10 }}>Split mode: {str(erp.settings.equitySplitMode) || 'not set'} · figures computed by the server.</Text>
      {erp.partners.length === 0 ? <Empty icon="users" title="No partners" /> : erp.partners.map((p) => (
        <Card key={p.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{p.name}</Text><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{p.mobile}</Text></View>
            <Text style={{ color: c.primary, fontFamily: 'Inter_700Bold', fontSize: 20 }}>{p.equityPercent}%</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: c.muted, marginVertical: 8 }}><View style={{ height: 6, borderRadius: 3, backgroundColor: '#FFB800', width: `${Math.min(100, Math.max(0, Number(p.equityPercent) || 0))}%` }} /></View>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Invested {money(p.invested)} · Expenses {money(p.expenses)} · Drawings {money(p.drawings)}</Text>
        </Card>
      ))}
    </View>
  );
}

export function KV({ title, data }: { title: string; data: unknown }) {
  const c = useColors();
  const entries = data && typeof data === 'object' ? Object.entries(data as Record<string, unknown>) : [];
  return (
    <Card>
      <Label>{title.toUpperCase()}</Label>
      {entries.length === 0 ? <Text style={{ color: c.mutedForeground }}>Not configured. Set it in Settings.</Text> : entries.map(([k, v]) => <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 8 }}><Text style={{ color: c.foreground }}>{k}</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', flexShrink: 1, textAlign: 'right' }}>{typeof v === 'object' ? JSON.stringify(v) : str(v)}</Text></View>)}
    </Card>
  );
}

function Layout({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  return <View><KV title="Layout calculation" data={erp.settings.layoutCalculation} /><ResourceView erp={erp} kind="plots" ctx={ctx} /></View>;
}

/* ---------- statement ---------- */
function Statement({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const [note, setNote] = useState<string | null>(null);
  const tx = erp.statement || [];
  const exportCsv = () => setNote(downloadText('project-statement.csv', csvOf([['Date', 'Account', 'Type', 'Description', 'Amount', 'Status', 'Posted account movement'], ...tx.map((r) => [r.date, r.accountName, r.type, r.description, r.amount, r.status, r.affectsCash ? 'yes' : 'no'])]), 'text/csv'));
  const print = () => { if (Platform.OS === 'web' && typeof window !== 'undefined') window.print(); else setNote('Printing is available on web only in this build.'); };
  void ctx;
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}><Btn label="Export CSV" icon="download" variant="ghost" onPress={exportCsv} disabled={!tx.length} /><Btn label="Print" icon="printer" variant="ghost" onPress={print} /></View>
      {note ? <Banner tone="warn" title={note} /> : null}
      <Equity erp={erp} />
      <Card>
        <Label>ACCOUNT BALANCES (APPROVED)</Label>
        {erp.balances.length === 0 ? <Text style={{ color: c.mutedForeground }}>No accounts.</Text> : erp.balances.map((b) => <View key={b.accountId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text style={{ color: c.foreground }}>{recLabel(erp.records, b.accountId)}</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{money(b.balance)}</Text></View>)}
      </Card>
      <Card>
        <Label>PROJECT FINANCIAL ENTRIES</Label>
        {tx.length === 0 ? <Text style={{ color: c.mutedForeground }}>No financial entries yet.</Text> : tx.map((r) => <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: 8 }}><Text style={{ color: c.foreground, flex: 1 }}>{r.date} · {r.accountName} · {r.description} · {r.status}</Text><Text style={{ color: c.foreground }}>{r.type === 'credit' ? '+' : '−'}{money(r.amount)}</Text></View>)}
      </Card>
    </View>
  );
}

export function Audit({ erp }: { erp: ProjectErp }) {
  const c = useColors();
  const [q, setQ] = useState(''); const [actor, setActor] = useState('all'); const [act, setAct] = useState('all');
  const [date, setDate] = useState('all'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const who = (id: string) => erp.partners.find((p) => p.id === id)?.name ?? id;
  const actors = Array.from(new Set(erp.audit.map((a) => a.actor)));
  const events = Array.from(new Set(erp.audit.map((a) => a.event)));
  const now = new Date(); const today = now.toISOString().slice(0, 10);
  const rows = erp.audit.filter((a) => {
    const d = a.timestamp.slice(0, 10);
    if (actor !== 'all' && a.actor !== actor) return false;
    if (act !== 'all' && a.event !== act) return false;
    if (date === 'today' && d !== today) return false;
    if (date === 'last7' && d < new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)) return false;
    if (date === 'last30' && d < new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)) return false;
    if (date === 'custom' && ((from && d < from) || (to && d > to))) return false;
    const t = q.trim().toLowerCase();
    return !t || `${a.event} ${who(a.actor)}`.toLowerCase().includes(t);
  });
  if (!erp.audit.length) return <Empty icon="clock" title="No audit events" />;
  return (
    <View>
      <Card>
        <Label>AUDIT FILTERS</Label>
        <Field label="Search action or actor" value={q} onChangeText={setQ} />
        <Chips label="Actor" options={[{ value: 'all', label: 'Everyone' }, ...actors.map((x) => ({ value: x, label: who(x) }))]} value={actor} onChange={setActor} />
        <Chips label="Action" options={[{ value: 'all', label: 'All actions' }, ...events.map((x) => ({ value: x, label: x }))]} value={act} onChange={setAct} />
        <Chips label="Date" options={[['all', 'All time'], ['today', 'Today'], ['last7', 'Last 7 days'], ['last30', 'Last 30 days'], ['custom', 'Custom']].map(([value, l]) => ({ value, label: l }))} value={date} onChange={setDate} />
        {date === 'custom' ? <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Field label="From" value={from} onChangeText={setFrom} hint="YYYY-MM-DD" /></View><View style={{ flex: 1 }}><Field label="To" value={to} onChangeText={setTo} hint="YYYY-MM-DD" /></View></View> : null}
      </Card>
      <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 6 }}>{rows.length} of {erp.audit.length} events</Text>
      {rows.length === 0 ? <Empty icon="search" title="No events match" /> : rows.map((a) => <Card key={a.id} style={{ padding: 12 }}><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{a.event}</Text><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{who(a.actor)} · {a.timestamp.slice(0, 16).replace('T', ' ')}</Text></Card>)}
    </View>
  );
}

/* ---------- entry point ---------- */
export const ERP_KEYS = ['erp-dashboard', 'erp-resource', 'erp-equity', 'erp-layout', 'erp-pricing', 'erp-statement', 'erp-audit', 'erp-settings', 'erp-plan'];

type Bespoke = (k: string, p: Record<string, unknown>, erp: ProjectErp, ctx: ErpCtx) => React.ReactNode | null;
let bespoke: Bespoke | null = null;
export const registerBespoke = (f: Bespoke) => { bespoke = f; };

export function ErpComponent({ compKey, props, ctx }: { compKey: string; props: Record<string, unknown>; ctx: ErpCtx }) {
  const q = useErp(ctx.project?.id);
  if (!ctx.project) return <Empty icon="mouse-pointer" title="Select a project first" text="Choose a project from the selector above." />;
  if (q.isLoading) return <Skeleton lines={5} />;
  if (q.isError || !q.data) return <Banner tone="error" title="Project data could not load" text={errMessage(q.error)} action={{ label: 'Retry', onPress: () => void q.refetch() }} />;
  const erp = q.data;
  const custom = bespoke ? bespoke(compKey, props, erp, ctx) : null;
  if (custom) return <>{custom}</>;
  switch (compKey) {
    case 'erp-dashboard': return <Dashboard erp={erp} />;
    case 'erp-resource': return <ResourceView erp={erp} kind={str(props.resource)} ctx={ctx} />;
    case 'erp-equity': return <Equity erp={erp} />;
    case 'erp-layout': return <Layout erp={erp} ctx={ctx} />;
    case 'erp-pricing': return <View><KV title="Pricing matrix" data={erp.settings.pricingMatrix} /><ResourceView erp={erp} kind="units" ctx={ctx} /></View>;
    case 'erp-statement': return <Statement erp={erp} ctx={ctx} />;
    case 'erp-audit': return <Audit erp={erp} />;
    default: return <Banner tone="warn" title="Unsupported component" text={compKey} />;
  }
}
