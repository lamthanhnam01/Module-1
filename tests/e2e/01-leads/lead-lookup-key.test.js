'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourcePath = path.resolve(
  __dirname,
  '../../../apps/api/src/modules/01-leads/lead-lookup-key.ts'
);

const source = fs.readFileSync(sourcePath, 'utf8');

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const moduleObject = { exports: {} };
new Function('module', 'exports', compiled)(
  moduleObject,
  moduleObject.exports
);

const { buildNormalizedLookupKey } = moduleObject.exports;

test('Ưu tiên tên công ty và bỏ dấu tiếng Việt', () => {
  assert.equal(
    buildNormalizedLookupKey('Công Ty Ánh Dương', 'Dự án LED'),
    'cong ty anh duong'
  );
});

test('Dùng tên dự án khi tên công ty trống', () => {
  assert.equal(
    buildNormalizedLookupKey(null, 'Màn Hình LED'),
    'man hinh led'
  );
});

test('Trả về null khi cả hai tên đều trống', () => {
  assert.equal(
    buildNormalizedLookupKey('  ', null),
    null
  );
});

test('Chuẩn hóa chữ Đ, dấu câu và khoảng trắng', () => {
  assert.equal(
    buildNormalizedLookupKey('  Điện   Máy - Đà Nẵng!  ', null),
    'dien may da nang'
  );
});
