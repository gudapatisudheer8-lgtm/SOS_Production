import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { downloadProjectAttachment } from '../../../adapter/api';
import type { Project } from '../../types';

export function ProjectPlans({ project }: { project: Project | null }) {
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  if (!project?.planDocuments?.length) return null;
  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4" aria-label="Project plans and documents">
      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-950"><FileText size={18} /> Plans &amp; Documents</h3>
      <p className="mt-1 text-xs text-gray-500">Private files for {project.name}</p>
      {project.planDocuments.map((doc) => (
        <div key={doc.id} className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{doc.title}</p><p className="truncate text-xs text-gray-500">{doc.fileName}</p></div>
          <button type="button" disabled={!!downloading} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
            onClick={async () => {
              setError(''); setDownloading(doc.id);
              try { await downloadProjectAttachment(project.id, doc.id); }
              catch (e) { setError(e instanceof Error ? e.message : 'Download failed. Please try again.'); }
              finally { setDownloading(''); }
            }}><Download size={14} />{downloading === doc.id ? 'Downloading…' : 'Download'}</button>
        </div>
      ))}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}
