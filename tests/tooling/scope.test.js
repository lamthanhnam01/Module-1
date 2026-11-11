'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');

const SOURCE = path.resolve(__dirname, '../..');
function fixture(t, git = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toantrung-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(SOURCE, 'scripts'), path.join(root, 'scripts'), { recursive: true });
  write(root, 'docs/tasks/ACTIVE_TASK.json', JSON.stringify({
    activeModule: '01-leads', allowSharedCore: false,
    allowedDirectories: ['apps/api/src/modules/01-leads'], alwaysAllowed: []
  }));
  write(root, 'README.md', 'Test fixture only\n');
  if (git) {
    command(root, ['init', '--quiet']);
    commit(root);
  }
  return root;
}
function write(root, file, body = 'fixture\n') {
  const p = path.join(root, file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, body);
}
function command(root, args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function commit(root) {
  command(root, ['add', '-A']);
  command(root, ['-c', 'user.name=Scope Test Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'Isolated test fixture']);
  return command(root, ['rev-parse', 'HEAD']);
}
function check(root, args) {
  return spawnSync(process.execPath, [path.join(root, 'scripts/check-scope.js'), ...args], { cwd: root, encoding: 'utf8' });
}
function exit(result, expected) { assert.equal(result.status, expected, result.stdout + result.stderr); }

test('M01 accepts its own source path', t => {
  exit(check(fixture(t, false), ['--module', '01-leads', '--files', 'apps/api/src/modules/01-leads/a.ts']), 0);
});
test('selecting M02 does not carry M01 paths from the old global config', t => {
  exit(check(fixture(t, false), ['--module', '02-tracking-sync', '--files', 'apps/api/src/modules/01-leads/a.ts']), 1);
});
test('M02 accepts its own source path', t => {
  exit(check(fixture(t, false), ['--module', '02-tracking-sync', '--files', 'apps/api/src/modules/02-tracking-sync/a.ts']), 0);
});
test('unknown module is a configuration error', t => {
  exit(check(fixture(t, false), ['--module', 'unknown', '--files', 'apps/api/src/modules/01-leads/a.ts']), 2);
});
test('each module can change its own model without opening all DB paths', t => {
  exit(check(fixture(t, false), ['--module', '01-leads', '--files', 'packages/database/prisma/models/01-leads.prisma']), 0);
});
test('other module model is rejected', t => {
  exit(check(fixture(t, false), ['--module', '01-leads', '--files', 'packages/database/prisma/models/02-tracking-sync.prisma']), 1);
});
test('parent traversal in an explicit path is rejected', t => {
  exit(check(fixture(t, false), ['--module', '01-leads', '--files', 'apps/api/src/modules/01-leads/../02-tracking-sync/a.ts']), 2);
});
test('a similar directory name is not a module prefix', t => {
  exit(check(fixture(t, false), ['--module', '01-leads', '--files', 'apps/api/src/modules/01-leads-other/a.ts']), 1);
});
test('real Git unstaged path retains its first character', t => {
  const root = fixture(t); write(root, 'apps/api/src/modules/01-leads/a.ts', 'before\n'); commit(root);
  write(root, 'apps/api/src/modules/01-leads/a.ts', 'after\n');
  exit(check(root, ['--module', '01-leads']), 0);
});
test('real Git staged names with spaces and Vietnamese are handled', t => {
  const root = fixture(t); write(root, 'apps/api/src/modules/01-leads/hồ sơ khách.ts'); command(root, ['add', '-A']);
  exit(check(root, ['--module', '01-leads']), 0);
});
test('nested untracked files are collected individually', t => {
  const root = fixture(t); write(root, 'apps/api/src/modules/01-leads/new/deep/a.ts');
  exit(check(root, ['--module', '01-leads']), 0);
});
test('rename from another module checks both old and new paths', t => {
  const root = fixture(t); write(root, 'apps/api/src/modules/02-tracking-sync/old.ts'); commit(root);
  fs.mkdirSync(path.join(root, 'apps/api/src/modules/01-leads'), { recursive: true });
  command(root, ['mv', 'apps/api/src/modules/02-tracking-sync/old.ts', 'apps/api/src/modules/01-leads/new.ts']);
  exit(check(root, ['--module', '01-leads']), 1);
});
test('base/head mode sees committed changes even with a clean worktree', t => {
  const root = fixture(t); const base = command(root, ['rev-parse', 'HEAD']);
  write(root, 'apps/api/src/modules/02-tracking-sync/a.ts'); commit(root);
  assert.equal(command(root, ['status', '--porcelain']), '');
  exit(check(root, ['--module', '01-leads', '--base', base, '--head', 'HEAD']), 1);
});
test('no Git in automatic collection is an error, not an mtime fallback', t => {
  exit(check(fixture(t, false), ['--module', '01-leads']), 2);
});
test('scope must be chosen explicitly', t => {
  exit(check(fixture(t), []), 2);
});
test('directory siblings are not covered by an exact shared file allowance', t => {
  const root = fixture(t, false);
  write(root, 'docs/tasks/m01/ready.json', JSON.stringify({ schemaVersion: 1, id: 'M01-1', status: 'ready', modules: ['01-leads'], title: 'Test', goal: 'Test scope', acceptanceCriteria: ['Pass fixture'], allowedSharedPaths: ['apps/api/src/core/http/errors.ts'] }));
  exit(check(root, ['--task', 'docs/tasks/m01/ready.json', '--files', 'apps/api/src/core/http/errors.ts']), 0);
  exit(check(root, ['--task', 'docs/tasks/m01/ready.json', '--files', 'apps/api/src/core/http/other.ts']), 1);
});
test('template task is not permission to edit source', t => {
  const root = fixture(t, false);
  write(root, 'docs/tasks/m01/template.json', JSON.stringify({ schemaVersion: 1, id: 'M01-X', status: 'template', modules: ['01-leads'], title: 'Template', goal: 'Not assigned', acceptanceCriteria: [], allowedSharedPaths: [] }));
  exit(check(root, ['--task', 'docs/tasks/m01/template.json', '--files', 'apps/api/src/modules/01-leads/a.ts']), 2);
});
test('malformed task fails closed', t => {
  const root = fixture(t, false); write(root, 'docs/tasks/m01/bad.json', '{invalid');
  exit(check(root, ['--task', 'docs/tasks/m01/bad.json', '--files', 'apps/api/src/modules/01-leads/a.ts']), 2);
});
test('module and task selectors cannot silently merge', t => {
  exit(check(fixture(t, false), ['--module', '02-tracking-sync', '--task', 'docs/tasks/m01/ready.json', '--files', 'apps/api/src/modules/01-leads/a.ts']), 2);
});
test('policy-ref uses the reviewed task version rather than a modified worktree policy', t => {
  const root = fixture(t);
  const policy = { schemaVersion: 1, id: 'M01-1', status: 'ready', modules: ['01-leads'], title: 'Test', goal: 'Test scope', acceptanceCriteria: ['Pass fixture'], allowedSharedPaths: [] };
  write(root, 'docs/tasks/m01/ready.json', JSON.stringify(policy)); const base = commit(root);
  policy.allowedSharedPaths = ['AGENTS.md'];
  write(root, 'docs/tasks/m01/ready.json', JSON.stringify(policy)); write(root, 'AGENTS.md', 'Changed rule\n'); commit(root);
  exit(check(root, ['--task', 'docs/tasks/m01/ready.json', '--policy-ref', base, '--base', base, '--head', 'HEAD']), 1);
});
