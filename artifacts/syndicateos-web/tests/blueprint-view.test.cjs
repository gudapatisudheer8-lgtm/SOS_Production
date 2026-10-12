const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sourceRoot = path.resolve(__dirname, '../src') + path.sep;
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    assert.ok(filename.startsWith(sourceRoot));
    const source = fs.readFileSync(filename, 'utf8').replace(/\bimport\.meta\.env\b/g, '({BASE_URL:"/",DEV:false})');
    const { outputText } = ts.transpileModule(source, {compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    }, fileName: filename});
    module._compile(outputText, filename);
  };
}
const geometry = require('../src/original/components/blueprint/blueprintGeometry.ts');
const { Blueprint3DView } = require('../src/original/components/blueprint/Blueprint3DView.tsx');
const sample = () => ({
  plots: [{number:'1', facing:'UNKNOWN', points:[{x:10,y:10},{x:30,y:10},{x:30,y:30},{x:10,y:30}]}],
  roads: [{name:'Main road',widthFeet:30,points:[{x:0,y:35},{x:100,y:35},{x:100,y:45},{x:0,y:45}]}],
  northDegrees:null,aspectRatio:2,notes:'Synthetic test only',
});
test('reviewed geometry preserves source proportions and original arrays', () => {
  const original=sample(),copy=geometry.cloneGeometry(original);
  const view=geometry.proportionedGeometry(copy);
  assert.equal(view.plots[0].points[0].y,30);
  assert.equal(original.plots[0].points[0].y,10);
  assert.equal(copy.aspectRatio,2);
  const p=geometry.project(10,10,0,geometry.DEFAULT_CAMERA,5);
  assert.ok(Number.isFinite(p.sx)&&Number.isFinite(p.sy));
});
test('confirmation rejects unknown labels until marked plan-only, and unknown widths remain unknown', () => {
  const model=sample();model.roads[0].widthFeet=null;
  assert.ok(geometry.validateGeometry(model,[],true).length>0);
  model.plots[0].referenceOnly=true;
  assert.equal(geometry.validateGeometry(model,[],true).length,0);
  assert.equal(model.roads[0].widthFeet,null);
});
test('confirmed viewer renders SVG and honest unknown labels without changing booking records', () => {
  const model=sample();model.roads[0].widthFeet=null;
  const plots=Object.freeze([Object.freeze({plotNumber:'1',status:'booked',projectId:'test'})]);
  const before=JSON.stringify(plots);
  const html=renderToStaticMarkup(React.createElement(Blueprint3DView,{geometry:model,plots}));
  assert.match(html,/<svg/);assert.match(html,/cadastral survey/i);
  assert.match(html,/unknown/i);assert.match(html,/Rotate|rotate/);
  assert.equal(JSON.stringify(plots),before);
});
