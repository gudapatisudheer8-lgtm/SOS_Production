// Owner-only database master editor (command master.save). Optimistic revisions; reloads the catalog on success.
import { useMemo, useState } from 'react';
import { useConfig, saveMaster, type MasterItem } from './config';

export function MasterEditor({ onNotify }: { onNotify: (m: string) => void }) {
  const { catalog, load } = useConfig();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState('');
  const [edit, setEdit] = useState<MasterItem | null>(null);
  const [meta, setMeta] = useState('{}');
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => Array.from(new Set((catalog?.items ?? []).map((i) => i.group))).sort(), [catalog]);
  const items = useMemo(() => (catalog?.items ?? []).filter((i) => i.group === group).sort((a, b) => a.position - b.position), [catalog, group]);

  const begin = (i: MasterItem | null) => {
    const base: MasterItem = i ?? { group, key: '', label: '', position: (items[items.length - 1]?.position ?? 0) + 10, enabled: true, metadata: {} };
    setIsNew(!i); setEdit(base); setMeta(JSON.stringify(base.metadata ?? {}, null, 2));
  };
  const save = async () => {
    if (!edit) return;
    let metadata: Record<string, any>;
    try { metadata = JSON.parse(meta || '{}'); if (typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error(); }
    catch { onNotify('✕ Metadata must be a JSON object.'); return; }
    setBusy(true);
    try {
      await saveMaster({ group: edit.group, key: edit.key.trim(), label: edit.label.trim(), position: Number(edit.position), enabled: edit.enabled, metadata, ...(isNew ? {} : { revision: edit.revision }) });
      if (!(await load())) throw new Error('Saved, but the catalog could not be reloaded.');
      onNotify('✓ Master saved'); setEdit(null);
    } catch (e: any) { onNotify(`✕ Master save failed: ${e.message}`); }
    setBusy(false);
  };

  return (
    <section className="mt-8 bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="text-xs font-black uppercase tracking-wider text-gray-950">
        {open ? 'Hide' : 'Show'} business masters (database)
      </button>
      {open && (
        <div className="mt-4 space-y-3 text-xs">
          <select value={group} onChange={(e) => { setGroup(e.target.value); setEdit(null); }} className="border border-gray-300 rounded-xl px-3 py-2 bg-white">
            <option value="">Select a master group</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {group && <button onClick={() => begin(null)} className="ml-2 px-3 py-2 bg-[#FFB800] rounded-xl font-black text-gray-950">+ Add value</button>}
          <ul className="divide-y divide-gray-100">
            {items.map((i) => (
              <li key={i.key} className="py-2 flex items-center gap-3">
                <span className="font-mono text-gray-500 w-48 truncate">{i.key}</span>
                <span className="flex-1 font-bold">{i.label}</span>
                <span className={i.enabled ? 'text-emerald-700' : 'text-gray-400'}>{i.enabled ? 'enabled' : 'disabled'}</span>
                <button onClick={() => begin(i)} className="px-2 py-1 border border-gray-300 rounded-lg font-bold">Edit</button>
              </li>
            ))}
          </ul>
          {edit && (
            <div className="border border-amber-300 rounded-2xl p-4 space-y-2 bg-amber-50/40">
              <input disabled={!isNew} value={edit.key} onChange={(e) => setEdit({ ...edit, key: e.target.value })} placeholder="key" className="w-full border border-gray-300 rounded-xl px-3 py-2 font-mono disabled:bg-gray-100" />
              <input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="label" className="w-full border border-gray-300 rounded-xl px-3 py-2" />
              <div className="flex gap-3 items-center">
                <input type="number" value={edit.position} onChange={(e) => setEdit({ ...edit, position: Number(e.target.value) })} className="w-28 border border-gray-300 rounded-xl px-3 py-2" />
                <label className="flex items-center gap-1.5 font-bold"><input type="checkbox" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> Enabled</label>
              </div>
              <textarea value={meta} onChange={(e) => setMeta(e.target.value)} rows={5} className="w-full border border-gray-300 rounded-xl px-3 py-2 font-mono" />
              <div className="flex gap-2">
                <button disabled={busy} onClick={save} className="px-4 py-2 bg-gray-950 text-white rounded-xl font-black disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
                <button onClick={() => setEdit(null)} className="px-4 py-2 border border-gray-300 rounded-xl font-bold">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
