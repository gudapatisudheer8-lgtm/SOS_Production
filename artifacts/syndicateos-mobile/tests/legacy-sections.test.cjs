const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

test('bespoke screens filter legacy duplicate components', () => {
  const s = read('screens/SectorInterface.tsx');
  assert.match(s, /export function visibleComponents/);
  assert.match(s, /const LEGACY_DUPES/);
  assert.ok(!/\(isDraft && hasErp \? \[\] : screen\.components\)/.test(s), 'screen.components must go through visibleComponents');
});
test('firm picker is always rendered, beside project picker', () => {
  const s = read('screens/SectorInterface.tsx');
  assert.ok(!/firms\.length <= 1\) return null/.test(s));
  assert.match(s, /<ProjectBar firm=\{firmPicker\}/);
});
test('open plotting has no layout calculator or table/add clutter', () => {
  const s = read('screens/ErpBespoke.tsx');
  assert.ok(!/case 'erp-layout': return <View><LayoutCalc/.test(s));
  assert.ok(!/Show table/.test(s) && !/label="Add plot"/.test(s));
});
test('statement uses dropdown filters instead of chip walls', () => {
  const s = read('screens/ErpStatement.tsx');
  const f = s.slice(s.indexOf('export function Filters'), s.indexOf('function TallyModal'));
  assert.ok(!/<Chips/.test(f));
  for (const id of ['stmt-flow', 'stmt-category', 'stmt-account', 'stmt-enrolled', 'stmt-mode']) assert.ok(f.includes(id), id);
  assert.match(s, /cmd\.referBack/); assert.match(s, /cmd\.resubmit/);
});

const ts = require('typescript');
const vm = require('node:vm');
function loadVisible() {
  const src = read('screens/SectorInterface.tsx');
  const a = src.indexOf('function screenRole'); const b = src.indexOf('const ACCT_LABEL');
  const code = ts.transpileModule(src.slice(a, b).replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  const ctx = {}; vm.runInNewContext(code + '\nthis.visibleComponents = visibleComponents;', ctx); return ctx.visibleComponents;
}
const C = (key, resource) => ({ key, props: resource ? { resource } : {} });
test('only known duplicates are removed; unrelated/custom components preserved', () => {
  const vis = loadVisible();
  const keys = (sc) => vis(sc).map((x) => `${x.key}:${x.props.resource ?? ''}`);
  assert.deepEqual(keys({ key: 'd', components: [C('erp-dashboard'), C('erp-plan'), C('erp-resource', 'documents'), C('custom-widget')] }), ['erp-dashboard:', 'erp-resource:documents', 'custom-widget:']);
  assert.deepEqual(keys({ key: 'p', components: [C('erp-equity'), C('erp-resource', 'partner-profiles'), C('erp-resource', 'investments'), C('erp-resource', 'budgets')] }), ['erp-equity:', 'erp-resource:budgets']);
  assert.deepEqual(keys({ key: 'o', components: [C('erp-layout'), C('erp-resource', 'plots'), C('erp-resource', 'bookings')] }), ['erp-layout:', 'erp-resource:bookings']);
  // Statement and other sectors (no bespoke match) are untouched.
  assert.deepEqual(keys({ key: 's', components: [C('erp-statement'), C('erp-resource', 'transactions')] }), ['erp-statement:', 'erp-resource:transactions']);
  assert.deepEqual(keys({ key: 'u', components: [C('erp-pricing'), C('erp-resource', 'units'), C('erp-plan')] }), ['erp-pricing:', 'erp-resource:units', 'erp-plan:']);
  assert.deepEqual(keys({ key: 'x', components: [C('erp-resource', 'plots'), C('erp-plan')] }), ['erp-resource:plots', 'erp-plan:']);
});
test('open plotting keeps saved Project Layout Summary and single sort control', () => {
  const b = read('screens/ErpBespoke.tsx');
  for (const k of ['Venture Extent', 'Approach Road Width', 'Planned Open Space', 'Protected Floor Rate', 'Recorded Plots', 'Recorded Plot Area', "'Not specified'"]) assert.ok(b.includes(k), k);
  const s = read('screens/ErpStatement.tsx');
  assert.ok(!s.includes('Sort by column')); assert.match(s, /f\.clearCol\(\)/);
});

test('shell branding/profile follow the selected active firm via the frame, not the account firm', () => {
  const si = read('screens/SectorInterface.tsx');
  assert.match(si, /activeFirmId\?: string \| null/);
  assert.match(si, /content, activeFirmId: mode === 'preview' \? null : item\.firmId \}/);
  const sh = read('screens/WorkspaceShell.tsx');
  assert.match(sh, /const frame: Frame = \(\{ selectors, nav, content, activeFirmId \}\)/);
  assert.match(sh, /activeFirmId \? ws\?\.firms\.find\(\(f\) => f\.id === activeFirmId\) : undefined\) \?\? firm/);
  assert.match(sh, /\{af \? af\.name : 'No active firm assigned'\}/);
  assert.match(sh, /firm=\{af \? `\$\{af\.name\} \(\$\{af\.clientCode\}\)`/);
  assert.ok(!/firm \? firm\.name : 'No active firm assigned'/.test(sh));
});
