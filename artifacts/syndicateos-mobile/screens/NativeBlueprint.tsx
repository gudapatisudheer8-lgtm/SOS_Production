import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, Switch, Text, View } from 'react-native';
import Svg, { Circle, G, Line as SLine, Polygon, Polyline, Text as SText } from 'react-native-svg';
import type { ProjectErp } from '@workspace/api-client-react';
import { Badge, Banner, Btn, Card, Chips, Field, Skeleton } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { nativeApi } from '@/lib/native-api';
import { attachmentsSupported, fetchAttachmentBlob, pickFile, saveBlob, uploadAttachment, validateFile } from '@/lib/attachments';
import { newRequestId } from '@/lib/erp';
import { errMessage } from '@/lib/session';
import { useRun } from '@/lib/workspace';

/* ---- geometry contract: copied from web blueprintGeometry.ts ---- */
type Facing = 'E' | 'N' | 'W' | 'S' | 'NE' | 'NW' | 'SE' | 'SW' | 'UNKNOWN';
const FACINGS: Facing[] = ['E', 'N', 'W', 'S', 'NE', 'NW', 'SE', 'SW', 'UNKNOWN'];
const FACING_LABEL: Record<Facing, string> = { E: 'East', N: 'North', W: 'West', S: 'South', NE: 'North-East', NW: 'North-West', SE: 'South-East', SW: 'South-West', UNKNOWN: 'Unknown' };
type Pt = { x: number; y: number };
type BPlot = { number: string; facing: Facing; points: Pt[]; referenceOnly?: boolean; confidence?: number };
type BRoad = { name: string; widthFeet: number | null; points: Pt[]; confidence?: number };
type Geometry = { plots: BPlot[]; roads: BRoad[]; northDegrees: number | null; notes: string; aspectRatio?: number | null };
type BState = { revision: number; status: 'EMPTY' | 'DRAFT' | 'CONFIRMED'; sourceAttachmentId: string | null; confirmedAttachmentId?: string | null; draft: Geometry | null; confirmed: Geometry | null; attachments: { id: string; fileName: string; contentType: string }[]; canManage: boolean };
type Camera = { yaw: number; pitch: number; zoom: number; panX: number; panY: number };
const SUPPORTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const DEFAULT_CAMERA: Camera = { yaw: -30, pitch: 55, zoom: 1, panX: 0, panY: 0 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const emptyGeometry = (): Geometry => ({ plots: [], roads: [], northDegrees: null, notes: '', aspectRatio: null });
const clone = (g: Geometry): Geometry => ({ plots: g.plots.map((p) => ({ ...p, points: p.points.map((q) => ({ ...q })) })), roads: g.roads.map((r) => ({ ...r, points: r.points.map((q) => ({ ...q })) })), northDegrees: g.northDegrees, notes: g.notes ?? '', aspectRatio: g.aspectRatio ?? null });
const centroid = (pts: Pt[]) => (pts.length ? { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length } : { x: 0, y: 0 });
const norm = (s: string) => String(s || '').trim().toUpperCase().replace(/^PLOT\s*/i, '').replace(/\s+/g, '');
const unmatchedOf = (g: Geometry, inv: string[]) => { const s = new Set(inv.map(norm)); return new Set(g.plots.filter((p) => !s.has(norm(p.number))).map((p) => p.number)); };
function validate(g: Geometry, inv: string[], confirm: boolean): string[] {
  const e: string[] = [];
  const ok = (p: Pt) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100;
  const seen = new Set<string>();
  g.plots.forEach((p, i) => {
    const l = p.number.trim() || `#${i + 1}`;
    if (!p.number.trim()) e.push(`Plot polygon ${i + 1} needs a plot number.`);
    if (p.points.length < 3) e.push(`Plot ${l} needs at least 3 vertices.`);
    if (!p.points.every(ok)) e.push(`Plot ${l} has a vertex outside 0 to 100.`);
    const k = norm(p.number); if (k && seen.has(k)) e.push(`Plot number ${l} is used more than once.`); seen.add(k);
  });
  g.roads.forEach((r, i) => {
    const l = r.name.trim() || `#${i + 1}`;
    if (r.points.length < 2) e.push(`Road ${l} needs at least 2 points.`);
    if (!r.points.every(ok)) e.push(`Road ${l} has a point outside 0 to 100.`);
    if (r.widthFeet !== null && !(r.widthFeet > 0)) e.push(`Road ${l}: width must be positive or left unknown.`);
  });
  if (g.northDegrees !== null && !(g.northDegrees >= 0 && g.northDegrees < 360)) e.push('North angle must be between 0 and 359 degrees, or unknown.');
  const ar = g.aspectRatio; if (ar != null && !(Number.isFinite(ar) && ar > 0.05 && ar <= 20)) e.push('Source page aspect ratio must be greater than 0.05 and at most 20, or unknown.');
  if (confirm) {
    if (!g.plots.length) e.push('At least one plot polygon is required to confirm.');
    const u = unmatchedOf(g, inv);
    g.plots.forEach((p) => { if (u.has(p.number) && !p.referenceOnly) e.push(`Plot ${p.number || '(blank)'} is not in current inventory. Mark it reference-only or correct the number.`); });
  }
  return e;
}
function project(x: number, y: number, h: number, cam: Camera, base: number) {
  const X = x - 50, Z = y - 50, Y = h;
  const yaw = (cam.yaw * Math.PI) / 180, pitch = (cam.pitch * Math.PI) / 180;
  const x1 = X * Math.cos(yaw) - Z * Math.sin(yaw);
  const z1 = X * Math.sin(yaw) + Z * Math.cos(yaw);
  const sy = z1 * Math.sin(pitch) - Y * Math.cos(pitch);
  const depth = z1 * Math.cos(pitch) + Y * Math.sin(pitch);
  const s = base * cam.zoom;
  return { sx: x1 * s + cam.panX, sy: sy * s + cam.panY, depth };
}
function proportioned(g: Geometry): Geometry {
  const ar = g.aspectRatio && g.aspectRatio > 0 ? g.aspectRatio : 1;
  const fy = (y: number) => 50 + (y - 50) / ar;
  return { ...g, plots: g.plots.map((p) => ({ ...p, points: p.points.map((q) => ({ x: q.x, y: fy(q.y) })) })), roads: g.roads.map((r) => ({ ...r, points: r.points.map((q) => ({ x: q.x, y: fy(q.y) })) })) };
}
function fitCamera(g: Geometry, cam: Camera, base: number, w: number, h: number): Camera {
  const pts = [...g.plots.flatMap((p) => p.points), ...g.roads.flatMap((r) => r.points)];
  if (!pts.length) return { ...cam, zoom: 1, panX: 0, panY: 0 };
  const pr = pts.map((p) => project(p.x, p.y, 0, { ...cam, zoom: 1, panX: 0, panY: 0 }, base));
  const minX = Math.min(...pr.map((p) => p.sx)), maxX = Math.max(...pr.map((p) => p.sx));
  const minY = Math.min(...pr.map((p) => p.sy)), maxY = Math.max(...pr.map((p) => p.sy));
  const zoom = clamp(Math.min((w * 0.86) / Math.max(1, maxX - minX), (h * 0.8) / Math.max(1, maxY - minY)), 0.2, 8);
  return { ...cam, zoom, panX: -((minX + maxX) / 2) * zoom, panY: -((minY + maxY) / 2) * zoom };
}

const api = {
  get: (p: string) => nativeApi<BState>(`/api/erp/${p}/blueprint`),
  analyze: (p: string, attachmentId: string, revision: number) => nativeApi<BState>(`/api/erp/${p}/blueprint/analyze`, { method: 'POST', body: { attachmentId, revision } }),
  save: (p: string, body: Record<string, unknown>) => nativeApi<BState>(`/api/erp/${p}/blueprint/save`, { method: 'POST', body }),
};

/* ---- original plan preview ---- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(u: Uint8Array): string {
  let out = '';
  for (let i = 0; i < u.length; i += 3) {
    const a = u[i], b = u[i + 1], c = u[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)] + (b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? '=' : B64[c & 63]);
  }
  return out;
}
function Original({ projectId, att }: { projectId: string; att: BState['attachments'][number] }) {
  const c = useColors();
  const [uri, setUri] = useState<string | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true; let made: string | null = null;
    setUri(null); setErr('');
    if (att.contentType === 'application/pdf') return;
    fetchAttachmentBlob(projectId, att.id).then(async (b) => {
      if (!alive) return;
      if (Platform.OS === 'web') { made = URL.createObjectURL(b); setUri(made); return; }
      const ab = (b as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer;
      if (typeof ab !== 'function') { setErr('This device cannot preview the plan inline. Use Download original.'); return; }
      const buf = await ab.call(b);
      if (alive) setUri(`data:${att.contentType};base64,${toBase64(new Uint8Array(buf))}`);
    }).catch((e) => alive && setErr(errMessage(e)));
    return () => { alive = false; if (made && Platform.OS === 'web') URL.revokeObjectURL(made); };
  }, [projectId, att.id, att.contentType]);
  const download = async () => { try { saveBlob(await fetchAttachmentBlob(projectId, att.id), att.fileName); } catch (e) { setErr(errMessage(e)); } };
  return (
    <Card>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>{att.fileName}</Text>
      {err ? <Banner tone="error" title={err} /> : null}
      {att.contentType === 'application/pdf' ? <Text style={{ color: c.mutedForeground, marginBottom: 8 }}>PDF plans open with the device viewer.</Text> : uri ? <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 360, backgroundColor: '#FBF8F1', borderRadius: 12 }} accessibilityLabel={`Original plan ${att.fileName}`} /> : <Skeleton lines={3} />}
      <Btn label="Download original" icon="download" variant="ghost" onPress={() => void download()} />
    </Card>
  );
}

/* ---- draft editor: tap the canvas to add vertices, or type them ---- */
function DraftEditor({ g, onChange, unmatched, disabled }: { g: Geometry; onChange: (g: Geometry) => void; unmatched: Set<string>; disabled: boolean }) {
  const c = useColors();
  const [sel, setSel] = useState<{ kind: 'plot' | 'road'; i: number } | null>(g.plots.length ? { kind: 'plot', i: 0 } : null);
  const [w, setW] = useState(300);
  const ar = g.aspectRatio && g.aspectRatio > 0 ? g.aspectRatio : 1;
  const h = w / ar;
  const set = (fn: (d: Geometry) => void) => { const d = clone(g); fn(d); onChange(d); };
  const shape = sel ? (sel.kind === 'plot' ? g.plots[sel.i] : g.roads[sel.i]) : undefined;
  const addPoint = (x: number, y: number) => { if (!sel || disabled) return; set((d) => { (sel.kind === 'plot' ? d.plots[sel.i] : d.roads[sel.i]).points.push({ x: round2(clamp(x, 0, 100)), y: round2(clamp(y, 0, 100)) }); }); };
  return (
    <Card>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>Geometry editor</Text>
      <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>Coordinates are 0 to 100 of the source page, not survey values. Select a plot or road, then tap the canvas to add a vertex.</Text>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
        <Pressable onPress={(e) => addPoint((e.nativeEvent.locationX / w) * 100, (e.nativeEvent.locationY / h) * 100)} accessibilityLabel="Geometry canvas, tap to add a vertex to the selected shape">
          <Svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ backgroundColor: '#FBF8F1', borderRadius: 12 }}>
            {g.roads.map((r, i) => <Polyline key={`r${i}`} points={r.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={sel?.kind === 'road' && sel.i === i ? '#d97706' : '#78716c'} strokeWidth={1.4} />)}
            {g.plots.map((p, i) => {
              const on = sel?.kind === 'plot' && sel.i === i; const cc = centroid(p.points);
              return (
                <G key={`p${i}`}>
                  <Polygon points={p.points.map((q) => `${q.x},${q.y}`).join(' ')} fill={unmatched.has(p.number) ? 'rgba(244,63,94,0.18)' : 'rgba(16,185,129,0.18)'} stroke={on ? '#d97706' : '#57534e'} strokeWidth={on ? 0.8 : 0.4} />
                  {p.points.length ? <SText x={cc.x} y={cc.y} fontSize={2.6} fill="#1c1917" textAnchor="middle">{p.number}</SText> : null}
                </G>
              );
            })}
            {shape?.points.map((p, i) => <Circle key={`v${i}`} cx={p.x} cy={p.y} r={0.9} fill="#d97706" />)}
          </Svg>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Btn label="Add plot" icon="plus" variant="ghost" disabled={disabled} onPress={() => { set((d) => { d.plots.push({ number: '', facing: 'UNKNOWN', points: [] }); }); setSel({ kind: 'plot', i: g.plots.length }); }} />
        <Btn label="Add road" icon="plus" variant="ghost" disabled={disabled} onPress={() => { set((d) => { d.roads.push({ name: '', widthFeet: null, points: [] }); }); setSel({ kind: 'road', i: g.roads.length }); }} />
      </View>
      <Chips label="Shapes" options={[...g.plots.map((p, i) => ({ value: `plot:${i}`, label: `Plot ${p.number || i + 1}${unmatched.has(p.number) ? ' (not in inventory)' : ''}` })), ...g.roads.map((r, i) => ({ value: `road:${i}`, label: `Road ${r.name || i + 1}` }))]} value={sel ? `${sel.kind}:${sel.i}` : ''} onChange={(v) => { const [k, n] = v.split(':'); setSel({ kind: k as 'plot' | 'road', i: Number(n) }); }} />
      {sel && shape ? (
        <View style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 8 }}>
          {sel.kind === 'plot' ? (() => { const p = g.plots[sel.i]; return (
            <>
              <Field label="Plot number" value={p.number} onChangeText={(v) => set((d) => { d.plots[sel.i].number = v; })} editable={!disabled} />
              <Chips label="Facing" options={FACINGS.map((f) => ({ value: f, label: FACING_LABEL[f] }))} value={p.facing} onChange={(v) => set((d) => { d.plots[sel.i].facing = v as Facing; })} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}><Switch value={!!p.referenceOnly} onValueChange={(v) => set((d) => { d.plots[sel.i].referenceOnly = v; })} accessibilityLabel="Reference only" /><Text style={{ color: c.foreground, flex: 1 }}>Reference-only (not linked to inventory)</Text></View>
            </>
          ); })() : (() => { const r = g.roads[sel.i]; return (
            <>
              <Field label="Road name" value={r.name} onChangeText={(v) => set((d) => { d.roads[sel.i].name = v; })} editable={!disabled} />
              <Field label="Width (feet, blank = unknown)" value={r.widthFeet == null ? '' : String(r.widthFeet)} onChangeText={(v) => set((d) => { d.roads[sel.i].widthFeet = v.trim() === '' ? null : Number(v); })} keyboardType="numeric" />
            </>
          ); })()}
          {shape.points.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}><Field label={`V${i + 1} x`} value={String(p.x)} onChangeText={(v) => set((d) => { (sel.kind === 'plot' ? d.plots[sel.i] : d.roads[sel.i]).points[i].x = Number(v); })} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Field label="y" value={String(p.y)} onChangeText={(v) => set((d) => { (sel.kind === 'plot' ? d.plots[sel.i] : d.roads[sel.i]).points[i].y = Number(v); })} keyboardType="numeric" /></View>
              <Btn label="Remove" variant="ghost" onPress={() => set((d) => { (sel.kind === 'plot' ? d.plots[sel.i] : d.roads[sel.i]).points.splice(i, 1); })} />
            </View>
          ))}
          <Btn label={sel.kind === 'plot' ? 'Delete plot' : 'Delete road'} icon="trash-2" variant="ghost" disabled={disabled} onPress={() => { set((d) => { if (sel.kind === 'plot') d.plots.splice(sel.i, 1); else d.roads.splice(sel.i, 1); }); setSel(null); }} />
        </View>
      ) : null}
      <Field label="North angle (degrees, blank = unknown)" value={g.northDegrees == null ? '' : String(g.northDegrees)} onChangeText={(v) => set((d) => { d.northDegrees = v.trim() === '' ? null : Number(v); })} keyboardType="numeric" />
      <Field label="Source page aspect (width / height, blank = unknown)" value={g.aspectRatio == null ? '' : String(g.aspectRatio)} onChangeText={(v) => set((d) => { d.aspectRatio = v.trim() === '' ? null : Number(v); })} keyboardType="numeric" />
      <Field label="Notes" value={g.notes} onChangeText={(v) => set((d) => { d.notes = v; })} multiline />
    </Card>
  );
}

