const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function adapter(error) {
  const storage = new Map([['sos_web_session_token', 'fixture-session']]);
  const events = [];
  const context = {
    exports: {}, URL, FormData, Response,
    CustomEvent: class { constructor(type) { this.type = type; } },
    window: {
      location: { origin: 'https://fixture.example' },
      fetch: async () => new Response(JSON.stringify(error), { status: 401 }),
      sessionStorage: { getItem: k => storage.get(k), removeItem: k => storage.delete(k) },
      localStorage: { removeItem() {} },
      dispatchEvent: e => events.push(e.type),
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(
    path.join(__dirname, '../src/adapter/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return { api: context.exports.api, storage, events };
}

test('wrong current PIN is shown without logging out the valid session', async () => {
  const state = adapter({ error: 'INVALID_CREDENTIALS', message: 'The current credential is incorrect.' });
  await assert.rejects(state.api('/auth/credential', { body: {} }), /current credential is incorrect/);
  assert.equal(state.storage.get('sos_web_session_token'), 'fixture-session');
  assert.deepEqual(state.events, []);
});

test('an actually expired session still clears storage and requests sign-in', async () => {
  const state = adapter({ error: 'AUTHENTICATION_REQUIRED', message: 'Sign in again.' });
  await assert.rejects(state.api('/auth/credential', { body: {} }), /Sign in again/);
  assert.equal(state.storage.has('sos_web_session_token'), false);
  assert.deepEqual(state.events, ['sos-session-expired']);
});
