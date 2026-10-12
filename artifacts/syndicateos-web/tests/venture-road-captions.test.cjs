// Run with: node --test artifacts/syndicateos-web/tests/venture-road-captions.test.cjs
// Transpile the real component using the workspace compiler; no extra test dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const sourceRoot = path.resolve(__dirname, '../src') + path.sep;
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    assert.ok(filename.startsWith(sourceRoot), 'Only transpile this app’s source');
    const source = fs.readFileSync(filename, 'utf8').replace(/\bimport\.meta\.env\b/g, '({ BASE_URL: "/", DEV: false })');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}
// The API adapter captures fetch when imported; these renders never request data.
global.window = { fetch: global.fetch, location: { search: '', origin: 'http://localhost' } };
const { VentureLayoutMasterGrid } = require('../src/original/components/accountant/VentureLayoutMasterGrid.tsx');

const projectA = Object.freeze({ id: 'project-a', name: 'A', roadWidth: 30 });
const projectB = Object.freeze({ id: 'project-b', name: 'B', roadWidth: 60 });
const plot = (id, projectId, roadWidthFt) => Object.freeze({
  id, projectId, roadWidthFt, plotNumber: `${projectId}-plot-${id}`,
  facing: 'East', status: 'available', areaSqYards: 200, ratePerSqYard: 1000,
});
const plots = Object.freeze([
  plot(1, projectA.id, 33),
  plot(2, projectA.id, undefined),
  plot(3, projectB.id, 40),
  plot(4, undefined, 99),
]);
const render = (project, inputPlots = plots) => renderToStaticMarkup(
  React.createElement(VentureLayoutMasterGrid, {
    project, plots: inputPlots, firm: { name: 'Test firm' }, onSelectPlot: () => {},
  }),
);

test('switching A → B → A keeps approach and plot widths project-specific', () => {
  for (const project of [projectA, projectB, projectA]) {
    const html = render(project);
    const otherProject = project.id === projectA.id ? projectB : projectA;
    const plotWidth = project.id === projectA.id ? 33 : 40;
    assert.equal(html.match(new RegExp(`Approach Road — ${project.roadWidth} ft`, 'g')).length, 2);
    assert.ok(!html.includes(`Approach Road — ${otherProject.roadWidth} ft`));
    assert.ok(html.includes(`Plot road width: ${plotWidth} ft`));
    assert.ok(!html.includes(`${otherProject.id}-plot-`));
    assert.ok(!html.includes('99 ft'));
    assert.ok(html.includes('Internal Sector Road — Width unspecified'));
    assert.ok(html.includes('Internal Access Road — Width unspecified'));
    assert.ok(!html.includes('BLACKTOP'));
    assert.ok(!html.includes('CONCRETE'));
    assert.ok(!html.includes('40 Ft / 60 Ft'));
  }
});

test('missing widths are explicit, never copied from approach or other plots', () => {
  assert.ok(render(projectA).includes('Plot road width: Width unspecified'));
  const html = render({ ...projectA, roadWidth: undefined });
  assert.equal(html.match(/Approach Road — Width unspecified/g).length, 2);
  assert.ok(html.includes('Plot road width: 33 ft'));
  assert.ok(!html.includes('Approach Road — 33 ft'));
  const empty = render(undefined);
  assert.ok(empty.includes('Approach Road — Width unspecified'));
  assert.ok(!empty.includes('project-a-plot-'));
  assert.ok(!empty.includes('project-b-plot-'));
});

test('API-shaped numeric select strings render correctly across project selections', () => {
  for (const project of [
    { ...projectA, roadWidth: '30' },
    { ...projectB, roadWidth: '60' },
    { ...projectA, roadWidth: '30' },
  ]) {
    const html = render(project);
    assert.equal(html.match(new RegExp(`Approach Road — ${project.roadWidth} ft`, 'g')).length, 2);
    assert.ok(html.includes(`Plot road width: ${project.id === projectA.id ? 33 : 40} ft`));
    assert.ok(!html.includes(`${project.id === projectA.id ? projectB.id : projectA.id}-plot-`));
  }
  const html = render({ ...projectA, roadWidth: ' 30 ' }, [plot(1, projectA.id, '32.5')]);
  assert.equal(html.match(/Approach Road — 30 ft/g).length, 2);
  assert.ok(html.includes('Plot road width: 32.5 ft'));
});

test('nonpositive or invalid measurements remain unspecified; valid saved decimals survive', () => {
  for (const width of [0, -1, NaN, Infinity, null, '', ' ', '0', '-1', '30ft', 'NaN', 'Infinity', '0x20', true]) {
    const html = render({ ...projectA, roadWidth: width }, [plot(1, projectA.id, width)]);
    assert.equal(html.match(/Approach Road — Width unspecified/g).length, 2);
    assert.ok(html.includes('Plot road width: Width unspecified'));
  }
  assert.ok(render(projectA, [plot(1, projectA.id, 32.5)]).includes('Plot road width: 32.5 ft'));
});

test('rendering does not modify saved project, booking or financial data', () => {
  const bookingPlot = Object.freeze({
    ...plot(1, projectA.id, 33), status: 'sold', buyerName: 'Test buyer',
    advanceReceived: 50000, paymentMode: 'Cash', bookedAt: '2026-10-01',
  });
  const input = Object.freeze([bookingPlot]);
  const before = JSON.stringify({ projectA, input });
  render(projectA, input);
  assert.equal(JSON.stringify({ projectA, input }), before);
});
