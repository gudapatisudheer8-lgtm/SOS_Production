const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('partner and accountant render the same posted project-account card', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../screens/ParityDashboards.tsx'), 'utf8');
  assert.equal((source.match(/<ProjectAccount erp=\{erp\} \/>/g) || []).length, 2);
  assert.match(source, /function ProjectAccount\(\{ erp \}/);
  assert.match(source, /<Kpi title="Project Account"/);
  assert.match(source, /Posted cash movements/);
  assert.match(source, /cashBreakdown\(erp\)/);
  assert.match(source, /value=\{cb \? formatINR\(bc\.bank \+ bc\.cash\) : 'Unavailable'\}/);
  assert.match(source, /onPress=\{\(\) => navTo\(\{ kind: 'statement' \}\)\}/);
  assert.doesNotMatch(source, /title="Project Account Balance"/);
});
