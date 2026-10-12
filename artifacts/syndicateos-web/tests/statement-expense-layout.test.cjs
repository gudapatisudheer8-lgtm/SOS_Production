const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const sourceRoot = path.resolve(__dirname, '../src') + path.sep;
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    assert.ok(filename.startsWith(sourceRoot));
    const source = fs.readFileSync(filename, 'utf8').replace(/\bimport\.meta\.env\b/g, '({ BASE_URL: "/", DEV: false })');
    module._compile(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: filename,
    }).outputText, filename);
  };
}
global.window = { fetch: global.fetch, location: { search: '', origin: 'http://localhost' } };
const { EnrollExpenseModal } = require('../src/original/components/modals/EnrollExpenseModal.tsx');
const { ProjectStatementModule } = require('../src/original/components/accountant/ProjectStatementModule.tsx');
const { ConfigProvider } = require('../src/adapter/config.tsx');
const render = (element) => renderToStaticMarkup(React.createElement(ConfigProvider, null, element));
const firm = { id: 'firm-a', name: 'Firm A', accountantName: 'Accountant' };
const project = { id: 'project-a', firmId: firm.id, name: 'Venture A', code: 'A', partners: [], financialStatement: [], canRecordDrawings: true };

test('expense modal has a viewport-bounded scroll body and separate wrapping action footer', () => {
  const html = render(React.createElement(EnrollExpenseModal, {
    isOpen: true, firm, project, partners: [], firmAccounts: [],
    onClose: () => {}, onEnrollExpense: () => true,
  }));
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(html, /data-testid="expense-form-scroll" class="[^"]*min-h-0 overflow-y-auto/);
  assert.match(html, /class="p-4 flex flex-wrap[^"]*shrink-0"/);
  assert.match(html, /type="button"[^>]*>Cancel<\/button>/);
  assert.match(html, /type="submit"/);
});

const statement = (extra) => render(React.createElement(ProjectStatementModule, {
  project, firm, accounts: [], fieldExpenses: [], plots: [], apartmentUnits: [],
  partners: [], onOpenEnrollExpenseModal: () => {}, ...extra,
}));
test('partner statement exposes drawing request and expense actions without accountant drawing control', () => {
  const html = statement({ onOpenDrawingRequest: () => {} });
  assert.match(html, /btn-stmt-drawing-request/);
  assert.match(html, /\+ Drawing Request/);
  assert.match(html, /btn-stmt-enroll-expense/);
  assert.doesNotMatch(html, /btn-stmt-record-drawing/);
});
test('accountant statement retains its record partner drawing action', () => {
  const html = statement({ onRecordDrawing: () => true });
  assert.match(html, /btn-stmt-record-drawing/);
  assert.doesNotMatch(html, /btn-stmt-drawing-request/);
});
