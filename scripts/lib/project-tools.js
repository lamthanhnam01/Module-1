'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
class InputError extends Error {}
const MODULES = Object.freeze({
  '01-leads': { route: 'leads', team: 'm01', title: 'Lead và Pipeline' },
  '02-tracking-sync': { route: 'tracking', team: 'm02', title: 'Tracking và đồng bộ' },
  '03-keywords-ads': { route: 'ads', team: 'm03', title: 'Ads, từ khóa và SEO' },
  '04-reports': { route: 'reports', team: 'm04', title: 'Báo cáo' },
  '05-ai-design': { route: 'design', team: 'm05', title: 'AI thiết kế — giai đoạn 2' }
});
function normalizeRepoPath(value, directory = false) {
  if (typeof value !== 'string' || !value || /[\0\r\n]/.test(value)) throw new InputError('Đường dẫn trống hoặc không hợp lệ.');
  const raw = value.replace(/\\/g, '/');
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw) || raw.split('/').includes('..') || /[*?]/.test(raw)) throw new InputError(`Đường dẫn phải nằm trong repo, không dùng .. hoặc wildcard: ${value}`);
  const clean = path.posix.normalize(raw).replace(/^\.\//, '').replace(/\/$/, '');
  if (!clean || clean === '.') throw new InputError('Không được mở phạm vi toàn repo.');
  return clean + (directory && raw.endsWith('/') ? '/' : '');
}
function moduleInfo(key) {
  if (!Object.hasOwn(MODULES, key)) throw new InputError(`Module không hợp lệ: ${key}`);
  return MODULES[key];
}
function modulePaths(key) {
  const { route, team } = moduleInfo(key);
  return [
    `apps/web/src/modules/${key}/`, `apps/web/src/app/(workspace)/${route}/`,
    `apps/api/src/modules/${key}/`, `apps/api/src/app/api/v1/${route}/`,
    `packages/contracts/src/${key}/`, `packages/database/prisma/models/${key}.prisma`,
    `tests/e2e/${key}/`, `tests/fixtures/${key}/`,
    `docs/modules/${key}.md`, `docs/handoffs/${key}.md`, `docs/tasks/${team}/`
  ];
}
function matches(file, rule) {
  return rule.endsWith('/') ? file === rule.slice(0, -1) || file.startsWith(rule) : file === rule;
}
const SHARED_DIRS = [
  'apps/web/src/core/', 'apps/web/src/app/(auth)/', 'apps/web/public/brand/',
  'apps/web/src/app/(workspace)/notifications/', 'apps/web/src/app/(workspace)/profile/',
  'apps/web/src/app/(workspace)/dashboard/', 'apps/web/src/app/(workspace)/settings/',
  'apps/web/src/app/(workspace)/admin/', 'apps/web/src/app/api/',
  'apps/api/src/core/', 'apps/api/src/workers/', 'apps/api/src/app/api/v1/auth/',
  'apps/api/src/app/api/v1/users/', 'apps/api/src/app/api/v1/notifications/',
  'apps/api/src/app/api/v1/profile/', 'apps/api/src/app/api/v1/settings/',
  'packages/database/src/', 'packages/database/scripts/', 'packages/database/prisma/migrations/',
  'packages/contracts/src/common/', 'tests/e2e/auth/', 'tests/tooling/',
  'infra/', 'scripts/', '.github/', 'docs/database/', 'docs/decisions/', 'docs/reviews/', 'docs/design/', 'docs/runbooks/'
];
const SHARED_FILES = new Set([
  'AGENTS.md', 'AI_START_HERE.md', 'AI_CONTEXT.md', 'PROJECT_MEMORY.md', 'README.md', '.gitignore', '.env.example',
  '.editorconfig', 'package.json', 'package-lock.json', 'tsconfig.base.json',
  'apps/web/package.json', 'apps/api/package.json', 'packages/database/package.json', 'packages/contracts/package.json',
  'apps/web/postcss.config.js', 'apps/web/tailwind.config.ts', 'apps/web/next-env.d.ts', 'apps/api/next-env.d.ts',
  'apps/web/src/app/layout.tsx', 'apps/web/src/app/page.tsx', 'apps/web/src/app/globals.css', 'apps/web/src/middleware.ts',
  'apps/web/src/app/(workspace)/layout.tsx', 'apps/api/src/app/layout.tsx',
  'packages/database/prisma/schema.prisma', 'packages/database/prisma/models/core.prisma',
  'packages/database/prisma.config.ts'
]);
function validateSharedPath(value) {
  const normalized = normalizeRepoPath(value, true);
  if (!SHARED_FILES.has(normalized) && !SHARED_DIRS.some(dir => matches(normalized.replace(/\/$/, ''), dir)) &&
      !/^docs\/[^/]+\.md$/.test(normalized) &&
      !/^apps\/(web|api)\/(next\.config\.(js|mjs|ts)|tsconfig\.json|eslint\.config\.(js|mjs))$/.test(normalized)) {
    throw new InputError(`Phần dùng chung quá rộng hoặc không được nhận diện: ${value}. Không dùng mục này để mở module khác.`);
  }
  return normalized;
}
function git(root, args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }); }
  catch { throw new InputError(`Không đọc được Git (${args[0]}). Kiểm tra repo/ref; không dùng mtime thay thế.`); }
}
function assertGitRoot(root) {
  const top = git(root, ['rev-parse', '--show-toplevel']).trim();
  const realTop = (fs.realpathSync.native ? fs.realpathSync.native(top) : fs.realpathSync(top));
  const realRoot = (fs.realpathSync.native ? fs.realpathSync.native(root) : fs.realpathSync(root));
  if (process.platform === 'win32' ? realTop.toLowerCase() !== realRoot.toLowerCase() : realTop !== realRoot) {
    throw new InputError('Thư mục hiện tại phải là root Git của dự án.');
  }
}
function commitRef(root, ref) {
  if (typeof ref !== 'string' || !ref || /[\0\r\n]/.test(ref)) throw new InputError('Git ref không hợp lệ.');
  return git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
}
function changedPaths(root, { base, head } = {}) {
  assertGitRoot(root);
  let output;
  if (base) {
    const from = commitRef(root, base); const to = commitRef(root, head || 'HEAD');
    const ancestor = git(root, ['merge-base', from, to]).trim();
    output = git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', ancestor, to, '--']);
  } else {
    output = git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', '--']) +
      git(root, ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', '--']) +
      git(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  }
  return [...new Set(output.split('\0').filter(Boolean).map(p => normalizeRepoPath(p)))].sort();
}
function safeText(root, relative, maxBytes = 16000) {
  const name = normalizeRepoPath(relative);
  const full = path.join(root, name);
  let real;
  try { real = fs.realpathSync(full); } catch { throw new InputError(`Thiếu file: ${name}`); }
  const rel = path.relative(fs.realpathSync(root), real);
  if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) throw new InputError(`File trỏ ra ngoài repo: ${name}`);
  const info = fs.statSync(real);
  if (!info.isFile() || info.size > maxBytes) throw new InputError(`File ${name} vượt giới hạn ${maxBytes} byte hoặc không phải file.`);
  return fs.readFileSync(real, 'utf8').replace(/^\uFEFF/, '');
}
function validateTask(task, { allowTemplate = false } = {}) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) throw new InputError('Task phải là JSON object.');
  const fields = new Set(['schemaVersion', 'id', 'status', 'modules', 'title', 'goal', 'acceptanceCriteria', 'allowedSharedPaths', 'readWhenNeeded', 'notes']);
  for (const key of Object.keys(task)) if (!fields.has(key)) throw new InputError(`Trường task không hỗ trợ: ${key}`);
  if (task.schemaVersion !== 1) throw new InputError('Task cần schemaVersion: 1.');
  for (const key of ['id', 'title', 'goal']) if (typeof task[key] !== 'string' || !task[key].trim() || task[key].length > 2000) throw new InputError(`Task thiếu/sai ${key}.`);
  if (!['template', 'ready', 'completed', 'blocked'].includes(task.status)) throw new InputError('Trạng thái task không hợp lệ.');
  if (!allowTemplate && !['ready', 'completed'].includes(task.status)) throw new InputError('Task chưa ready; template/blocked không cấp phạm vi chỉnh sửa.');
  if (!Array.isArray(task.modules) || task.modules.length < 1 || task.modules.length > 5 || new Set(task.modules).size !== task.modules.length) throw new InputError('Task cần 1–5 module duy nhất.');
  task.modules.forEach(moduleInfo);
  if (!Array.isArray(task.acceptanceCriteria) || task.acceptanceCriteria.length > 12 || task.acceptanceCriteria.some(s => typeof s !== 'string' || !s.trim() || s.length > 2000)) throw new InputError('acceptanceCriteria không hợp lệ.');
  if (['ready', 'completed'].includes(task.status) && !task.acceptanceCriteria.length) throw new InputError('Task ready cần tiêu chí nghiệm thu.');
  if (!Array.isArray(task.allowedSharedPaths) || task.allowedSharedPaths.length > 20) throw new InputError('Cần allowedSharedPaths dạng mảng, tối đa 20.');
  task.allowedSharedPaths.forEach(validateSharedPath);
  if (task.readWhenNeeded !== undefined && (!Array.isArray(task.readWhenNeeded) || task.readWhenNeeded.length > 12 || task.readWhenNeeded.some(p => !normalizeRepoPath(p).endsWith('.md')))) throw new InputError('readWhenNeeded chỉ nhận tối đa 12 đường dẫn .md.');
  if (task.notes !== undefined && (typeof task.notes !== 'string' || task.notes.length > 2000)) throw new InputError('notes quá dài hoặc không phải chuỗi.');
  return task;
}
function readTask(root, relative, options = {}) {
  const name = normalizeRepoPath(relative);
  if (!name.startsWith('docs/tasks/') || !name.endsWith('.json')) throw new InputError('Task phải là file JSON trong docs/tasks/.');
  let body;
  if (options.policyRef) {
    assertGitRoot(root);
    body = git(root, ['show', `${commitRef(root, options.policyRef)}:${name}`]);
    if (Buffer.byteLength(body) > 16000) throw new InputError('Task vượt 16000 byte.');
  } else body = safeText(root, name, 16000);
  let task;
  try { task = JSON.parse(body.replace(/^\uFEFF/, '')); } catch { throw new InputError(`JSON không hợp lệ: ${name}`); }
  return validateTask(task, options);
}
function allowedPaths(modules, shared = []) {
  return [...new Set([...modules.flatMap(modulePaths), ...shared.map(validateSharedPath)])];
}
module.exports = { InputError, MODULES, normalizeRepoPath, moduleInfo, modulePaths, matches, validateSharedPath, git, assertGitRoot, commitRef, changedPaths, safeText, validateTask, readTask, allowedPaths };
