import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ProjectErp } from '@workspace/api-client-react';
import { Banner, Card } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { formatINR, formatIndianCompact } from '@/lib/sourceCalc';
import { live, navTo, str, useLang, type ErpCtx } from '@/screens/ErpScreens';

const nv = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };

/** Same aggregation as web AccountantDashboard cashBreakdown: server statement, cash-affecting entries only. */
export function cashBreakdown(erp: ProjectErp) {
  const st = erp.statement;
  if (!Array.isArray(st)) return null;
  const b = { opening: 0, investments: 0, receipts: 0, otherIn: 0, expenses: 0, drawings: 0, otherOut: 0, net: 0 };
  for (const t of st) {
    if (t.affectsCash !== true) continue;
    const cat = String(t.category || '');
    if (cat === 'inter_account_transfer') continue;
    const amt = nv(t.amount);
    const signed = t.type === 'credit' ? amt : -amt;
    b.net += signed;
    if (cat === 'opening_balance') b.opening += signed;
    else if (cat === 'partner_capital') b.investments += signed;
    else if (cat === 'plot_booking_advance' || cat === 'flat_booking_advance') b.receipts += signed;
    else if (cat.startsWith('field_') || t.kind === 'expenses') b.expenses -= signed;
    else if (cat === 'partner_draw') b.drawings -= signed;
    else if (signed >= 0) b.otherIn += signed;
    else b.otherOut -= signed;
  }
  return b;
}

/** Bank vs cash split from server balances (web computeProjectBalance: field_petty_cash = cash). */
function bankCash(erp: ProjectErp) {
  const r = { bank: 0, cash: 0, count: 0 };
  for (const a of erp.records.filter((x) => x.kind === 'accounts' && live(x))) {
    const bal = erp.balances.find((b) => b.accountId === a.id);
    const amt = nv(bal?.balance);
    if (str(a.data.accountType) === 'field_petty_cash') r.cash += amt; else r.bank += amt;
    r.count += 1;
  }
  return r;
}

function inventory(erp: ProjectErp) {
  const inv = erp.records.filter((r) => (r.kind === 'plots' || r.kind === 'units') && live(r));
  const c = { total: inv.length, available: 0, booked: 0, sold: 0, blocked: 0, area: 0, value: 0 };
  for (const r of inv) {
    const s = str(r.data.status);
    if (s === 'available') c.available += 1; else if (s === 'reserved' || s === 'booked') c.booked += 1; else if (s === 'sold') c.sold += 1; else if (s === 'blocked') c.blocked += 1;
    if (r.kind === 'plots') { c.area += nv(r.data.areaSqYards); if (s !== 'blocked') c.value += nv(r.data.areaSqYards) * nv(r.data.ratePerSqYard); }
  }
  return c;
}

