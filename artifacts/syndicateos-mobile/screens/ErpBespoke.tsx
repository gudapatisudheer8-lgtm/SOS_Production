import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ErpRecord, ErpResource, ProjectErp } from '@workspace/api-client-react';
import { Badge, Banner, Btn, Card, Chips, Empty, Field, Label } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useErpCommands } from '@/lib/erp';
import { errMessage } from '@/lib/session';
import { formatINR, formatIndianCompact } from '@/lib/sourceCalc';
import { erpSetup } from '@/lib/erpSetup';
import { LiquorModule } from '@/screens/ErpLiquor';
import { PlanBuilder } from '@/screens/ErpPlan';
import { BookingReceipts, InventoryStage, milestonesOf, openWa, stagePct as stagePct0 } from '@/screens/ErpInventory';
import { AttachmentView, Dashboard, Dialog, Equity, LangToggle, RecordDetail, RecordForm, ResourceView, Stat, label, live, money, recLabel, navTo, registerBespoke, str, takeIntent, tone, useLang, type ErpCtx } from '@/screens/ErpScreens';
import { Filters, ProjectStatement, RowList, buildRows, useRowFilters } from '@/screens/ErpStatement';

const AMBER = '#FFB800';
const nv = (x: unknown, d = 0) => { const n = Number(x); return Number.isFinite(n) ? n : d; };
const numStr = (x: unknown) => (x === undefined || x === null ? '' : String(x));
const cleanSettings = (s: Record<string, unknown>) => { const { revision: _r, ...rest } = s; void _r; return rest; };
const Title = ({ children, sub }: { children: string; sub?: string }) => { const c = useColors(); return <View style={{ marginBottom: 10 }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 20 }}>{children}</Text>{sub ? <Text style={{ color: c.mutedForeground, fontSize: 13 }}>{sub}</Text> : null}</View>; };
const resOf = (erp: ProjectErp, k: string): ErpResource | undefined => erp.resources.find((r) => r.kind === k);
const recsOf = (erp: ProjectErp, k: string) => erp.records.filter((r) => r.kind === k && live(r));

/* ===== typed settings save ===== */
function useSettingsSave(erp: ProjectErp) {
  const cmd = useErpCommands(erp.projectId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const save = async (patch: Record<string, unknown>) => {
    setBusy(true); setMsg(null);
    try { await cmd.settings(nv(erp.settings.revision), { ...cleanSettings(erp.settings), ...patch }); setMsg({ ok: true, t: 'Saved.' }); }
    catch (e) { setMsg({ ok: false, t: errMessage(e) }); } finally { setBusy(false); }
  };
  return { save, busy, msg };
}

/* ===== Layout calculator (OpenPlottingModule: Venture Layout Calculator) ===== */
function LayoutCalc({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const setup = erpSetup(erp);
  const L = setup.layout;
  const lc = (erp.settings.layoutCalculation ?? {}) as Record<string, unknown>;
  const [ext, setExt] = useState(numStr(lc.totalExtentValue));
  const [unit, setUnit] = useState<string>(str(lc.unit));
  const [road, setRoad] = useState<string>(numStr(lc.roadWidth));
  const [open, setOpen] = useState(numStr(lc.openSpacePercent));
  const [floor, setFloor] = useState(numStr(lc.floorRatePerSqYard));
  const [exp, setExp] = useState(numStr(lc.expectedRatePerSqYard));
  const [plotArea, setPlotArea] = useState(numStr(lc.customPlotArea));
  const s = useSettingsSave(erp);
  const editable = ctx.account.role === 'ACCOUNTANT';
  if (!L) return <Card><Banner tone="warn" title="Layout rules are not configured" text="This project's release does not define unit conversions, road-loss percentages, road widths and the open-space limit, so the layout calculator is unavailable. Nothing has been assumed." /></Card>;
  const conv = L.unitConversions[unit];
  const roadPct = L.roadLossPercentByWidth[road];
  const ready = conv !== undefined && roadPct !== undefined && open.trim() !== '' && ext.trim() !== '';
  const gross = ready ? nv(ext) * conv : 0;
  const roadLoss = ready ? (gross * roadPct) / 100 : 0;
  const park = ready ? (gross * nv(open)) / 100 : 0;
  const net = Math.max(0, gross - roadLoss - park);
  const errs = nv(open) < 0 || nv(open) > L.openSpaceLimit ? `Open space must be between 0 and ${L.openSpaceLimit} percent.` : nv(ext) < 0 ? 'Extent cannot be negative.' : null;
  const rows: [string, string][] = ready ? [
    ['Gross extent', `${Math.round(gross).toLocaleString('en-IN')} Sq. Yds`],
    [`Road loss (${roadPct}%)`, `- ${Math.round(roadLoss).toLocaleString('en-IN')} Sq. Yds`],
    [`Park / open space (${nv(open)}%)`, `- ${Math.round(park).toLocaleString('en-IN')} Sq. Yds`],
    ['Net sellable plotted area', `${Math.round(net).toLocaleString('en-IN')} Sq. Yds${gross > 0 ? ` (${((net / gross) * 100).toFixed(1)}%)` : ''}`],
    ...Object.entries(L.unitConversions).filter(([u]) => u !== unit).map(([u, f]) => [`Equivalent in ${u}`, (net / f).toLocaleString('en-IN', { maximumFractionDigits: 2 })] as [string, string]),
    ...(nv(plotArea) > 0 ? [[`Plots of ${nv(plotArea)} Sq. Yds`, String(Math.floor(net / nv(plotArea)))] as [string, string]] : []),
    ...(nv(exp) > 0 ? [['Expected gross revenue', formatIndianCompact(net * nv(exp))] as [string, string]] : []),
    ...(nv(floor) > 0 ? [['Floor-rate revenue', formatIndianCompact(net * nv(floor))] as [string, string]] : []),
  ] : [];
  const off = () => undefined;
  return (
    <Card>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 8 }}>Venture Layout Calculator</Text>
      <Field label="Total extent" value={ext} onChangeText={setExt} keyboardType="numeric" editable={editable} />
      <Chips label="Unit" options={Object.keys(L.unitConversions).map((u) => ({ value: u, label: u }))} value={unit} onChange={editable ? setUnit : off} />
      <Chips label="Approach road width" options={L.roadWidthOptions.map((w) => ({ value: String(w), label: `${w} Ft Road` }))} value={road} onChange={editable ? setRoad : off} />
      <Field label={`Park / open space (%), up to ${L.openSpaceLimit}`} value={open} onChangeText={setOpen} keyboardType="numeric" editable={editable} />
      <Field label="Floor rate per Sq. Yard" value={floor} onChangeText={setFloor} keyboardType="numeric" editable={editable} />
      <Field label="Expected rate per Sq. Yard" value={exp} onChangeText={setExp} keyboardType="numeric" editable={editable} />
      <Field label="Typical plot area to estimate plot count (Sq. Yds, optional)" value={plotArea} onChangeText={setPlotArea} keyboardType="numeric" editable={editable} />
      {rows.length ? <View style={{ backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginBottom: 10 }}>
        {rows.map(([k, v]) => <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 8 }}><Text style={{ color: '#78350f', flexShrink: 1 }}>{k}</Text><Text style={{ color: '#451a03', fontFamily: 'Inter_700Bold', flexShrink: 1, textAlign: 'right' }}>{v}</Text></View>)}
      </View> : <Text style={{ color: c.mutedForeground, marginBottom: 10 }}>Choose extent, unit, road width and open space to see the estimate.</Text>}
      {errs ? <Banner tone="error" title={errs} /> : null}
      {s.msg ? <Banner tone={s.msg.ok ? 'ok' : 'error'} title={s.msg.t} /> : null}
      {editable ? <Btn label="Save layout calculation" loading={s.busy} disabled={!!errs || !ready} onPress={() => void s.save({ layoutCalculation: { totalExtentValue: nv(ext), unit, roadWidth: nv(road), openSpacePercent: nv(open), ...(floor.trim() ? { floorRatePerSqYard: nv(floor) } : {}), ...(exp.trim() ? { expectedRatePerSqYard: nv(exp) } : {}), ...(plotArea.trim() ? { customPlotArea: nv(plotArea) } : {}) } })} /> : null}
    </Card>
  );
}

