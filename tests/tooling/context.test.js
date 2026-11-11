'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const SOURCE = path.resolve(__dirname, '../..');
const modules = ['01-leads', '02-tracking-sync', '03-keywords-ads', '04-reports', '05-ai-design'];
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toantrung-context-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(SOURCE, 'scripts'), path.join(root, 'scripts'), { recursive: true });
  for (const name of ['AGENTS.md', 'AI_CONTEXT.md']) fs.copyFileSync(path.join(SOURCE, name), path.join(root, name));
  for (const key of modules) write(root, `docs/handoffs/${key}.md`, `# Handoff ${key}\nCurrent state ${key}\n`);
  return root;
}
function write(root, file, body) { const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, body); }
function generate(root, args) { return spawnSync(process.execPath, [path.join(root, 'scripts/prepare-context.js'), ...args], { cwd: root, encoding: 'utf8' }); }
function exit(result, expected) { assert.equal(result.status, expected, result.stdout + result.stderr); }
function policy(status = 'ready') { return { schemaVersion: 1, id: 'M01-T', title: 'Scoped fixture task', goal: 'Test context boundary', status, modules: ['01-leads'], acceptanceCriteria: ['Bounded context'], allowedSharedPaths: [], readWhenNeeded: ['docs/reference.md'] }; }
for (const key of modules) test(`context includes only selected handoff for ${key}`, t => {
  const root = fixture(t);
  write(root, 'docs/reference.md', 'REFERENCE_CANARY_MUST_NOT_APPEAR');
  write(root, 'apps/api/src/modules/' + key + '/large.ts', 'SOURCE_CANARY_MUST_NOT_APPEAR');
  const result = generate(root, ['--module', key]); exit(result, 0);
  assert.ok(result.stdout.includes('Current state ' + key));
  for (const other of modules.filter(m => m !== key)) assert.ok(!result.stdout.includes('Current state ' + other));
  assert.ok(!result.stdout.includes('CANARY_MUST_NOT_APPEAR'));
  assert.ok(result.stdout.includes('NOT_INITIALIZED_OR_NOT_ROOT'));
  assert.ok(Buffer.byteLength(result.stdout) <= 18000);
});
test('task context lists optional references without reading their contents', t => {
  const root = fixture(t); write(root, 'docs/tasks/m01/ready.json', JSON.stringify(policy()));
  write(root, 'docs/reference.md', Buffer.from([0xff, 0xfe]));
  const result = generate(root, ['--task', 'docs/tasks/m01/ready.json']); exit(result, 0);
  assert.ok(result.stdout.includes('Test context boundary'));
  assert.ok(result.stdout.includes('docs/reference.md'));
  assert.ok(result.stdout.includes('sha256'));
});
test('template context explicitly warns it is not a ready task', t => {
  const root = fixture(t); write(root, 'docs/tasks/m01/template.json', JSON.stringify(policy('template')));
  const result = generate(root, ['--task', 'docs/tasks/m01/template.json']); exit(result, 0);
  assert.ok(result.stdout.includes('không ở trạng thái ready'));
});
test('too small budget fails without silently truncating or writing a packet', t => {
  const root = fixture(t); const result = generate(root, ['--module', '01-leads', '--max-bytes', '2000', '--out', '.ai-context/small.md']);
  exit(result, 2); assert.ok(!fs.existsSync(path.join(root, '.ai-context/small.md')));
});
test('output is constrained to generated context directory', t => {
  const root = fixture(t); const before = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  exit(generate(root, ['--module', '01-leads', '--out', 'AGENTS.md']), 2);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), before);
});
test('missing handoff fails rather than constructing a false state', t => {
  const root = fixture(t); fs.unlinkSync(path.join(root, 'docs/handoffs/01-leads.md'));
  exit(generate(root, ['--module', '01-leads']), 2);
});
test('changed context updates the input hash in a newly generated packet', t => {
  const root = fixture(t); const before = generate(root, ['--module', '01-leads']); exit(before, 0);
  write(root, 'docs/handoffs/01-leads.md', '# Handoff\nNEW_STATE\n');
  const after = generate(root, ['--module', '01-leads', '--out', '.ai-context/new.md']); exit(after, 0);
  const content = fs.readFileSync(path.join(root, '.ai-context/new.md'), 'utf8');
  const parseHashes = body => JSON.parse(body.slice(body.lastIndexOf('```json') + 7, body.lastIndexOf('```')));
  assert.notEqual(parseHashes(before.stdout).find(x => x.path.includes('handoffs')).sha256, parseHashes(content).find(x => x.path.includes('handoffs')).sha256);
  assert.ok(content.includes('NEW_STATE'));
});
test('output directory symlink cannot escape the repo', t => {
  const root = fixture(t); const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'toantrung-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  try {
    fs.symlinkSync(outside, path.join(root, '.ai-context'), 'dir');
  } catch (err) {
    if (err && err.code === 'EPERM') return t.skip('Windows symlink requires elevated privileges');
    throw err;
  }
  exit(generate(root, ['--module', '01-leads', '--out', '.ai-context/escape.md']), 2);
  assert.ok(!fs.existsSync(path.join(outside, 'escape.md')));
});
test('a required input symlink outside the repo is rejected', t => {
  const root = fixture(t); const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'toantrung-input-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'rules.md'), 'EXTERNAL_RULES');
  fs.unlinkSync(path.join(root, 'AGENTS.md'));
  try {
    fs.symlinkSync(path.join(outside, 'rules.md'), path.join(root, 'AGENTS.md'));
  } catch (err) {
    if (err && err.code === 'EPERM') return t.skip('Windows symlink requires elevated privileges');
    throw err;
  }
  exit(generate(root, ['--module', '01-leads']), 2);
});

test('a dangling output symlink is rejected before it can create an external target', t => {
  const root = fixture(t); const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'toantrung-dangling-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.ai-context'));
  try {
    fs.symlinkSync(path.join(outside, 'missing.md'), path.join(root, '.ai-context/dangling.md'));
  } catch (err) {
    if (err && err.code === 'EPERM') return t.skip('Windows symlink requires elevated privileges');
    throw err;
  }
  exit(generate(root, ['--module', '01-leads', '--out', '.ai-context/dangling.md']), 2);
  assert.ok(!fs.existsSync(path.join(outside, 'missing.md')));
});
test('links from root rules and nested handoffs are rebased in generated output', t => {
  const root = fixture(t);
  write(root, 'docs/handoffs/01-leads.md', '# Handoff\n[Details](../modules/01-leads.md)\n');
  exit(generate(root, ['--module', '01-leads', '--out', '.ai-context/task.md']), 0);
  const content = fs.readFileSync(path.join(root, '.ai-context/task.md'), 'utf8');
  assert.ok(content.includes('[AI_CONTEXT](../AI_CONTEXT.md)'));
  assert.ok(content.includes('[Details](../docs/modules/01-leads.md)'));
});
