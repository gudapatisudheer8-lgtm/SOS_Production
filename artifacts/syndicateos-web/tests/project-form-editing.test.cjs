const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const mocks = { './api': {}, './erp': {}, './planFile': {} };
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, `../src/adapter/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)((key) =>
    key === './projectEditing' ? load('projectEditing') : mocks[key], mod, mod.exports);
  return mod.exports;
}
const { projectFormSeed, projectFormPayload } = load('projectFormEditing');
const keys = (...names) => names.map((key) => ({ key }));
function fixture() {
  const context = {
    project: { id: 'project-a', sectorId: 'sector', setupState: 'READY', setupReleaseId: 'pinned',
      setupData: { groups: [{ count: 2 }], accounts: [{ original: true }], partners: [{ original: true }], documents: [] } },
    definition: { sections: [{ fields: keys('name', 'location', 'projectCode', 'developmentStage', 'roadWidth', 'notes') }],
      settingsFields: keys('autoGenerateInventory', 'layoutAmenities') },
    values: { projectCode: 'P-A', notes: 'before', roadWidth: '30' },
    settings: { autoGenerateInventory: true, layoutAmenities: [] },
  };
  const project = { id: 'project-a', firmId: 'firm-a', sector: 'real_estate_open_plotting', name: 'Project A',
    partners: [{ name: 'Partner', equityPercent: 50 }], __revision: 12, status: 'active_sales' };
  const erp = { resources: [{ kind: 'accounts', canManage: true, canCreate: true,
    fields: keys('bankName', 'accountName', 'openingBalance', 'openingBalanceDate') }],
    records: [
      { id: 'plot-1', kind: 'plots', revision: 2, data: { facing: 'East', areaSqYards: 100, status: 'reserved' } },
      { id: 'plot-2', kind: 'plots', revision: 4, data: { facing: 'East', areaSqYards: 150, status: 'available' } },
      { id: 'bank-a', kind: 'accounts', revision: 6,
        data: { bankName: 'Old Bank', accountName: 'Current', openingBalance: 1000, openingBalanceDate: '2026-10-01' } },
    ] };
  return { context, project, erp };
}
test('edit seeds actual count and preserves mixed live sizes rather than the old template', () => {
  const { context, project, erp } = fixture();
  const seed = projectFormSeed(project, context, erp);
  assert.equal(seed.id, 'project-a');
  assert.equal(seed.plotDistribution.eastPlotsCount, 2);
  assert.equal(seed.plotDistribution.eastAreaSqYards, 0);
  assert.equal(seed.__livePlotArea, 250);
  assert.deepEqual(seed.__mixedPlotGroups, ['east']);
  assert.deepEqual(seed.partners, project.partners);
});
test('save combines bank metadata and matrix, keeps captured revisions, opening capital and historical setup', () => {
  const { context, project, erp } = fixture();
  const seed = projectFormSeed(project, context, erp);
  seed.name = 'Renamed'; seed.code = 'NEW'; seed.notes = '';
  seed.autoGenerateInventory = false;
  seed.__plotRevisions = [{ recordId: 'plot-1', revision: 1 }, { recordId: 'plot-2', revision: 3 }];
  const accounts = [{ id: 'bank-a', __revision: 5, bankName: 'Edited bank', openingBalance: 9000, currentBalance: 12500 },
    { id: 'new-ui-account', bankName: 'New bank', accountName: 'New current', openingBalance: 0, createdDate: '2026-10-12' }];
  const p = projectFormPayload(seed, context, erp, accounts, (_, data) => data);
  assert.equal(p.revision, 12);
  assert.equal(p.setup.values.name, 'Renamed');
  assert.equal(p.setup.values.projectCode, 'NEW');
  assert.equal(p.setup.values.notes, '');
  assert.equal(p.setup.settings.autoGenerateInventory, true);
  assert.deepEqual(p.setup.groups, context.project.setupData.groups);
  assert.deepEqual(p.setup.accounts, context.project.setupData.accounts);
  assert.equal(p.plotMatrix.groups[0].areaSqYards, null);
  assert.equal(p.plotMatrix.records[0].revision, 1);
  assert.equal(p.accountEdits[0].recordId, 'bank-a');
  assert.equal(p.accountEdits[0].revision, 5);
  assert.equal(p.accountEdits[0].data.openingBalance, 1000);
  assert.equal(p.accountEdits[0].data.bankName, 'Edited bank');
  assert.equal(p.accountEdits[0].data.currentBalance, undefined);
  assert.equal(p.accountEdits[1].recordId, undefined);
  assert.equal(p.accountEdits[1].data.openingBalance, 0);
});
test('default cash metadata cannot be staged for edit', () => {
  const { context, project, erp } = fixture();
  erp.records[2].data.isDefaultCash = true;
  assert.throws(() => projectFormPayload(projectFormSeed(project, context, erp), context, erp,
    [{ id: 'bank-a', __revision: 6 }], (_, data) => data), /cannot be edited/);
});