/* ===== Venture layout master grid ===== */
const pd = (r: ErpRecord) => ({ no: str(r.data.plotNumber || r.data.name), area: nv(r.data.areaSqYards), facing: str(r.data.facing), rate: nv(r.data.ratePerSqYard), status: str(r.data.status), block: str(r.data.blockName), dim: str(r.data.dimensions), road: str(r.data.roadWidthFt), buyer: str(r.data.buyerName) });

export function LayoutMasterGrid({ erp, ctx, onBook }: { erp: ProjectErp; ctx: ErpCtx; onBook: (id: string) => void }) {
  const c = useColors();
  const { t } = useLang();
  const partner = ctx.account.role === 'PARTNER';
  const res = resOf(erp, 'plots');
  const plots = recsOf(erp, 'plots');
  const [facing, setFacing] = useState('all'); const [status, setStatus] = useState('all'); const [q, setQ] = useState(''); const [view, setView] = useState<'layout' | 'table'>('layout');
  const [sel, setSel] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  const shown = plots.filter((r) => { const p = pd(r);
    if (facing !== 'all' && p.facing !== facing) return false;
    if (status !== 'all' && p.status !== status) return false;
    const s = q.trim().toLowerCase(); return !s || `${p.no} ${p.buyer} ${p.facing} ${p.block}`.toLowerCase().includes(s); });
  const cnt = (f: (p: ReturnType<typeof pd>) => boolean) => plots.filter((r) => f(pd(r))).length;
  const sellable = plots.reduce((n, r) => n + pd(r).area, 0);
  const cur = plots.find((r) => r.id === sel) ?? null;
  const FACINGS = Array.from(new Set(plots.map((r) => pd(r).facing).filter(Boolean)));
  const statusOpts = (res?.fields.find((f) => f.key === 'status')?.options ?? Array.from(new Set(plots.map((r) => pd(r).status).filter(Boolean))));
  const card = (r: ErpRecord) => {
    const p = pd(r);
    const bg = p.status === 'available' ? c.successSurface : p.status === 'sold' ? '#e5e7eb' : p.status === 'blocked' ? '#f6dedb' : c.warningSurface;
    return (
      <Pressable key={r.id} onPress={() => (p.status === 'available' && resOf(erp, 'bookings')?.canCreate ? onBook(r.id) : setSel(r.id))} onLongPress={() => setSel(r.id)} accessibilityRole="button" accessibilityHint="Opens booking for an available plot; long press for details" style={{ width: 150, padding: 10, borderRadius: 14, backgroundColor: bg, borderWidth: 1, borderColor: c.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>#{p.no}</Text><Badge text={p.status || r.status} tone={tone(p.status)} /></View>
        <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 4 }}>{p.area} Sq.Yds{p.dim ? ` · ${p.dim}` : ''}</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{p.facing}{p.road ? ` · ${p.road} ft road` : ''}</Text>
        <Text style={{ color: c.foreground, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 4 }}>{formatIndianCompact(p.area * p.rate)}</Text>
        {p.buyer ? <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 11 }}>{p.buyer}</Text> : null}
      </Pressable>
    );
  };
  const COLS: [string, number][] = [['Plot No', 70], ['Block', 90], ['Facing', 110], ['Dimensions', 90], ['Road (ft)', 70], ['Area (Sq.Yd)', 90], ['Rate/Sq.Yd', 90], ['Total Value', 110], ['Status', 90], ['Buyer', 120]];
  const groups = FACINGS.map((f) => [f, f] as const);
  return (
    <View>
      <Title sub={partner ? t('plotsSubtitle') : 'Directional master layout with live status, dimensions, rates and buyers.'}>{partner ? t('plotsInventory') : 'Venture Layout Master Grid'}</Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <Stat l={partner ? t('totalPlots') : 'Total plotted inventory'} v={String(plots.length)} sub={`${Math.round(sellable).toLocaleString('en-IN')} Sq.Yds`} />
        <Stat l="Available" v={String(cnt((p) => p.status === 'available'))} />
        <Stat l="Reserved" v={String(cnt((p) => p.status === 'reserved'))} />
        <Stat l="Blocked" v={String(cnt((p) => p.status === 'blocked'))} />
        <Stat l="Sold" v={String(cnt((p) => p.status === 'sold'))} />
      </View>
      <Chips label="Facing" options={[{ value: 'all', label: 'All' }, ...FACINGS.map((f) => ({ value: f, label: `${f} (${cnt((p) => p.facing === f)})` }))]} value={facing} onChange={setFacing} />
      <Chips label="Plot status" options={['all', ...statusOpts].map((s) => ({ value: s, label: s }))} value={status} onChange={setStatus} />
      <Field label="Search plot number, buyer, facing, block" value={q} onChangeText={setQ} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Btn label={view === 'layout' ? 'Show table' : 'Show master layout'} variant="ghost" icon={view === 'layout' ? 'list' : 'grid'} onPress={() => setView(view === 'layout' ? 'table' : 'layout')} />
        {res?.canCreate ? <Btn label="Add plot" icon="plus" onPress={() => setAdding(true)} /> : null}
      </View>
      {!shown.length ? <Empty icon="map" title="No plots" text={plots.length ? 'No plot matches the filters.' : 'Plots appear here once added.'} /> : view === 'layout' ? (
        groups.map(([title, key]) => { const g = shown.filter((r) => pd(r).facing === key); if (!g.length) return null;
          return <View key={key} style={{ marginBottom: 14 }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' }}>{title} ({g.length})</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{g.map(card)}</View></View>; })
      ) : (
        <ScrollView horizontal><View>
          <View style={{ flexDirection: 'row', backgroundColor: c.muted }}>{COLS.map(([h, w]) => <Text key={h} style={{ width: w, padding: 8, fontSize: 11, fontFamily: 'Inter_700Bold', color: c.foreground }}>{h}</Text>)}</View>
          {shown.map((r) => { const p = pd(r); const cells = [p.no, p.block || '-', p.facing, p.dim || '-', p.road || '-', String(p.area), money(p.rate), formatINR(p.area * p.rate), p.status, p.buyer || '-'];
            return <Pressable key={r.id} onPress={() => setSel(r.id)} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border }}>{cells.map((v, i) => <Text key={i} numberOfLines={1} style={{ width: COLS[i][1], padding: 8, fontSize: 12, color: c.foreground }}>{v}</Text>)}</Pressable>; })}
        </View></ScrollView>
      )}
      {adding && res ? <Dialog title="New plot" onClose={() => setAdding(false)}><RecordForm erp={erp} res={res} ctx={ctx} onDone={() => setAdding(false)} /></Dialog> : null}
      {cur && res ? <RecordDetail erp={erp} res={res} rec={cur} ctx={ctx} onClose={() => setSel(null)} footer={<View>{pd(cur).status === 'available' && resOf(erp, 'bookings')?.canCreate ? <View style={{ marginTop: 8 }}><Btn label={`Book plot ${pd(cur).no}`} icon="bookmark" onPress={() => { const id = cur.id; setSel(null); onBook(id); }} /></View> : null}{pd(cur).status === 'available' ? <View style={{ marginTop: 8 }}><Btn label="Share availability via WhatsApp" variant="ghost" icon="send" onPress={() => openWa(`Plot ${pd(cur).no}${pd(cur).block ? `, ${pd(cur).block}` : ''}: ${pd(cur).area} Sq.Yds, ${pd(cur).facing} facing${pd(cur).rate ? `, Rs ${pd(cur).rate}/Sq.Yd` : ''}. Available.`)} /></View> : null}<InventoryStage erp={erp} rec={cur} ctx={ctx} /></View>} /> : null}
    </View>
  );
}

