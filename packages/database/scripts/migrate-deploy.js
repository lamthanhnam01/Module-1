'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const defaultDbFile = path.resolve(__dirname, '../prisma/independent_v2.db').replace(/\\/g, '/');
const defaultDbUrl = defaultDbFile.startsWith('/') ? `file://${defaultDbFile}` : `file:${defaultDbFile}`;

const targetDbUrl =
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL !== 'file:./independent_v2.db' &&
  process.env.DATABASE_URL !== 'file:./dev.db'
    ? process.env.DATABASE_URL
    : defaultDbUrl;

process.env.DATABASE_URL = targetDbUrl;

// Ensure .env exists on fresh deployment containers (e.g. Render) where gitignored .env files are absent
const repoRoot = path.resolve(__dirname, '../../..');
const envLocations = [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, 'packages', 'database', '.env'),
  path.join(repoRoot, 'apps', 'web', '.env'),
];
for (const envFile of envLocations) {
  if (!fs.existsSync(envFile)) {
    try {
      fs.writeFileSync(
        envFile,
        `DATABASE_URL="${targetDbUrl}"\nSESSION_SECRET="${process.env.SESSION_SECRET || 'toantrung-v2-production-default-secret-key-2026'}"\nSTORAGE_ROOT="./storage_independent_v2"\n`,
        'utf8',
      );
    } catch {
      // Ignore read-only filesystem errors if any
    }
  }
}

const { PrismaClient } = require('@prisma/client');

function splitSqlStatements(sql) {
  const withoutComments = sql.replace(/^\s*--.*$/gm, '');
  return withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function deployCoordinatedMigrations() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: targetDbUrl,
      },
    },
  });
  const migrationsRoot = path.resolve(__dirname, '../prisma/migrations');

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                     TEXT PRIMARY KEY NOT NULL,
        "checksum"              TEXT NOT NULL,
        "finished_at"           DATETIME,
        "migration_name"        TEXT NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        DATETIME,
        "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
      );
    `);

    const appliedRows = await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    );
    const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

    const dirs = fs
      .readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    let appliedCount = 0;
    for (const dirName of dirs) {
      if (appliedSet.has(dirName)) {
        console.log(`[migrate:deploy] Đã áp dụng trước đó: ${dirName}`);
        continue;
      }

      const sqlPath = path.join(migrationsRoot, dirName, 'migration.sql');
      if (!fs.existsSync(sqlPath)) continue;

      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');
      const statements = splitSqlStatements(sqlContent);

      console.log(`[migrate:deploy] Đang áp dụng ${dirName} (${statements.length} câu lệnh DDL)...`);
      for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt);
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count") VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
        crypto.randomUUID(),
        checksum,
        dirName,
        statements.length,
      );
      appliedCount += 1;
    }

    console.log(
      `[migrate:deploy] Hoàn tất lịch sử migration dùng chung (${appliedCount} migration mới được áp dụng).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  deployCoordinatedMigrations().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

module.exports = { deployCoordinatedMigrations };

