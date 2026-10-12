const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { test } = require('node:test');

function loadAdapter() {
  const calls = [];
  let seq = 0;
  const mockCommand = async (action, body) => { calls.push({ action, body }); return { entity: { id: 'p1' } }; };
  const dependencies = {
    './api': {
      newRequestId: () => `request-${++seq}`,
      api: async (url) => { calls.push({ url }); return { id: 'attachment-1' }; },
    },
    './erp': { command: mockCommand, pickConfigured: (_, data) => data },
    './planFile': { validatePlanFile: async () => {} },
  };
  const file = path.resolve(__dirname, '../src/adapter/projectEditing.ts');
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)((name) => {
    assert.ok(dependencies[name], `Unexpected import: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return { ...module.exports, calls };
}

const definition = {
  sections: [{ fields: [{ key: 'name' }, { key: 'location' }, { key: 'notes' }] }],
  settingsFields: [{ key: 'equitySplitMode' }, { key: 'autoGenerateInventory' }],
};
const snapshot = {
  values: { name: 'Original', notes: 'Old note' },
  settings: { equitySplitMode: 'fixed', autoGenerateInventory: true },
  groups: [{ count: 2, startNumber: 1 }],
  partners: [{ mobile: 'test-mobile', initialCapital: 1000 }],
  accounts: [{ openingBalance: 1000 }],
  documents: [{ attachmentId: 'private-file', title: 'Existing layout' }],
};
const project = { id: 'p1', firmId: 'f1', sectorId: 's1', setupState: 'READY', revision: 3, setupData: snapshot };

test('edit seed uses only the selected authorized project and configured fields', () => {
  const { projectEditContext } = loadAdapter();
  const workspace = {
    projects: [{ ...project, name: 'Current', location: '', details: { notes: 'Updated note', currentBalance: 9999 } }],
    interfaces: [
      { firmId: 'wrong-firm', sectorId: 's1', enabled: true, configuration: { projectSetup: { sections: [] } } },
      { firmId: 'f1', sectorId: 's1', enabled: true, configuration: { projectSetup: definition } },
    ],
  };
  const result = projectEditContext(workspace, { settings: { equitySplitMode: 'proportional', projectPlan: {} } }, 'p1');
  assert.deepEqual(result.values, { name: 'Current', location: '', notes: 'Updated note' });
  assert.deepEqual(result.settings, { equitySplitMode: 'proportional', autoGenerateInventory: true });
  assert.equal(projectEditContext(workspace, {}, 'another-project'), undefined);
});

test('editing never rebuilds children or injects computed money into setup', () => {
  const { projectEditPayload } = loadAdapter();
  const payload = projectEditPayload(project, definition, { name: 'New', notes: '', balance: 500 },
    { equitySplitMode: 'fixed', currentBalance: 500 }, 3);
  assert.deepEqual(payload.setup.values, { name: 'New', notes: '' });
  assert.deepEqual(payload.setup.settings, { equitySplitMode: 'fixed' });
  for (const key of ['groups', 'partners', 'accounts', 'documents']) assert.deepEqual(payload.setup[key], snapshot[key]);
  assert.equal(snapshot.values.name, 'Original');
  assert.equal(payload.revision, 3);
  assert.throws(() => projectEditPayload(project, definition, {}, {}, 0), /Reload/);
  assert.throws(() => projectEditPayload({ ...project, setupState: 'DRAFT' }, definition, {}, {}, 3), /Finish project setup/);
});

test('identical edit retries retain their request ID while changed input gets a new one', async () => {
  const { ProjectEditorSaver, projectEditPayload, calls } = loadAdapter();
  const saver = new ProjectEditorSaver();
  const input = projectEditPayload(project, definition, { name: 'New' }, {}, 3);
  await saver.save(input);
  await saver.save(input);
  assert.equal(calls[0].body.requestId, calls[1].body.requestId);
  await saver.save({ ...input, revision: 4 });
  assert.notEqual(calls[1].body.requestId, calls[2].body.requestId);
});

test('document retry reuses uploaded attachment and posted document instead of duplicating', async () => {
  const { ProjectEditorSaver, calls } = loadAdapter();
  const saver = new ProjectEditorSaver();
  const doc = { id: 'local-1', title: 'Plan', fileName: 'plan.png', category: 'master_layout',
    dataUrl: 'data:image/png;base64,aGVsbG8=' };
  const erp = { resources: [{ kind: 'documents', canCreate: true, fields: [] }] };
  await saver.uploadDocuments('p1', erp, [doc]);
  await saver.uploadDocuments('p1', erp, [doc]);
  assert.equal(calls.filter((entry) => entry.url).length, 1);
  assert.equal(calls.filter((entry) => entry.action === 'erp.save').length, 1);
  assert.equal(calls.at(-1).body.data.attachmentId, 'attachment-1');
  await assert.rejects(saver.uploadDocuments('p1', { resources: [] }, [doc]), /permission/);
});