/* ===== Apartment pricing matrix (ConstructionModule) ===== */
function PricingEditor({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const pm = (erp.settings.pricingMatrix ?? {}) as Record<string, unknown>;
  const PM: [string, string][] = (erpSetup(erp).pricing ?? []).map((f) => [f.key, f.label]);
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(PM.map(([k]) => [k, numStr(pm[k])])));
  const s = useSettingsSave(erp);
  const editable = ctx.account.role === 'ACCOUNTANT';
  if (!PM.length) return <Card><Banner tone="warn" title="Pricing fields are not configured" text="This project's release defines no pricing matrix fields. Nothing has been assumed." /></Card>;
  const bad = PM.find(([k]) => v[k].trim() === '' || !Number.isFinite(Number(v[k])) || Number(v[k]) < 0);
  return (
    <Card>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 8 }}>Configure Pricing Matrix</Text>
      {PM.map(([k, l]) => <Field key={k} label={`${l} (Rs):`} value={v[k]} onChangeText={(x) => setV((o) => ({ ...o, [k]: x }))} keyboardType="numeric" editable={editable} />)}
      {bad ? <Text style={{ color: c.destructive, fontSize: 12 }}>{bad[1]} needs a non-negative number.</Text> : null}
      {s.msg ? <Banner tone={s.msg.ok ? 'ok' : 'error'} title={s.msg.t} /> : null}
      {editable ? <Btn label="Save pricing matrix" loading={s.busy} disabled={!!bad} onPress={() => void s.save({ pricingMatrix: Object.fromEntries(PM.map(([k]) => [k, Number(v[k])])) })} /> : null}
    </Card>
  );
}

