'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const SOURCE = path.resolve(__dirname, '../..');
function run(t, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toantrung-docs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(SOURCE, 'scripts'), path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), body);
  return spawnSync(process.execPath, [path.join(root, 'scripts/check-docs.js')], { cwd: root, encoding: 'utf8' });
}
test('docs check rejects a broken relative link', t => {
  const r = run(t, '# Fixture\n[Missing](missing.md)\n'); assert.equal(r.status, 1, r.stdout + r.stderr);
});
test('docs check rejects a missing Markdown anchor', t => {
  const r = run(t, '# Fixture\n[Missing](#missing)\n'); assert.equal(r.status, 1, r.stdout + r.stderr);
});
test('docs check handles Vietnamese heading anchors and ignores fenced examples', t => {
  const r = run(t, '# Đăng nhập\n[Local](#đăng-nhập)\n\n```md\n[Example](not-a-real-file.md)\n```\n'); assert.equal(r.status, 0, r.stdout + r.stderr);
});