function Kpi({ title, value, sub, onPress, children, dark }: { title: string; value: string; sub?: string; onPress?: () => void; children?: React.ReactNode; dark?: boolean }) {
  const c = useColors();
  const fg = dark ? '#FFFFFF' : c.foreground;
  const mu = dark ? 'rgba(255,255,255,0.65)' : c.mutedForeground;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => ({ flexGrow: 1, flexBasis: 260, opacity: pressed ? 0.9 : 1 })}>
      <View style={{ backgroundColor: dark ? '#111827' : '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: dark ? '#111827' : '#e5e7eb', padding: 18, minHeight: 150 }}>
        <Text style={{ color: dark ? '#FFB800' : '#b45309', fontSize: 10, letterSpacing: 1, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' }}>{title}</Text>
        <Text style={{ color: fg, fontSize: 24, fontFamily: 'Inter_700Bold', marginTop: 6 }}>{value}</Text>
        {sub ? <Text style={{ color: mu, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
        <View style={{ marginTop: 10 }}>{children}</View>
      </View>
    </Pressable>
  );
}
function Line({ k, v, dark }: { k: string; v: string; dark?: boolean }) {
  const c = useColors();
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, gap: 8 }}><Text style={{ color: dark ? 'rgba(255,255,255,0.7)' : c.mutedForeground, fontSize: 12, flexShrink: 1 }}>{k}</Text><Text style={{ color: dark ? '#fff' : c.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{v}</Text></View>;
}

function partnerCommitment(erp: ProjectErp, partnerId: string) {
  return nv(erp.records.find(r => r.kind === 'partner-profiles' && live(r) && r.data.partnerId === partnerId)?.data.initialCapital);
}

function partnerShare(erp: ProjectErp, partnerId: string) {
  const partner = erp.partners.find(p => p.id === partnerId);
  if (erp.settings.equitySplitMode === 'proportional') {
    const total = erp.partners.reduce((sum, p) => sum + partnerCommitment(erp, p.id), 0);
    return total > 0 ? partnerCommitment(erp, partnerId) / total * 100 : 0;
  }
  return nv(partner?.equityPercent);
}

export function AccountantDashboard({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const det = (ctx.project?.details ?? {}) as Record<string, unknown>;
  const outlay = det.totalEstimatedOutlay;
  const hasOutlay = outlay !== undefined && outlay !== null && outlay !== '';
  const inv = inventory(erp);
  const bc = bankCash(erp);
  const cb = cashBreakdown(erp);
  const invested = erp.partners.reduce((n, p) => n + nv(p.invested), 0);
  const surplus = hasOutlay ? inv.value - nv(outlay) : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <Kpi title="Project cost" value={hasOutlay ? formatINR(nv(outlay)) : 'Not set'} sub={`${formatINR(invested)} invested by ${erp.partners.length} partner${erp.partners.length === 1 ? '' : 's'}`} onPress={() => navTo({ kind: 'partner-profiles' })}>
          {erp.partners.length ? erp.partners.map((p) => <Line key={p.id} k={`${p.name} · ${partnerShare(erp, p.id).toFixed(1)}%`} v={formatINR(partnerCommitment(erp, p.id))} />) : <Line k="No partners allocated yet" v="" />}
          <Line k="Partner target commitment" v={formatINR(erp.partners.reduce((sum, p) => sum + partnerCommitment(erp, p.id), 0))} />
        </Kpi>
        <Kpi title="Projected sales" value={inv.value > 0 ? formatINR(inv.value) : 'No rates yet'} sub={`${Math.round(inv.area).toLocaleString('en-IN')} Sq.Yds sellable`} onPress={() => navTo({ kind: 'plots' })}>
          <Line k="Projected surplus" v={surplus === null ? 'Needs project cost' : formatINR(surplus)} />
          <Line k="Return on cost" v={surplus !== null && nv(outlay) > 0 ? `${((surplus / nv(outlay)) * 100).toFixed(1)}%` : '-'} />
        </Kpi>
        <Kpi title="Inventory" value={`${inv.total} total`} sub={`${inv.available} available`} onPress={() => navTo({ kind: 'plots' })}>
          <Line k="Booked / reserved" v={String(inv.booked)} />
          <Line k="Sold" v={String(inv.sold)} />
          <Line k="Blocked" v={String(inv.blocked)} />
        </Kpi>
        <Kpi title="Project Account" value={cb ? formatINR(bc.bank + bc.cash) : 'Unavailable'} sub={`Bank + Cash · ${bc.count} A/Cs · net balance from live bank and cash account balances`} onPress={() => navTo({ kind: 'statement' })}>
          {cb ? <>
            <Text style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Inter_700Bold', textTransform: 'uppercase', marginBottom: 2 }}>Posted cash movements</Text>
            {([['Opening balance', cb.opening, 1], ['Investments', cb.investments, 1], ['Plot booking / customer receipts', cb.receipts, 1], ['Other inflows', cb.otherIn, 1], ['Expenses', cb.expenses, -1], ['Drawings', cb.drawings, -1], ['Other outflows', cb.otherOut, -1]] as [string, number, number][]).map(([k, v, sg]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 }}><Text style={{ color: '#4b5563', fontSize: 12 }}>{sg > 0 ? '+' : '-'} {k}</Text><Text style={{ color: sg > 0 ? '#047857' : '#be123c', fontSize: 12, fontFamily: 'Inter_700Bold' }}>{formatINR(v)}</Text></View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#f3f4f6', paddingTop: 3, marginTop: 2 }}><Text style={{ color: '#1f2937', fontSize: 12, fontFamily: 'Inter_700Bold' }}>= Posted net</Text><Text style={{ color: '#030712', fontSize: 12, fontFamily: 'Inter_700Bold' }}>{formatINR(cb.net)}</Text></View>
            {Math.abs(cb.net - (bc.bank + bc.cash)) >= 0.005 ? <Text style={{ color: '#92400e', fontSize: 11, marginTop: 4, fontFamily: 'Inter_600SemiBold' }}>Differs from live balances by {formatINR(Math.abs(cb.net - (bc.bank + bc.cash)))}. Review the Project Statement to reconcile.</Text> : null}
          </> : <Text style={{ color: '#4b5563', fontSize: 11 }}>Posted cash breakdown unavailable: the server statement for this project has not loaded. Open the Project Statement for the full ledger.</Text>}
        </Kpi>
      </View>
    </View>
  );
}

export function PartnerHome({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const { t } = useLang();
  const me = erp.partners.find((p) => p.id === ctx.account.identityId);
  const pr = erp.records.find((r) => r.kind === 'partner-profiles' && live(r) && r.data.partnerId === ctx.account.identityId);
  const est = nv(pr?.data.initialCapital);
  const act = nv(me?.invested);
  const draws = nv(me?.drawings);
  const eq = partnerShare(erp, ctx.account.identityId);
  const det = (ctx.project?.details ?? {}) as Record<string, unknown>;
  const inv = inventory(erp);
  const bc = bankCash(erp);
  const cb = cashBreakdown(erp);
  const profit = Math.round((eq / 100) * Math.max(0, inv.value - nv(det.totalEstimatedOutlay)));
  // Web FieldPartnerMobileView: actualInvested + shareOfFieldExpenses - drawings. Server partner.expenses is that share.
  const net = act + nv(me?.expenses) - draws;
  const allotted = Math.round((eq / 100) * inv.area);
  const lc = (erp.settings.layoutCalculation ?? {}) as Record<string, unknown>;
  const ext = det.extentValue ?? lc.totalExtentValue;
  return (
    <View>
      {!me ? <Banner tone="warn" title="Your partner figures are not available for this project" /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <Card style={{ width: '100%', backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 170 }}>
              <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#92400e' }}>{t('netShareBalance')}</Text>
              <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: '#111827', marginTop: 6 }}>{formatINR(net)}</Text>
              <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{net >= 0 ? t('netReceivable') : t('netPayable')} ({formatIndianCompact(net)})</Text>
            </View>
            <View style={{ backgroundColor: '#fff', borderColor: '#fef3c7', borderWidth: 1, padding: 12, borderRadius: 12 }}>
              <Text style={{ fontSize: 9, color: '#6b7280' }}>AGREED SYNDICATE EQUITY</Text>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 22, color: '#92400e', textAlign: 'right' }}>{eq.toFixed(1)}%</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {[
              [t('estimatedInvestment'), est, '#111827'], [t('actualInvestment'), act, '#047857'],
              [t('cashDrawings'), draws, '#be123c'], [t('expectedProfit'), profit, '#3730a3'],
            ].map(([label, value, color]) => <View key={String(label)} style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: '#fffef8', borderWidth: 1, borderColor: '#fef3c7', borderRadius: 10, padding: 10 }}>
              <Text style={{ fontSize: 9, color: '#6b7280', marginBottom: 5 }}>{String(label)}</Text>
              <Text style={{ fontFamily: 'Inter_700Bold', color: String(color), fontSize: 13 }}>{formatINR(Number(value))}</Text>
            </View>)}
          </View>
        </Card>
        <Kpi title="Inventory" value={`${inv.total}`} sub={`${inv.available} available · ${inv.booked} booked · ${inv.sold} sold`} onPress={() => navTo({ kind: 'plots' })}>
          <Line k="Blocked" v={String(inv.blocked)} />
          <Line k="Sellable area" v={`${Math.round(inv.area).toLocaleString('en-IN')} Sq.Yds`} />
        </Kpi>
        <Kpi title="Project Account Balance" value={formatINR(bc.bank + bc.cash)} sub={`Bank ${formatIndianCompact(bc.bank)} · Cash ${formatIndianCompact(bc.cash)}`} onPress={() => navTo({ kind: 'statement' })} />
      </View>
      <Card>
        <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 }}>{t('allottedSellableArea')}</Text>
        <Text style={{ color: c.foreground, fontSize: 22, fontFamily: 'Inter_700Bold' }}>{allotted.toLocaleString('en-IN')} Sq.Yds</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{eq}% of {Math.round(inv.area).toLocaleString('en-IN')} Sq.Yds (~{(allotted * 9).toLocaleString('en-IN')} Sq.Ft)</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: '#e5e7eb', marginTop: 8 }}><View style={{ height: 8, borderRadius: 4, backgroundColor: '#FFB800', width: `${Math.max(0, Math.min(100, eq))}%` }} /></View>
      </Card>
      <Card>
        <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 }}>{t('projectOverview')}</Text>
        <Line k={t('projectLocation')} v={str(ctx.project?.location) || '-'} />
        <Line k={t('surveyNumber')} v={str(det.surveyNumbers) || '-'} />
        <Line k={t('lpReraNumber')} v={str(det.lpOrReraNumber) || '-'} />
        <Line k={t('totalVentureExtent')} v={ext !== undefined && ext !== '' ? `${ext} ${str(det.extentUnit ?? lc.unit)}` : '-'} />
        <Line k={t('ventureCostOutlay')} v={det.totalEstimatedOutlay !== undefined && det.totalEstimatedOutlay !== '' ? formatINR(nv(det.totalEstimatedOutlay)) : '-'} />
        <Line k={t('agreedEquity')} v={`${eq}%`} />
      </Card>
    </View>
  );
}
