import crypto from 'node:crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function generateSessionTokens(): {
  rawToken: string;
  tokenHash: string;
  csrfToken: string;
} {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);
  const csrfToken = crypto.randomBytes(24).toString('base64url');
  return { rawToken, tokenHash, csrfToken };
}

export function hashSessionToken(rawToken: string): string {
  const secret = process.env.SESSION_SECRET || 'toantrung-v2-fallback-dev-secret';
  return crypto.createHmac('sha256', secret).update(rawToken).digest('hex');
}

