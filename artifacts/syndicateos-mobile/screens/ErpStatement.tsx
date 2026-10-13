import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { ErpField, ErpRecord, FinancialStatementEntry, ProjectErp } from '@workspace/api-client-react';
import { Badge, Banner, Btn, Card, Chips, Empty, Field, Label } from '@/components/ui';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { newRequestId, useErpCommands } from '@/lib/erp';
import { errMessage } from '@/lib/session';
import { csvOf, Dialog, label, live, money, recLabel, str, tone, useLang, RecordDetail, RecordForm, takeIntent, type ErpCtx } from '@/screens/ErpScreens';
import { exportText, printTable } from '@/lib/exportFile';
import { generateTallyCSV, generateTallyXML, type Voucher } from '@/lib/sourceCalc';

const nv = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
export interface StmtRow { id: string; date: string; kind: string; accountId: string; account: string; party: string; desc: string; mode: string; amount: number; flow: 'credit' | 'debit'; status: string; category: string; rec?: ErpRecord; affectsCash?: boolean; by: string; entry?: FinancialStatementEntry }
type SortCol = 'date' | 'kind' | 'account' | 'party' | 'desc' | 'amount' | 'by';
const KINDS = ['transactions', 'investments', 'expenses', 'bookings', 'drawings', 'settlements', 'stock-draws'];

export function buildRows(erp: ProjectErp): StmtRow[] {
  return (erp.statement || []).map((r) => ({
    id: r.id, date: r.date, kind: r.kind, accountId: r.accountId, account: r.accountName,
    party: r.partnerName || '', desc: r.description, mode: r.paymentMode || '', amount: nv(r.amount),
    flow: r.type, status: r.postingState, category: r.category || '', affectsCash: r.affectsCash,
    rec: erp.records.find((record) => record.id === r.id), entry: r,
    by: (() => { const rec = erp.records.find((record) => record.id === r.id); if (!rec) return ''; const named = (rec as ErpRecord & { createdByName?: string }).createdByName; return named || erp.partners.find((p) => p.id === rec.createdBy)?.name || erp.audit.find((a) => a.event.includes(rec.id))?.actor || ''; })(),
  }));
}

const FLOW = [{ value: 'all', label: 'All' }, { value: 'credit', label: 'Inflows' }, { value: 'debit', label: 'Outflows' }];
const CATS = [{ value: 'all', label: 'All categories' }, { value: 'booking_advances', label: 'Booking advances' }, { value: 'site_expenses', label: 'Site expenses' }, { value: 'partner_capital_draws', label: 'Partner capital / draws' }, { value: 'contractor_vendor', label: 'Contractor / vendor' }];
const DATES = [{ value: 'all', label: 'All time' }, { value: 'month', label: 'This month' }, { value: 'last30', label: 'Last 30 days' }, { value: 'custom', label: 'Custom range' }];
const MODES = ['Cash', 'Cheque', 'RTGS / NEFT', 'UPI'];

export function useRowFilters(rows: StmtRow[]) {
  const [flow, setFlow] = useState('all'); const [cat, setCat] = useState('all'); const [acct, setAcct] = useState('all');
  const [st, setSt] = useState('all'); const [date, setDate] = useState('all'); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [mode, setMode] = useState('all'); const [q, setQ] = useState(''); const [sort, setSort] = useState('newest'); const [col, setCol] = useState<SortCol | null>(null); const [asc, setAsc] = useState(false);
  const out = useMemo(() => {
    const now = new Date(); const today = now.toISOString().slice(0, 10);
    const ago = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const list = rows.filter((r) => {
      if (flow !== 'all' && r.flow !== flow) return false;
      if (st !== 'all' && r.by !== st) return false;
      if (cat !== 'all' && r.category !== cat) return false;
      if (acct !== 'all' && r.accountId !== acct) return false;
      if (mode !== 'all' && r.mode !== mode) return false;
      if (date === 'month' && r.date.slice(0, 7) !== today.slice(0, 7)) return false;
      if (date === 'last30' && (r.date < ago || r.date > today)) return false;
      if (date === 'custom' && ((from && r.date < from) || (to && r.date > to))) return false;
      const t = q.trim().toLowerCase();
      return !t || `${r.desc} ${r.party} ${r.account} ${r.kind} ${r.mode} ${r.amount}`.toLowerCase().includes(t);
    });
    if (col) { const k = (r: StmtRow) => (col === 'amount' ? r.amount : col === 'date' ? r.date : (r[col] || '').toLowerCase()); return list.sort((a, b) => { const x = k(a), y = k(b); const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return asc ? d : -d; }); }
    return list.sort((a, b) => (sort === 'newest' ? b.date.localeCompare(a.date) : sort === 'oldest' ? a.date.localeCompare(b.date) : b.amount - a.amount));
  }, [rows, flow, st, cat, acct, mode, date, from, to, q, sort, col, asc]);
  const sortBy = (k: SortCol) => { if (col === k) setAsc(!asc); else { setCol(k); setAsc(k !== 'amount' && k !== 'date'); } };
  return { out, rows, state: { flow, cat, acct, st, date, from, to, mode, q, sort, col, asc }, sortBy, set: { setFlow, setCat, setAcct, setSt, setDate, setFrom, setTo, setMode, setQ, setSort } };
}

