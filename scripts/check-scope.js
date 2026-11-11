'use strict';
const { InputError, normalizeRepoPath, moduleInfo, changedPaths, readTask, allowedPaths, matches } = require('./lib/project-tools');
const HELP = `Kiểm tra phạm vi đường dẫn, không tự sửa/xóa file.
  node scripts/check-scope.js --module 01-leads
  node scripts/check-scope.js --task docs/tasks/m01/task.local.json
  node scripts/check-scope.js --module 01-leads --base origin/main --head HEAD
  node scripts/check-scope.js --task docs/tasks/m01/M01-123.json --policy-ref origin/main --base origin/main
  node scripts/check-scope.js --module 01-leads --files <path> [<path>...]
--files chỉ kiểm tra danh sách cung cấp, không chứng minh toàn bộ diff.
Exit 0: các path đã xét hợp lệ; 1: ngoài phạm vi; 2: lỗi input/Git/config.`;
function parse(argv) {
  const opts = {}; const known = new Set(['--module', '--task', '--base', '--head', '--policy-ref', '--files']);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!known.has(flag) || Object.hasOwn(opts, flag)) throw new InputError(`Tham số lạ hoặc lặp: ${flag}`);
    if (flag === '--files') {
      const values = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) values.push(argv[++i]);
      if (!values.length) throw new InputError('--files cần ít nhất một đường dẫn.');
      opts[flag] = values;
    } else {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new InputError(`${flag} thiếu giá trị.`);
      opts[flag] = value;
    }
  }
  if (Number(!!opts['--module']) + Number(!!opts['--task']) !== 1) throw new InputError('Chọn đúng một --module hoặc --task.');
  if (opts['--head'] && !opts['--base']) throw new InputError('--head cần --base.');
  if (opts['--policy-ref'] && !opts['--task']) throw new InputError('--policy-ref cần --task.');
  if (opts['--files'] && (opts['--base'] || opts['--head'])) throw new InputError('Không trộn --files với --base/--head.');
  return opts;
}
function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log(HELP); return; }
  const opts = parse(args); const root = process.cwd();
  const task = opts['--task'] ? readTask(root, opts['--task'], { policyRef: opts['--policy-ref'] }) : undefined;
  const modules = task ? task.modules : [opts['--module']]; modules.forEach(moduleInfo);
  const rules = allowedPaths(modules, task ? task.allowedSharedPaths : []);
  const files = opts['--files'] ? opts['--files'].map(p => normalizeRepoPath(p)) : changedPaths(root, { base: opts['--base'], head: opts['--head'] });
  console.log(`Phạm vi: ${modules.join(', ')}. Nguồn policy: ${opts['--policy-ref'] || 'working tree/CLI'}.`);
  console.log(`Chế độ: ${opts['--files'] ? 'danh sách thủ công' : opts['--base'] ? 'diff từ merge-base đến head' : 'staged + unstaged + untracked'}. Đã xét ${files.length} đường dẫn.`);
  const violations = files.filter(file => !rules.some(rule => matches(file, rule)));
  if (violations.length) {
    console.error('Ngoài phạm vi:\n' + violations.map(file => `  ${file}`).join('\n'));
    console.error('Giữ nguyên thay đổi của người khác. Đọc diff, báo đúng nguồn và giới hạn; không tự revert/xóa hoặc tự nới policy để qua check.');
    process.exitCode = 1;
  } else console.log('PASS cho các đường dẫn đã xét; không kết luận build, nghiệp vụ hoặc toàn repo sạch.');
}
try { main(); } catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 2; }