function UnitsModule({ erp, ctx, onBook }: { erp: ProjectErp; ctx: ErpCtx; onBook: (id: string) => void }) {
  const stagePct1 = (m: string) => stagePct0(erp, m);
  const c = useColors();
  const units = recsOf(erp, 'units');
  const res = resOf(erp, 'units');
  const pm = (erp.settings.pricingMatrix ?? {}) as Record<string, unknown>;
  const [sel, setSel] = useState<string | null>(null); const [adding, setAdding] = useState(false); const [st, setSt] = useState('all');
  const price = (r: ErpRecord) => {
    const d = r.data; const f = str(d.facing);
    const pk = erpSetup(erp).premiumFieldByFacing?.[f];
    const prem = d.facingPremium !== undefined ? nv(d.facingPremium) : pk ? nv(pm[pk]) : 0;
    const rise = d.floorRise !== undefined ? nv(d.floorRise) : (nv(d.floor, 1) - 1) * nv(pm.floorRisePerFloor);
    const base = d.baseRate !== undefined ? nv(d.baseRate) : nv(pm.baseSqFtRate);
    const parking = d.parkingFee !== undefined ? nv(d.parkingFee) : nv(pm.carParkingFee);
    const amen = d.amenitiesFee !== undefined ? nv(d.amenitiesFee) : nv(pm.amenitiesFee);
    const sft = nv(d.sftArea);
    return { prem, rise, base, parking, amen, sft, total: (base + prem + rise) * sft + parking + amen };
  };
  const shown = units.filter((r) => st === 'all' || str(r.data.status) === st);
  const floors = Array.from(new Set(shown.map((r) => nv(r.data.floor, 1)))).sort((a, b) => b - a);
  const cur = units.find((r) => r.id === sel) ?? null;
  return (
    <View>
      <Title sub="Floor-wise apartment inventory priced from the project matrix.">Apartment Units and Pricing</Title>
      {units.length ? <Card><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 12 }}>CONSTRUCTION PROGRESS</Text>{(() => { const staged = units.filter((r) => stagePct1(str(r.data.currentMilestone || r.data.milestoneStage)) !== null); const avg = staged.length ? staged.reduce((n, r) => n + (stagePct1(str(r.data.currentMilestone || r.data.milestoneStage)) ?? 0), 0) / staged.length : 0; return <View><View style={{ height: 8, borderRadius: 4, backgroundColor: '#e5e7eb', marginVertical: 6 }}><View style={{ height: 8, borderRadius: 4, backgroundColor: '#FFB800', width: `${avg}%` }} /></View><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{staged.length ? `${avg.toFixed(0)}% average across ${staged.length} unit(s) with a milestone` : 'No unit has a milestone set yet'}</Text>{(milestonesOf(erp) ?? []).map((m) => { const n = staged.filter((r) => str(r.data.currentMilestone || r.data.milestoneStage) === m.name).length; return n ? <Text key={m.name} style={{ color: c.foreground, fontSize: 12 }}>{m.name}: {n}</Text> : null; })}</View>; })()}</Card> : null}
      <Chips label="Flat status" options={['all', ...(res?.fields.find((x) => x.key === 'status')?.options ?? Array.from(new Set(units.map((r) => str(r.data.status)).filter(Boolean))))].map((s) => ({ value: s, label: s }))} value={st} onChange={setSt} />
      {res?.canCreate ? <Btn label="Add unit" icon="plus" onPress={() => setAdding(true)} /> : null}
      <View style={{ height: 10 }} />
      {!shown.length ? <Empty icon="home" title="No units" text="Units appear once added to this project." /> : floors.map((fl) => (
        <View key={fl} style={{ marginBottom: 12 }}>
          <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 12, marginBottom: 6 }}>FLOOR {fl}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {shown.filter((r) => nv(r.data.floor, 1) === fl).map((r) => { const p = price(r); const s = str(r.data.status);
              return <Pressable key={r.id} onPress={() => setSel(r.id)} style={{ width: 150, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: s === 'available' ? c.successSurface : s === 'booked' ? c.warningSurface : '#e5e7eb' }}>
                <Text style={{ fontFamily: 'Inter_700Bold', color: c.foreground }}>Flat {str(r.data.unitNumber || r.data.name)}</Text>
                <Text style={{ fontSize: 11, color: c.mutedForeground }}>{str(r.data.flatType)} · {p.sft} Sft · {str(r.data.facing)}</Text>
                <Text style={{ fontSize: 12, color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{formatIndianCompact(p.total)}</Text>
                {stagePct1(str(r.data.currentMilestone || r.data.milestoneStage)) !== null ? <View><View style={{ height: 5, borderRadius: 3, backgroundColor: '#e5e7eb', marginVertical: 4 }}><View style={{ height: 5, borderRadius: 3, backgroundColor: '#FFB800', width: `${stagePct1(str(r.data.currentMilestone || r.data.milestoneStage)) ?? 0}%` }} /></View><Text style={{ fontSize: 10, color: c.mutedForeground }}>{str(r.data.currentMilestone || r.data.milestoneStage)}</Text></View> : null}
                <Badge text={s || r.status} tone={tone(s)} /></Pressable>; })}
          </View>
        </View>
      ))}
      {adding && res ? <Dialog title="New unit" onClose={() => setAdding(false)}><RecordForm erp={erp} res={res} ctx={ctx} onDone={() => setAdding(false)} /></Dialog> : null}
      {cur && res ? (() => { const p = price(cur); return (
        <Dialog title={`Flat ${str(cur.data.unitNumber || cur.data.name)}: Apartment Booking and Pricing`} onClose={() => setSel(null)}>
          {[['Base rate / Sft', formatINR(p.base)], ['Facing premium / Sft', formatINR(p.prem)], [`Floor rise escalation`, formatINR(p.rise)], ['Car parking fee', formatINR(p.parking)], ['Amenities fee', formatINR(p.amen)], [`Total for ${p.sft} Sft`, formatINR(p.total)]].map(([k, x]) => <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text style={{ color: c.foreground }}>{k}</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{x}</Text></View>)}
          {nv(pm.floorRatePerSqFt) > 0 ? <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Discount floor: {formatINR(nv(pm.floorRatePerSqFt))}/Sft</Text> : null}
          <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 12, marginTop: 10 }}>MILESTONE PAYMENT SCHEDULE</Text>
          {(milestonesOf(erp) ?? []).filter((m) => m.call > 0).map((m) => { const at = stagePct1(str(cur.data.currentMilestone || cur.data.milestoneStage)) ?? -1; const reached = at >= m.done; return <View key={m.name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}><Text style={{ color: reached ? c.success : c.foreground }}>{reached ? 'Reached' : 'Upcoming'} · {m.name} ({m.call}%)</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{formatINR((p.total * m.call) / 100)}</Text></View>; })}
          <InventoryStage erp={erp} rec={cur} ctx={ctx} />
          <View style={{ height: 8 }} />
          {str(cur.data.status) === 'available' && resOf(erp, 'bookings')?.canCreate ? <Btn label="Start booking" icon="bookmark" onPress={() => { const id = cur.id; setSel(null); onBook(id); }} /> : null}
          <View style={{ height: 6 }} />
          <ResourceViewDetail erp={erp} res={res} rec={cur} ctx={ctx} onClose={() => setSel(null)} />
        </Dialog>); })() : null}
    </View>
  );
}
function ResourceViewDetail({ erp, res, rec, ctx, onClose }: { erp: ProjectErp; res?: ErpResource; rec: ErpRecord; ctx: ErpCtx; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  if (!res) return null;
  return <View><Btn label="Details, edit and review" variant="ghost" onPress={() => setOpen(true)} />{open ? <RecordDetail erp={erp} res={res} rec={rec} ctx={ctx} onClose={() => { setOpen(false); onClose(); }} /> : null}</View>;
}

/* ===== Syndicate equity module ===== */
function EquityModule({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const s = useSettingsSave(erp);
  const mode = str(erp.settings.equitySplitMode) || 'proportional';
  const profiles = recsOf(erp, 'partner-profiles');
  const pres = resOf(erp, 'partner-profiles');
  const [pool, setPool] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  const prof = (pid: string) => profiles.find((r) => r.data.partnerId === pid);
  const rows = erp.partners.map((p) => {
    const pr = prof(p.id);
    const inv = nv(p.invested) + nv(extra[p.id]);
    return { p, pr, inv, fixed: nv(pr?.data.fixedEquityPercent, nv(p.equityPercent)), initial: nv(pr?.data.initialCapital) };
  });
  const totalInv = rows.reduce((n, r) => n + r.inv, 0);
  const totalFixed = rows.reduce((n, r) => n + r.fixed, 0);
  const calc = rows.map((r) => ({ ...r, pct: mode === 'fixed' ? r.fixed : totalInv > 0 ? (r.inv / totalInv) * 100 : 0 }));
  const poolN = nv(pool);
  const canSet = ctx.account.role === 'ACCOUNTANT';
  const curP = profiles.find((r) => r.id === editing) ?? null;
  return (
    <View>
      <Title sub="Equity split mode, partner profiles and an illustrative what-if. Server percentages remain the record.">Syndicate Equity</Title>
      <Card>
        <Chips label="Equity split mode" options={[{ value: 'fixed', label: 'Fixed equity %' }, { value: 'proportional', label: 'Proportional to investment' }]} value={mode} onChange={(v) => canSet && void s.save({ equitySplitMode: v })} />
        {!canSet ? <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Only the accountant can change the split mode.</Text> : null}
        {mode === 'fixed' && Math.abs(totalFixed - 100) > 0.01 && erp.partners.length ? <Banner tone="warn" title={`Fixed equity totals ${totalFixed.toFixed(2)}%, not 100%`} text="Adjust partner profiles before relying on the split." /> : null}
        {s.msg ? <Banner tone={s.msg.ok ? 'ok' : 'error'} title={s.msg.t} /> : null}
      </Card>
      <Equity erp={erp} />
      <Card>
        <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 6 }}>What-if calculator</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>Illustrative only. Nothing here is saved.</Text>
        <Field label="Projected profit / sale pool (Rs)" value={pool} onChangeText={setPool} keyboardType="numeric" />
        {calc.length === 0 ? <Text style={{ color: c.mutedForeground }}>No partners yet.</Text> : calc.map((r) => (
          <View key={r.p.id} style={{ borderTopWidth: 1, borderColor: c.border, paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{r.p.name}</Text><Text style={{ color: c.primary, fontFamily: 'Inter_700Bold' }}>{r.pct.toFixed(2)}%</Text></View>
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Invested {formatINR(r.inv)} · Drawings {formatINR(nv(r.p.drawings))} · Expenses {formatINR(nv(r.p.expenses))}</Text>
            <Text style={{ color: c.foreground, fontSize: 13 }}>Projected share {formatINR((poolN * r.pct) / 100)} · Net after drawings {formatINR((poolN * r.pct) / 100 - nv(r.p.drawings))}</Text>
            <Field label="Additional investment (what-if)" value={extra[r.p.id] ?? ''} onChangeText={(x) => setExtra((o) => ({ ...o, [r.p.id]: x }))} keyboardType="numeric" />
          </View>
        ))}
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }}>Partner profiles</Text>{pres?.canCreate ? <Btn label="Add" icon="plus" onPress={() => setAdding(true)} /> : null}</View>
        {profiles.length === 0 ? <Text style={{ color: c.mutedForeground }}>No partner profiles yet.</Text> : profiles.map((r) => (
          <Pressable key={r.id} onPress={() => setEditing(r.id)} style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{erp.partners.find((p) => p.id === r.data.partnerId)?.name ?? str(r.data.partnerId)}</Text>
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{str(r.data.roleDescription)}{r.data.roleDescription ? ' · ' : ''}equity {str(r.data.fixedEquityPercent)}% · capital {formatINR(nv(r.data.initialCapital))} · {(() => { const f = pres?.fields.find((x) => x.key === 'userRole') as ({ optionLabels?: Record<string, string> } | undefined); return f?.optionLabels?.[str(r.data.userRole)] ?? str(r.data.userRole).replace(/_/g, ' '); })()}</Text>
          </Pressable>
        ))}
      </Card>
      {adding && pres ? <Dialog title="Partner allocation" onClose={() => setAdding(false)}><RecordForm erp={erp} res={pres} ctx={ctx} onDone={() => setAdding(false)} /></Dialog> : null}
      {curP && pres ? <RecordDetail erp={erp} res={pres} rec={curP} ctx={ctx} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

/* ===== Firm accounts bar and account ledger ===== */
function AccountsBar({ erp, ctx, full }: { erp: ProjectErp; ctx: ErpCtx; full?: boolean }) {
  const c = useColors();
  const res = resOf(erp, 'accounts');
  const accts = recsOf(erp, 'accounts');
  const [type, setType] = useState('all'); const [sel, setSel] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  const types = Array.from(new Set(accts.map((a) => str(a.data.accountType || a.data.type)).filter(Boolean)));
  const shown = accts.filter((a) => type === 'all' || str(a.data.accountType || a.data.type) === type);
  const bal = (id: string) => erp.balances.find((b) => b.accountId === id)?.balance;
  const cur = accts.find((a) => a.id === sel) ?? null;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: full ? 20 : 16 }}>Project Accounts</Text>
        {res?.canCreate ? <Btn label="Add account" icon="plus" onPress={() => setAdding(true)} /> : null}
      </View>
      {types.length > 1 ? <Chips options={[{ value: 'all', label: 'All' }, ...types.map((t) => ({ value: t, label: t }))]} value={type} onChange={setType} /> : null}
      {!shown.length ? <Empty icon="credit-card" title="No accounts" text={res?.canCreate ? 'Add the first bank, cash or escrow account.' : 'No accounts have been set up.'} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ flexDirection: 'row', gap: 10 }}>
          {shown.map((a) => (
            <Pressable key={a.id} onPress={() => setSel(a.id)} accessibilityRole="button" style={{ width: 220, padding: 14, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Badge text={str(a.data.accountType || a.data.type) || 'account'} tone="warn" />
              <Text numberOfLines={1} style={{ color: '#111827', fontFamily: 'Inter_700Bold', marginTop: 6 }}>{label(a)}</Text>
              <Text numberOfLines={1} style={{ color: '#6b7280', fontSize: 11 }}>{str(a.data.bankName || a.data.accountNumber)}</Text>
              <Text style={{ color: '#111827', fontFamily: 'Inter_700Bold', fontSize: 18, marginTop: 8 }}>{bal(a.id) !== undefined ? formatINR(nv(bal(a.id))) : '-'}</Text>
            </Pressable>
          ))}
        </View></ScrollView>
      )}
      {adding && res ? <Dialog title="New project bank account" onClose={() => setAdding(false)}><RecordForm erp={erp} res={res} ctx={ctx} onDone={() => setAdding(false)} /></Dialog> : null}
      {cur ? <AccountLedger erp={erp} acct={cur} ctx={ctx} onClose={() => setSel(null)} /> : null}
    </View>
  );
}
function AccountLedger({ erp, acct, ctx, onClose }: { erp: ProjectErp; acct: ErpRecord; ctx: ErpCtx; onClose: () => void }) {
  const c = useColors();
  const res = resOf(erp, 'accounts');
  const rows = useMemo(() => buildRows(erp).filter((r) => r.accountId === acct.id), [erp, acct.id]);
  const f = useRowFilters(rows);
  const [edit, setEdit] = useState(false);
  const b = erp.balances.find((x) => x.accountId === acct.id)?.balance;
  if (edit && res) return <RecordDetail erp={erp} res={res} rec={acct} ctx={ctx} onClose={() => setEdit(false)} />;
  return (
    <Dialog title={`${label(acct)}: account ledger`} onClose={onClose}>
      <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Server-computed balance (approved records)</Text>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 26, marginBottom: 8 }}>{b !== undefined ? formatINR(nv(b)) : '-'}</Text>
      {res ? <Btn label="Account details" variant="ghost" onPress={() => setEdit(true)} /> : null}
      <View style={{ height: 8 }} />
      <Filters erp={erp} f={f} />
      <RowList rows={f.out} />
    </Dialog>
  );
}

