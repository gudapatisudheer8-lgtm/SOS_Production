const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/api-base.ts'), 'utf8');
const moduleExports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: moduleExports });
const { mobileApiBase } = moduleExports;

test('web API requests remain on the current Expo or production browser origin', () => {
  for (const domain of ['separate-preview.replit.dev', 'production.example.com', undefined]) {
    assert.equal(mobileApiBase('web', domain), '');
    assert.equal(new URL(`${mobileApiBase('web', domain)}/api/readyz`, 'https://mobile.example.com/').origin,
      'https://mobile.example.com');
  }
});

test('native API requests retain their configured absolute origin', () => {
  for (const platform of ['ios', 'android']) {
    assert.equal(mobileApiBase(platform, 'api.example.com'), 'https://api.example.com');
    assert.equal(mobileApiBase(platform, undefined), '');
  }
});

test('session requests and attachment requests share the same origin rule', () => {
  for (const file of ['lib/session.tsx', 'lib/attachments.ts']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(text, /mobileApiBase\(Platform\.OS,/);
    assert.doesNotMatch(text, /setBaseUrl\(`https:\/\/\$\{domain\}`\)/);
  }
});
