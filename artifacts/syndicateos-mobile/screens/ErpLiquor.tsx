import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ErpRecord, ErpResource, ProjectErp } from '@workspace/api-client-react';
import { Badge, Banner, Btn, Card, Chips, Empty, Field } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useErpCommands } from '@/lib/erp';
import { errMessage } from '@/lib/session';
import { formatINR } from '@/lib/sourceCalc';
import { Dialog, RecordDetail, Stat, live, str, tone, type ErpCtx } from '@/screens/ErpScreens';

const nv = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
const Bar = ({ pct, color = '#FFB800' }: { pct: number; color?: string }) => <View style={{ height: 8, borderRadius: 4, backgroundColor: '#e5e7eb', marginVertical: 6 }}><View style={{ height: 8, borderRadius: 4, backgroundColor: color, width: `${Math.max(0, Math.min(100, pct))}%` }} /></View>;

/** Source formulas: sold = opening + received - closing; gross = sold x price; variance = gross - (cash + UPI). */
export function settle(d: Record<string, unknown>) {
  const sold = Math.max(0, nv(d.openingBottles) + nv(d.receivedBottles) - nv(d.closingBottles));
  const gross = d.grossSalesValue !== undefined && d.avgBottlePrice === undefined ? nv(d.grossSalesValue) : sold * nv(d.avgBottlePrice);
  const collected = nv(d.cashCollected) + nv(d.upiCollected);
  return { sold: d.bottlesSold !== undefined && d.avgBottlePrice === undefined ? nv(d.bottlesSold) : sold, gross, collected, variance: gross - collected };
}

