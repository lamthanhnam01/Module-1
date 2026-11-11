'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Ensure DATABASE_URL is always present in process.env before Next.js or Prisma Engine initializes
if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL === 'file:./independent_v2.db' ||
  process.env.DATABASE_URL === 'file:./dev.db'
) {
  const defaultDbFile = path
    .resolve(__dirname, '..', 'packages', 'database', 'prisma', 'independent_v2.db')
    .replace(/\\/g, '/');
  process.env.DATABASE_URL = defaultDbFile.startsWith('/')
    ? `file://${defaultDbFile}`
    : `file:${defaultDbFile}`;
}

// Only apply mkdir patch on Windows to prevent transient EPERM/EEXIST collisions in Windows sandbox.
// On Linux/POSIX systems (like Render, Docker, CI), keep native fast asynchronous filesystem calls.
if (process.platform === 'win32') {
  const origMkdirSync = fs.mkdirSync.bind(fs);
  const origMkdir = fs.mkdir.bind(fs);
  const origPromisesMkdir = fs.promises.mkdir.bind(fs.promises);

  function ensureDirSyncSafe(targetPath, options) {
    const resolved = path.resolve(String(targetPath));
    if (fs.existsSync(resolved)) {
      return undefined;
    }
    const isRecursive =
      options && typeof options === 'object' ? Boolean(options.recursive) : false;
    if (isRecursive) {
      const parent = path.dirname(resolved);
      if (parent !== resolved && !fs.existsSync(parent)) {
        ensureDirSyncSafe(parent, options);
      }
    }
    try {
      return origMkdirSync(resolved, options);
    } catch (err) {
      if (err && (err.code === 'EEXIST' || err.code === 'EPERM') && fs.existsSync(resolved)) {
        return undefined;
      }
      throw err;
    }
  }

  fs.mkdirSync = function patchedMkdirSync(targetPath, options) {
    return ensureDirSyncSafe(targetPath, options);
  };

  fs.mkdir = function patchedMkdir(targetPath, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? undefined : options;
    try {
      const res = ensureDirSyncSafe(targetPath, opts);
      if (cb) process.nextTick(() => cb(null, res));
    } catch (err) {
      if (cb) process.nextTick(() => cb(err));
    }
  };

  fs.promises.mkdir = async function patchedPromisesMkdir(targetPath, options) {
    return ensureDirSyncSafe(targetPath, options);
  };
}

