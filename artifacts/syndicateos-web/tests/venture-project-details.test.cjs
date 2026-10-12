// Run with: node --test artifacts/syndicateos-web/tests/venture-project-details.test.cjs
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
    assert.ok(filename.startsWith(sourceRoot));
    const source = fs.readFileSync(filename, 'utf8').replace(/\bimport\.meta\.env\b/g, '({ BASE_URL: "/", DEV: false })');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022, esModuleInterop: true,
      },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}
global.window = { fetch: global.fetch, location: { search: '', origin: 'http://localhost' } };
const { VentureLayoutMasterGrid } = require('../src/original/components/accountant/VentureLayoutMasterGrid.tsx');
const { ProjectLayoutDetails } = require('../src/original/components/accountant/ProjectLayoutDetails.tsx');
const renderDetails = (project) => renderToStaticMarkup(React.createElement(ProjectLayoutDetails, { project }));
const renderGrid = (project, props = {}, viewMode = 'interactive_grid') => {
  const useState = React.useState;
  // Exercise all real render branches without a browser or adding a production test prop.
  React.useState = (initial) => useState(initial === 'interactive_grid' ? viewMode : initial);
  try {
    return renderToStaticMarkup(React.createElement(VentureLayoutMasterGrid, {
      project, plots: [], firm: { name: 'Test firm', reraNumber: 'FIRM-ONLY' },
      onSelectPlot: () => {}, ...props,
    }));
  } finally {
    React.useState = useState;
  }
};

const projectA = Object.freeze({
  id: 'a', name: 'A', approvalAuthority: 'DTCP', lpOrReraNumber: 'LP-A',
  openSpacePercent: 7.5, extentValue: 100, extentUnit: 'Acres',
  layoutAmenities: Object.freeze([
    Object.freeze({ id: 'park-a', category: 'park', name: 'Pocket garden', allocatedAreaSqYards: 425.5 }),
    Object.freeze({ id: 'water-a', category: 'utilities', name: 'Borewell', allocatedAreaSqYards: 12 }),
  ]),
});
const projectB = Object.freeze({
  id: 'b', name: 'B', approvalAuthority: 'Gram Panchayat', lpOrReraNumber: 'GP-B',
  openSpacePercent: 0,
  layoutAmenities: Object.freeze([
    Object.freeze({ id: 'park-b', category: 'park', name: 'East green', allocatedAreaSqYards: 250 }),
    Object.freeze({ id: 'club-b', category: 'clubhouse', name: 'Community room' }),
  ]),
});

test('A → B → A renders only each selected project’s saved approval and park details', () => {
  for (const project of [projectA, projectB, projectA]) {
    const html = renderGrid(project);
    const own = project === projectA
      ? ['Approval authority: DTCP', 'LP / RERA number: LP-A', 'Open space: 7.5%', 'Pocket garden', '425.5 Sq.Yards', 'Borewell']
      : ['Approval authority: Gram Panchayat', 'LP / RERA number: GP-B', 'Open space: 0%', 'East green', '250 Sq.Yards', 'Community room'];
    const other = project === projectA
      ? ['GP-B', 'East green', 'Community room']
      : ['LP-A', 'Pocket garden', 'Borewell', '425.5 Sq.Yards'];
    own.forEach((text) => assert.ok(html.includes(text), text));
    other.forEach((text) => assert.ok(!html.includes(text), text));
    assert.ok(!html.includes('FIRM-ONLY'));
  }
});

test('missing details never inherit firm, calculated reservations, construction amenities or defaults', () => {
  for (const project of [undefined, { id: 'empty', name: 'Empty' }, {
    id: 'partial', name: 'Partial', approvalAuthority: '  ', lpOrReraNumber: '',
    layoutAmenities: [], amenities: [{ id: 'construction', name: 'Wrong-sector gym', plannedSqFt: 5000 }],
  }]) {
    const html = renderGrid(project, { layoutCalc: { openSpacePercent: 10, parkAmenityLossSqYards: 1850 } });
    for (const text of ['Approval authority: Unspecified', 'LP / RERA number: Unspecified', 'Open space: Unspecified',
      'Sanctioned compass bearings: Unspecified', 'Direction Guide (Illustrative)']) {
      assert.ok(html.includes(text), text);
    }
    for (const text of ['1,850', '10%', '50,000L', 'Transformer Yard', 'UGD', 'Solar Fencing',
      'walking jogging', 'Statutory Public Park Reserve', 'Wrong-sector gym', 'FIRM-ONLY']) {
      assert.ok(!html.includes(text), text);
    }
    assert.match(html, /Saved Parks, Amenities &amp; Infrastructure<\/span><\/div><ul[^>]*><li>Unspecified/);
  }
});