/* ===== Customer booking wizard ===== */
function BookingWizard({ erp, ctx, initial, onClose }: { erp: ProjectErp; ctx: ErpCtx; initial?: string; onClose: () => void }) {
  const c = useColors();
  const cmd = useErpCommands(erp.projectId);
  const inv = erp.records.filter((r) => (r.kind === 'plots' || r.kind === 'units') && live(r) && ['available', undefined, ''].includes(str(r.data.status) as 'available'));
  const accts = recsOf(erp, 'accounts');
  const [step, setStep] = useState(initial ? 1 : 0);
  const [v, setV] = useState({ inventoryId: initial ?? '', buyerName: '', buyerPhone: '', date: new Date().toISOString().slice(0,10), advanceReceived: '', accountId: '', paymentMode: '', paymentRefNumber: '', notes: '', ratePerSqYard: '', bookingStatus: '', paymentMilestone: '', terms: '' });
  const bf = (k: string) => resOf(erp, 'bookings')?.fields.find((f) => f.key === k);
  const bopts = (k: string) => (bf(k)?.options ?? []).map((o) => ({ value: o, label: o }));
  const setup = erpSetup(erp);
  const pickRate = (id: string) => { const r = erp.records.find((x) => x.id === id); const n = r ? nv(r.data.ratePerSqYard, 0) : 0; setV((o) => ({ ...o, inventoryId: id, ratePerSqYard: n > 0 ? String(n) : '' })); };
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const set = (k: keyof typeof v) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const steps = ['Inventory', 'Buyer', 'Payment', 'Confirm'];
  const check = (): string | null => {
    if (step === 0 && !v.inventoryId) return 'Select a plot or unit.';
    if (step === 1) { if (!v.buyerName.trim()) return 'Buyer name is required.'; if (!/^[0-9+\s-]{7,15}$/.test(v.buyerPhone.trim())) return 'Enter a valid buyer phone number.'; }
    if (step === 2) { if (!(nv(v.advanceReceived, -1) >= 0) || v.advanceReceived.trim() === '') return 'Advance received must be a number (0 or more).'; if (nv(v.advanceReceived) > 0 && !v.accountId) return 'Choose the account that received the advance.'; if (!/cash/i.test(v.paymentMode) && nv(v.advanceReceived) > 0 && !v.paymentRefNumber.trim()) return 'Reference number is required for non-cash payments.'; }
    return null;
  };
  const next = () => { const e = check(); setErr(e); if (!e) setStep(step + 1); };
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await cmd.save('bookings', { inventoryId: v.inventoryId, buyerName: v.buyerName.trim(), buyerPhone: v.buyerPhone.trim(), date: v.date, advanceReceived: nv(v.advanceReceived), ...(v.accountId ? { accountId: v.accountId } : {}), ...(v.paymentMode ? { paymentMode: v.paymentMode } : {}), ...(bf('ratePerSqYard') && v.ratePerSqYard.trim() ? { ratePerSqYard: nv(v.ratePerSqYard) } : {}), ...(v.bookingStatus ? { bookingStatus: v.bookingStatus } : {}), ...(v.paymentMilestone ? { paymentMilestone: v.paymentMilestone } : {}), ...(bf('terms') && v.terms.trim() ? { terms: v.terms.trim() } : {}), ...(v.paymentRefNumber.trim() ? { paymentRefNumber: v.paymentRefNumber.trim() } : {}), ...(v.notes.trim() ? { notes: v.notes.trim() } : {}) });
      setDone(true);
    } catch (e) { setErr(errMessage(e)); } finally { setBusy(false); }
  };
  void ctx;
  const chosen = erp.records.find((r) => r.id === v.inventoryId);
  const total = chosen && nv(v.ratePerSqYard) > 0 ? nv(v.ratePerSqYard) * nv(chosen.data.areaSqYards) : 0;
  return (
    <Dialog title="Customer booking" onClose={onClose}>
      {done ? <View><Banner tone="ok" title="Booking submitted" text="It is pending review. Inventory status changes only when the server records it." /><Btn label="Close" onPress={onClose} /></View> : <View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>{steps.map((s, i) => <View key={s} style={{ flex: 1 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: i <= step ? AMBER : c.muted }} /><Text style={{ fontSize: 10, color: i === step ? c.foreground : c.mutedForeground, marginTop: 3 }}>{i + 1}. {s}</Text></View>)}</View>
        {chosen && step > 0 ? <View style={{ backgroundColor: c.muted, borderRadius: 12, padding: 10, marginBottom: 10 }}><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{chosen.kind === 'plots' ? 'Plot' : 'Flat'} {label(chosen)}</Text><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{[str(chosen.data.facing), chosen.data.areaSqYards !== undefined ? `${str(chosen.data.areaSqYards)} Sq.Yds` : '', str(chosen.data.dimensions), chosen.data.roadWidthFt !== undefined ? `${str(chosen.data.roadWidthFt)} ft road` : ''].filter(Boolean).join(' · ')}</Text></View> : null}
        {step === 0 ? (inv.length ? <Chips label="Available plot or unit" options={inv.map((r) => ({ value: r.id, label: `${r.kind === 'plots' ? 'Plot' : 'Flat'} ${label(r)}` }))} value={v.inventoryId} onChange={pickRate} /> : <Empty icon="inbox" title="Nothing available to book" />) : null}
        {step === 1 ? <View><Field label="Buyer Name:" value={v.buyerName} onChangeText={set('buyerName')} /><Field label="Buyer Phone:" value={v.buyerPhone} onChangeText={set('buyerPhone')} keyboardType="phone-pad" /></View> : null}
        {step === 2 ? <View><Field label="Booking date" value={v.date} onChangeText={set('date')} hint="YYYY-MM-DD" /><Field label="Advance Received (Rs):" value={v.advanceReceived} onChangeText={set('advanceReceived')} keyboardType="numeric" />{(setup.quickTokens.length || total > 0) ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{setup.quickTokens.map((t) => <Btn key={t} label={formatINR(t)} variant="ghost" onPress={() => set('advanceReceived')(String(t))} />)}{total > 0 ? <Btn label={`Full payment ${formatINR(total)}`} variant="ghost" onPress={() => set('advanceReceived')(String(total))} /> : null}</View> : null}<Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>Recorded as pending. Money counts toward an account balance only after the receipt is cleared.</Text><Chips label="Deposit account" options={[{ value: '', label: 'None' }, ...accts.map((a) => ({ value: a.id, label: label(a) }))]} value={v.accountId} onChange={set('accountId')} />{bopts('paymentMode').length ? <Chips label="Payment mode" options={bopts('paymentMode')} value={v.paymentMode} onChange={set('paymentMode')} /> : <Field label="Payment mode" value={v.paymentMode} onChangeText={set('paymentMode')} />}{bf('ratePerSqYard') ? <Field label={`${bf('ratePerSqYard')?.label ?? 'Rate'} (floor is validated by the server)`} value={v.ratePerSqYard} onChangeText={set('ratePerSqYard')} keyboardType="numeric" /> : null}{bf('ratePerSqYard') && nv(v.ratePerSqYard) > 0 && chosen ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>Total {formatINR(nv(v.ratePerSqYard) * nv(chosen.data.areaSqYards))} · Outstanding after advance {formatINR(Math.max(0, nv(v.ratePerSqYard) * nv(chosen.data.areaSqYards) - nv(v.advanceReceived)))} (estimate; the server calculates the saved amounts)</Text> : null}{bopts('bookingStatus').length ? <Chips label={bf('bookingStatus')?.label ?? 'Booking status'} options={bopts('bookingStatus')} value={v.bookingStatus} onChange={set('bookingStatus')} /> : null}{bopts('paymentMilestone').length ? <Chips label={bf('paymentMilestone')?.label ?? 'Payment milestone'} options={bopts('paymentMilestone')} value={v.paymentMilestone} onChange={set('paymentMilestone')} /> : null}{bf('terms') ? <Field label={bf('terms')?.label ?? 'Terms'} value={v.terms} onChangeText={set('terms')} multiline height={80} /> : null}<Field label="Payment reference number:" value={v.paymentRefNumber} onChangeText={set('paymentRefNumber')} /></View> : null}
        {step === 3 ? <View>{[['Inventory', chosen ? `${chosen.kind === 'plots' ? 'Plot' : 'Flat'} ${label(chosen)}` : '-'], ['Buyer', `${v.buyerName} (${v.buyerPhone})`], ['Advance', formatINR(nv(v.advanceReceived))], ['Account', v.accountId ? recLabel(erp.records, v.accountId) : '-'], ['Mode', v.paymentMode], ['Reference', v.paymentRefNumber || '-']].map(([k, x]) => <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text style={{ color: c.mutedForeground }}>{k}</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', flexShrink: 1, textAlign: 'right' }}>{x}</Text></View>)}<Field label="Notes" value={v.notes} onChangeText={set('notes')} multiline /></View> : null}
        {err ? <Banner tone="error" title={err} /> : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {step > 0 ? <View style={{ flex: 1 }}><Btn label="Back" variant="ghost" onPress={() => { setErr(null); setStep(step - 1); }} /></View> : null}
          <View style={{ flex: 1 }}>{step < 3 ? <Btn label="Next" onPress={next} /> : <Btn label="Confirm booking" loading={busy} onPress={submit} />}</View>
        </View>
      </View>}
    </Dialog>
  );
}
function BookingsView({ erp, ctx, preset, clearPreset }: { erp: ProjectErp; ctx: ErpCtx; preset?: string; clearPreset: () => void }) {
  const c = useColors();
  const res = resOf(erp, 'bookings');
  const [wiz, setWiz] = useState(false); const [sel, setSel] = useState<string | null>(null);
  const recs = recsOf(erp, 'bookings');
  const cur = recs.find((r) => r.id === sel) ?? null;
  return (
    <View>
      <Title sub="Customer bookings against plots and apartments.">Bookings</Title>
      {res?.canCreate ? <Btn label="New booking" icon="bookmark" onPress={() => setWiz(true)} /> : null}
      <View style={{ height: 10 }} />
      {!recs.length ? <Empty icon="bookmark" title="No bookings yet" /> : recs.map((r) => (
        <Pressable key={r.id} onPress={() => setSel(r.id)}><Card style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{str(r.data.buyerName)}</Text><Badge text={r.status} tone={tone(r.status)} /></View>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{recLabel(erp.records, r.data.inventoryId)} · advance {formatINR(nv(r.data.advanceReceived))} · {str(r.data.paymentMode)}</Text>
        </Card></Pressable>
      ))}
      {(wiz || preset) ? <BookingWizard erp={erp} ctx={ctx} initial={preset} onClose={() => { setWiz(false); clearPreset(); }} /> : null}
      {cur && res ? <RecordDetail erp={erp} res={res} rec={cur} ctx={ctx} onClose={() => setSel(null)} footer={<BookingReceipts erp={erp} booking={cur} ctx={ctx} />} /> : null}
    </View>
  );
}

/* ===== Investments / Expenses / Drawings approvals desk ===== */
function Reimbursements({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const res = resOf(erp, 'reimbursements');
  const [pick, setPick] = useState(false); const [exp, setExp] = useState<string | null>(null); const [sel, setSel] = useState<string | null>(null);
  if (!res) return null;
  const list = recsOf(erp, 'reimbursements');
  const eligible = recsOf(erp, 'expenses').filter((r) => r.status === 'approved' && r.data.paymentSource === 'individual' && !r.data.accountId
    && (ctx.account.role !== 'PARTNER' || r.data.partnerId === ctx.account.identityId));
  const paid = (id: string) => list.filter((r) => r.data.expenseId === id && r.status !== 'rejected').reduce((n, r) => n + nv(r.data.amount), 0);
  const chosen = eligible.find((r) => r.id === exp) ?? null;
  const cur = list.find((r) => r.id === sel) ?? null;
  return (
    <Card>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 15 }}>Reimbursements</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>Repay a partner who paid an approved expense personally. The bank is debited only here, once the reimbursement itself is approved, so nothing is debited twice.</Text>
      {res.canCreate ? <Btn label="Reimburse an expense" icon="plus" variant="ghost" onPress={() => { setExp(null); setPick(true); }} /> : null}
      <View style={{ height: 8 }} />
      {!list.length ? <Text style={{ color: c.mutedForeground }}>No reimbursements yet.</Text> : list.map((r) => (
        <Pressable key={r.id} onPress={() => setSel(r.id)} style={{ paddingVertical: 8, borderTopWidth: 1, borderColor: c.border, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{formatINR(nv(r.data.amount))}</Text><Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 12 }}>{recLabel(erp.records, r.data.expenseId)} · {str(r.data.date)}</Text></View>
          <Badge text={r.status} tone={tone(r.status)} />
        </Pressable>
      ))}
      {pick ? <Dialog title="Reimburse an expense" onClose={() => setPick(false)}>
        {!chosen ? (eligible.length ? <View><Label>Approved expense paid individually (paymentSource = individual)</Label>{eligible.map((r) => <Pressable key={r.id} onPress={() => setExp(r.id)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: c.border }}><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{formatINR(nv(r.data.amount))} · {str(r.data.category) || label(r)}</Text><Text style={{ color: c.mutedForeground, fontSize: 12 }}>Already requested {formatINR(paid(r.id))}</Text></Pressable>)}</View> : <Empty icon="inbox" title="Nothing to reimburse" text="Approved expenses paid by an individual appear here." />)
          : <RecordForm erp={erp} res={res} ctx={ctx} fixed={{ expenseId: chosen.id }} onDone={() => setPick(false)} />}
      </Dialog> : null}
      {cur ? <RecordDetail erp={erp} res={res} rec={cur} ctx={ctx} onClose={() => setSel(null)} /> : null}
    </Card>
  );
}

function ApprovalsDesk({ erp, kind, ctx }: { erp: ProjectErp; kind: string; ctx: ErpCtx }) {
  const c = useColors();
  const { t } = useLang();
  const partner = ctx.account.role === 'PARTNER';
  const res = resOf(erp, kind);
  const recs = recsOf(erp, kind);
  const [f, setF] = useState('all'); const [q, setQ] = useState(''); const [sel, setSel] = useState<string | null>(null); const [adding, setAdding] = useState(false);
  useEffect(() => { if (takeIntent(kind)) setAdding(true); }, [kind]);
  if (!res) return <Empty icon="slash" title="Not available" text={`"${kind}" is not available to your role in this project.`} />;
  const isInv = kind === 'investments';
  const filters = isInv
    ? [['all', t('filterAllInvestments')], ['mine', t('filterMyInvestments')], ['cash', t('filterCashOnly')], ['bank', t('filterBankOnly')], ['pending', t('filterInvPending')], ['approved', t('filterInvApproved')]]
    : [['all', t('filterAll')], ['mine', t('filterMyInvestments')], ['pending', t('filterPending')], ['approved', t('filterApproved')], ['rejected', 'Rejected']];
  const modeOf = (r: ErpRecord) => str(r.data.paymentMode || r.data.paymentChannel || r.data.payoutMode || r.data.mode);
  const shown = recs.filter((r) => {
    if (f === 'mine' && r.data.partnerId !== ctx.account.identityId && r.createdBy !== ctx.account.identityId) return false;
    if (f === 'cash' && modeOf(r).toLowerCase() !== 'cash') return false;
    if (f === 'bank' && modeOf(r).toLowerCase() === 'cash') return false;
    if (['pending', 'approved', 'rejected'].includes(f) && r.status !== f) return false;
    return !q.trim() || JSON.stringify(r.data).toLowerCase().includes(q.trim().toLowerCase());
  });
  const total = shown.filter((r) => r.status === 'approved').reduce((n, r) => n + nv(r.data.amount), 0);
  const titleKey = isInv ? 'investmentRecordsHistory' : kind === 'drawings' ? 'recentDraws' : 'pendingApprovalsTitle';
  const addKey = isInv ? 'investedAmount' : kind === 'drawings' ? 'submitDrawBtn' : 'submitExpenseBtn';
  const cur = recs.find((r) => r.id === sel) ?? null;
  return (
    <View>
      {partner ? <Title sub={isInv ? t('investmentsBannerSubtitle') : t('expensesBannerSubtitle')}>{isInv ? t('investmentsBannerTitle') : t('expensesBannerTitle')}</Title> : <Title>{res.title}</Title>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <Stat l="Approved total" v={formatINR(total)} sub="in current filter" />
        <Stat l="Awaiting review" v={String(recs.filter((r) => r.status === 'pending').length)} />
      </View>
      {res.canCreate ? <Btn label={partner ? (isInv ? t('enrollExpenseBtn').replace(/expenses/i, 'Investment') : t(addKey === 'investedAmount' ? 'submitExpenseBtn' : addKey)) : `Add ${res.title}`} icon="plus" onPress={() => setAdding(true)} /> : null}
      {kind === 'expenses' ? <Reimbursements erp={erp} ctx={ctx} /> : null}
      <View style={{ height: 10 }} />
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 }}>{t(titleKey as 'recentDraws')}</Text>
      <Chips options={filters.map(([value, l]) => ({ value, label: l }))} value={f} onChange={setF} />
      <Field label="Search" value={q} onChangeText={setQ} />
      {!shown.length ? <Empty icon="inbox" title={isInv ? t('noInvestmentsFound') : kind === 'drawings' ? t('noDrawings') : t('noExpenses')} /> : shown.map((r) => (
        <Pressable key={r.id} onPress={() => setSel(r.id)}><Card style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{formatINR(nv(r.data.amount))}</Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }} numberOfLines={2}>{[erp.partners.find((p) => p.id === r.data.partnerId)?.name, str(r.data.category), str(r.data.vendorName), modeOf(r), r.data.accountId ? recLabel(erp.records, r.data.accountId) : '', str(r.data.date)].filter(Boolean).join(' · ')}</Text>
              <Text style={{ color: c.mutedForeground, fontSize: 11 }}>{r.votes.length} consensus sign-off(s){r.data.receiptAttachmentId ? ' · bill attached' : ''}{r.data.voiceAttachmentId ? ' · voice memo' : ''}</Text>
            </View>
            <Badge text={r.status === 'pending' ? t('statusPending') : r.status === 'approved' ? t('statusApproved') : r.status} tone={tone(r.status)} />
          </View>
        </Card></Pressable>
      ))}
      {adding ? <Dialog title={`New ${res.title}`} onClose={() => setAdding(false)}><RecordForm erp={erp} res={res} ctx={ctx} onDone={() => setAdding(false)} /></Dialog> : null}
      {cur ? <RecordDetail erp={erp} res={res} rec={cur} ctx={ctx} onClose={() => setSel(null)} /> : null}
    </View>
  );
}

