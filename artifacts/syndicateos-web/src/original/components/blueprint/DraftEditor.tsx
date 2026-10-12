import React, { useRef, useState } from 'react';
import { Plus, Trash2, PenLine, Check, X } from 'lucide-react';
import {
  FACINGS, FACING_LABEL, centroid, clamp, round2,
  type Geometry, type Facing, type Pt,
} from './blueprintGeometry';

type Sel = { kind: 'plot' | 'road'; index: number } | null;
type DrawMode = { kind: 'plot' | 'road'; points: Pt[] } | null;

interface Props {
  geometry: Geometry;
  onChange: (g: Geometry) => void;
  unmatched: Set<string>;
  aspect: number;
  disabled?: boolean;
}

const input = 'w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60';

/** Normalized 2D polygon editor: select, drag or type vertices, draw/remove polygons, edit labels. */
export const DraftEditor: React.FC<Props> = ({ geometry: g, onChange, unmatched, aspect, disabled }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [draw, setDraw] = useState<DrawMode>(null);
  const dragRef = useRef<{ kind: 'plot' | 'road'; index: number; vi: number } | null>(null);

  const toNorm = (e: React.PointerEvent | React.MouseEvent): Pt | null => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    return { x: round2(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)), y: round2(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100)) };
  };

  const update = (fn: (draft: Geometry) => void) => {
    const next: Geometry = { ...g, plots: g.plots.map((p) => ({ ...p, points: [...p.points] })), roads: g.roads.map((r) => ({ ...r, points: [...r.points] })) };
    fn(next);
    onChange(next);
  };

  const setVertex = (kind: 'plot' | 'road', index: number, vi: number, pt: Partial<Pt>) =>
    update((d) => {
      const list = kind === 'plot' ? d.plots[index].points : d.roads[index].points;
      list[vi] = { ...list[vi], ...pt };
    });

  const finishDraw = () => {
    if (!draw) return;
    if (draw.kind === 'plot' && draw.points.length >= 3) {
      update((d) => { d.plots.push({ number: '', facing: 'UNKNOWN', points: draw.points }); });
      setSel({ kind: 'plot', index: g.plots.length });
    } else if (draw.kind === 'road' && draw.points.length >= 2) {
      update((d) => { d.roads.push({ name: '', widthFeet: null, points: draw.points }); });
      setSel({ kind: 'road', index: g.roads.length });
    }
    setDraw(null);
  };

  const selPlot = sel?.kind === 'plot' ? g.plots[sel.index] : undefined;
  const selRoad = sel?.kind === 'road' ? g.roads[sel.index] : undefined;
  const selPoints = selPlot?.points ?? selRoad?.points ?? [];
  const minPts = sel?.kind === 'plot' ? 3 : 2;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <div className="xl:col-span-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {!draw ? (
            <>
              <button type="button" disabled={disabled} onClick={() => { setDraw({ kind: 'plot', points: [] }); setSel(null); }} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50" data-testid="button-draw-plot">
                <PenLine className="w-3.5 h-3.5" /> Draw plot
              </button>
              <button type="button" disabled={disabled} onClick={() => { setDraw({ kind: 'road', points: [] }); setSel(null); }} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50" data-testid="button-draw-road">
                <PenLine className="w-3.5 h-3.5" /> Draw road
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold text-amber-900" role="status">
                Click on the canvas to place {draw.kind === 'plot' ? 'plot corners (3 or more)' : 'road centreline points (2 or more)'}: {draw.points.length} placed
              </span>
              <button type="button" onClick={finishDraw} disabled={draw.points.length < (draw.kind === 'plot' ? 3 : 2)} className="inline-flex items-center gap-1 rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Check className="w-3.5 h-3.5" /> Finish</button>
              <button type="button" onClick={() => setDraw(null)} className="inline-flex items-center gap-1 rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold"><X className="w-3.5 h-3.5" /> Cancel</button>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-stone-200 bg-[#FBF8F1] p-2">
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className={`w-full touch-none select-none ${draw ? 'cursor-crosshair' : ''}`}
            style={{ aspectRatio: String(g.aspectRatio || aspect || 1) }}
            role="img"
            aria-label="Normalized 2D plan geometry editor"
            onClick={(e) => { if (draw) { const p = toNorm(e); if (p) setDraw({ ...draw, points: [...draw.points, p] }); } }}
            onPointerMove={(e) => { const d = dragRef.current; if (d) { const p = toNorm(e); if (p) setVertex(d.kind, d.index, d.vi, p); } }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerLeave={() => { dragRef.current = null; }}
          >
            <rect x="0" y="0" width="100" height="100" fill="#F4EFE3" stroke="#D6CCB6" strokeWidth="0.3" />
            {g.roads.map((r, i) => (
              <g key={`r${i}`} onClick={(e) => { if (!draw) { e.stopPropagation(); setSel({ kind: 'road', index: i }); } }} className="cursor-pointer">
                <polyline points={r.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={r.widthFeet === null ? '#A8A29E' : '#57534E'} strokeWidth={sel?.kind === 'road' && sel.index === i ? 2.2 : 1.6} strokeDasharray={r.widthFeet === null ? '1.5 1' : undefined} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              </g>
            ))}
            {g.plots.map((p, i) => {
              const c = centroid(p.points);
              const active = sel?.kind === 'plot' && sel.index === i;
              const flagged = unmatched.has(p.number) && !p.referenceOnly;
              return (
                <g key={`p${i}`} onClick={(e) => { if (!draw) { e.stopPropagation(); setSel({ kind: 'plot', index: i }); } }} className="cursor-pointer">
                  <polygon points={p.points.map((q) => `${q.x},${q.y}`).join(' ')} fill={active ? '#FCD34D' : flagged ? '#FECACA' : p.referenceOnly ? '#E7E5E4' : '#FDE68A'} fillOpacity={0.75} stroke={active ? '#92400E' : '#B45309'} strokeWidth={active ? 0.6 : 0.3} />
                  <text x={c.x} y={c.y} fontSize="2.4" textAnchor="middle" dominantBaseline="middle" fill="#1C1917" fontWeight={700} pointerEvents="none">{p.number || '?'}</text>
                </g>
              );
            })}
            {sel && !draw && selPoints.map((pt, vi) => (
              <circle key={vi} cx={pt.x} cy={pt.y} r={1.1} fill="#fff" stroke="#92400E" strokeWidth={0.4} className="cursor-move"
                onPointerDown={(e) => { if (disabled) return; e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); dragRef.current = { kind: sel.kind, index: sel.index, vi }; }} />
            ))}
            {draw && draw.points.length > 0 && (
              <polyline points={draw.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#B45309" strokeWidth={0.5} strokeDasharray="1 0.6" />
            )}
          </svg>
        </div>
        <p className="text-[11px] text-stone-600">Positions are normalized to the original image (0 to 100). Red plots are not in current inventory and are not reference-only yet. Dashed roads have unknown width.</p>
      </div>

      <div className="xl:col-span-2 space-y-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-stone-600">North angle (degrees clockwise from image top)</label>
          <div className="flex gap-2">
            <input type="number" min={0} max={359} step={1} disabled={disabled || g.northDegrees === null} className={input} value={g.northDegrees ?? ''} placeholder="Unknown"
              onChange={(e) => update((d) => { d.northDegrees = e.target.value === '' ? null : Number(e.target.value); })} data-testid="input-north-degrees" />
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
              <input type="checkbox" disabled={disabled} checked={g.northDegrees === null} onChange={(e) => update((d) => { d.northDegrees = e.target.checked ? null : 0; })} /> Unknown
            </label>
          </div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-stone-600 pt-1">Source page aspect ratio (page width / height, not land dimensions)</label>
          <div className="flex gap-2">
            <input type="number" min={0.06} max={20} step={0.001} disabled={disabled || g.aspectRatio == null} className={input} value={g.aspectRatio ?? ''} placeholder="Unknown (unverified)"
              onChange={(e) => update((d) => { d.aspectRatio = e.target.value === '' ? null : Number(e.target.value); })} data-testid="input-aspect-ratio" />
            <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
              <input type="checkbox" disabled={disabled} checked={g.aspectRatio == null} onChange={(e) => update((d) => { d.aspectRatio = e.target.checked ? null : round2(aspect || 1); })} /> Unknown
            </label>
          </div>
          {g.aspectRatio == null && <p className="text-[11px] text-amber-800">Unverified: the editor and 3D view use a square display as a viewing convention only.</p>}
          <label className="block text-[11px] font-bold uppercase tracking-wide text-stone-600 pt-1">Reviewer notes</label>
          <textarea disabled={disabled} className={input} rows={2} value={g.notes} onChange={(e) => update((d) => { d.notes = e.target.value; })} />
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-3 max-h-48 overflow-y-auto">
          <p className="text-[11px] font-bold uppercase tracking-wide text-stone-600 mb-1.5">Polygons ({g.plots.length} plots, {g.roads.length} roads)</p>
          <div className="flex flex-wrap gap-1.5">
            {g.plots.map((p, i) => (
              <button key={`sp${i}`} type="button" onClick={() => setSel({ kind: 'plot', index: i })} className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${sel?.kind === 'plot' && sel.index === i ? 'border-amber-600 bg-amber-100' : unmatched.has(p.number) && !p.referenceOnly ? 'border-red-300 bg-red-50 text-red-800' : 'border-stone-200'}`}>{p.number || '?'}</button>
            ))}
            {g.roads.map((r, i) => (
              <button key={`sr${i}`} type="button" onClick={() => setSel({ kind: 'road', index: i })} className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${sel?.kind === 'road' && sel.index === i ? 'border-amber-600 bg-amber-100' : 'border-stone-200 bg-stone-50'}`}>{r.name || 'Road'} · {r.widthFeet === null ? 'width unknown' : `${r.widthFeet} ft`}</button>
            ))}
          </div>
        </div>

        {sel && (selPlot || selRoad) && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/40 p-3 space-y-2" data-testid="panel-selected-polygon">
            {selPlot && sel.kind === 'plot' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-bold text-stone-700">Plot number
                    <input disabled={disabled} className={input} value={selPlot.number} onChange={(e) => update((d) => { d.plots[sel.index].number = e.target.value; })} data-testid="input-plot-number" />
                  </label>
                  <label className="text-[11px] font-bold text-stone-700">Facing
                    <select disabled={disabled} className={input} value={selPlot.facing} onChange={(e) => update((d) => { d.plots[sel.index].facing = e.target.value as Facing; })}>
                      {FACINGS.map((f) => <option key={f} value={f}>{FACING_LABEL[f]}</option>)}
                    </select>
                  </label>
                </div>
                <label className="flex items-start gap-2 text-xs">
                  <input type="checkbox" disabled={disabled} checked={!!selPlot.referenceOnly} onChange={(e) => update((d) => { d.plots[sel.index].referenceOnly = e.target.checked; })} className="mt-0.5" />
                  <span>Reference only (shown from the plan; no inventory plot is created or changed)</span>
                </label>
                {unmatched.has(selPlot.number) && <p className="text-[11px] font-semibold text-red-700">Not found in current inventory.</p>}
                {typeof selPlot.confidence === 'number' && <p className="text-[11px] text-stone-600">AI confidence: {Math.round(selPlot.confidence * 100)}%</p>}
              </>
            )}
            {selRoad && sel.kind === 'road' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-bold text-stone-700">Road label
                  <input disabled={disabled} className={input} value={selRoad.name} onChange={(e) => update((d) => { d.roads[sel.index].name = e.target.value; })} />
                </label>
                <label className="text-[11px] font-bold text-stone-700">Width (feet)
                  <input type="number" min={1} disabled={disabled} className={input} placeholder="Unknown" value={selRoad.widthFeet ?? ''} onChange={(e) => update((d) => { d.roads[sel.index].widthFeet = e.target.value === '' ? null : Number(e.target.value); })} />
                </label>
              </div>
            )}
            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-600">Vertices (x, y)</p>
              {selPoints.map((pt, vi) => (
                <div key={vi} className="flex items-center gap-1.5">
                  <span className="w-5 text-[10px] font-mono text-stone-500">{vi + 1}</span>
                  <input aria-label={`Vertex ${vi + 1} x`} type="number" step={0.1} min={0} max={100} disabled={disabled} className={input} value={pt.x} onChange={(e) => setVertex(sel.kind, sel.index, vi, { x: Number(e.target.value) })} />
                  <input aria-label={`Vertex ${vi + 1} y`} type="number" step={0.1} min={0} max={100} disabled={disabled} className={input} value={pt.y} onChange={(e) => setVertex(sel.kind, sel.index, vi, { y: Number(e.target.value) })} />
                  <button type="button" aria-label={`Remove vertex ${vi + 1}`} disabled={disabled || selPoints.length <= minPts} className="p-1 text-stone-500 hover:text-red-700 disabled:opacity-30"
                    onClick={() => update((d) => { (sel.kind === 'plot' ? d.plots[sel.index].points : d.roads[sel.index].points).splice(vi, 1); })}><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" disabled={disabled} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50"
                onClick={() => update((d) => {
                  const list = sel.kind === 'plot' ? d.plots[sel.index].points : d.roads[sel.index].points;
                  const a = list[list.length - 1], b = list[0];
                  list.push({ x: round2((a.x + b.x) / 2), y: round2((a.y + b.y) / 2) });
                })}><Plus className="w-3 h-3" /> Add vertex</button>
              <button type="button" disabled={disabled} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-red-700 disabled:opacity-50" data-testid="button-remove-polygon"
                onClick={() => { update((d) => { if (sel.kind === 'plot') d.plots.splice(sel.index, 1); else d.roads.splice(sel.index, 1); }); setSel(null); }}>
                <Trash2 className="w-3 h-3" /> Remove {sel.kind === 'plot' ? 'plot' : 'road'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