/* ---- illustrative 3D (orthographic projection, same math as web Blueprint3DView) ---- */
const STATUS_FILL: Record<string, [string, string]> = { available: ['#6EE7B7', '#059669'], reserved: ['#FCD34D', '#B45309'], blocked: ['#D6D3D1', '#78716C'], sold: ['#94A3B8', '#334155'], reference: ['#F5F5F4', '#A8A29E'] };
const W = 800, H = 520, BASE = 6, SLAB = 0.8;
function View3D({ geometry, statusOf }: { geometry: Geometry; statusOf: (n: string) => string | null }) {
  const c = useColors();
  const g = useMemo(() => proportioned(geometry), [geometry]);
  const [cam, setCam] = useState<Camera>(() => fitCamera(g, DEFAULT_CAMERA, BASE, W, H));
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<number | null>(null);
  const faces = useMemo(() => {
    const out: { key: string; pts: string; fill: string; stroke: string; depth: number; label?: { x: number; y: number; t: string } }[] = [];
    g.plots.forEach((p, i) => {
      const st = p.referenceOnly ? 'reference' : (statusOf(p.number) ?? 'reference');
      const k = st === 'booked' ? 'reserved' : st;
      const [fill, stroke] = STATUS_FILL[k] ?? STATUS_FILL.reference;
      const top = p.points.map((q) => project(q.x, q.y, SLAB, cam, BASE));
      p.points.forEach((q, j) => {
        const n = p.points[(j + 1) % p.points.length];
        const a = project(q.x, q.y, 0, cam, BASE), b = project(n.x, n.y, 0, cam, BASE), bt = project(n.x, n.y, SLAB, cam, BASE), at = top[j];
        out.push({ key: `s${i}-${j}`, pts: [a, b, bt, at].map((v) => `${v.sx},${v.sy}`).join(' '), fill: stroke, stroke, depth: (a.depth + b.depth) / 2 - 0.01 });
      });
      const cc = centroid(p.points); const lp = project(cc.x, cc.y, SLAB, cam, BASE);
      out.push({ key: `t${i}`, pts: top.map((v) => `${v.sx},${v.sy}`).join(' '), fill, stroke, depth: top.reduce((n, v) => n + v.depth, 0) / Math.max(1, top.length), label: { x: lp.sx, y: lp.sy, t: p.number } });
    });
    return out.sort((a, b) => a.depth - b.depth);
  }, [g, cam, statusOf]);
  const nudge = (d: Partial<Camera>) => setCam((k) => ({ ...k, yaw: k.yaw + (d.yaw ?? 0), pitch: clamp(k.pitch + (d.pitch ?? 0), 15, 89), zoom: clamp(k.zoom * (d.zoom ?? 1), 0.2, 8), panX: k.panX + (d.panX ?? 0), panY: k.panY + (d.panY ?? 0) }));
  const north = geometry.northDegrees;
  return (
    <Card>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => { drag.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }; pinch.current = null; }}
        onResponderMove={(e) => {
          const t = e.nativeEvent.touches;
          if (t && t.length >= 2) {
            // Two-finger pinch zoom.
            const dist = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
            if (pinch.current) { const f = dist / pinch.current; setCam((k) => ({ ...k, zoom: clamp(k.zoom * f, 0.2, 8), panX: k.panX * f, panY: k.panY * f })); }
            pinch.current = dist; drag.current = null; return;
          }
          pinch.current = null;
          const d = drag.current; const x = e.nativeEvent.pageX, y = e.nativeEvent.pageY;
          drag.current = { x, y };
          if (!d) return;
          setCam((k) => ({ ...k, panX: k.panX + (x - d.x) * 1.6, panY: k.panY + (y - d.y) * 1.6 }));
        }}
        onResponderRelease={() => { drag.current = null; pinch.current = null; }}
        style={{ width: '100%', aspectRatio: W / H, backgroundColor: '#F5F1E8', borderRadius: 14, overflow: 'hidden' }}
        accessibilityLabel="Confirmed blueprint scene. Drag to pan, pinch to zoom; use the buttons to rotate, tilt and zoom.">
        <Svg width="100%" height="100%" viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`}>
          {g.roads.map((r, i) => { const pts = r.points.map((q) => project(q.x, q.y, 0, cam, BASE)); return <Polyline key={`r${i}`} points={pts.map((v) => `${v.sx},${v.sy}`).join(' ')} fill="none" stroke="#a8a29e" strokeWidth={Math.max(2, (r.widthFeet ?? 20) / 6) * cam.zoom} strokeLinecap="round" />; })}
          {faces.map((f) => (
            <G key={f.key}>
              <Polygon points={f.pts} fill={f.fill} stroke={f.stroke} strokeWidth={1} />
              {f.label ? <SText x={f.label.x} y={f.label.y + 4} fontSize={11 * Math.min(1.6, Math.max(0.7, cam.zoom))} fontWeight="bold" fill="#1c1917" textAnchor="middle">{f.label.t}</SText> : null}
            </G>
          ))}
          {north != null ? (
            <G transform={`translate(${W / 2 - 46} ${-H / 2 + 46}) rotate(${north - cam.yaw})`}>
              <Circle r={26} fill="#ffffff" stroke="#d6d3d1" />
              <SLine x1={0} y1={14} x2={0} y2={-18} stroke="#b45309" strokeWidth={3} />
              <SText x={0} y={-6} fontSize={11} fontWeight="bold" fill="#1c1917" textAnchor="middle" transform="translate(0 22)">N</SText>
            </G>
          ) : null}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <Btn label="Rotate left" variant="ghost" onPress={() => nudge({ yaw: -15 })} />
        <Btn label="Rotate right" variant="ghost" onPress={() => nudge({ yaw: 15 })} />
        <Btn label="Tilt up" variant="ghost" onPress={() => nudge({ pitch: 8 })} />
        <Btn label="Tilt down" variant="ghost" onPress={() => nudge({ pitch: -8 })} />
        <Btn label="Zoom in" variant="ghost" onPress={() => nudge({ zoom: 1.2 })} />
        <Btn label="Zoom out" variant="ghost" onPress={() => nudge({ zoom: 1 / 1.2 })} />
        <Btn label="Reset view" variant="ghost" onPress={() => setCam(fitCamera(g, DEFAULT_CAMERA, BASE, W, H))} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
        {Object.entries(STATUS_FILL).map(([k, [f, s]]) => <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: f, borderWidth: 1, borderColor: s }} /><Text style={{ color: c.mutedForeground, fontSize: 11, textTransform: 'capitalize' }}>{k}</Text></View>)}
      </View>
      <Text style={{ color: c.mutedForeground, fontSize: 11, marginTop: 6 }}>Illustrative view of confirmed geometry. Uniform slab height; not a survey or elevation model.{north == null ? ' North is unknown.' : ''}</Text>
    </Card>
  );
}

/* ---- workspace ---- */
type Tab = 'original' | 'review' | 'view3d';
export function NativeBlueprint({ projectId, erp }: { projectId: string; erp: ProjectErp }) {
  const c = useColors();
  const run = useRun();
  const [state, setState] = useState<BState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('original');
  const [selectedId, setSelectedId] = useState('');
  const [edit, setEdit] = useState<Geometry | null>(null);
  const [editRevision, setEditRevision] = useState<number | null>(null);
  const [editSourceId, setEditSourceId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState<'' | 'analyze' | 'save' | 'confirm' | 'upload'>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const dirtyRef = useRef(false); dirtyRef.current = dirty;
  const busyRef = useRef(false);
  const plots = useMemo(() => erp.records.filter((r) => r.kind === 'plots' && r.status !== 'deleted'), [erp.records]);
  const inventory = useMemo(() => plots.map((p) => String(p.data.plotNumber ?? '')), [plots]);
  const statusOf = useCallback((n: string) => { const hit = plots.find((p) => norm(String(p.data.plotNumber ?? '')) === norm(n)); return hit ? String(hit.data.status ?? 'available') : null; }, [plots]);

  const apply = useCallback((s: BState, force: boolean) => {
    setState(s);
    setSelectedId((cur) => (force && s.sourceAttachmentId ? s.sourceAttachmentId : cur && s.attachments.some((a) => a.id === cur) ? cur : s.sourceAttachmentId || s.confirmedAttachmentId || s.attachments[0]?.id || ''));
    if (force || !dirtyRef.current) {
      const seed = s.draft ?? s.confirmed;
      setEdit(seed ? clone(seed) : null); setEditRevision(s.revision);
      setEditSourceId(s.draft ? s.sourceAttachmentId || '' : s.confirmedAttachmentId || '');
      setDirty(false); setAck(false);
    }
  }, []);
  const load = useCallback(async (force: boolean) => {
    setLoading(true); setLoadError('');
    try { apply(await api.get(projectId), force); } catch (e) { setLoadError(errMessage(e)); } finally { setLoading(false); }
  }, [projectId, apply]);
  useEffect(() => { void load(true); }, [load]);

  const act = async (k: Exclude<typeof busy, ''>, fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(k); setErrors([]); setNotice('');
    try { await fn(); } catch (e) { setErrors([errMessage(e)]); } finally { busyRef.current = false; setBusy(''); }
  };
  const upload = () => act('upload', async () => {
    const f = await pickFile(SUPPORTED.join(','));
    if (!f) return;
    if (!SUPPORTED.includes(f.type)) throw new Error('Select a PDF, PNG, JPEG or WebP plan.');
    const bad = validateFile({ type: f.type, size: f.size }); if (bad) throw new Error(bad);
    const att = await uploadAttachment(projectId, f, f.name);
    // Same as the web uploader: file the plan as a project document when permitted.
    const docs = erp.resources.find((r) => r.kind === 'documents' && r.canCreate);
    if (docs) await run('erp.save', { projectId, kind: 'documents', requestId: newRequestId(), data: Object.fromEntries(Object.entries({ title: f.name.replace(/\.[^/.]+$/, ''), category: 'master_layout', attachmentId: att.id }).filter(([k]) => docs.fields.some((x) => x.key === k))) });
    setNotice(`${f.name} uploaded privately.`);
    const s = await api.get(projectId); apply(s, false); setSelectedId(att.id);
  });
  const analyze = () => { if (state && selectedId) void act('analyze', async () => { apply(await api.analyze(projectId, selectedId, state.revision), true); setTab('review'); setNotice('AI draft ready. Review every plot, road and vertex before confirming. The confirmed view is unchanged until you confirm.'); }); };
  const save = (confirm: boolean) => {
    if (!state || !edit || editRevision === null) return;
    if (editSourceId && editSourceId !== selectedId) { setErrors(["Choose this draft's original document, analyze the selected file, or start manual tracing for the new source."]); return; }
    const attachmentId = editSourceId || selectedId;
    const e = validate(edit, inventory, confirm);
    if (confirm && !ack) e.push('Tick the review acknowledgement before confirming.');
    if (!attachmentId) e.push('Select the source plan document.');
    if (e.length) { setErrors(e); return; }
    void act(confirm ? 'confirm' : 'save', async () => {
      apply(await api.save(projectId, { attachmentId, revision: editRevision, geometry: edit, confirm, reviewAcknowledged: confirm ? ack : false }), true);
      setNotice(confirm ? 'Geometry confirmed. The 3D view now reflects this revision.' : 'Draft saved. Not confirmed yet.');
      if (confirm) setTab('view3d');
    });
  };
  const startManual = () => { if (!state) return; setEdit(emptyGeometry()); setEditSourceId(selectedId); setEditRevision(state.revision); setDirty(true); setAck(false); setTab('review'); };

  if (loading && !state) return <Skeleton lines={5} />;
  if (loadError && !state) return <Banner tone="error" title="Could not load the blueprint workspace." text={loadError} action={{ label: 'Retry', onPress: () => void load(true) }} />;
  if (!state) return null;
  const selected = state.attachments.find((a) => a.id === selectedId);
  const canManage = state.canManage;
  const stale = dirty && editRevision !== null && state.revision !== editRevision;
  const unmatched = edit ? unmatchedOf(edit, inventory) : new Set<string>();
  const tabs: { k: Tab; l: string }[] = [{ k: 'original', l: 'Original plan' }, ...(canManage ? [{ k: 'review' as Tab, l: state.draft ? 'Review draft' : 'Edit geometry' }] : []), { k: 'view3d', l: '3D view (confirmed)' }];

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: 8 }}>Layout blueprint</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
        {tabs.map((t) => (
          <Pressable key={t.k} onPress={() => setTab(t.k)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.k }} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: tab === t.k ? '#1c1917' : '#f5f5f4' }}>
            <Text style={{ color: tab === t.k ? '#ffffff' : '#44403c', fontFamily: 'Inter_700Bold', fontSize: 12 }}>{t.l}</Text>
          </Pressable>
        ))}
        <Badge text={`${state.status === 'CONFIRMED' ? 'Confirmed' : state.status === 'DRAFT' ? 'Draft awaiting review' : 'No geometry'} · rev ${state.revision}`} tone={state.status === 'CONFIRMED' ? 'ok' : state.status === 'DRAFT' ? 'warn' : 'muted'} />
      </View>
      {state.attachments.length ? <Chips label="Source plan document" options={state.attachments.map((a) => ({ value: a.id, label: a.fileName }))} value={selectedId} onChange={setSelectedId} /> : null}
      {canManage ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {attachmentsSupported ? <Btn label={busy === 'upload' ? 'Uploading…' : 'Upload plan'} icon="upload" variant="ghost" disabled={!!busy} onPress={() => void upload()} /> : null}
          <Btn label={busy === 'analyze' ? 'Analyzing…' : 'AI draft (uses billed Replit credits)'} icon="zap" disabled={!!busy || !selected} onPress={analyze} />
        </View>
      ) : null}
      {notice ? <Banner tone="ok" title={notice} /> : null}
      {canManage ? <Text style={{ color: c.mutedForeground, fontSize: 12, marginBottom: 8 }}>AI sends only the selected file to the configured provider. Use venture plans, not personal or financial documents. Review the result before confirming; the original stays unchanged.</Text> : null}
      {canManage && selectedId && edit && editSourceId !== selectedId ? <Banner tone="warn" title="This draft belongs to a different original." text="Analyze the selected plan or start a new manual draft." action={{ label: 'Start manual draft for this source', onPress: startManual }} /> : null}
      {errors.length ? <Banner tone="error" title={errors[0]} text={errors.slice(1).join('\n') || undefined} /> : null}

      {tab === 'original' ? (selected ? <Original key={selected.id} projectId={projectId} att={selected} /> : (
        <Card><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', textAlign: 'center' }}>No plan document uploaded yet</Text><Text style={{ color: c.mutedForeground, fontSize: 12, textAlign: 'center' }}>{canManage ? 'Upload the approved layout as PDF, PNG, JPEG or WebP. It is stored privately.' : 'Ask a project manager to upload the approved layout.'}</Text></Card>
      )) : null}

      {tab === 'review' && canManage ? (
        <View>
          {stale ? <Banner tone="warn" title={`A newer revision (${state.revision}) exists.`} text={`Your unsaved edits are based on revision ${editRevision}; saving will be rejected.`} action={{ label: 'Discard edits and load newer', onPress: () => apply(state, true) }} /> : null}
          {state.status === 'DRAFT' && state.confirmed ? <Text style={{ color: c.mutedForeground, fontSize: 11, marginBottom: 6 }}>The previously confirmed geometry stays in the 3D view until this draft is confirmed.</Text> : null}
          {!edit ? (
            <Card>
              <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', textAlign: 'center' }}>No draft geometry yet</Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12, textAlign: 'center', marginBottom: 8 }}>Run the AI draft on the selected plan, or trace plots and roads manually. Nothing is guessed: unknown widths, facings and north stay unknown.</Text>
              <Btn label="Start manual tracing" variant="ghost" onPress={startManual} />
            </Card>
          ) : (
            <>
              <DraftEditor g={edit} onChange={(g) => { setEdit(g); setDirty(true); }} unmatched={unmatched} disabled={!!busy} />
              <Card>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <Switch value={ack} onValueChange={setAck} accessibilityLabel="Review acknowledgement" />
                  <Text style={{ color: c.foreground, fontSize: 12, flex: 1 }}>I reviewed every plot number, facing, road label and width, north angle and vertex against the original plan. Unmatched plots are marked reference-only; no inventory, bookings or cash are changed.</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Btn label={busy === 'save' ? 'Saving…' : 'Save draft'} icon="save" variant="ghost" disabled={!!busy} onPress={() => save(false)} />
                  <Btn label={busy === 'confirm' ? 'Confirming…' : 'Confirm geometry'} icon="shield" disabled={!!busy || !ack} onPress={() => save(true)} />
                </View>
              </Card>
            </>
          )}
        </View>
      ) : null}

      {tab === 'view3d' ? (state.confirmed && state.confirmed.plots.length ? <View3D key={`3d-${state.revision}`} geometry={state.confirmed} statusOf={statusOf} /> : (
        <Card><Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold', textAlign: 'center' }}>No confirmed geometry yet</Text><Text style={{ color: c.mutedForeground, fontSize: 12, textAlign: 'center' }}>The 3D view only shows geometry a reviewer has confirmed against the original plan. No default layout is generated.</Text></Card>
      )) : null}
    </View>
  );
}
