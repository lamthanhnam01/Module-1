'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const { validateTask } = require('./lib/project-tools');
const root = process.cwd();
const ignored = new Set(['.git', 'node_modules', '.next', '.ai-context', 'dist', 'build', 'coverage', 'storage', 'package-lock.json']);
function filesAt(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...filesAt(p)); else if (entry.isFile()) files.push(p);
  }
  return files;
}
function text(file) { return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file)).replace(/^\uFEFF/, ''); }
function outside(file) { const rel = path.relative(root, file); return rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel); }
function stripFences(body, errors, file) {
  let open = null;
  const lines = body.split('\n');
  return lines.map(line => {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (!open) open = { char: fence[1][0], size: fence[1].length };
      else if (fence[1][0] === open.char && fence[1].length >= open.size && !fence[2].trim()) open = null;
      return '';
    }
    return open ? '' : line;
  }).join('\n') + (open ? (errors.push(`${file}: code fence chưa đóng`), '') : '');
}
function anchors(body) {
  const result = new Set(); const used = new Map();
  for (const line of body.split('\n')) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const slug = heading[1].toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{M}\p{N}_\s-]/gu, '').replace(/\s/g, '-');
      const count = used.get(slug) || 0; used.set(slug, count + 1); result.add(slug + (count ? `-${count}` : ''));
    }
    for (const m of line.matchAll(/\bid=["']([^"']+)["']/g)) result.add(m[1]);
  }
  return result;
}
function main() {
  const errors = []; const files = filesAt(root); const markdown = files.filter(p => p.endsWith('.md')); const cache = new Map();
  for (const file of markdown) {
    try { const body = stripFences(text(file), errors, path.relative(root, file)); cache.set(file, { body, anchors: anchors(body) }); }
    catch { errors.push(`${path.relative(root, file)}: không đọc được UTF-8`); }
  }
  let links = 0; let jsonCount = 0; let tasks = 0;
  for (const [file, { body }] of cache) {
    // Inline Markdown links/images, including angle-bracket destinations. Fenced examples are excluded.
    for (const match of body.matchAll(/!?\[[^\]\n]*\]\((<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\)/g)) {
      let target = match[1].replace(/^<|>$/g, '');
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) || target.startsWith('//')) continue;
      try { target = decodeURIComponent(target); } catch { errors.push(`${path.relative(root, file)}: URL encoding sai`); continue; }
      const split = target.indexOf('#');
      const part = split === -1 ? target : target.slice(0, split); const anchor = split === -1 ? '' : target.slice(split + 1);
      const dest = part ? path.resolve(path.dirname(file), part) : file;
      links++;
      if (outside(dest) || !fs.existsSync(dest)) { errors.push(`${path.relative(root, file)}: thiếu link ${target}`); continue; }
      const real = fs.realpathSync(dest);
      if (outside(real)) { errors.push(`${path.relative(root, file)}: link ra ngoài repo ${target}`); continue; }
      if (anchor && dest.endsWith('.md') && !cache.get(dest)?.anchors.has(anchor)) errors.push(`${path.relative(root, file)}: thiếu anchor ${target}`);
    }
  }
  for (const file of files.filter(p => p.endsWith('.json'))) {
    const name = path.relative(root, file).replace(/\\/g, '/');
    try {
      const value = JSON.parse(text(file)); jsonCount++;
      if (name.startsWith('docs/tasks/') && name.endsWith('.json')) { validateTask(value, { allowTemplate: true }); tasks++; }
    } catch (error) { errors.push(`${name}: JSON/task sai (${error.message})`); }
  }
  console.log(`Đã xét ${markdown.length} Markdown, ${links} link nội bộ inline, ${jsonCount} JSON và ${tasks} task.`);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('PASS: UTF-8, code fence, đường dẫn/anchor Markdown inline và JSON/task. Không kiểm tra link web hoặc nghiệp vụ.');
}
try { main(); } catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 2; }
