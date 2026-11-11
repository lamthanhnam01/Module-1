const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const API_ROUTES_DIR = path.join(ROOT, 'apps', 'api', 'src', 'app', 'api', 'v1');
const WEB_ROUTES_DIR = path.join(ROOT, 'apps', 'web', 'src', 'app', 'api', 'v1');

function findRouteFiles(dir, baseDir = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(full, baseDir));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return results.sort();
}

function extractExportedHttpMethods(content) {
  const methods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
  const exported = new Set();
  for (const m of methods) {
    const fnRegex = new RegExp(`export\\s+async\\s+function\\s+${m}\\b`);
    const reExportRegex = new RegExp(`export\\s*\\{[^}]*\\b${m}\\b[^}]*\\}`);
    if (fnRegex.test(content) || reExportRegex.test(content)) {
      exported.add(m);
    }
  }
  return [...exported].sort();
}

test('Every route in apps/api/src/app/api/v1/**/route.ts is re-exported in apps/web/src/app/api/v1/**/route.ts', () => {
  const apiRoutes = findRouteFiles(API_ROUTES_DIR);
  assert.ok(apiRoutes.length > 0, 'Expected at least one API route in apps/api');

  for (const relRoute of apiRoutes) {
    const apiFile = path.join(API_ROUTES_DIR, relRoute);
    const webFile = path.join(WEB_ROUTES_DIR, relRoute);

    assert.ok(
      fs.existsSync(webFile),
      `Missing web route re-export file for ${relRoute}: expected ${webFile}`,
    );

    const apiMethods = extractExportedHttpMethods(fs.readFileSync(apiFile, 'utf8'));
    const webMethods = extractExportedHttpMethods(fs.readFileSync(webFile, 'utf8'));

    assert.deepEqual(
      webMethods,
      apiMethods,
      `HTTP methods mismatch in ${relRoute}: apps/api exports [${apiMethods.join(', ')}], apps/web exports [${webMethods.join(', ')}]`,
    );
  }
});

