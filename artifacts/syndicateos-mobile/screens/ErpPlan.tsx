import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { ProjectErp } from '@workspace/api-client-react';
import { Banner, Btn, Card, Chips, Field } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { newRequestId, planChunks, useErpCommands } from '@/lib/erp';
import { errMessage } from '@/lib/session';
import { formatINR } from '@/lib/sourceCalc';
import { erpSetup } from '@/lib/erpSetup';
import { str, type ErpCtx } from '@/screens/ErpScreens';

const nv = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : 0; };
type Row = Record<string, string>;
type Col = { key: string; label: string; kind?: 'num' | 'select'; options?: string[]; w?: number };

function ListEditor({ title, cols, rows, onChange, addLabel, editable }: { title: string; cols: Col[]; rows: Row[]; onChange: (r: Row[]) => void; addLabel: string; editable: boolean }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 6 }}>{title} ({rows.length})</Text>
      {rows.map((r, i) => (
        <Card key={i} style={{ padding: 10 }}>
          {cols.map((k) => k.kind === 'select'
            ? <Chips key={k.key} label={k.label} options={(k.options ?? []).map((o) => ({ value: o, label: o }))} value={r[k.key] ?? ''} onChange={(v) => editable && onChange(rows.map((x, j) => (j === i ? { ...x, [k.key]: v } : x)))} />
            : <Field key={k.key} label={k.label} value={r[k.key] ?? ''} editable={editable} keyboardType={k.kind === 'num' ? 'numeric' : 'default'} onChangeText={(v) => onChange(rows.map((x, j) => (j === i ? { ...x, [k.key]: v } : x)))} />)}
          {editable ? <Btn label="Remove" variant="ghost" icon="trash-2" onPress={() => onChange(rows.filter((_, j) => j !== i))} /> : null}
        </Card>
      ))}
      {editable ? <Btn label={addLabel} variant="ghost" icon="plus" onPress={() => onChange([...rows, Object.fromEntries(cols.map((k) => [k.key, '']))])} /> : null}
    </View>
  );
}