test('only recorded amenity areas are shown, without estimating a park allocation', () => {
  const html = renderDetails({
    ...projectA, openSpacePercent: 20,
    layoutAmenities: [
      { id: 'p', category: 'park', name: 'Park without measurement' },
      { id: 'n', name: 'Uncategorized saved feature', allocatedAreaSqYards: 0 },
      { id: 'u', category: 'utilities', name: '', allocatedAreaSqYards: null },
    ],
  });
  assert.ok(html.includes('Open space: 20%'));
  assert.match(html, /Park without measurement<\/span><span[^>]*>Allocated area: Unspecified/);
  assert.match(html, /Uncategorized saved feature<\/span><span[^>]*>Allocated area: 0 Sq.Yards/);
  assert.ok(!html.includes('425.5'));
  assert.ok(!html.includes('Reserved Area'));
});

test('parks saved by the project form without categories appear with their actual allocated areas', () => {
  // OpenPlottingPlanBuilder.handleAddAmenity persists exactly these three fields.
  const park = Object.freeze({ id: 'form-park', name: 'Central Park', allocatedAreaSqYards: 320 });
  const utility = Object.freeze({ id: 'form-utility', name: 'Water tank', allocatedAreaSqYards: 16 });
  const first = Object.freeze({ ...projectA, layoutAmenities: Object.freeze([park, utility]) });
  const second = Object.freeze({
    ...projectB, layoutAmenities: Object.freeze([
      Object.freeze({ id: 'form-park-b', name: 'Riverside garden', allocatedAreaSqYards: 90 }),
    ]),
  });
  for (const project of [first, second, first]) {
    const html = renderGrid(project);
    assert.ok(html.includes('Saved Parks, Amenities &amp; Infrastructure'));
    assert.ok(!html.includes('Recorded parks:'));
    if (project === first) {
      assert.match(html, /Central Park<\/span><span[^>]*>Allocated area: 320 Sq.Yards/);
      assert.match(html, /Water tank<\/span><span[^>]*>Allocated area: 16 Sq.Yards/);
      assert.ok(!html.includes('Riverside garden'));
    } else {
      assert.match(html, /Riverside garden<\/span><span[^>]*>Allocated area: 90 Sq.Yards/);
      assert.ok(!html.includes('Central Park'));
      assert.ok(!html.includes('Water tank'));
    }
  }
});

test('numeric strings and zero survive; invalid or absent measurements are unspecified', () => {
  for (const value of [undefined, null, '', ' ', -1, 101, NaN, Infinity, '0x10', '10%', true]) {
    assert.ok(renderDetails({ openSpacePercent: value }).includes('Open space: Unspecified'));
  }
  for (const value of [0, 7.5, 100, ' 7.5 ']) {
    assert.ok(renderDetails({ openSpacePercent: value }).includes(`Open space: ${Number(value)}%`));
  }
  for (const value of [undefined, null, '', ' ', -1, NaN, Infinity, '12yd', true]) {
    assert.ok(renderDetails({ layoutAmenities: [{ id: 'u', name: 'Utility', allocatedAreaSqYards: value }] })
      .includes('Allocated area: Unspecified'));
  }
});

test('rendering leaves project, booking and financial data unchanged and performs no updates', () => {
  const plot = Object.freeze({
    id: 1, projectId: 'a', plotNumber: 'A1', facing: 'East', status: 'sold',
    areaSqYards: 200, ratePerSqYard: 1000, advanceReceived: 50000, buyerName: 'Test buyer',
    paymentMode: 'Cash', bookedAt: '2026-10-01',
  });
  const plots = Object.freeze([plot]);
  const before = JSON.stringify({ projectA, plots });
  renderGrid(projectA, { plots, onUpdatePlot: () => assert.fail('Read-only details cannot update a plot') });
  assert.equal(JSON.stringify({ projectA, plots }), before);
});

test('both blueprint modes use selected-project references without claiming sanction', () => {
  for (const mode of ['blueprint_overlay', 'split_view']) {
    for (const project of [projectA, projectB, undefined, projectA]) {
      const html = renderGrid(project, {}, mode);
      assert.ok(html.includes(`LP / RERA: ${project?.lpOrReraNumber ?? 'Unspecified'}`));
      assert.ok(!html.includes('FIRM-ONLY'));
      assert.ok(!html.includes('DTCP / HMDA Approved'));
      assert.ok(!html.includes('Approved LP'));
      assert.ok(!html.includes('Sanctioned Blueprint'));
      assert.ok(!html.includes(project === projectA ? 'GP-B' : 'LP-A'));
    }
  }
});