/* ===== Documents (authenticated attachments) ===== */
function Documents({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const res = resOf(erp, 'documents');
  const recs = recsOf(erp, 'documents');
  const [adding, setAdding] = useState(false); const [sel, setSel] = useState<string | null>(null);
  if (!res) return <Empty icon="slash" title="Not available" />;
  const cur = recs.find((r) => r.id === sel) ?? null;
  return (
    <View>
      <Title sub="Plan uploads and project documents. Files are stored server-side and downloaded with your session.">Documents</Title>
      {res.canCreate ? <Btn label="Upload document" icon="upload" onPress={() => setAdding(true)} /> : null}
      <View style={{ height: 10 }} />
      {!recs.length ? <Empty icon="file" title="No documents" /> : recs.map((r) => <Pressable key={r.id} onPress={() => setSel(r.id)}><Card style={{ padding: 12 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold' }}>{str(r.data.title)}</Text><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{str(r.data.category)}</Text></View><Badge text={r.status} tone={tone(r.status)} /></View></Card></Pressable>)}
      {adding ? <Dialog title="Upload document" onClose={() => setAdding(false)}><RecordForm erp={erp} res={res} ctx={ctx} onDone={() => setAdding(false)} /></Dialog> : null}
      {cur ? <Dialog title={str(cur.data.title)} onClose={() => setSel(null)}>{str(cur.data.attachmentId) ? <AttachmentView projectId={erp.projectId} id={str(cur.data.attachmentId)} label="Document" /> : <Text>No file attached.</Text>}<ResourceViewDetail erp={erp} res={res} rec={cur} ctx={ctx} onClose={() => setSel(null)} /></Dialog> : null}
    </View>
  );
}

/* ===== Partner dashboard (source KPI cards, en/te) ===== */
function PartnerDashboard({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const { t } = useLang();
  const me = erp.partners.find((p) => p.id === ctx.account.identityId);
  const pr = recsOf(erp, 'partner-profiles').find((r) => r.data.partnerId === ctx.account.identityId);
  const roleField = resOf(erp, 'partner-profiles')?.fields.find((f) => f.key === 'userRole');
  const roleLabels = (roleField as (typeof roleField & { optionLabels?: Record<string, string> }) | undefined)?.optionLabels;
  const projectRole = roleLabels?.[str(pr?.data.userRole)];
  const est = nv(pr?.data.initialCapital); const act = nv(me?.invested); const draws = nv(me?.drawings);
  const eq = nv(me?.equityPercent);
  const plots = recsOf(erp, 'plots');
  const invs = recsOf(erp, 'investments'); const exps = recsOf(erp, 'expenses');
  const mine = (r: ErpRecord) => r.data.partnerId === ctx.account.identityId || r.createdBy === ctx.account.identityId;
  const pendInv = invs.filter((r) => r.status === 'pending' && mine(r)).length;
  const lc = (erp.settings.layoutCalculation ?? {}) as Record<string, unknown>;
  const det = (ctx.project?.details ?? {}) as Record<string, unknown>;
  const ext = det.extentValue ?? lc.totalExtentValue; const extUnit = str(det.extentUnit ?? lc.unit);
  const totalArea = plots.reduce((n, r) => n + nv(r.data.areaSqYards), 0);
  const allotted = (totalArea * eq) / 100;
  const avgPlot = plots.length ? totalArea / plots.length : 0;
  const plotValue = plots.filter((r) => str(r.data.status) !== 'blocked').reduce((n, r) => n + nv(r.data.areaSqYards) * nv(r.data.ratePerSqYard), 0);
  const outlay = det.totalEstimatedOutlay;
  const profit = outlay !== undefined && outlay !== '' && plotValue > 0 ? ((plotValue - nv(outlay)) * eq) / 100 : null;
  const bar = (pct: number, color = '#FFB800') => <View style={{ height: 8, borderRadius: 4, backgroundColor: '#e5e7eb', marginTop: 6 }}><View style={{ height: 8, borderRadius: 4, backgroundColor: color, width: `${Math.max(0, Math.min(100, pct))}%` }} /></View>;
  const tile = (lab: string, icon: string, go: () => void, dark?: boolean) => <Pressable key={lab} onPress={go} accessibilityRole="button" style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: dark ? '#111827' : '#FFB800', borderWidth: 1, borderColor: c.border }}><Text style={{ color: dark ? '#fff' : '#111827', fontFamily: 'Inter_700Bold', fontSize: 12 }}>{lab}</Text></Pressable>;
  void icon_;
  const kpi = (title: string, v: string, desc?: string, pct?: number, color?: string) => <Card key={title} style={{ minWidth: 150, flexGrow: 1, marginBottom: 0 }}><Text style={{ color: c.mutedForeground, fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' }}>{title}</Text><Text style={{ color: c.foreground, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 }}>{v}</Text>{pct !== undefined ? bar(pct, color) : null}{desc ? <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 4 }}>{desc}</Text> : null}</Card>;
  const go = (kind: string, create?: boolean) => { if (!navTo({ kind, create })) { /* screen not in this interface */ } };
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}><Title sub={projectRole ? `${projectRole} · ${ctx.project?.name ?? ''}` : undefined}>{t('partnerHub')}</Title><LangToggle /></View>
      {!me ? <Banner tone="warn" title="Your partner figures are not available for this project" /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {kpi(t('estimatedInvestment'), formatINR(est), `${t('estimatedInvestmentDesc')} (${formatIndianCompact(est)})`)}
        {kpi(t('actualInvestment'), formatINR(act), t('actualInvestmentDesc'), est > 0 ? (act / est) * 100 : undefined, act >= est && est > 0 ? c.success : '#FFB800')}
        {kpi(act >= est && est > 0 ? t('targetMet') : t('pendingToClear'), formatINR(Math.abs(est - act)), act >= est && est > 0 ? t('surplusInvestedDesc') : t('pendingToClearDesc'))}
        {kpi(t('cashDrawings'), formatINR(draws), t('cashDrawingsDesc'), act > 0 ? (draws / act) * 100 : undefined, c.destructive)}
        {kpi(t('agreedEquity'), `${me?.equityPercent ?? '0'}%`, undefined, eq)}
        {kpi(t('allottedSellableArea'), `${Math.round(allotted).toLocaleString('en-IN')} Sq.Yds`, `${t('allottedSellableAreaDesc')}: ${eq}% of ${Math.round(totalArea).toLocaleString('en-IN')} Sq.Yds (~${Math.round(allotted * 9).toLocaleString('en-IN')} Sq.Ft)`, eq)}
        {kpi(t('equivalentPlots'), avgPlot > 0 ? (allotted / avgPlot).toFixed(1) : '-', avgPlot > 0 ? `at average ${Math.round(avgPlot)} Sq.Yds per plot` : undefined)}
        {kpi(t('expectedProfit'), profit === null ? '-' : formatINR(profit), profit === null ? 'Needs plot rates and the project outlay' : `${est > 0 ? Math.round((profit / est) * 100) : 0}% of estimated investment`)}
      </View>
      <Card>
        <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>{t('projectOverview')}</Text>
        {[[t('projectLocation'), str(ctx.project?.location) || '-'], [t('surveyNumber'), str(det.surveyNumbers) || '-'], [t('lpReraNumber'), str(det.lpOrReraNumber) || '-'], [t('totalVentureExtent'), ext !== undefined && ext !== '' ? `${ext} ${extUnit}` : '-'], [t('ventureCostOutlay'), outlay !== undefined && outlay !== '' ? formatINR(nv(outlay)) : '-']].map(([k, x]) => <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 8 }}><Text style={{ color: c.mutedForeground, fontSize: 12 }}>{k}</Text><Text style={{ color: c.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 12, flexShrink: 1, textAlign: 'right' }}>{x}</Text></View>)}
        <Text style={{ color: c.mutedForeground, fontSize: 11, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>{t('quickActions')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tile(t('enrollInvestmentBtn'), 'plus', () => go('investments', true))}
          {tile(`${t('investmentRecordsHistory')} (${invs.length})${pendInv ? ` · ${pendInv} pending` : ''}`, 'file', () => go('investments'), true)}
          {tile(t('enrollExpenseBtn'), 'camera', () => go('expenses', true))}
          {tile(t('requestDrawBtn'), 'dollar', () => go('drawings', true), true)}
          {tile(`${t('viewPlotsBtn')} (${plots.length})`, 'grid', () => go('plots'))}
          {tile(t('viewPassbookBtn'), 'bank', () => go('statement'))}
        </View>
        <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 8 }}>{exps.filter((r) => r.status === 'pending' && mine(r)).length} of your expense record(s) await review.</Text>
      </Card>
    </View>
  );
}
const icon_ = 0;

/* ===== registry ===== */
function Host({ children }: { children: React.ReactNode }) { return <View>{children}</View>; }

function Plots({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const [book, setBook] = useState<string | undefined>();
  return <Host><LayoutMasterGrid erp={erp} ctx={ctx} onBook={setBook} />{book ? <BookingWizard erp={erp} ctx={ctx} initial={book} onClose={() => setBook(undefined)} /> : null}</Host>;
}
function Units({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const [book, setBook] = useState<string | undefined>();
  return <Host><UnitsModule erp={erp} ctx={ctx} onBook={setBook} />{book ? <BookingWizard erp={erp} ctx={ctx} initial={book} onClose={() => setBook(undefined)} /> : null}</Host>;
}
function Bookings({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const [p, setP] = useState<string | undefined>();
  return <BookingsView erp={erp} ctx={ctx} preset={p} clearPreset={() => setP(undefined)} />;
}
function Settings({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const s = useSettingsSave(erp);
  const mode = str(erp.settings.ledgerMode) || 'internal_syndicate';
  return (
    <View>
      <Title>Project Settings</Title>
      <Card>
        <Chips label="Ledger mode" options={[{ value: 'internal_syndicate', label: 'Internal syndicate book' }, { value: 'official_tax', label: 'Official tax book' }]} value={mode} onChange={(v) => ctx.account.role === 'ACCOUNTANT' && void s.save({ ledgerMode: v })} />
        {s.msg ? <Banner tone={s.msg.ok ? 'ok' : 'error'} title={s.msg.t} /> : null}
      </Card>
      <EquityModule erp={erp} ctx={ctx} />
      <LayoutCalc erp={erp} ctx={ctx} />
      <PricingEditor erp={erp} ctx={ctx} />
      <PlanBuilder erp={erp} ctx={ctx} />
    </View>
  );
}

registerBespoke((key, props, erp, ctx) => {
  const kind = str(props.resource);
  switch (key) {
    case 'erp-dashboard': return ctx.account.role === 'PARTNER' ? <PartnerDashboard erp={erp} ctx={ctx} /> : <View><AccountsBar erp={erp} ctx={ctx} /><Dashboard erp={erp} /></View>;
    case 'erp-equity': return <EquityModule erp={erp} ctx={ctx} />;
    case 'erp-layout': return <View><LayoutCalc erp={erp} ctx={ctx} /><Plots erp={erp} ctx={ctx} /></View>;
    case 'erp-pricing': return <View><PricingEditor erp={erp} ctx={ctx} /><Units erp={erp} ctx={ctx} /></View>;
    case 'erp-statement': return <ProjectStatement erp={erp} ctx={ctx} />;
    case 'erp-settings': return <Settings erp={erp} ctx={ctx} />;
    case 'erp-plan': return <PlanBuilder erp={erp} ctx={ctx} />;
    case 'erp-resource':
      if (kind === 'plots') return <Plots erp={erp} ctx={ctx} />;
      if (kind === 'units') return <Units erp={erp} ctx={ctx} />;
      if (kind === 'accounts') return <AccountsBar erp={erp} ctx={ctx} full />;
      if (kind === 'investments' || kind === 'expenses' || kind === 'drawings') return <ApprovalsDesk erp={erp} kind={kind} ctx={ctx} />;
      if (kind === 'bookings') return <Bookings erp={erp} ctx={ctx} />;
      if (kind === 'settlements' || kind === 'stock-draws') return <LiquorModule erp={erp} ctx={ctx} initial={kind} />;
      if (kind === 'documents') return <Documents erp={erp} ctx={ctx} />;
      return null;
    default: return null;
  }
});
void ResourceView;