function SettlementForm({ erp, res, ctx, onDone }: { erp: ProjectErp; res: ErpResource; ctx: ErpCtx; onDone: () => void }) {
  const c = useColors();
  const cmd = useErpCommands(erp.projectId);
  const has = (k: string) => res.fields.some((f) => f.key === k);
  const [v, setV] = useState({ date: new Date().toISOString().slice(0, 10), counterName: '', openingBottles: '', receivedBottles: '', closingBottles: '', avgBottlePrice: '', cashCollected: '', upiCollected: '', accountId: '', settledBy: ctx.account.displayName, bankDepositSlipNo: '' });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const num = (k: keyof typeof v) => v[k].trim() === '' ? NaN : Number(v[k]);
  const filled = (['openingBottles', 'receivedBottles', 'closingBottles', 'avgBottlePrice', 'cashCollected', 'upiCollected'] as const).every((k) => Number.isFinite(num(k)));
  const m = filled ? settle({ openingBottles: num('openingBottles'), receivedBottles: num('receivedBottles'), closingBottles: num('closingBottles'), avgBottlePrice: num('avgBottlePrice'), cashCollected: num('cashCollected'), upiCollected: num('upiCollected') }) : null;
  const submit = async () => {
    if (!v.counterName.trim()) return setErr('Counter name is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return setErr('Date must be YYYY-MM-DD.');
    for (const k of ['openingBottles', 'receivedBottles', 'closingBottles', 'avgBottlePrice', 'cashCollected', 'upiCollected'] as const) if (!(num(k) >= 0)) return setErr(`${k} must be a number, 0 or more.`);
    if (num('closingBottles') > num('openingBottles') + num('receivedBottles')) return setErr('Closing stock cannot exceed opening plus received stock.');
    if (!v.settledBy.trim()) return setErr('Settled by is required.');
    if (!v.accountId) return setErr('Choose the receiving project account.');
    setBusy(true); setErr(null);
    const data: Record<string, unknown> = { date: v.date, counterName: v.counterName.trim(), openingBottles: num('openingBottles'), receivedBottles: num('receivedBottles'), closingBottles: num('closingBottles'), avgBottlePrice: num('avgBottlePrice'), cashCollected: num('cashCollected'), upiCollected: num('upiCollected'), accountId: v.accountId, settledBy: v.settledBy.trim() };
    if (v.bankDepositSlipNo.trim()) data.bankDepositSlipNo = v.bankDepositSlipNo.trim();
    if (m) {
      if (has('bottlesSold')) data.bottlesSold = m.sold;
      if (has('grossSalesValue')) data.grossSalesValue = m.gross;
       if (has('counterShortage')) data.counterShortage = m.variance;
      if (has('status')) data.status = m.variance === 0 ? 'reconciled' : 'variance_flagged';
    }
    try { await cmd.save('settlements', data); onDone(); } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };
  return (
    <View>
      <Field label="Settlement date" value={v.date} onChangeText={set('date')} hint="YYYY-MM-DD" />
      <Field label="Counter / outlet name" value={v.counterName} onChangeText={set('counterName')} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Opening bottles" value={v.openingBottles} onChangeText={set('openingBottles')} keyboardType="numeric" /></View>
        <View style={{ flex: 1 }}><Field label="Received bottles" value={v.receivedBottles} onChangeText={set('receivedBottles')} keyboardType="numeric" /></View>
        <View style={{ flex: 1 }}><Field label="Closing bottles" value={v.closingBottles} onChangeText={set('closingBottles')} keyboardType="numeric" /></View>
      </View>
      <Field label="Average bottle price (Rs)" value={v.avgBottlePrice} onChangeText={set('avgBottlePrice')} keyboardType="numeric" />
      <Field label="Cash collected (Rs)" value={v.cashCollected} onChangeText={set('cashCollected')} keyboardType="numeric" />
      <Field label="UPI / QR collected (Rs)" value={v.upiCollected} onChangeText={set('upiCollected')} keyboardType="numeric" />
      <Field label="Settled by" value={v.settledBy} onChangeText={set('settledBy')} />
      <Chips label="Receiving project account" value={v.accountId} onChange={set('accountId')} options={erp.records.filter(r => r.kind === 'accounts' && r.status === 'approved' && r.data.status === 'active').map(r => ({ value: r.id, label: str(r.data.accountName) }))} />
      <Field label="Bank deposit slip number (optional)" value={v.bankDepositSlipNo} onChangeText={set('bankDepositSlipNo')} />
      {m ? <View style={{ backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <Text style={{ color: '#451a03' }}>Bottles sold: <Text style={{ fontFamily: 'Inter_700Bold' }}>{m.sold}</Text> (opening + received - closing)</Text>
        <Text style={{ color: '#451a03' }}>Gross sales: <Text style={{ fontFamily: 'Inter_700Bold' }}>{formatINR(m.gross)}</Text></Text>
        <Text style={{ color: '#451a03' }}>Collected: <Text style={{ fontFamily: 'Inter_700Bold' }}>{formatINR(m.collected)}</Text></Text>
        <Text style={{ color: m.variance === 0 ? c.success : c.destructive, fontFamily: 'Inter_700Bold' }}>{m.variance > 0 ? `Shortage ${formatINR(m.variance)}` : m.variance < 0 ? `Excess ${formatINR(-m.variance)}` : 'Reconciled: zero variance'}</Text>
      </View> : <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>Enter all stock and collection figures to see the reconciliation.</Text>}
      {err ? <Banner tone="error" title={err} /> : null}
      <Banner tone="warn" title="Saved as pending review" />
      <Btn label="Record evening settlement" loading={busy} onPress={submit} />
    </View>
  );
}

function DrawForm({ erp, res, ctx, onDone }: { erp: ProjectErp; res: ErpResource; ctx: ErpCtx; onDone: () => void }) {
  const cmd = useErpCommands(erp.projectId);
  const has = (k: string) => res.fields.some((f) => f.key === k);
  const [v, setV] = useState({ partnerId: '', date: new Date().toISOString().slice(0, 10), stockDetails: '', bottlesCount: '', retailValuation: '', purpose: '', deductedFromPayout: 'true', authorizedBy: '' });
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  void ctx;
  const submit = async () => {
    if (!v.partnerId) return setErr('Choose the partner.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return setErr('Date must be YYYY-MM-DD.');
    if (!v.stockDetails.trim()) return setErr('Describe the stock drawn.');
    if (!(Number(v.bottlesCount) > 0) || v.bottlesCount.trim() === '') return setErr('Bottles / cases must be above zero.');
    if (v.retailValuation.trim() === '' || !(Number(v.retailValuation) >= 0)) return setErr('Retail valuation must be a number, 0 or more.');
    if (!v.purpose.trim()) return setErr('Purpose is required.');
    setBusy(true); setErr(null);
    try { await cmd.save('stock-draws', { partnerId: v.partnerId, date: v.date, stockDetails: v.stockDetails.trim(), bottlesCount: Number(v.bottlesCount), retailValuation: Number(v.retailValuation), purpose: v.purpose.trim(), deductedFromPayout: v.deductedFromPayout === 'true', ...(has('authorizedBy') && v.authorizedBy.trim() ? { authorizedBy: v.authorizedBy.trim() } : {}) }); onDone(); } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };
  return (
    <View>
      <Chips label="Partner" options={erp.partners.map((p) => ({ value: p.id, label: p.name }))} value={v.partnerId} onChange={set('partnerId')} />
      <Field label="Date" value={v.date} onChangeText={set('date')} hint="YYYY-MM-DD" />
      <Field label="Items / stock description" value={v.stockDetails} onChangeText={set('stockDetails')} multiline />
      <Field label="Bottles / cases count" value={v.bottlesCount} onChangeText={set('bottlesCount')} keyboardType="numeric" />
      <Field label="Retail valuation (Rs)" value={v.retailValuation} onChangeText={set('retailValuation')} keyboardType="numeric" />
      <Field label="Purpose" value={v.purpose} onChangeText={set('purpose')} />
      <Chips label="Deduct from profit payout" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} value={v.deductedFromPayout} onChange={set('deductedFromPayout')} />
      {has('authorizedBy') ? <Field label="Authorised by" value={v.authorizedBy} onChangeText={set('authorizedBy')} /> : null}
      {err ? <Banner tone="error" title={err} /> : null}
      <Btn label="Log partner stock draw" loading={busy} onPress={submit} />
    </View>
  );
}

export function LiquorModule({ erp, ctx, initial }: { erp: ProjectErp; ctx: ErpCtx; initial?: 'settlements' | 'stock-draws' }) {
  const c = useColors();
  const [tab, setTab] = useState<'settlements' | 'stock-draws'>(initial ?? 'settlements');
  const sres = erp.resources.find((r) => r.kind === 'settlements');
  const dres = erp.resources.find((r) => r.kind === 'stock-draws');
  const sets = useMemo(() => erp.records.filter((r) => r.kind === 'settlements' && live(r)), [erp.records]);
  const draws = useMemo(() => erp.records.filter((r) => r.kind === 'stock-draws' && live(r)), [erp.records]);
  const [add, setAdd] = useState(false); const [sel, setSel] = useState<string | null>(null); const [q, setQ] = useState('');
  const appr = (r: ErpRecord) => r.status === 'approved';
  const tot = sets.filter(appr).reduce((a, r) => { const m = settle(r.data); return { gross: a.gross + m.gross, cash: a.cash + nv(r.data.cashCollected), upi: a.upi + nv(r.data.upiCollected), short: a.short + Math.max(0, m.variance), excess: a.excess + Math.max(0, -m.variance), sold: a.sold + m.sold }; }, { gross: 0, cash: 0, upi: 0, short: 0, excess: 0, sold: 0 });
  const drawVal = draws.filter(appr).reduce((n, r) => n + nv(r.data.retailValuation), 0);
  const counters = Array.from(new Set(sets.map((r) => str(r.data.counterName)).filter(Boolean)));
  const byPartner = erp.partners.map((p) => ({ p, v: draws.filter((r) => appr(r) && r.data.partnerId === p.id && r.data.deductedFromPayout !== false).reduce((n, r) => n + nv(r.data.retailValuation), 0), n: draws.filter((r) => appr(r) && r.data.partnerId === p.id).reduce((n, r) => n + nv(r.data.bottlesCount), 0) })).filter((x) => x.v > 0 || x.n > 0);
  const list = (tab === 'settlements' ? sets : draws).filter((r) => !q.trim() || JSON.stringify(r.data).toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => str(b.data.date).localeCompare(str(a.data.date)));
  const res = tab === 'settlements' ? sres : dres;
  const cur = list.find((r) => r.id === sel) ?? null;
  const pName = (id: unknown) => erp.partners.find((p) => p.id === id)?.name ?? str(id);
  return (
    <View>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 20 }}>Daily Counter Settlement and Partner Stock Draws</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 10 }}>Opening stock + received stock - closing stock = bottles sold. Cash and UPI are reconciled against gross sales. Approved partner stock draws reduce profit payouts.</Text>
      <Chips options={[{ value: 'settlements', label: 'Daily Counter Settlement' }, { value: 'stock-draws', label: 'Partner Barter / Stock Log' }]} value={tab} onChange={(v) => { setTab(v as typeof tab); setSel(null); }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <Stat l="Gross retail turnover" v={formatINR(tot.gross)} sub={`${tot.sold} bottles, approved`} />
        <Stat l="Cash collected" v={formatINR(tot.cash)} />
        <Stat l="UPI / QR volume" v={formatINR(tot.upi)} />
        <Stat l="Partner stock draws" v={formatINR(drawVal)} sub="approved valuation" />
      </View>
      <Card>
        <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 12 }}>COLLECTION RECONCILIATION</Text>
        <Bar pct={tot.gross > 0 ? ((tot.cash + tot.upi) / tot.gross) * 100 : 0} color={tot.short > 0 ? c.destructive : c.success} />
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{tot.gross > 0 ? `${(((tot.cash + tot.upi) / tot.gross) * 100).toFixed(1)}% of gross collected` : 'No approved settlements yet'} · Shortage {formatINR(tot.short)} · Excess {formatINR(tot.excess)}</Text>
        {counters.length > 1 ? counters.map((n) => { const rs = sets.filter((r) => appr(r) && str(r.data.counterName) === n); const g = rs.reduce((a, r) => a + settle(r.data).gross, 0); const col = rs.reduce((a, r) => a + settle(r.data).collected, 0); return <View key={n} style={{ marginTop: 6 }}><Text style={{ color: c.foreground, fontSize: 12 }}>{n}: {formatINR(g)} gross, {formatINR(col)} collected</Text><Bar pct={g > 0 ? (col / g) * 100 : 0} /></View>; }) : null}
      </Card>
      {tab === 'stock-draws' && byPartner.length ? <Card><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 12 }}>PROFIT PAYOUT DEDUCTIONS BY PARTNER</Text>{byPartner.map((x) => <View key={x.p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}><Text style={{ color: c.foreground }}>{x.p.name} · {x.n} bottles</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{formatINR(x.v)}</Text></View>)}</Card> : null}
      {res?.canCreate ? <Btn label={tab === 'settlements' ? 'Record evening settlement' : 'Log partner stock draw'} icon="plus" onPress={() => setAdd(true)} /> : null}
      <View style={{ height: 8 }} />
      <Field label="Search" value={q} onChangeText={setQ} />
      {!res ? <Empty icon="slash" title="Not available" text="This record type is not exposed to your role." /> : list.length === 0 ? <Empty icon="inbox" title={tab === 'settlements' ? 'No settlements recorded' : 'No stock draws logged'} /> : (
        <ScrollView horizontal><View>
          {list.map((r) => {
            const d = r.data;
            if (tab === 'settlements') { const m = settle(d); return (
              <Pressable key={r.id} onPress={() => setSel(r.id)} style={{ width: 640, maxWidth: '100%' }}><Card style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{str(d.counterName)} · {str(d.date)}</Text><Badge text={r.status} tone={tone(r.status)} /></View>
                <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Opening {nv(d.openingBottles)} + received {nv(d.receivedBottles)} - closing {nv(d.closingBottles)} = {m.sold} sold</Text>
                <Text style={{ color: c.foreground, fontSize: 13 }}>Gross {formatINR(m.gross)} · Cash {formatINR(nv(d.cashCollected))} · UPI {formatINR(nv(d.upiCollected))}</Text>
                <Text style={{ color: m.variance === 0 ? c.success : c.destructive, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>{m.variance > 0 ? `Short ${formatINR(m.variance)}` : m.variance < 0 ? `Excess ${formatINR(-m.variance)}` : 'Zero variance'}{str(d.bankDepositSlipNo) ? ` · Slip ${str(d.bankDepositSlipNo)}` : ''}</Text>
              </Card></Pressable>); }
            return (
              <Pressable key={r.id} onPress={() => setSel(r.id)} style={{ width: 640, maxWidth: '100%' }}><Card style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{pName(d.partnerId)} · {str(d.date)}</Text><Badge text={r.status} tone={tone(r.status)} /></View>
                <Text style={{ color: c.foreground, fontSize: 13 }}>{str(d.stockDetails)}</Text>
                <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{nv(d.bottlesCount)} bottles · {formatINR(nv(d.retailValuation))} · {str(d.purpose)} · {d.deductedFromPayout === false ? 'not deducted' : 'deducted from payout'}</Text>
              </Card></Pressable>); })}
        </View></ScrollView>
      )}
      {add && res ? <Dialog title={tab === 'settlements' ? 'Record evening settlement' : 'Log partner stock draw'} onClose={() => setAdd(false)}>{tab === 'settlements' ? <SettlementForm erp={erp} res={res} ctx={ctx} onDone={() => setAdd(false)} /> : <DrawForm erp={erp} res={res} ctx={ctx} onDone={() => setAdd(false)} />}</Dialog> : null}
      {cur && res ? <RecordDetail erp={erp} res={res} rec={cur} ctx={ctx} onClose={() => setSel(null)} /> : null}
    </View>
  );
}
