import type { Project, FirmAccount } from '../original/types';
import { projectEditPayload, setupFields } from './projectEditing';

const groups = [
  ['east', ['East']], ['north', ['North']], ['west', ['West']], ['south', ['South']],
  ['corner', ['North-East Corner', 'South-East Corner']], ['commercial', ['Commercial']],
] as const;

export function projectFormSeed(project: Project, context: any, erp: any): Project {
  const distribution: Record<string, number> = {};
  const mixed: string[] = [];
  const records = (erp?.records || []).filter((r: any) => r.kind === 'plots');
  for (const [key, facings] of groups) {
    const members = records.filter((r: any) => (facings as readonly string[]).includes(r.data?.facing));
    const areas = [...new Set(members.map((r: any) => Number(r.data?.areaSqYards)))];
    distribution[`${key}PlotsCount`] = members.length;
    distribution[`${key}AreaSqYards`] = areas.length === 1 ? Number(areas[0]) : 0;
    if (areas.length > 1) mixed.push(key);
  }
  return {
    ...project, ...context.values, ...context.settings,
    id: project.id, firmId: project.firmId, sector: project.sector,
    name: project.name, code: context.values.projectCode ?? project.code,
    status: context.values.developmentStage ?? project.status,
    roadWidth: Number(context.values.roadWidth ?? project.roadWidth),
    partners: project.partners,
    planDocuments: project.planDocuments,
    ...(project.sector === 'real_estate_open_plotting' ? {
      plotDistribution: distribution,
      __mixedPlotGroups: mixed,
      __livePlotArea: records.reduce((sum: number, r: any) => sum + Number(r.data?.areaSqYards || 0), 0),
    } : {}),
  } as Project;
}

/** Preserve setup children; changes target live records, never bootstrap them again. */
export function projectFormPayload(project: Project, context: any, erp: any, accounts: FirmAccount[],
  pick: (fields: any[], data: any, label: string) => any, roadDeduction?: number): any {
  const p = project as any;
  const fields = context.definition.sections.flatMap((section: any) => section.fields || []);
  const values = setupFields(fields, {
    ...context.values, ...p, name: p.name, location: p.location,
    projectCode: p.code, developmentStage: p.status,
    roadWidth: p.roadWidth == null ? undefined : String(p.roadWidth),
    ...(roadDeduction === undefined ? {} : { roadDeductionPercent: roadDeduction }),
  });
  // UI metadata and calculated financial projections are not business fields.
  const settings = setupFields(context.definition.settingsFields || [], {
    ...context.settings,
    ...Object.fromEntries(['floorPlans', 'amenities', 'plotDistribution', 'layoutAmenities'].map((key) =>
      [key, p[key] === undefined ? context.settings[key] : p[key]])),
  });
  const payload: any = projectEditPayload(context.project, context.definition, values, settings, Number(p.__revision));
  const resource = (erp?.resources || []).find((r: any) => r.kind === 'accounts');
  if (accounts.length && !resource) throw new Error('Project account configuration is unavailable.');
  payload.accountEdits = accounts.map((account: any) => {
    const saved = (erp?.records || []).find((r: any) => String(r.id) === account.id && r.kind === 'accounts');
    if (saved && (!resource.canManage || saved.data?.isDefaultCash)) throw new Error('This account cannot be edited.');
    if (!saved && !resource.canCreate) throw new Error('You do not have permission to add project accounts.');
    // Preserve immutable opening amounts and configured metadata not represented in the UI.
    const data = pick(resource.fields, setupFields(resource.fields, { ...(saved?.data || {}), ...account,
      openingBalance: saved ? saved.data.openingBalance : account.openingBalance,
      openingBalanceDate: saved ? saved.data.openingBalanceDate : account.createdDate,
    }), 'Project account');
    return saved ? { recordId: saved.id, revision: Number(account.__revision), data } : { data };
  });
  if (p.sector === 'real_estate_open_plotting') {
    const records = (erp?.records || []).filter((r: any) => r.kind === 'plots');
    const dist = p.plotDistribution || {};
    payload.plotMatrix = {
      groups: groups.map(([key]) => ({
        key, count: Number(dist[`${key}PlotsCount`] ?? 0),
        areaSqYards: dist[`${key}AreaSqYards`] == null || Number(dist[`${key}AreaSqYards`]) === 0
          ? null : Number(dist[`${key}AreaSqYards`]),
      })),
      records: (p.__plotRevisions || records.map((r: any) => ({ recordId: r.id, revision: r.revision }))),
    };
  }
  return payload;
}
