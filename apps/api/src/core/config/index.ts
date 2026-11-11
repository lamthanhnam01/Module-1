import path from 'node:path';

export const APP_CONFIG = {
  sessionCookieName: 'tt_v2_indep_session',
  csrfHeaderName: 'x-csrf-token',
  sessionTtlMs: 1000 * 60 * 60 * 12, // 12 hours
  maxLogoSizeBytes: 2 * 1024 * 1024, // 2 MB
  maxHeroSizeBytes: 5 * 1024 * 1024, // 5 MB
  maxAttachmentSizeBytes: 10 * 1024 * 1024, // 10 MB technical guard (Q06 tracked)
  defaultLogoUrl: '/brand/logo-toan-trung.png',
  defaultHeroUrl: '/brand/login-hero-led-building.jpg',
  getStorageRoot(): string {
    const raw = process.env.STORAGE_ROOT || './storage_independent_v2';
    if (path.isAbsolute(raw)) return raw;
    const cwd = process.cwd();
    const repoRoot =
      cwd.endsWith(path.join('apps', 'web')) || cwd.endsWith(path.join('apps', 'api'))
        ? path.resolve(cwd, '../..')
        : cwd;
    return path.resolve(repoRoot, raw);
  },
};
