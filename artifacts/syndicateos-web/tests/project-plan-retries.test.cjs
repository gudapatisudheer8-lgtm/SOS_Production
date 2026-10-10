const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function compile(name, dependencies = {}) {
  const filename = path.resolve(__dirname, `../src/adapter/${name}.ts`);
  const mod = new Module(filename, module);
  mod.require = (name) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
const { validatePlanFile } = compile('planFile');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=', 'base64');
const plan = { id: 'file', fileName: 'plan.png', title: 'Plan', category: 'master_layout',
  dataUrl: `data:image/png;base64,${png.toString('base64')}` };

function saver(failUpload = false) {
  const commands = [], uploads = [];
  class ApiError extends Error {}
  const { ProjectPlanSaver } = compile('projectPlans', {
    './planFile': { validatePlanFile },
    './api': {
      ApiError,
      newRequestId: () => `request-${commands.length}`,
      api: async (route) => {
        uploads.push(route);
        if (failUpload) { failUpload = false; throw new Error('HTTP 400: rejected file'); }
        return { id: 'attachment' };
      },
    },
    './erp': { command: async (action, input) => {
      commands.push({ action, input });
      return { entity: { id: input.projectId || 'original-draft', revision: (input.revision || 0) + 1 } };
    } },
  });
  return { instance: new ProjectPlanSaver(), commands, uploads };
}

test('valid plans pass; unsupported, oversized and disguised files fail', async () => {
  await validatePlanFile(new File([png], 'plan.png', { type: 'image/png' }));
  await assert.rejects(validatePlanFile(new File(['<svg/>'], 'plan.svg', { type: 'image/svg+xml' })), /not supported/);
  await assert.rejects(validatePlanFile(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })), /10 MB/);
  await assert.rejects(validatePlanFile(new File(['not a png'], 'fake.png', { type: 'image/png' })), /genuine/);
});

test('invalid plan fails before a server draft is created', async () => {
  const { instance, commands } = saver();
  await assert.rejects(instance.create('local', 'sector', {}, [{
    ...plan, dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
  }]), /not supported/);
  assert.equal(commands.length, 0);
  assert.equal(instance.hasDraft('local'), false);
});

test('upload failure followed by retry reuses the same saved draft', async () => {
  const { instance, commands, uploads } = saver(true);
  await assert.rejects(instance.create('stable-form:CODE', 'sector', {}, [plan]), /draft is retained/);
  assert.equal(instance.hasDraft('stable-form:CODE'), true);
  await instance.create('stable-form:CODE', 'sector', {}, [plan]);
  assert.deepEqual(uploads, ['/erp/original-draft/attachments', '/erp/original-draft/attachments']);
  assert.equal(commands.filter((c) => c.action === 'project.setup-save' && !c.input.projectId).length, 1);
  assert.equal(commands.at(-1).action, 'project.setup-finalize');
  assert.equal(instance.hasDraft('stable-form:CODE'), false);
});

test('confirmed existing-draft recovery does not create another project', async () => {
  const { instance, commands, uploads } = saver();
  await instance.create('local', 'sector', {}, [plan], { id: 'saved-draft', revision: 7 });
  assert.deepEqual(uploads, ['/erp/saved-draft/attachments']);
  assert.equal(commands[0].input.projectId, 'saved-draft');
  assert.equal(commands[0].input.revision, 7);
  assert.equal(commands.filter((c) => !c.input.projectId).length, 0);
});

test('confirmed draft can be finalized after its plan is removed', async () => {
  const { instance, commands, uploads } = saver();
  await instance.create('local', 'sector', {}, [], { id: 'saved-draft', revision: 7 });
  assert.deepEqual(uploads, []);
  assert.deepEqual(commands.map((c) => c.action), ['project.setup-save', 'project.setup-finalize']);
  assert.equal(commands[0].input.projectId, 'saved-draft');
});
