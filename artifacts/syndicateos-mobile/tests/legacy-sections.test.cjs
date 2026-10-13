const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const read = (f) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

test('bespoke screens filter legacy duplicate components', () => {
  const s = read('screens/SectorInterface.tsx');
  assert.match(s, /export function visibleComponents/);
  assert.match(s, /const LEGACY: Record/);
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
// Component shapes exactly as V4__original_dashboard_configuration.sql creates them.
test('core screens hide V4 legacy components (accountant and partner); unrelated/custom kept', () => {
  const vis = loadVisible();
  const keys = (sc) => vis(sc).map((x) => `${x.key}:${x.props.resource ?? ''}`);
  // Accountant dashboard: erp-dashboard, erp-plan, project-form, documents
  assert.deepEqual(keys({ key: 'dashboard', components: [C('erp-dashboard'), C('erp-plan'), C('project-form'), C('erp-resource', 'documents'), C('custom-widget')] }), ['erp-dashboard:', 'custom-widget:']);
  // Partner dashboard: erp-dashboard, drawings
  assert.deepEqual(keys({ key: 'dashboard', components: [C('erp-dashboard'), C('erp-resource', 'drawings')] }), ['erp-dashboard:']);
  // Partners: erp-equity, partner-profiles, investments, partner-form
  assert.deepEqual(keys({ key: 'partners', components: [C('erp-equity'), C('erp-resource', 'partner-profiles'), C('erp-resource', 'investments'), C('partner-form'), C('erp-resource', 'budgets')] }), ['erp-equity:', 'erp-resource:budgets']);
  // Accountant open plotting: plots, erp-layout, bookings
  assert.deepEqual(keys({ key: 'open-plotting', components: [C('erp-resource', 'plots'), C('erp-layout'), C('erp-resource', 'bookings')] }), ['erp-layout:']);
  // Partner plots: plots, bookings (no erp-layout, so plots view stays)
  assert.deepEqual(keys({ key: 'plots', components: [C('erp-resource', 'plots'), C('erp-resource', 'bookings')] }), ['erp-resource:plots']);
  // Statement (both roles): erp-statement, erp-audit
  assert.deepEqual(keys({ key: 'project-statement', components: [C('erp-statement'), C('erp-audit'), C('custom-widget')] }), ['erp-statement:', 'custom-widget:']);
  // Construction / unknown screens untouched.
  assert.deepEqual(keys({ key: 'construction', components: [C('erp-resource', 'units'), C('erp-pricing'), C('erp-resource', 'bookings')] }), ['erp-resource:units', 'erp-pricing:', 'erp-resource:bookings']);
  assert.deepEqual(keys({ key: 'x', components: [C('custom-widget'), C('erp-plan')] }), ['custom-widget:', 'erp-plan:']);
});
test('statement rows route every entry to the correction dialog with discoverable server-gated actions', () => {
  const s = read('screens/ErpStatement.tsx');
  assert.match(s, /\{open\?\.entry \? <CorrectionDialog/);
  assert.match(s, /r\.entry\?\.canResubmit \?/); assert.match(s, /r\.entry\?\.canReferBack \?/);
  assert.match(s, /e\.canReferBack \? <View>/); assert.match(s, /e\.canResubmit \? <View/);
  assert.match(s, /correction-unavailable/);
  const d = read('screens/ErpScreens.tsx');
  const detail = d.slice(d.indexOf('export function RecordDetail'));
  assert.ok(detail.indexOf('detail-refer-back') < detail.indexOf('res.fields.filter'), 'Refer Back must sit above the field list');
  assert.match(d, /KeyboardAwareScrollViewCompat style=\{\{ flexShrink: 1 \}\}/, 'dialogs scroll on small phones');
});
test('no approval UI wording on reachable client screens', () => {
  const files = ['screens/ErpBespoke.tsx', 'screens/ErpInventory.tsx', 'screens/ErpStatement.tsx', 'screens/ErpScreens.tsx'];
  for (const f of files) { const s = read(f).replace(/\/\*[\s\S]*?\*\//g, ''); assert.ok(!/['"`>][^'"`<]*\b(Approve|Approval|approved booking|for Approval)\b/.test(s), f); }
  const i = read('lib/i18nFull.ts'); assert.ok(!/Submit Expense for Approval|Approvals Desk|Pending Approval|approveBtn: 'Approve/.test(i) || /approveBtn/.test(i));
  assert.match(read('lib/erp.ts'), /Approvals have been removed/);
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

test('reachable Telugu and English financial labels use direct-posting wording', () => {
  const i = read('lib/i18nFull.ts');
  const keys = ['tabExpensesApprovals', 'investmentsBannerSubtitle', 'filterInvPending', 'filterInvApproved', 'consensusSignoff', 'expensesBannerTitle', 'expensesBannerSubtitle', 'submitExpenseBtn', 'pendingApprovalsTitle', 'filterPending', 'filterApproved', 'statusPending', 'statusApproved'];
  for (const k of keys) for (const m of i.matchAll(new RegExp(`${k}: '([^']*)'`, 'g'))) assert.ok(!/ఆమోద|Approv|Sign-off|Clearance|approval/i.test(m[1]), `${k}: ${m[1]}`);
  assert.match(i, /lpReraNumber: 'Approval & LP \/ RERA No\.'/, 'statutory approval permit label preserved');
});

test('correction dialog and detail title the reason by actual posting state', () => {
  const ts2 = require('typescript'); const vm2 = require('node:vm');
  const src = read('screens/ErpScreens.tsx'); const a = src.indexOf('export function postingStateInfo'); const b = src.indexOf('export const money');
  const ctx = {}; vm2.runInNewContext(ts2.transpileModule(src.slice(a, b).replace(/export /g, ''), { compilerOptions: { target: ts2.ScriptTarget.ES2020 } }).outputText + '\nthis.f = postingStateInfo;', ctx);
  const R = 'Correcting a historical unposted entry';
  const m = (postingState, canReferBack = false, canResubmit = false) => ctx.f({ postingState, correctionReason: R, canReferBack, canResubmit });
  assert.equal(m('posted', true).badge, 'Recorded'); assert.equal(m('posted', true).reasonTitle, 'Correction history');
  assert.equal(m('referred_back', false, true).reasonTitle, 'Referred back'); assert.match(m('referred_back').text, /Only the enrolled author/);
  assert.match(m('referred_back', false, true).text, /resubmit/);
  assert.equal(m('superseded').badge, 'Replaced by correction'); assert.notEqual(m('superseded').reasonTitle, 'Referred back'); assert.match(m('superseded').text, /cannot be referred back again/);
  assert.equal(m('reversal').badge, 'Reversal'); assert.match(m('reversal').text, /cannot be corrected/);
  assert.equal(m('legacy_unposted').badge, 'Historical unposted'); assert.match(m('legacy_unposted', true).text, /shown below/); assert.match(m('legacy_unposted').text, /No correction action/);
  const st = read('screens/ErpStatement.tsx'); assert.ok(!/title="Referred back"/.test(st)); assert.ok(!/title="Referred back"/.test(src));
  assert.match(st, /e\.canReferBack \? <View>/); assert.match(st, /e\.canResubmit \? <View/);
});