export function Filters({ erp, f }: { erp: ProjectErp; f: ReturnType<typeof useRowFilters> }) {
  const accts = erp.records.filter((r) => r.kind === 'accounts' && live(r));
  const { state: s, set } = f;
  return (
    <Card>
      <Label>STATEMENT FILTERS AND SEARCH</Label>
      <Field label="Search" value={s.q} onChangeText={set.setQ} placeholder="Description, party, account, amount" />
      <Chips label="Flow" options={FLOW} value={s.flow} onChange={set.setFlow} />
      <Chips label="Category" options={CATS} value={s.cat} onChange={set.setCat} />
      <Chips label="Account" options={[{ value: 'all', label: 'All accounts' }, ...accts.map((a) => ({ value: a.id, label: label(a) }))]} value={s.acct} onChange={set.setAcct} />
      {(() => { const bys = Array.from(new Set(f.rows.map((r) => r.by).filter(Boolean))); return bys.length ? <Chips label="Enrolled by" options={[{ value: 'all', label: 'Anyone' }, ...bys.map((b) => ({ value: b, label: b }))]} value={s.st} onChange={set.setSt} /> : null; })()}
      <Chips label="Mode" options={[{ value: 'all', label: 'Any mode' }, ...MODES.map((m) => ({ value: m, label: m }))]} value={s.mode} onChange={set.setMode} />
      <Chips label="Date" options={DATES} value={s.date} onChange={set.setDate} />
      {s.date === 'custom' ? <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><Field label="From" value={s.from} onChangeText={set.setFrom} hint="YYYY-MM-DD" /></View><View style={{ flex: 1 }}><Field label="To" value={s.to} onChangeText={set.setTo} hint="YYYY-MM-DD" /></View></View> : null}
      <Chips label="Sort" options={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'amount', label: 'Largest' }]} value={s.sort} onChange={set.setSort} />
    </Card>
  );
}

