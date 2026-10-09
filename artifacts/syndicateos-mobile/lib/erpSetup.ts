import type { ErpField, ProjectErp } from '@workspace/api-client-react';

/** Validated view of `ProjectErp.projectSetup` (typed locally until the generated type lands). Never supplies defaults. */
export interface LayoutRules { unitConversions: Record<string, number>; roadLossPercentByWidth: Record<string, number>; roadWidthOptions: number[]; openSpaceLimit: number }
export interface ErpSetup { quickTokens: number[]; layout: LayoutRules | null; pricing: ErpField[] | null; labels: Record<string, string>; milestones: { name: string; call: number; done: number }[] | null; premiumFieldByFacing: Record<string, string> | null }

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const numMap = (x: unknown): Record<string, number> | null => {
  if (!isObj(x)) return null;
  const o: Record<string, number> = {};
  for (const [k, v] of Object.entries(x)) if (typeof v === 'number' && Number.isFinite(v)) o[k] = v;
  return Object.keys(o).length ? o : null;
};

export function erpSetup(erp: ProjectErp): ErpSetup {
  const raw = (erp as unknown as { projectSetup?: unknown }).projectSetup;
  const ps = isObj(raw) ? raw : {};
  const wf = isObj(ps.workflow) ? ps.workflow : {};
  const rules = isObj(ps.rules) ? ps.rules : {};
  const lr = isObj(rules.layout) ? rules.layout : null;
  const conv = lr ? numMap(lr.unitConversions) : null;
  const road = lr ? numMap(lr.roadLossPercentByWidth) : null;
  const widths = lr && Array.isArray(lr.roadWidthOptions) ? lr.roadWidthOptions.filter((n): n is number => typeof n === 'number') : [];
  const lim = lr && typeof lr.openSpaceLimit === 'number' ? lr.openSpaceLimit : null;
  const pr = rules.pricing;
  const pf = Array.isArray(pr) ? pr : isObj(pr) && Array.isArray(pr.fields) ? pr.fields : null;
  const pricing = pf ? pf.filter((f): f is ErpField => isObj(f) && typeof f.key === 'string' && typeof f.label === 'string') : null;
  const labels: Record<string, string> = {};
  if (isObj(ps.labels)) for (const [k, v] of Object.entries(ps.labels)) if (typeof v === 'string') labels[k] = v;
  const ms = Array.isArray(rules.milestones) ? rules.milestones.filter((m): m is { name: string; percent: number } => isObj(m) && typeof m.name === 'string' && typeof m.percent === 'number') : null;
  let acc = 0;
  const milestones = ms && ms.length ? ms.map((m) => { acc += m.percent; return { name: m.name, call: m.percent, done: acc }; }) : null;
  const pbf = isObj(rules.pricing) && isObj(rules.pricing.premiumFieldByFacing) ? Object.fromEntries(Object.entries(rules.pricing.premiumFieldByFacing).filter((e): e is [string, string] => typeof e[1] === 'string')) : null;
  return {
    milestones, premiumFieldByFacing: pbf && Object.keys(pbf).length ? pbf : null,
    quickTokens: Array.isArray(wf.quickTokens) ? wf.quickTokens.filter((n): n is number => typeof n === 'number' && n > 0) : [],
    layout: conv && road && widths.length && lim !== null ? { unitConversions: conv, roadLossPercentByWidth: road, roadWidthOptions: widths, openSpaceLimit: lim } : null,
    pricing: pricing && pricing.length ? pricing : null,
    labels,
  };
}
