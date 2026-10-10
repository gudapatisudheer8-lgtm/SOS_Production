const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function loader(projects, failingProject) {
  const calls = [];
  const filename = path.resolve(__dirname, '../src/adapter/erp.ts');
  const mod = new Module(filename, module);
  mod.require = (name) => {
    if (name === './config') return { sectorUiCode: () => 'real_estate_open_plotting' };
    if (name === './api') return {
      api: async (route) => {
        calls.push(route);
        if (route === '/workspace') return { projects, sectors: [], firms: [] };
        if (route === `/erp/${failingProject}`) throw new Error('Real ledger failure');
        assert.ok(!route.includes('draft'), 'Never request an unfinalized project ledger');
        return { records: [], resources: [], balances: [] };
      },
    };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return { load: mod.exports.loadAll, calls };
}

test('draft-only firm remains an empty operational workspace, without ledger errors', async () => {
  const { load, calls } = loader([{ id: 'draft', name: 'Upload in progress', setupState: 'DRAFT' }]);
  const data = await load('accountant');
  assert.deepEqual(calls, ['/workspace']);
  assert.deepEqual(data.projects, []);
  assert.deepEqual(data.loadErrors, []);
  assert.equal(data.workspace.projects.length, 1, 'Keep the source draft metadata');
});

test('drafts are skipped but finalized project ledgers are loaded', async () => {
  const { load, calls } = loader([
    { id: 'draft', setupState: 'DRAFT' },
    { id: 'ready', name: 'Ready project', setupState: 'READY' },
  ]);
  const data = await load('accountant');
  assert.deepEqual(calls, ['/workspace', '/erp/ready']);
  assert.deepEqual(data.projects.map((p) => p.id), ['ready']);
  assert.deepEqual(data.loadErrors, []);
});

test('real finalized-project ledger failures remain visible', async () => {
  const { load } = loader([{ id: 'ready', name: 'Ready project', setupState: 'READY' }], 'ready');
  const data = await load('field_partner');
  assert.deepEqual(data.loadErrors, ['Ready project: Real ledger failure']);
});