function TallyModal({ erp, rows, onClose }: { erp: ProjectErp; rows: StmtRow[]; onClose: () => void }) {
  const c = useColors();
  const [fmt, setFmt] = useState<'xml' | 'csv'>('xml');
  const [note, setNote] = useState<string | null>(null);
  const mode = str(erp.settings.ledgerMode);
  const vouchers: Voucher[] = rows.filter((r) => r.affectsCash && r.amount > 0).map((r) => ({
    date: r.date, voucherType: r.flow === 'credit' ? 'Receipt' : 'Payment',
    ledgerName: r.account !== '-' ? r.account : r.kind === 'stock-draws' ? 'Stock' : `Partner Payable: ${r.party || 'Unspecified'}`,
    amount: r.amount, narration: `${r.kind} ${r.desc}`.slice(0, 200),
    contraLedger: r.kind === 'investments' ? `Partner Capital: ${r.party}` : r.kind === 'bookings' ? 'Customer Advances' : r.kind === 'drawings' || r.kind === 'stock-draws' ? `Partner Drawings: ${r.party}` : r.kind === 'expenses' ? `Site Expenses: ${r.rec?.data.category || r.category}` : r.kind === 'settlements' ? 'Counter Sales' : str(r.rec?.data.category) || 'Other Transactions',
  }));
  const firm = `Project ${erp.projectId.slice(0, 8)}`;
  const text = fmt === 'xml' ? generateTallyXML(firm, vouchers) : generateTallyCSV(firm, vouchers);
  return (
    <Dialog title="TallyPrime / ERP9 export: draft vouchers" onClose={onClose}>
      <Banner tone="warn" title={`Ledger view: ${mode || 'internal_syndicate'}`} text={`${vouchers.length} recorded voucher(s) from the filtered statement, including reversals. Unposted records are excluded. Check ledger mappings with your accountant before import; this is not a tax filing.`} />
      <Chips options={[{ value: 'xml', label: 'Tally XML (.xml)' }, { value: 'csv', label: 'Bank Excel CSV (.csv)' }]} value={fmt} onChange={setFmt} />
      <ScrollView horizontal style={{ backgroundColor: '#0b0f14', borderRadius: 10, maxHeight: 260, marginBottom: 10 }}><Text selectable style={{ color: '#6ee7b7', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 11, padding: 10 }}>{text.slice(0, 6000)}{text.length > 6000 ? '\n... preview truncated, download has the full file' : ''}</Text></ScrollView>
      {note ? <Banner tone="warn" title={note} /> : null}
      <Btn label={`Download .${fmt}`} icon="download" disabled={!vouchers.length} onPress={() => void exportText(`official_tax_${fmt}.${fmt}`, text, fmt === 'xml' ? 'application/xml' : 'text/csv').then(() => setNote(null), (e) => setNote(`Export failed: ${errMessage(e)}`))} />
      {!vouchers.length ? <Text style={{ color: c.mutedForeground, marginTop: 6 }}>No recorded account movements in the current filter.</Text> : null}
    </Dialog>
  );
}

