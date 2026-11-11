'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { InputError, normalizeRepoPath, moduleInfo, modulePaths, readTask, safeText, assertGitRoot, git, changedPaths } = require('./lib/project-tools');
const HELP = `Tạo ngữ cảnh nhỏ, chỉ đọc quy tắc, bối cảnh, task và handoff module.
  node scripts/prepare-context.js --module 01-leads --out .ai-context/m01.md
  node scripts/prepare-context.js --task docs/tasks/m01/task.local.json --out .ai-context/task.md
Tùy chọn --max-bytes 18000 (2000..30000). Không có --out: in nội dung.
Không đọc source nghiệp vụ, tài liệu BA chi tiết, ảnh/PDF hoặc lockfile.`;
function parse(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!['--module', '--task', '--out', '--max-bytes'].includes(key) || Object.hasOwn(opts, key)) throw new InputError(`Tham số lạ hoặc lặp: ${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new InputError(`${key} thiếu giá trị.`);
    opts[key] = value;
  }
  if (Number(!!opts['--module']) + Number(!!opts['--task']) !== 1) throw new InputError('Chọn đúng một --module hoặc --task.');
  const limit = opts['--max-bytes'] === undefined ? 18000 : Number(opts['--max-bytes']);
  if (!Number.isInteger(limit) || limit < 2000 || limit > 30000) throw new InputError('--max-bytes phải là số nguyên 2000..30000.');
  return { ...opts, limit };
}
function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log(HELP); return; }
  const opts = parse(args); const root = process.cwd();
  const task = opts['--task'] ? readTask(root, opts['--task'], { allowTemplate: true }) : undefined;
  const modules = task ? task.modules : [opts['--module']]; modules.forEach(moduleInfo);
  const outputName = opts['--out'] ? normalizeRepoPath(opts['--out']) : undefined;
  if (outputName && (!outputName.startsWith('.ai-context/') || !outputName.endsWith('.md'))) throw new InputError('--out phải là .ai-context/<tên>.md.');
  function packetLinks(body, sourceName) {
    return body.replace(/(!?\[[^\]\n]*\]\()(<[^>\n]+>|[^\s)]+)(\))/g, (whole, before, target, after) => {
      const angled = target.startsWith('<'); const raw = angled ? target.slice(1, -1) : target;
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith('/')) return whole;
      const hash = raw.indexOf('#'); const file = hash === -1 ? raw : raw.slice(0, hash); const fragment = hash === -1 ? '' : raw.slice(hash);
      const resolved = file ? path.posix.join(path.posix.dirname(sourceName), file) : sourceName;
      const link = path.posix.relative(outputName ? path.posix.dirname(outputName) : '.', resolved) + fragment;
      return before + (angled ? '<' + link + '>' : link) + after;
    });
  }
  const inputs = [];
  function include(name, limit) {
    const body = safeText(root, name, limit);
    inputs.push({ path: name, bytes: Buffer.byteLength(body), sha256: crypto.createHash('sha256').update(body).digest('hex') });
    return `\n## ${name}\n\n${packetLinks(body.trim(), name)}\n`;
  }
  let snapshot = { state: 'NOT_INITIALIZED_OR_NOT_ROOT' };
  try {
    assertGitRoot(root);
    const files = changedPaths(root);
    snapshot = { state: 'GIT', head: git(root, ['rev-parse', 'HEAD']).trim(), branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(), changedCount: files.length, changedPathsFirst20: files.slice(0, 20) };
  } catch { /* A folder scaffold is valid without Git. Do not claim a clean worktree. */ }
  let body = '# Ngữ cảnh task Toàn Trung\n\n' +
    'Gói tóm tắt để đọc có chọn lọc. Quy tắc trong repo và yêu cầu người dùng vẫn là nguồn hiện tại.\n' +
    'Chỉ mở source/caller và tài liệu chi tiết liên quan khi task cần. Đừng coi tóm tắt là bằng chứng code đã hoạt động.\n' +
    `\nTạo UTC: ${new Date().toISOString()}\n\nGit snapshot:\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\`\n`;
  if (task) {
    const text = safeText(root, opts['--task'], 16000);
    inputs.push({ path: opts['--task'], bytes: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex') });
    body += `\n## Task\n\n\`\`\`json\n${JSON.stringify(task, null, 2)}\n\`\`\`\n`;
    if (task.status !== 'ready') body += '\nTask không ở trạng thái ready: chỉ định hướng/bàn giao, không tự tiếp tục sửa source.\n';
  } else body += '\nChưa có task cụ thể. Chỉ định hướng module; không tự triển khai chức năng.\n';
  body += include('AGENTS.md', 6500) + include('AI_CONTEXT.md', 5000);
  for (const module of modules) {
    body += include(`docs/handoffs/${module}.md`, 4500);
    body += `\n### Đường dẫn ${module}\n\n` + modulePaths(module).map(p => `- \`${p}\``).join('\n') + '\n';
  }
  const references = [...new Set([...modules.map(m => `docs/modules/${m}.md`), ...(task?.readWhenNeeded || []), 'docs/PERMISSIONS.md', 'docs/API_CONTRACTS.md', 'docs/decisions/OPEN_QUESTIONS.md'])];
  body += '\n## Chỉ mở khi task cần\n\n' + references.map(p => `- \`${p}\``).join('\n') + '\n';
  body += '\n## Độ mới\n\nHash dưới đây chỉ bao phủ các file ngữ cảnh đã nạp, không bao phủ source. Kiểm tra Git/file thật trước khi sửa; tạo lại gói khi HEAD, task hoặc handoff thay đổi.\n';
  body += '\n```json\n' + JSON.stringify(inputs, null, 2) + '\n```\n';
  const bytes = Buffer.byteLength(body);
  if (bytes > opts.limit) throw new InputError(`Gói ${bytes} byte vượt ngân sách ${opts.limit}; thu gọn handoff/task hoặc chọn ít module hơn. Không cắt quy tắc âm thầm.`);
  if (!opts['--out']) { process.stdout.write(body); return; }
  const out = outputName;
  if (!out.startsWith('.ai-context/') || !out.endsWith('.md')) throw new InputError('--out phải là .ai-context/<tên>.md.');
  const full = path.join(root, out); const dir = path.dirname(full);
  // Check existing ancestors before mkdir to avoid following a symlink out of the repo.
  let parent = dir;
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  const relative = path.relative(fs.realpathSync(root), fs.realpathSync(parent));
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw new InputError('Output trỏ ra ngoài repo.');
  let outputStat;
  try { outputStat = fs.lstatSync(full); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (outputStat?.isSymbolicLink()) throw new InputError('Không ghi đè output symlink.');
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(full, body);
  console.log(`Đã tạo ${out}: ${bytes} byte, ${inputs.length} file ngữ cảnh. Byte không phải số token. Git: ${snapshot.state}.`);
}
try { main(); } catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 2; }
