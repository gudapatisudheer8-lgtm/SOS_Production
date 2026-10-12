import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Sparkles, Save, ShieldCheck, RefreshCw, FileText, Box, PencilRuler, AlertTriangle } from 'lucide-react';
import type { Plot, PlanUploadDocument } from '../../types';
import { validatePlanFile } from '../../../adapter/planFile';
import { AttachmentViewer } from './AttachmentViewer';
import { DraftEditor } from './DraftEditor';
import { Blueprint3DView } from './Blueprint3DView';
import { analyzeBlueprint, errorMessage, getBlueprint, saveBlueprint } from './blueprintApi';
import {
  SUPPORTED_TYPES, cloneGeometry, emptyGeometry, unmatchedPlotNumbers, validateGeometry,
  type BlueprintState, type Geometry,
} from './blueprintGeometry';

interface Props {
  projectId: string;
  plots: Plot[];
  onUploadDocuments?: (projectId: string, documents: PlanUploadDocument[]) => Promise<boolean>;
}

type Tab = 'original' | 'review' | 'view3d';

/** Original plan + AI-assisted, human-reviewed geometry + illustrative 3D of confirmed geometry only. */
export const BlueprintWorkspace: React.FC<Props> = ({ projectId, plots, onUploadDocuments }) => {
  const [state, setState] = useState<BlueprintState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('original');
  const [selectedId, setSelectedId] = useState<string>('');
  const [aspect, setAspect] = useState(0);

  // Local editing copy; never overwritten by a refresh while dirty.
  const [edit, setEdit] = useState<Geometry | null>(null);
  const [editRevision, setEditRevision] = useState<number | null>(null);
  const [editSourceId, setEditSourceId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState<'' | 'analyze' | 'save' | 'confirm' | 'upload'>('');
  const busyRef = useRef(false);
  const [actionError, setActionError] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const inventoryNumbers = useMemo(() => plots.filter((p) => p.projectId === projectId).map((p) => p.plotNumber), [plots, projectId]);

  const applyState = useCallback((s: BlueprintState, force: boolean) => {
    setState(s);
    setSelectedId((cur) => (force && s.sourceAttachmentId ? s.sourceAttachmentId : cur && s.attachments.some((a) => a.id === cur) ? cur : s.sourceAttachmentId || s.confirmedAttachmentId || s.attachments[0]?.id || ''));
    if (force || !dirtyRef.current) {
      const seed = s.draft ?? s.confirmed;
      setEdit(seed ? cloneGeometry(seed) : null);
      setEditRevision(s.revision);
      setEditSourceId(s.draft ? s.sourceAttachmentId || '' : s.confirmedAttachmentId || '');
      setDirty(false);
      setAck(false);
    }
  }, []);
  useEffect(() => { setAspect(0); setAck(false); }, [selectedId]);

  const load = useCallback(async (force = false) => {
    setLoading(true); setLoadError('');
    try { applyState(await getBlueprint(projectId), force); }
    catch (e) { setLoadError(errorMessage(e, 'Could not load the blueprint workspace.')); }
    finally { setLoading(false); }
  }, [projectId, applyState]);

  useEffect(() => { void load(true); }, [load]);

  const run = async (kind: 'analyze' | 'save' | 'confirm' | 'upload', fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(kind); setActionError([]); setNotice('');
    try { await fn(); }
    catch (e) { setActionError([errorMessage(e, 'The request failed. Please try again.')]); }
    finally { busyRef.current = false; setBusy(''); }
  };

  const handleUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !onUploadDocuments) return;
    void run('upload', async () => {
      if (!SUPPORTED_TYPES.includes(file.type)) throw new Error('Select a PDF, PNG, JPEG or WebP plan.');
      await validatePlanFile(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error(`Could not read "${file.name}". Select it again.`));
        r.readAsDataURL(file);
      });
      const doc: PlanUploadDocument = {
        id: `doc-${crypto.randomUUID()}`, fileName: file.name, fileType: file.type, fileSize: file.size,
        uploadedAt: new Date().toISOString(), dataUrl, title: file.name.replace(/\.[^/.]+$/, ''), category: 'master_layout',
      };
      const ok = await onUploadDocuments(projectId, [doc]);
      if (!ok) throw new Error('Upload failed. The file was not stored; try again.');
      setNotice(`${file.name} uploaded privately.`);
      const s = await getBlueprint(projectId);
      applyState(s, false);
      const added = s.attachments.find((a) => a.fileName === file.name);
      if (added) setSelectedId(added.id);
    });
  };

  const handleAnalyze = () => {
    if (!state || !selectedId) return;
    void run('analyze', async () => {
      const s = await analyzeBlueprint(projectId, selectedId, state.revision);
      applyState(s, true);
      setTab('review');
      setNotice('AI draft ready. Review every plot, road and vertex before confirming. The confirmed view is unchanged until you confirm.');
    });
  };

  const handleSave = (confirm: boolean) => {
    if (!state || !edit || editRevision === null) return;
    if (editSourceId && editSourceId !== selectedId) {
      setActionError(["Choose this draft's original document, analyze the selected file, or start manual tracing for the new source."]);
      return;
    }
    const attachmentId = editSourceId || selectedId;
    const errs = validateGeometry(edit, inventoryNumbers, confirm);
    if (confirm && !ack) errs.push('Tick the review acknowledgement before confirming.');
    if (!attachmentId) errs.push('Select the source plan document.');
    if (errs.length) { setActionError(errs); return; }
    void run(confirm ? 'confirm' : 'save', async () => {
      const s = await saveBlueprint(projectId, { attachmentId, revision: editRevision, geometry: edit, confirm, reviewAcknowledged: confirm ? ack : false });
      applyState(s, true);
      setNotice(confirm ? 'Geometry confirmed. The 3D view now reflects this revision.' : 'Draft saved. Not confirmed yet.');
      if (confirm) setTab('view3d');
    });
  };

  const selected = state?.attachments.find((a) => a.id === selectedId);
  // Image natural size may seed an unknown page ratio, never over dirty edits; PDFs stay reviewer input.
  const handleImageAspect = (ar: number) => {
    setAspect(ar);
    if (dirtyRef.current || !selected || selected.contentType === 'application/pdf') return;
    if (state?.sourceAttachmentId && state.sourceAttachmentId !== selected.id) return;
    if (!(ar > 0.05 && ar <= 20)) return;
    setEdit((g) => (g && g.aspectRatio == null ? { ...g, aspectRatio: Math.round(ar * 1000) / 1000 } : g));
  };

  const unmatched = useMemo(() => (edit ? unmatchedPlotNumbers(edit, inventoryNumbers) : new Set<string>()), [edit, inventoryNumbers]);
  const canManage = !!state?.canManage;
  const staleRevision = dirty && state && editRevision !== null && state.revision !== editRevision;

  const tabBtn = (t: Tab, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <button type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} data-testid={`tab-blueprint-${t}`}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${tab === t ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'}`}>
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );

  if (loading && !state) {
    return <div className="space-y-3" aria-label="Loading blueprint workspace"><div className="h-10 rounded-xl bg-stone-200 animate-pulse" /><div className="h-80 rounded-2xl bg-stone-100 animate-pulse" /></div>;
  }
  if (loadError && !state) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3" role="alert">
        <p className="text-sm font-semibold text-red-800">{loadError}</p>
        <button type="button" onClick={() => void load(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
      </div>
    );
  }
  if (!state) return null;

  return (
    <div className="space-y-4" data-testid="blueprint-workspace">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div role="tablist" aria-label="Blueprint views" className="flex flex-wrap gap-1 bg-stone-50 border border-stone-200 rounded-2xl p-1">
          {tabBtn('original', 'Original plan', FileText)}
          {canManage && tabBtn('review', state.draft ? 'Review draft' : 'Edit geometry', PencilRuler)}
          {tabBtn('view3d', '3D view (confirmed)', Box)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${state.status === 'CONFIRMED' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : state.status === 'DRAFT' ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-stone-100 border-stone-300 text-stone-700'}`}>
            {state.status === 'CONFIRMED' ? 'Confirmed' : state.status === 'DRAFT' ? 'Draft awaiting review' : 'No geometry'} · rev {state.revision}
          </span>
          {state.attachments.length > 0 && (
            <select aria-label="Source plan document" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="max-w-[220px] rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold" data-testid="select-blueprint-attachment">
              {state.attachments.map((a) => <option key={a.id} value={a.id}>{a.fileName}</option>)}
            </select>
          )}
          {canManage && onUploadDocuments && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => handleUpload(e.target.files)} aria-label="Upload plan document" data-testid="input-upload-blueprint" />
              <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50" data-testid="button-upload-blueprint">
                <Upload className="w-3.5 h-3.5" />{busy === 'upload' ? 'Uploading…' : 'Upload plan'}
              </button>
            </>
          )}
          {canManage && (
            <button type="button" disabled={!!busy || !selected} onClick={handleAnalyze} className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFB800] hover:bg-amber-400 px-3 py-2 text-xs font-black text-stone-950 border border-amber-600/30 disabled:opacity-50" data-testid="button-analyze-blueprint"
              title="Sends the selected layout plan to the AI provider. Billed to your Replit credits. Use plans only, not personal or financial documents.">
              <Sparkles className="w-3.5 h-3.5" />{busy === 'analyze' ? 'Analyzing…' : 'AI draft (uses billed Replit credits)'}
            </button>
          )}
        </div>
      </div>

      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{notice}</p>}
      {canManage && <p className="text-xs text-stone-500">AI sends only the selected file to the configured provider. Use venture plans, not personal or financial documents. Review the result before confirming; the original stays unchanged.</p>}
      {canManage && selectedId && edit && editSourceId !== selectedId && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          This draft belongs to a different original. Analyze the selected plan or start a new manual draft.
          <button type="button" disabled={!!busy} className="ml-2 underline font-bold" onClick={() => {
            if (dirty && !window.confirm('Discard unsaved edits and start tracing this selected source?')) return;
            setEdit({...emptyGeometry(),aspectRatio:selected?.contentType !== 'application/pdf' && aspect > 0.05 ? aspect : null});
            setEditSourceId(selectedId);setEditRevision(state.revision);setDirty(true);setAck(false);setTab('review');
          }}>Start manual draft for this source</button>
        </div>
      )}
      {actionError.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 space-y-0.5">
          {actionError.map((m, i) => <p key={i} className="font-semibold">{m}</p>)}
        </div>
      )}

      {tab === 'original' && (
        selected ? <AttachmentViewer key={selected.id} projectId={projectId} attachment={selected} onImageAspect={setAspect} /> : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FBF8F1] p-10 text-center">
            <FileText className="w-8 h-8 text-amber-700 mx-auto" />
            <p className="mt-2 text-sm font-bold text-stone-900">No plan document uploaded yet</p>
            <p className="text-xs text-stone-600">{canManage ? 'Upload the approved layout as PDF, PNG, JPEG or WebP. It is stored privately.' : 'Ask a project manager to upload the approved layout.'}</p>
          </div>
        )
      )}

      {tab === 'review' && canManage && (
        <div className="space-y-4">
          {staleRevision && (
            <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> A newer revision ({state.revision}) exists. Your unsaved edits are based on revision {editRevision}; saving will be rejected.</span>
              <button type="button" onClick={() => applyState(state, true)} className="rounded-lg bg-stone-900 px-3 py-1.5 font-bold text-white">Discard edits and load newer</button>
            </div>
          )}
          {state.status === 'DRAFT' && state.confirmed && <p className="text-[11px] text-stone-600">The previously confirmed geometry stays in the 3D view until this draft is confirmed.</p>}
          {!edit ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FBF8F1] p-8 text-center space-y-3">
              <p className="text-sm font-bold text-stone-900">No draft geometry yet</p>
              <p className="text-xs text-stone-600 max-w-md mx-auto">Run the AI draft on the selected plan, or trace plots and roads manually. Nothing is guessed: unknown widths, facings and north stay unknown.</p>
              <button type="button" onClick={() => { setEdit({ ...emptyGeometry(), aspectRatio: selected && selected.contentType !== 'application/pdf' && aspect > 0.05 && aspect <= 20 ? Math.round(aspect * 1000) / 1000 : null }); setEditRevision(state.revision); setEditSourceId(selectedId); setDirty(true); }} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold" data-testid="button-start-manual">Start manual tracing</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
                {selected && <AttachmentViewer key={`r-${selected.id}`} projectId={projectId} attachment={selected} onImageAspect={handleImageAspect} compact />}
                <DraftEditor geometry={edit} onChange={(g) => { setEdit(g); setDirty(true); }} unmatched={unmatched} aspect={aspect} disabled={!!busy} />
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-3">
                <label className="flex items-start gap-2 text-xs text-stone-800 max-w-xl">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-amber-600" data-testid="checkbox-review-ack" />
                  <span>I reviewed every plot number, facing, road label and width, north angle and vertex against the original plan. Unmatched plots are marked reference-only; no inventory, bookings or cash are changed.</span>
                </label>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button type="button" disabled={!!busy} onClick={() => handleSave(false)} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold disabled:opacity-50" data-testid="button-save-blueprint-draft">
                    <Save className="w-3.5 h-3.5" />{busy === 'save' ? 'Saving…' : 'Save draft'}
                  </button>
                  <button type="button" disabled={!!busy || !ack} onClick={() => handleSave(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40" data-testid="button-confirm-blueprint">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />{busy === 'confirm' ? 'Confirming…' : 'Confirm geometry'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'view3d' && (
        state.confirmed && state.confirmed.plots.length > 0 ? (
          <Blueprint3DView key={`3d-${state.revision}`} geometry={state.confirmed} plots={plots.filter((p) => p.projectId === projectId)} />
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FBF8F1] p-10 text-center" data-testid="empty-3d">
            <Box className="w-8 h-8 text-amber-700 mx-auto" />
            <p className="mt-2 text-sm font-bold text-stone-900">No confirmed geometry yet</p>
            <p className="text-xs text-stone-600 max-w-md mx-auto">The 3D view only shows geometry a reviewer has confirmed against the original plan. No default layout is generated.</p>
          </div>
        )
      )}
    </div>
  );
};
