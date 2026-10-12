import { useMemo, useState } from 'react';
import { Lock, MapPinned, RotateCcw, Search } from 'lucide-react';
import { FieldInput, fieldError, isVisible, normalize, type FieldDef, type Row } from './EditProjectModal';

export interface PlotRecord { id: string; revision: number; status?: string; data: Row }
export type PlotEdit = { recordId: string; revision: number; data: Record<string, any> };

const editableFields = (fields: FieldDef[]) => fields.filter((f) => f.key !== 'status' && !f.readOnly);

/** A plot is editable only if the resource allows it, the record is approved and its live status is available. */
export const isPlotLocked = (rec: PlotRecord, canManage: boolean) =>
  !canManage || rec.status !== 'approved' || String(rec.data?.status ?? '') !== 'available';

const sameValue = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');

const isChanged = (fields: FieldDef[], rec: PlotRecord, draft: Row) =>
  editableFields(fields).some((f) => !sameValue(draft[f.key], rec.data?.[f.key]));

export function plotEditErrors(fields: FieldDef[], records: PlotRecord[], drafts: Record<string, Row>): string[] {
  const errs: string[] = [];
  for (const rec of records) {
    const d = drafts[rec.id];
    if (!d || !isChanged(fields, rec, d)) continue;
    const label = String(rec.data?.plotNumber ?? rec.id);
    for (const f of editableFields(fields)) {
      if (!isVisible(f, d)) continue;
      const e = fieldError(f, d[f.key]);
      if (e) errs.push(`${label}: ${e}`);
    }
  }
  return errs;
}

export function buildPlotEdits(fields: FieldDef[], records: PlotRecord[], drafts: Record<string, Row>): PlotEdit[] {
  const out: PlotEdit[] = [];
  for (const rec of records) {
    const d = drafts[rec.id];
    if (!d || !isChanged(fields, rec, d)) continue;
    const data: Row = {};
    for (const f of fields) data[f.key] = f.key === 'status' ? rec.data?.status : d[f.key];
    const norm = normalize(fields, data);
    norm.status = rec.data?.status;
    out.push({ recordId: rec.id, revision: Number(rec.revision), data: norm });
  }
  return out;
}

interface Props {
  fields: FieldDef[];
  records: PlotRecord[];
  drafts: Record<string, Row>;
  onChangeDrafts: (fn: (prev: Record<string, Row>) => Record<string, Row>) => void;
  canManage: boolean;
  disabled: boolean;
}