export function RowList({ rows, onOpen }: { rows: StmtRow[]; onOpen?: (r: StmtRow) => void }) {
  const c = useColors();
  if (!rows.length) return <Empty icon="inbox" title="No entries match" text="Adjust the filters or add records." />;
  return (
    <View>
      {rows.map((r) => (
        <Pressable key={r.id} onPress={() => onOpen?.(r)} accessibilityRole="button">
          <Card style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }} numberOfLines={1}>{r.desc}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{r.date} · {r.kind} · {r.account}{r.party ? ` · ${r.party}` : ''}{r.mode ? ` · ${r.mode}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ color: r.flow === 'credit' ? c.success : c.destructive, fontFamily: 'Inter_700Bold' }}>{r.flow === 'credit' ? '+' : '-'}{money(r.amount)}</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}

export function ProjectStatement({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const { t } = useLang();
  const partner = ctx.account.role === 'PARTNER';
  const all = useMemo(() => buildRows(erp), [erp]);
  const f = useRowFilters(all);
  const [note, setNote] = useState<string | null>(null);
  const [tally, setTally] = useState(false);
  const [open, setOpen] = useState<StmtRow | null>(null);
  const [creating, setCreating] = useState<string | null>(takeIntent('investments')?.kind ?? takeIntent('expenses')?.kind ?? takeIntent('drawings')?.kind ?? null);
  const cr = f.out.filter((r) => r.flow === 'credit' && r.affectsCash).reduce((n, r) => n + r.amount, 0);
  const dr = f.out.filter((r) => r.flow === 'debit' && r.affectsCash).reduce((n, r) => n + r.amount, 0);
  const head = ['Date', 'Type', 'Account', 'Party', 'Description', 'Mode', 'Recorded by', 'Flow', 'Amount'];
  const body = () => f.out.map((r) => [r.date, r.kind, r.account, r.party, r.desc, r.mode, r.by, r.flow, String(r.amount)]);
  const [exporting, setExporting] = useState<'csv' | 'print' | null>(null);
  const runExport = async (k: 'csv' | 'print', fn: () => Promise<void>) => {
    if (exporting) return; setExporting(k); setNote(null);
    try { await fn(); } catch (e) { setNote(`${k === 'csv' ? 'CSV export' : 'Print'} failed: ${errMessage(e)}`); } finally { setExporting(null); }
  };
  const csv = () => void runExport('csv', () => exportText('project-statement.csv', csvOf([head, ...body()]), 'text/csv'));
  const print = () => void runExport('print', () => printTable(ctx.project?.name ? `${ctx.project.name} — Project Statement` : 'Project Statement', `${f.out.length} entries · generated ${new Date().toLocaleString()}`, head, body(), `Inflows ${money(cr)} · Outflows ${money(dr)} · Net ${money(cr - dr)}`));
  return (
    <View>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 20 }}>{partner ? t('statementsTitle') : 'Project Statement'}</Text>
      <Text style={{ color: c.mutedForeground, marginBottom: 10 }}>{partner ? t('statementsSubtitle') : 'Consolidated investments, expenses, bookings, drawings, settlements and transactions.'}</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Btn label="Export CSV" icon="download" variant="ghost" onPress={csv} disabled={!f.out.length} loading={exporting === 'csv'} />
        <Btn label="Print" icon="printer" variant="ghost" onPress={print} loading={exporting === 'print'} />
        {!partner ? <Btn label="Tally XML" icon="file-text" onPress={() => setTally(true)} /> : null}
        {(['investments', 'expenses', 'drawings'] as const).filter((k) => erp.resources.find((x) => x.kind === k)?.canCreate).map((k) => <Btn key={k} icon="plus" label={k === 'investments' ? (partner ? t('enrollInvestmentBtn') : 'Record investment') : k === 'expenses' ? (partner ? t('enrollExpenseBtn') : 'Record expense') : (partner ? t('requestDrawBtn') : 'Record drawing')} onPress={() => setCreating(k)} />)}
      </View>
      {note ? <Banner tone="warn" title={note} /> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {[['Recorded inflow', cr], ['Recorded outflow', dr], ['Net', cr - dr]].map(([l, v]) => <Card key={String(l)} style={{ flexGrow: 1, minWidth: 110, marginBottom: 0 }}><Text style={{ color: c.mutedForeground, fontSize: 11 }}>{String(l).toUpperCase()}</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 18 }}>{money(v)}</Text></Card>)}
      </View>
      <Filters erp={erp} f={f} />
      <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 6 }}>{f.out.length} of {all.length} entries</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}><View style={{ flexDirection: 'row', gap: 6 }}>
        <Text style={{ color: c.mutedForeground, fontSize: 11, alignSelf: 'center' }}>SORT BY</Text>
        {([['date', 'Date'], ['kind', 'Type'], ['account', 'Account'], ['party', 'Party'], ['desc', 'Description'], ['by', 'Enrolled by'], ['amount', 'Amount']] as [SortCol, string][]).map(([k, l]) => { const on = f.state.col === k; return <Pressable key={k} onPress={() => f.sortBy(k)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: on ? '#111827' : '#e5e7eb' }}><Text style={{ color: on ? '#fff' : '#111827', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{l}</Text>{on ? <Feather name={f.state.asc ? 'arrow-up' : 'arrow-down'} size={12} color="#fff" /> : null}</Pressable>; })}
      </View></ScrollView>
      <RowList rows={f.out} onOpen={setOpen} />
      {open?.entry && (open.entry.canReferBack || open.entry.canResubmit) ? <CorrectionDialog erp={erp} row={open} ctx={ctx} onClose={() => setOpen(null)} /> : open?.rec && erp.resources.some((res) => res.kind === open.kind) ? <RecordDetail erp={erp}
        res={erp.resources.find((res) => res.kind === open.kind)!} rec={open.rec} ctx={ctx} onClose={() => setOpen(null)} /> : null}
      {creating ? <Dialog title={`New ${erp.resources.find((x) => x.kind === creating)?.title ?? creating}`} onClose={() => setCreating(null)}><RecordForm erp={erp} res={erp.resources.find((x) => x.kind === creating)!} ctx={ctx} onDone={() => setCreating(null)} /></Dialog> : null}
      {tally ? <TallyModal erp={erp} rows={f.out} onClose={() => setTally(false)} /> : null}
    </View>
  );
}

/* Refer back / correct & resubmit, driven by the server statement entry (canReferBack / canResubmit / correctionFields). */
function CorrectionDialog({ erp, row, ctx, onClose }: { erp: ProjectErp; row: StmtRow; ctx: ErpCtx; onClose: () => void }) {
  const c = useColors();
  const e = row.entry!;
  const cmd = useErpCommands(erp.projectId);
  const [reqId] = useState(newRequestId);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const fields: ErpField[] = e.correctionFields ?? [];
  const cd = (e.correctionData ?? {}) as Record<string, unknown>;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, cd[f.key] === undefined || cd[f.key] === null ? '' : String(cd[f.key])])));
  const opts = (f: ErpField) => f.kind === 'account' ? erp.records.filter((r) => r.kind === 'accounts' && live(r)).map((r) => ({ value: r.id, label: label(r) })) : f.kind === 'partner' ? erp.partners.map((p) => ({ value: p.id, label: p.name })) : f.kind === 'select' ? (f.options ?? []).map((o) => ({ value: o, label: o })) : f.kind === 'boolean' ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] : [];
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setMsg(null); try { await fn(); onClose(); } catch (x) { setMsg(errMessage(x)); } finally { setBusy(false); } };
  const resubmit = () => {
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const t = (vals[f.key] ?? '').trim();
      if (!t) { if (f.required) { setMsg(`${f.label} is required.`); return; } continue; }
      if (f.kind === 'number') { const n = Number(t); if (!Number.isFinite(n)) { setMsg(`${f.label} must be a number.`); return; } data[f.key] = n; }
      else if (f.kind === 'boolean') data[f.key] = t === 'true';
      else data[f.key] = t;
    }
    void run(() => cmd.resubmit(e.id, e.revision, data, reqId));
  };
  const res = erp.resources.find((x) => x.kind === row.kind);
  if (detail && row.rec && res) return <RecordDetail erp={erp} res={res} rec={row.rec} ctx={ctx} onClose={onClose} />;
  return (
    <Dialog title={`${row.desc || row.kind}`} onClose={onClose}>
      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{row.date} · {row.kind} · {row.account}{row.by ? ` · enrolled by ${row.by}` : ''}</Text>
      <Text style={{ color: row.flow === 'credit' ? c.success : c.destructive, fontFamily: 'Inter_700Bold', fontSize: 22, marginVertical: 8 }}>{row.flow === 'credit' ? '+' : '-'}{money(row.amount)}</Text>
      {e.correctionReason ? <Banner tone="warn" title="Referred back" text={e.correctionReason} /> : null}
      {e.canReferBack ? <View>
        <Field label="Refer-back reason *" value={reason} onChangeText={setReason} multiline />
        <Btn label="Refer Back" variant="ghost" loading={busy} disabled={!reason.trim()} onPress={() => void run(() => cmd.referBack(e.id, e.revision, reason.trim(), reqId))} />
      </View> : null}
      {e.canResubmit ? <View style={{ marginTop: 8 }}>
        <Label>CORRECT AND RESUBMIT</Label>
        {fields.map((f) => { const o = opts(f); return o.length ? <Chips key={f.key} label={f.label + (f.required ? ' *' : '')} options={o} value={vals[f.key] ?? ''} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} /> : <Field key={f.key} label={f.label + (f.required ? ' *' : '')} value={vals[f.key] ?? ''} onChangeText={(v) => setVals((s) => ({ ...s, [f.key]: v }))} keyboardType={f.kind === 'number' ? 'numeric' : 'default'} multiline={f.kind === 'multiline'} hint={f.kind === 'date' ? 'YYYY-MM-DD' : undefined} />; })}
        <Btn label="Correct & Resubmit" loading={busy} onPress={resubmit} />
      </View> : null}
      {msg ? <Banner tone="error" title="Action refused" text={msg} /> : null}
      {row.rec && res ? <View style={{ marginTop: 8 }}><Btn label="View full record" variant="ghost" onPress={() => setDetail(true)} /></View> : null}
    </Dialog>
  );
}
