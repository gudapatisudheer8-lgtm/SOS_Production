import React, { useEffect, useRef, useState } from 'react';
import { Download, Minus, Plus, RefreshCw, RotateCcw, FileWarning } from 'lucide-react';
import { fetchAttachmentBlob, errorMessage } from './blueprintApi';
import type { BlueprintAttachment } from './blueprintGeometry';

interface Props {
  projectId: string;
  attachment: BlueprintAttachment;
  onImageAspect?: (aspect: number) => void;
  compact?: boolean;
}

/** Original plan viewer: private Blob fetch, object URL revoked on change/unmount, zoom/pan, download. */
export const AttachmentViewer: React.FC<Props> = ({ projectId, attachment, onImageAspect, compact }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const aspectRef = useRef(onImageAspect);
  aspectRef.current = onImageAspect;
  const isPdf = attachment.contentType === 'application/pdf';

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true); setError(''); setUrl(null); setZoom(1); setPan({ x: 0, y: 0 });
    fetchAttachmentBlob(projectId, attachment.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: attachment.contentType }));
        setUrl(objectUrl);
      })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, 'Could not load this document.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [projectId, attachment.id, attachment.contentType, attempt]);

  const height = compact ? 'h-[360px]' : 'h-[520px]';
  const btn = 'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-stone-300 bg-white text-stone-800 hover:bg-amber-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';

  return (
    <div className="rounded-2xl border border-stone-200 bg-[#FBF8F1] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-stone-200 bg-white">
        <span className="truncate text-xs font-bold text-stone-800" title={attachment.fileName}>{attachment.fileName}</span>
        <div className="flex items-center gap-1 shrink-0">
          {!isPdf && (
            <>
              <button type="button" className={btn} aria-label="Zoom out" disabled={!url} onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))}><Minus className="w-4 h-4" /></button>
              <span className="w-12 text-center text-[11px] font-mono text-stone-600" aria-live="polite">{Math.round(zoom * 100)}%</span>
              <button type="button" className={btn} aria-label="Zoom in" disabled={!url} onClick={() => setZoom((z) => Math.min(8, z * 1.25))}><Plus className="w-4 h-4" /></button>
              <button type="button" className={btn} aria-label="Reset view" disabled={!url} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><RotateCcw className="w-4 h-4" /></button>
            </>
          )}
          {url && (
            <a href={url} download={attachment.fileName} className={btn} aria-label={`Download ${attachment.fileName}`} data-testid="link-download-original">
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
      <div className={`relative ${height} bg-[#EFE9DC]`}>
        {loading && <div className="absolute inset-4 rounded-xl bg-stone-200/70 animate-pulse" aria-label="Loading document" />}
        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
            <FileWarning className="w-8 h-8 text-amber-700" />
            <p className="text-sm font-semibold text-stone-800 max-w-sm">{error}</p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white" data-testid="button-retry-original">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}
        {url && isPdf && <iframe title={`Original plan ${attachment.fileName}`} src={url} className="absolute inset-0 w-full h-full bg-white" />}
        {url && !isPdf && (
          <div
            className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
            onPointerMove={(e) => { const d = drag.current; if (d) setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }); }}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            onWheel={(e) => setZoom((z) => Math.min(8, Math.max(0.25, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))))}
          >
            <img
              src={url}
              alt={`Original plan ${attachment.fileName}`}
              draggable={false}
              onLoad={(e) => { const i = e.currentTarget; if (i.naturalHeight) aspectRef.current?.(i.naturalWidth / i.naturalHeight); }}
              className="absolute left-1/2 top-1/2 max-w-full max-h-full"
              style={{ transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