export function ProjectPlotEditor({ fields, records, drafts, onChangeDrafts, canManage, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => records[0]?.id || '');

  const view = (rec: PlotRecord): Row => drafts[rec.id] || rec.data || {};
  const totalArea = records.reduce((s, r) => s + (Number(view(r).areaSqYards) || 0), 0);
  const editedIds = records.filter((r) => drafts[r.id] && isChanged(fields, r, drafts[r.id])).map((r) => r.id);
  const editableCount = records.filter((r) => !isPlotLocked(r, canManage)).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const d = drafts[r.id] || r.data || {};
      return [d.plotNumber, d.blockName, d.facing, d.status, d.dimensions].some((v) => String(v ?? '').toLowerCase().includes(q));
    });
  }, [query, records, drafts]);

  const selected = records.find((r) => r.id === selectedId) || null;
  const locked = selected ? isPlotLocked(selected, canManage) : true;
  const errorsFor = (rec: PlotRecord) => (drafts[rec.id] ? plotEditErrors(fields, [rec], drafts).length : 0);

  const setField = (rec: PlotRecord, key: string, v: any) =>
    onChangeDrafts((p) => ({ ...p, [rec.id]: { ...(p[rec.id] || rec.data || {}), [key]: v } }));
  const resetPlot = (rec: PlotRecord) =>
    onChangeDrafts((p) => { const n = { ...p }; delete n[rec.id]; return n; });

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 p-4" aria-label="Saved plots">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-gray-800"><MapPinned className="h-4 w-4 text-amber-600" /> Saved plots</h3>
          <p className="mt-0.5 text-[11px] text-gray-500">Edit details of existing available plots. Plots are never added, removed or regenerated here, and statuses, buyers and receipts are untouched.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 text-[10px] font-black">
          <span data-testid="text-plot-count" className="rounded-full bg-[#111827] px-2.5 py-1 text-white">{records.length} plots</span>
          <span data-testid="text-plot-area" className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-800">{totalArea.toLocaleString('en-IN')} sq.yd</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-800">{editableCount} editable</span>
          <span data-testid="text-plot-edited" className={`rounded-full px-2.5 py-1 ${editedIds.length ? 'bg-[#FFB800] text-gray-950' : 'bg-gray-100 text-gray-500'}`}>{editedIds.length} edited</span>
        </div>
      </div>

      {!canManage && records.length > 0 && (
        <p className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-[11px] text-gray-600">You can view plots but do not have permission to edit them.</p>
      )}

      {records.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-[11px] text-gray-500">No saved plots for this project. Plots are maintained in the Open Plotting tab.</p>
      ) : fields.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-[11px] text-gray-500">The plot field configuration has not loaded, so plots cannot be edited yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
          <div className="min-w-0 space-y-2">
            <label className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input data-testid="input-plot-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plot, block, facing"
                className="w-full min-w-0 bg-transparent text-xs font-semibold outline-none" aria-label="Search plots" />
            </label>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1 md:max-h-80">
              {filtered.length === 0 && <p className="p-2 text-center text-[11px] text-gray-500">No plots match.</p>}
              {filtered.map((r) => {
                const d = view(r);
                const lk = isPlotLocked(r, canManage);
                const edited = editedIds.includes(r.id);
                const bad = edited && errorsFor(r) > 0;
                return (
                  <button key={r.id} type="button" data-testid={`button-select-plot-${r.id}`} onClick={() => setSelectedId(r.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition-colors ${
                      selectedId === r.id ? 'border-[#111827] bg-[#111827] text-white' : 'border-gray-200 bg-white text-gray-900 hover:bg-gray-50'}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-black">{String(d.plotNumber || 'Untitled plot')}</span>
                      <span className={`block truncate text-[10px] ${selectedId === r.id ? 'text-gray-300' : 'text-gray-500'}`}>
                        {[d.facing, d.areaSqYards != null && d.areaSqYards !== '' ? `${d.areaSqYards} sq.yd` : '', String(d.status ?? '')].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {bad && <span className="h-2 w-2 rounded-full bg-red-600" title="Has errors" />}
                      {edited && !bad && <span className="h-2 w-2 rounded-full bg-[#FFB800]" title="Edited" />}
                      {lk && <Lock className="h-3 w-3 opacity-60" aria-label="Booking-protected" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-gray-200 bg-[#F9F8F4] p-3">
            {!selected ? (
              <p className="p-4 text-center text-[11px] text-gray-500">Select a plot to view or edit.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-black text-gray-950">{String(view(selected).plotNumber || 'Plot')}</span>
                    {locked && (
                      <span data-testid="status-plot-locked" className="flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-black text-gray-700">
                        <Lock className="h-3 w-3" /> {canManage ? 'Booking-protected' : 'Read only'}
                      </span>
                    )}
                  </div>
                  {drafts[selected.id] && (
                    <button type="button" data-testid="button-reset-plot" disabled={disabled} onClick={() => resetPlot(selected)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-white disabled:opacity-50">
                      <RotateCcw className="h-3.5 w-3.5" /> Revert plot
                    </button>
                  )}
                </div>
                {locked && canManage && (
                  <p className="mb-3 text-[11px] text-gray-600">This plot is booked, reserved, sold or pending approval, so its details are locked to protect the booking.</p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {fields.filter((f) => f.ui !== 'hidden' && isVisible(f, view(selected))).map((f) => (
                    <div key={f.key} className={f.kind === 'multiline' ? 'sm:col-span-2' : ''}>
                      <FieldInput f={f.key === 'status' ? { ...f, readOnly: true } : f} row={view(selected)} idBase={`plot-${selected.id}`}
                        disabled={disabled || locked} onChange={(v) => setField(selected, f.key, v)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
