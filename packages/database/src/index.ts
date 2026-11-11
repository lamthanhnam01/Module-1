import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

function toSqliteFileUrl(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  return norm.startsWith('/') ? `file://${norm}` : `file:${norm}`;
}

function resolveIndependentSqliteUrl(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'packages', 'database', 'prisma', 'independent_v2.db'),
    path.resolve(cwd, '..', '..', 'packages', 'database', 'prisma', 'independent_v2.db'),
    path.resolve(cwd, 'prisma', 'independent_v2.db'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return toSqliteFileUrl(candidate);
    }
  }
  for (const candidate of candidates) {
    const parent = path.dirname(candidate);
    if (fs.existsSync(parent)) {
      return toSqliteFileUrl(candidate);
    }
  }
  return toSqliteFileUrl(candidates[0]);
}

const resolvedDbUrl =
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL !== 'file:./independent_v2.db' &&
  process.env.DATABASE_URL !== 'file:./dev.db'
    ? process.env.DATABASE_URL
    : resolveIndependentSqliteUrl();

process.env.DATABASE_URL = resolvedDbUrl;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolvedDbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
export * from './operations';
