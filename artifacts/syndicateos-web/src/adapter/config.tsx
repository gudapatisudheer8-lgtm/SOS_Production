// Database-backed business masters (sos.business_masters) exposed to the original components.
// Loaded after login. There are deliberately no client-side fallback catalogs: when the
// configuration cannot be read, the app shows an explicit "unavailable" state.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';

export interface MasterItem {
  group: string;
  key: string;
  label: string;
  position: number;
  enabled: boolean;
  metadata: Record<string, any>;
  revision?: number;
}
export interface MasterCatalog { items: MasterItem[]; revision: number }
export type ConfigStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

interface ConfigValue {
  status: ConfigStatus;
  error: string | null;
  catalog: MasterCatalog | null;
  load: () => Promise<boolean>;
  clear: () => void;
}

// Module-level mirror so pure calculation helpers can read policy metadata without hooks.
let current: MasterCatalog | null = null;

export function masterItems(group: string, includeDisabled = false): MasterItem[] {
  return (current?.items ?? []).filter((i) => i.group === group && (includeDisabled || i.enabled))
    .sort((a, b) => a.position - b.position || a.key.localeCompare(b.key));
}
export function masterItem(group: string, key: string | number | undefined | null): MasterItem | undefined {
  if (key === undefined || key === null) return undefined;
  return (current?.items ?? []).find((i) => i.group === group && i.key === String(key));
}
/** Numeric policy value from a master's metadata; undefined when not configured (never defaulted). */
export function masterNumber(group: string, key: string, field = 'value'): number | undefined {
  const v = masterItem(group, key)?.metadata?.[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
export function masterLabel(group: string, key: string | undefined | null): string {
  return masterItem(group, key)?.label ?? String(key ?? '');
}

const Ctx = createContext<ConfigValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConfigStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<MasterCatalog | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await api<MasterCatalog>('/configuration/masters');
      if (!res || !Array.isArray(res.items) || !res.items.length) throw new Error('The configuration service returned no business masters.');
      current = res;
      setCatalog(res);
      setError(null);
      setStatus('ready');
      return true;
    } catch (e: any) {
      current = null;
      setCatalog(null);
      setError(e?.message || 'Business configuration could not be loaded.');
      setStatus('unavailable');
      return false;
    }
  }, []);
  const clear = useCallback(() => { current = null; setCatalog(null); setError(null); setStatus('idle'); }, []);

  const value = useMemo(() => ({ status, error, catalog, load, clear }), [status, error, catalog, load, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConfig(): ConfigValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConfig must be used inside ConfigProvider');
  return v;
}

/** Renders <option>s for a master group (drop-in for the original hardcoded option lists). */
export function MasterOptions({ group, only, valueKey = 'key', format }: {
  group: string;
  only?: string[];
  valueKey?: 'key' | 'uiCode';
  format?: (o: MasterItem) => string;
}) {
  const { catalog } = useConfig();
  const items = (catalog?.items ?? []).filter((i) => i.group === group && i.enabled)
    .sort((a, b) => a.position - b.position || a.key.localeCompare(b.key));
  return (
    <>
      {items.map((o) => {
        const value = valueKey === 'uiCode' ? String(o.metadata?.uiCode ?? '') : o.key;
        if (!value || (only && !only.includes(value))) return null;
        return <option key={o.key} value={value}>{format ? format(o) : o.label}</option>;
      })}
    </>
  );
}

/** Maps a backend sector (code/name) to the original UI discriminant using DB tokens. */
export function sectorUiCode(codeOrName: string): string | undefined {
  const c = (codeOrName || '').toLowerCase();
  for (const s of masterItems('sector_types')) {
    const tokens: string[] = Array.isArray(s.metadata?.matchTokens) ? s.metadata.matchTokens : [];
    if (tokens.some((t) => c.includes(String(t).toLowerCase()))) return String(s.metadata?.uiCode ?? '');
  }
  return undefined;
}

/** Owner master editing (command master.save). Returns true only after the server accepted it. */
export async function saveMaster(item: Pick<MasterItem, 'group' | 'key' | 'label' | 'position' | 'enabled' | 'metadata'> & { revision?: number }) {
  await api('/commands/master.save', { body: item });
}