export function PlanBuilder({ erp, ctx }: { erp: ProjectErp; ctx: ErpCtx }) {
  const c = useColors();
  const cmd = useErpCommands(erp.projectId);
  const has = (k: string) => erp.resources.some((r) => r.kind === k);
  const mode = has('plots') ? 'plots' : has('units') ? 'units' : has('settlements') ? 'liquor' : 'infra';
  const plan = ((erp.settings.projectPlan ?? {}) as Record<string, unknown>)[mode] as Record<string, unknown> | undefined;
  const rowsOf = (k: string, d: Row[] = []): Row[] => (Array.isArray(plan?.[k]) ? (plan?.[k] as Row[]) : d);
  const editable = ctx.account.role === 'ACCOUNTANT';
  const det = (ctx.project?.details ?? {}) as Record<string, unknown>;
  const lc = (erp.settings.layoutCalculation ?? {}) as Record<string, unknown>;

  const fopts = (kind: string, key: string): string[] | undefined => { const o = erp.resources.find((r) => r.kind === kind)?.fields.find((f) => f.key === key)?.options; return o && o.length ? o : undefined; };
  const FACINGS = fopts('plots', 'facing'); const FLATS = fopts('units', 'flatType'); const UFACINGS = fopts('units', 'facing');
  const OUTLETS = fopts('settlements', 'category') ?? fopts('counters', 'category');
  const sel = (options?: string[]) => (options ? { kind: 'select' as const, options } : {});
  const [dist, setDist] = useState<Row[]>(rowsOf('distribution'));
  const [startNo, setStartNo] = useState(str(plan?.startNumber));
  const [floors, setFloors] = useState(str(plan?.floorsCount));
  const [flats, setFlats] = useState<Row[]>(rowsOf('flats'));
  const [amen, setAmen] = useState<Row[]>(rowsOf('amenities'));
  const [counters, setCounters] = useState<Row[]>(rowsOf('counters'));
  const [facs, setFacs] = useState<Row[]>(rowsOf('facilities'));
  const [pkgs, setPkgs] = useState<Row[]>(rowsOf('packages'));
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const ext = nv(det.extentValue ?? lc.totalExtentValue);
  const unit = str(det.extentUnit ?? lc.unit);
  const LR = erpSetup(erp).layout;
  const roadInput = det.roadWidth ?? lc.roadWidth;
  const openInput = det.openSpacePercent ?? lc.openSpacePercent;
  const metrics = ext > 0 && roadInput !== undefined && roadInput !== '' && openInput !== undefined && openInput !== ''
    && LR && LR.unitConversions[unit] !== undefined && LR.roadLossPercentByWidth[String(roadInput)] !== undefined
    ? (() => { const g = ext * LR.unitConversions[unit]; return { netSellableSqYards: Math.round(Math.max(0, g - (g * LR.roadLossPercentByWidth[String(roadInput)]) / 100 - (g * nv(openInput)) / 100)) }; })() : null;

  const planData = (): Record<string, unknown> => mode === 'plots' ? { distribution: dist, startNumber: startNo } : mode === 'units' ? { floorsCount: floors, flats, amenities: amen } : mode === 'liquor' ? { counters, facilities: facs } : { packages: pkgs, facilities: facs };
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const { revision, ...rest } = erp.settings as Record<string, unknown>; void revision;
      const prev = (rest.projectPlan ?? {}) as Record<string, unknown>;
      await cmd.settings(nv(erp.settings.revision), { ...rest, projectPlan: { ...prev, [mode]: planData() } });
      setMsg({ ok: true, t: 'Plan saved to project settings.' });
    } catch (e) { setMsg({ ok: false, t: errMessage(e) }); } finally { setBusy(false); }
  };

  /* ----- inventory generation from entered rows only ----- */
  const existing = (kind: string, key: string) => new Set(erp.records.filter((r) => r.kind === kind && r.status !== 'deleted').map((r) => str(r.data[key])));
  const build = (): { rows: Record<string, unknown>[]; error: string | null } => {
    const out: Record<string, unknown>[] = [];
    if (mode === 'plots') {
      let n = Math.floor(nv(startNo));
      if (startNo.trim() === '' || n < 0) return { rows: [], error: 'Enter the starting plot number (0 or more).' };
      const taken = existing('plots', 'plotNumber');
      const road = lc.roadWidth ?? det.roadWidth; const rate = lc.expectedRatePerSqYard ?? lc.floorRatePerSqYard;
      for (const d of dist) {
        const cnt = d.count?.trim() === '' || d.count === undefined ? 0 : Number(d.count);
        if (!Number.isInteger(cnt) || cnt < 0) return { rows: [], error: `${d.label}: plot count must be a whole number.` };
        if (cnt === 0) continue;
        const area = Number(d.area);
        if (d.area?.trim() === '' || !(area > 0)) return { rows: [], error: `${d.label}: enter the area per plot (Sq.Yds).` };
        if (!d.facing) return { rows: [], error: `${d.label}: choose a facing.` };
        for (let i = 0; i < cnt; i++, n++) {
          if (taken.has(String(n))) return { rows: [], error: `Plot number ${n} already exists. Change the starting number.` };
          if (rate === undefined || rate === '') return { rows: [], error: 'Enter the plot rate in the layout calculator before generating inventory.' };
          out.push({ plotNumber: String(n), blockName: d.label, facing: d.facing, areaSqYards: area, status: 'available', ...(road !== undefined && road !== '' ? { roadWidthFt: nv(road) } : {}), ratePerSqYard: nv(rate) });
        }
      }
      if (metrics) { const total = out.reduce((a, r) => a + nv(r.areaSqYards), 0); if (total > metrics.netSellableSqYards) return { rows: [], error: `Plots total ${total.toLocaleString('en-IN')} Sq.Yds, above the net sellable ${metrics.netSellableSqYards.toLocaleString('en-IN')} Sq.Yds.` }; }
    } else if (mode === 'units') {
      const fl = Math.floor(nv(floors));
      if (floors.trim() === '' || fl < 1) return { rows: [], error: 'Enter the number of floors.' };
      const taken = existing('units', 'unitNumber');
      const perFloor = flats.filter((f) => f.flatType || f.sftArea);
      for (const f of perFloor) if (!f.flatType || !(Number(f.sftArea) > 0) || !f.facing) return { rows: [], error: 'Every flat needs a type, super built-up area and facing.' };
      for (let floor = 1; floor <= fl; floor++) perFloor.forEach((f, i) => {
        const no = `${floor}${String(i + 1).padStart(2, '0')}`;
        out.push({ unitNumber: no, floor, flatType: f.flatType, sftArea: Number(f.sftArea), facing: f.facing, status: 'available' });
      });
      const dup = out.find((r) => taken.has(str(r.unitNumber)));
      if (dup) return { rows: [], error: `Unit ${str(dup.unitNumber)} already exists.` };
    }
    return { rows: out, error: null };
  };
  const [gen, setGen] = useState<{ rows: number; chunks: number } | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);
  const prepare = () => { setMsg(null); const b = build(); if (b.error) { setGenErr(b.error); setGen(null); return; } if (!b.rows.length) { setGenErr('Nothing to generate. Enter counts first.'); setGen(null); return; } const pc = planChunks(b.rows); if (pc.error) { setGenErr(pc.error); return; } setGenErr(null); setGen({ rows: b.rows.length, chunks: pc.chunks.length }); };
  const generate = async () => {
    const b = build(); if (b.error) return setGenErr(b.error);
    const { chunks, error } = planChunks(b.rows); if (error) return setGenErr(error);
    const kind = mode === 'plots' ? 'plots' : 'units';
    setBusy(true); setMsg(null);
    let done = 0;
    try {
      for (const ch of chunks) { await cmd.bulkSave(kind, ch, newRequestId()); done += ch.length; }
      setMsg({ ok: true, t: `Created ${done} ${kind} in ${chunks.length} request(s).` }); setGen(null);
    } catch (e) { setMsg({ ok: false, t: `${errMessage(e)} ${done} of ${b.rows.length} rows were saved before the failure; completed chunks are not repeated automatically. Review the inventory before retrying.` }); }
    finally { setBusy(false); }
  };

  const totalPlots = dist.reduce((a, d) => a + nv(d.count), 0);
  const plotArea = dist.reduce((a, d) => a + nv(d.count) * nv(d.area), 0);
  const bua = nv(floors) * flats.reduce((a, f) => a + nv(f.sftArea), 0);
  const target = counters.reduce((a, r) => a + nv(r.dailySalesTarget), 0);
  return (
    <View>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 20 }}>{mode === 'plots' ? 'Open Plotting Plan Builder' : mode === 'units' ? 'Construction Plan Builder' : mode === 'liquor' ? 'Retail Counter Outlets and Logistics Planning' : 'Custom Infrastructure Planning'}</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 10 }}>Project details (extent, road width, rates) come from the project record and Layout settings. Nothing is pre-filled with sample numbers.</Text>
      {!editable ? <Banner tone="warn" title="Read-only" text="Only the accountant can change the plan." /> : null}

      {mode === 'plots' ? (
        <View>
          {metrics ? <Card><Text style={{ color: c.foreground }}>Net sellable area: <Text style={{ fontFamily: 'Inter_700Bold' }}>{metrics.netSellableSqYards.toLocaleString('en-IN')} Sq.Yds</Text> · planned {plotArea.toLocaleString('en-IN')} Sq.Yds in {totalPlots} plots</Text>{plotArea > metrics.netSellableSqYards ? <Text style={{ color: c.destructive, fontSize: 12 }}>Planned area exceeds net sellable area.</Text> : <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Remaining {(metrics.netSellableSqYards - plotArea).toLocaleString('en-IN')} Sq.Yds</Text>}</Card> : <Banner tone="warn" title="No extent entered" text="Enter the extent in the project details or the Layout calculator to compare against sellable area." />}
          <Field label="Starting plot number" value={startNo} onChangeText={setStartNo} keyboardType="numeric" editable={editable} />
          <ListEditor title="Plot distribution by sector" editable={editable} addLabel="Add sector" rows={dist} onChange={setDist} cols={[{ key: 'label', label: 'Sector / block name' }, { key: 'facing', label: 'Facing', ...sel(FACINGS) }, { key: 'count', label: 'Plots count', kind: 'num' }, { key: 'area', label: 'Area / Plot (Sq.Yds)', kind: 'num' }]} />
        </View>
      ) : null}

      {mode === 'units' ? (
        <View>
          <Field label="Floors count" value={floors} onChangeText={setFloors} keyboardType="numeric" editable={editable} />
          <ListEditor title="Flat types repeated on every floor" editable={editable} addLabel="Add flat" rows={flats} onChange={setFlats} cols={[{ key: 'flatType', label: 'Flat type', ...sel(FLATS) }, { key: 'sftArea', label: 'Super built-up area (Sft)', kind: 'num' }, { key: 'facing', label: 'Facing', ...sel(UFACINGS) }]} />
          <Card><Text style={{ color: c.foreground }}>Total residential units: <Text style={{ fontFamily: 'Inter_700Bold' }}>{Math.floor(nv(floors)) * flats.length}</Text> · Grand total BUA: <Text style={{ fontFamily: 'Inter_700Bold' }}>{bua.toLocaleString('en-IN')} Sft</Text></Text></Card>
          <ListEditor title="Project amenities" editable={editable} addLabel="Add amenity" rows={amen} onChange={setAmen} cols={[{ key: 'name', label: 'Amenity' }, { key: 'description', label: 'Description' }]} />
        </View>
      ) : null}

      {mode === 'liquor' ? (
        <View>
          <Card><Text style={{ color: c.foreground }}>Total daily sales target: <Text style={{ fontFamily: 'Inter_700Bold' }}>{formatINR(target)}</Text> across {counters.length} counters</Text></Card>
          <ListEditor title="Licensed retail shop counters" editable={editable} addLabel="Add retail shop counter" rows={counters} onChange={setCounters} cols={[{ key: 'name', label: 'Counter name' }, { key: 'category', label: 'Outlet type', ...sel(OUTLETS) }, { key: 'sqFtArea', label: 'Floor Sq.Ft', kind: 'num' }, { key: 'dailySalesTarget', label: 'Daily target (Rs)', kind: 'num' }, { key: 'staffCount', label: 'Staff count', kind: 'num' }]} />
          <ListEditor title="Cold storage and cash vault facilities" editable={editable} addLabel="Add facility" rows={facs} onChange={setFacs} cols={[{ key: 'name', label: 'Facility' }, { key: 'sqFtArea', label: 'Sq.Ft', kind: 'num' }, { key: 'description', label: 'Description' }]} />
        </View>
      ) : null}

      {mode === 'infra' ? (
        <View>
          <ListEditor title="Work packages" editable={editable} addLabel="Add package" rows={pkgs} onChange={setPkgs} cols={[{ key: 'name', label: 'Package name' }, { key: 'chainage', label: 'Chainage / Stretch' }, { key: 'scopeCategory', label: 'Scope category' }, { key: 'targetCompletionMonths', label: 'Timeline (months)', kind: 'num' }]} />
          <ListEditor title="Site facilities" editable={editable} addLabel="Add facility" rows={facs} onChange={setFacs} cols={[{ key: 'name', label: 'Facility' }, { key: 'areaString', label: 'Area' }, { key: 'purpose', label: 'Purpose' }]} />
        </View>
      ) : null}

      {msg ? <Banner tone={msg.ok ? 'ok' : 'error'} title={msg.t} /> : null}
      {editable ? <Btn label="Save plan" loading={busy} onPress={save} /> : null}
      {editable && (mode === 'plots' || mode === 'units') ? (
        <View style={{ marginTop: 10 }}>
          <Btn label={mode === 'plots' ? 'Generate plots from plan' : 'Generate units from plan'} variant="ghost" icon="layers" onPress={prepare} />
          {genErr ? <Banner tone="error" title={genErr} /> : null}
          {gen ? <Banner tone="warn" title={`This will create ${gen.rows} record(s) in ${gen.chunks} request(s)`} text="Limits are 2000 rows and 2 MB per request. Each request is transactional; larger plans are split into several requests." /> : null}
          {gen ? <Btn label={`Confirm and create ${gen.rows}`} loading={busy} onPress={generate} /> : null}
        </View>
      ) : null}
    </View>
  );
}
