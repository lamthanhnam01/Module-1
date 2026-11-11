'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const {
  BA_PRODUCTS_AUTHORITATIVE,
  UNAPPROVED_SLA_KEYS,
  syncAuthoritativeProducts,
} = require('../../../../../packages/database/scripts/seed');
const {
  reconcileExistingDatabase,
} = require('../../../../../packages/database/scripts/reconcile-existing-db');
const {
  ConcurrencyConflictError,
  IntakeValidationError,
  serializeBigInt,
  parseBigIntString,
  microsToDecimalString,
  decimalStringToMicros,
  toJsonSafe,
  ingestLeadWithTrackingIdempotent,
  upsertPlatformMetricIdempotent,
  recordAiUsageAttempt,
  transitionLeadWithVersion,
} = require('../../../../../packages/database/src/operations-runtime');

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const PRISMA_DIR = path.join(REPO_ROOT, 'packages/database/prisma');
const WORKING_DEV_DB = fs.existsSync(path.join(PRISMA_DIR, 'dev.db'))
  ? path.join(PRISMA_DIR, 'dev.db')
  : fs.existsSync(path.join(PRISMA_DIR, 'independent_v2.db'))
    ? path.join(PRISMA_DIR, 'independent_v2.db')
    : path.resolve(REPO_ROOT, '../ToanTrungMar/packages/database/prisma/dev.db');

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function createDisposableDbUrl(t, prefix) {
  const folderName = `.tmp-tt-db-${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpDir = path.join(PRISMA_DIR, folderName);
  fs.mkdirSync(tmpDir, { recursive: true });
  t.after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore Windows file lock cleanup delay
    }
  });
  const dbFile = path.join(tmpDir, 'disposable.db');
  const dbUrl = `file:./${folderName}/disposable.db`;
  return { tmpDir, dbFile, dbUrl };
}

function splitSqlStatements(sqlText) {
  return sqlText
    .replace(/^\s*--.*$/gm, '')
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function applyMigrationsToClient(client, sqlTexts) {
  for (const sqlText of sqlTexts) {
    for (const stmt of splitSqlStatements(sqlText)) {
      await client.$executeRawUnsafe(stmt);
    }
  }
}

test('Rehearsal 1 (Clean Disposable DB): applies coordinated migrations 0001 + 0002, seeds 25 authoritative BA products, and excludes unapproved SLA defaults', async (t) => {
  const { dbFile, dbUrl } = createDisposableDbUrl(t, 'clean');

  const mig1 = fs.readFileSync(
    path.join(PRISMA_DIR, 'migrations/20261105000000_0001_core_baseline/migration.sql'),
    'utf8',
  );
  const mig2 = fs.readFileSync(
    path.join(PRISMA_DIR, 'migrations/20261106000000_0002_five_modules_shared_schema/migration.sql'),
    'utf8',
  );

  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  t.after(() => client.$disconnect());

  await applyMigrationsToClient(client, [mig1, mig2]);

  // Seed authoritative 25 products
  await syncAuthoritativeProducts(client);

  const products = await client.product.findMany({ orderBy: { id: 'asc' } });
  assert.equal(products.length, 25);
  assert.equal(products[0].productCode, 'LED_INDOOR');
  assert.equal(products[0].productName, 'Màn hình LED Indoor');
  assert.equal(products[2].id, 3);
  assert.equal(products[2].productCode, 'LED_CURVED');
  assert.equal(products[2].productName, 'Màn hình LED Cong');
  assert.equal(products[10].id, 11);
  assert.equal(products[10].productCode, 'BOARD_MARATHON');
  assert.equal(products[10].productName, 'Bảng Marathon');
  assert.equal(products[12].id, 13);
  assert.equal(products[12].productCode, 'BOARD_SAFETY');
  assert.equal(products[12].productName, 'Bảng An toàn lao động');
  assert.equal(products[24].id, 25);
  assert.equal(products[24].productCode, 'OTHER_MISMATCH');
  assert.equal(products[24].productName, 'Không đúng nhu cầu');

  assert.ok(fs.existsSync(dbFile));
});

test('Rehearsal 2 (Representative Existing DB Copy): upgrades intermediate 18-table DB in-place without losing product FK references or monetary values, while leaving working dev.db untouched', async (t) => {
  const beforeWorkingHash = sha256File(WORKING_DEV_DB);
  const { dbFile, dbUrl } = createDisposableDbUrl(t, 'existing-copy');
  fs.copyFileSync(WORKING_DEV_DB, dbFile);

  // Insert representative pre-existing records into the intermediate DB copy using raw SQL
  const rawSetup = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  await rawSetup.$executeRawUnsafe(`
    INSERT INTO "leads" (
      "id", "lead_code", "company_name", "contact_name", "phone", "email",
      "contact_channel", "area_type", "province", "pipeline_status",
      "quote_value", "deal_value", "created_by_user_id", "updated_at"
    ) VALUES (
      101, 'TT-20261106-0101', 'Công ty TNHH Ánh Sáng Việt', 'Nguyễn Văn A', '0909111222', 'a@anhsang.vn',
      'hotline', 'tphcm', 'TP. Hồ Chí Minh', 'won',
      185000000, 179500000, 2, CURRENT_TIMESTAMP
    );
  `);
  // Reference products id=3 (LED_HALL -> LED_CURVED), id=11 (BOARD_SAFETY -> BOARD_MARATHON), id=13 (BOARD_WELCOME_GATE -> BOARD_SAFETY)
  await rawSetup.$executeRawUnsafe(`
    INSERT INTO "lead_products" ("id", "lead_id", "product_id", "requested_dimension")
    VALUES
      (201, 101, 3, 'Ngang 5m x Cao 3m'),
      (202, 101, 11, 'Ngang 2m x Cao 1m'),
      (203, 101, 13, 'Ngang 3m x Cao 1.2m');
  `);
  const campCols = await rawSetup.$queryRawUnsafe('PRAGMA table_info("campaigns")');
  const campColNames = new Set(campCols.map((c) => c.name));
  if (campColNames.has('daily_budget_vnd')) {
    await rawSetup.$executeRawUnsafe(`
      INSERT INTO "campaigns" ("id", "campaign_code", "campaign_name", "platform", "daily_budget_vnd", "updated_at")
      VALUES (301, 'CMP-LED-01', 'Chiến dịch LED Hội Trường', 'google_ads', 2500000.5, CURRENT_TIMESTAMP);
    `);
  } else {
    await rawSetup.$executeRawUnsafe(`
      INSERT INTO "campaigns" ("id", "campaign_code", "campaign_name", "platform", "daily_budget_micros", "updated_at")
      VALUES (301, 'CMP-LED-01', 'Chiến dịch LED Hội Trường', 'google_ads', 2500000500000, CURRENT_TIMESTAMP);
    `);
  }

  const metricCols = await rawSetup.$queryRawUnsafe('PRAGMA table_info("platform_daily_metrics")');
  const metricColNames = new Set(metricCols.map((c) => c.name));
  if (metricColNames.has('spend_vnd')) {
    await rawSetup.$executeRawUnsafe(`
      INSERT INTO "platform_daily_metrics" (
        "id", "platform", "metric_date", "campaign_id", "campaign_name", "keyword",
        "spend_vnd", "daily_budget_vnd", "cpc_vnd", "impressions", "clicks", "conversions"
      ) VALUES (
        401, 'google_ads', '2026-11-05', 301, 'Chiến dịch LED Hội Trường', 'Màn hình LED P2.5',
        1234567.89, 2500000.5, 4505.7222, 5400, 274, 3.5
      );
    `);
  } else {
    await rawSetup.$executeRawUnsafe(`
      INSERT INTO "platform_daily_metrics" (
        "id", "platform", "account_property_id", "metric_date", "grain", "campaign_external_id", "keyword_match_type",
        "keyword_text_norm", "page_path_norm", "dimension_fingerprint", "campaign_id", "campaign_name", "keyword",
        "spend_micros", "daily_budget_micros", "cpc_micros", "conversions_micros", "impressions", "clicks", "is_finalized"
      ) VALUES (
        401, 'google_ads', 'default', '2026-11-05', 'keyword', '', 'EXACT',
        'màn hình led p2.5', '', 'google_ads|default|2026-11-05|keyword||EXACT|màn hình led p2.5|', 301, 'Chiến dịch LED Hội Trường', 'Màn hình LED P2.5',
        1234567890000, 2500000500000, 4505722200, 3500000, 5400, 274, 1
      );
    `);
  }

  const aiCols = await rawSetup.$queryRawUnsafe('PRAGMA table_info("ai_usage_logs")');
  const aiColNames = new Set(aiCols.map((c) => c.name));
  if (aiColNames.has('cost_vnd')) {
    await rawSetup.$executeRawUnsafe(`
      INSERT INTO "ai_usage_logs" (
        "id", "module_code", "task_type", "user_id", "model_name",
        "prompt_tokens", "completion_tokens", "total_tokens", "cost_vnd", "duration_ms", "status", "error_message"
      ) VALUES (
        501, '05-ai-design', '3d_perspective', 4, 'gemini-2.5-flash',
        0, 0, 0, 0, 4820, 'timeout', 'Provider timed out after 4820ms'
      );
    `);
  } else {
    await rawSetup.$executeRawUnsafe(`
      INSERT INTO "ai_usage_logs" (
        "id", "idempotency_key", "module_code", "task_type", "user_id", "model_name",
        "prompt_tokens", "completion_tokens", "total_tokens", "cost_micros", "duration_ms", "status", "error_message"
      ) VALUES (
        501, 'rehearsal-key-501', '05-ai-design', '3d_perspective', 4, 'gemini-2.5-flash',
        NULL, NULL, NULL, NULL, 4820, 'timeout', 'Provider timed out after 4820ms'
      );
    `);
  }
  await rawSetup.$executeRawUnsafe(`
    INSERT OR IGNORE INTO "system_settings" ("key", "value", "updated_at")
    VALUES ('heroCropJson', '{"zoom":1}', CURRENT_TIMESTAMP);
  `);
  await rawSetup.$disconnect();

  // Run non-destructive reconciliation & backfill on the disposable copy
  await reconcileExistingDatabase(dbUrl);

  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  t.after(() => client.$disconnect());

  // 1. Verify products 1..25 were updated in-place and LeadProduct references remain 100% intact
  const linkedProducts = await client.leadProduct.findMany({
    where: { leadId: 101 },
    include: { product: true },
    orderBy: { id: 'asc' },
  });
  assert.equal(linkedProducts.length, 3);
  assert.equal(linkedProducts[0].productId, 3);
  assert.equal(linkedProducts[0].product.productCode, 'LED_CURVED');
  assert.equal(linkedProducts[0].product.productName, 'Màn hình LED Cong');
  assert.equal(linkedProducts[1].productId, 11);
  assert.equal(linkedProducts[1].product.productCode, 'BOARD_MARATHON');
  assert.equal(linkedProducts[1].product.productName, 'Bảng Marathon');
  assert.equal(linkedProducts[2].productId, 13);
  assert.equal(linkedProducts[2].product.productCode, 'BOARD_SAFETY');
  assert.equal(linkedProducts[2].product.productName, 'Bảng An toàn lao động');

  // 2. Verify Lead monetary values were preserved as BigInt VND
  const upgradedLead = await client.lead.findUniqueOrThrow({ where: { id: 101 } });
  assert.equal(upgradedLead.quoteValueVnd, 185_000_000n);
  assert.equal(upgradedLead.dealValueVnd, 179_500_000n);
  assert.equal(upgradedLead.version, 1);

  // 3. Verify Campaign and PlatformDailyMetric micros conversion
  const upgradedCampaign = await client.campaign.findUniqueOrThrow({ where: { id: 301 } });
  assert.equal(upgradedCampaign.dailyBudgetMicros, 2_500_000_500_000n);

  const upgradedMetric = await client.platformDailyMetric.findUniqueOrThrow({ where: { id: 401 } });
  assert.equal(upgradedMetric.spendMicros, 1_234_567_890_000n);
  assert.equal(upgradedMetric.cpcMicros, 4_505_722_200n);
  assert.equal(upgradedMetric.conversionsMicros, 3_500_000n);
  assert.equal(upgradedMetric.grain, 'keyword');
  assert.equal(upgradedMetric.keywordTextNorm, 'màn hình led p2.5');

  // 4. Verify AiUsageLog fake zeros were converted to null while durationMs on timeout was preserved
  const upgradedAiLog = await client.aiUsageLog.findUniqueOrThrow({ where: { id: 501 } });
  assert.equal(upgradedAiLog.promptTokens, null);
  assert.equal(upgradedAiLog.completionTokens, null);
  assert.equal(upgradedAiLog.totalTokens, null);
  assert.equal(upgradedAiLog.costMicros, null);
  assert.equal(upgradedAiLog.costCurrency, null);
  assert.equal(upgradedAiLog.durationMs, 4820);
  assert.equal(upgradedAiLog.status, 'timeout');

  // 5. Verify unapproved SLA keys were removed while admin-customized branding settings were preserved
  const remainingSettings = await client.systemSetting.findMany();
  const keys = new Set(remainingSettings.map((s) => s.key));
  for (const unapprovedKey of UNAPPROVED_SLA_KEYS) {
    assert.equal(keys.has(unapprovedKey), false, `Unapproved SLA key ${unapprovedKey} should be removed`);
  }
  assert.equal(keys.has('organizationName'), true);
  assert.equal(keys.has('heroCropJson'), true);

  // 6. Verify working dev.db was NOT touched at all
  const afterWorkingHash = sha256File(WORKING_DEV_DB);
  assert.equal(afterWorkingHash, beforeWorkingHash, 'Working dev.db must remain 100% untouched');
});

test('Webhook Idempotency, Multi-Website Submission ID Isolation, Channel-Specific Nullability & Shared Phone Leads', async (t) => {
  const { dbUrl } = createDisposableDbUrl(t, 'idempotency');
  const mig1 = fs.readFileSync(path.join(PRISMA_DIR, 'migrations/20261105000000_0001_core_baseline/migration.sql'), 'utf8');
  const mig2 = fs.readFileSync(path.join(PRISMA_DIR, 'migrations/20261106000000_0002_five_modules_shared_schema/migration.sql'), 'utf8');

  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  t.after(() => client.$disconnect());

  await applyMigrationsToClient(client, [mig1, mig2]);

  // 1. Website webhook missing email must be rejected by channel validator
  await assert.rejects(
    () =>
      ingestLeadWithTrackingIdempotent(client, {
        intakeSourceProvider: 'website_webhook',
        intakeSourceAccountKey: 'toantrung.com.vn',
        externalSubmissionId: 'form-900',
        leadCode: 'TT-20261106-0900',
        contactChannel: 'form_web',
        phone: '0909888777',
        email: null,
      }),
    (err) => err instanceof IntakeValidationError,
  );

  // 2. Concurrent & repeated deliveries of the exact same website webhook ('toantrung.com.vn', 'sub-1001')
  // Note: contactName, areaType, province, createdByUserId are all omitted (null) — no fake contact or fake Admin!
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, idx) =>
      ingestLeadWithTrackingIdempotent(client, {
        intakeSourceProvider: 'website_webhook',
        intakeSourceAccountKey: 'toantrung.com.vn',
        externalSubmissionId: 'sub-1001',
        leadCode: `TT-20261106-100${idx}`,
        contactChannel: 'form_web',
        phone: '0909888777',
        email: 'khachhang@congty.vn',
        sourceWebsite: 'toantrung.com.vn',
        gclid: 'EAIaIQobChMI_test_gclid',
        marketingSource: 'Google Ads',
        sourceResolutionMethod: 'gclid',
      }),
    ),
  );

  const uniqueLeadIds = new Set(results.map((r) => r.lead.id));
  assert.equal(uniqueLeadIds.size, 1, 'Repeated/concurrent deliveries of same source+submissionId must create only 1 Lead');
  assert.equal(results.filter((r) => !r.deduplicated).length, 1);
  assert.equal(results.filter((r) => r.deduplicated).length, 5);

  const createdLead = results[0].lead;
  assert.equal(createdLead.contactName, null);
  assert.equal(createdLead.areaType, null);
  assert.equal(createdLead.province, null);
  assert.equal(createdLead.createdByUserId, null);
  assert.equal(createdLead.createdByActorType, 'webhook');
  assert.equal(createdLead.createdByActorRef, 'website_webhook:toantrung.com.vn');

  // 3. A SECOND website ('bangled.vn') sends the SAME externalSubmissionId ('sub-1001') AND the SAME phone ('0909888777')
  // Must NOT collide and must create a 2nd legitimate Lead sharing that phone number!
  const secondSiteResult = await ingestLeadWithTrackingIdempotent(client, {
    intakeSourceProvider: 'website_webhook',
    intakeSourceAccountKey: 'bangled.vn',
    externalSubmissionId: 'sub-1001',
    leadCode: 'TT-20261106-2001',
    contactChannel: 'form_web',
    phone: '0909888777',
    email: 'khachhang@congty.vn',
    sourceWebsite: 'bangled.vn',
  });

  assert.equal(secondSiteResult.deduplicated, false);
  assert.notEqual(secondSiteResult.lead.id, createdLead.id);

  const leadsWithSamePhone = await client.lead.findMany({ where: { phone: '0909888777' } });
  assert.equal(leadsWithSamePhone.length, 2, 'Multiple legitimate Leads sharing a phone number must be preserved');
});

test('Multi-Scope Metric Uniqueness: repeated/concurrent upserts and identical dimension labels across different accounts', async (t) => {
  const { dbUrl } = createDisposableDbUrl(t, 'metrics');
  const mig1 = fs.readFileSync(path.join(PRISMA_DIR, 'migrations/20261105000000_0001_core_baseline/migration.sql'), 'utf8');
  const mig2 = fs.readFileSync(path.join(PRISMA_DIR, 'migrations/20261106000000_0002_five_modules_shared_schema/migration.sql'), 'utf8');

  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  t.after(() => client.$disconnect());

  await applyMigrationsToClient(client, [mig1, mig2]);

  // 1. Concurrent & repeated syncs for Account A with same keyword & matchType on 2026-11-05
  await Promise.all([
    upsertPlatformMetricIdempotent(client, {
      platform: 'google_ads',
      accountPropertyId: 'gads:111-111-1111',
      metricDate: '2026-11-05',
      grain: 'keyword',
      campaignExternalId: 'cmp-100',
      keywordMatchType: 'EXACT',
      keywordRaw: 'Màn hình LED P3',
      spendMicros: decimalStringToMicros('1500000.25'),
      cpcMicros: decimalStringToMicros('15000.0025'),
      clicks: 100,
      impressions: 2000,
    }),
    upsertPlatformMetricIdempotent(client, {
      platform: 'google_ads',
      accountPropertyId: 'gads:111-111-1111',
      metricDate: '2026-11-05',
      grain: 'keyword',
      campaignExternalId: 'cmp-100',
      keywordMatchType: 'exact',
      keywordRaw: '  màn hình   led p3 ',
      spendMicros: decimalStringToMicros('1850000.75'),
      cpcMicros: decimalStringToMicros('15416.672916'),
      clicks: 120,
      impressions: 2400,
    }),
  ]);

  // 2. Identical campaignExternalId + keyword label + matchType on Account B ('gads:222-222-2222')
  await upsertPlatformMetricIdempotent(client, {
    platform: 'google_ads',
    accountPropertyId: 'gads:222-222-2222',
    metricDate: '2026-11-05',
    grain: 'keyword',
    campaignExternalId: 'cmp-100',
    keywordMatchType: 'EXACT',
    keywordRaw: 'Màn hình LED P3',
    spendMicros: decimalStringToMicros('920000.5'),
    cpcMicros: decimalStringToMicros('11500.00625'),
    clicks: 80,
    impressions: 1600,
  });

  // 3. Same account ('gads:111-111-1111'), same keyword text, but PHRASE matchType (must NOT overwrite EXACT matchType)
  await upsertPlatformMetricIdempotent(client, {
    platform: 'google_ads',
    accountPropertyId: 'gads:111-111-1111',
    metricDate: '2026-11-05',
    grain: 'keyword',
    campaignExternalId: 'cmp-100',
    keywordMatchType: 'PHRASE',
    keywordRaw: 'Màn hình LED P3',
    spendMicros: decimalStringToMicros('450000'),
    clicks: 45,
    impressions: 900,
  });

  const allMetrics = await client.platformDailyMetric.findMany({
    orderBy: [{ accountPropertyId: 'asc' }, { keywordMatchType: 'asc' }],
  });
  assert.equal(allMetrics.length, 3, 'Must have 1 row for Acc A EXACT, 1 row for Acc A PHRASE, and 1 row for Acc B EXACT');
  assert.equal(allMetrics[0].accountPropertyId, 'gads:111-111-1111');
  assert.equal(allMetrics[0].keywordMatchType, 'EXACT');
  assert.equal(allMetrics[0].AccountPropertyId || allMetrics[0].accountPropertyId, 'gads:111-111-1111');
  assert.equal(allMetrics[1].accountPropertyId, 'gads:111-111-1111');
  assert.equal(allMetrics[1].keywordMatchType, 'PHRASE');
  assert.equal(allMetrics[2].accountPropertyId, 'gads:222-222-2222');
  assert.equal(allMetrics[2].keywordMatchType, 'EXACT');
  assert.equal(microsToDecimalString(allMetrics[2].spendMicros), '920000.5');
});

test('Optimistic Concurrency Control, Shared AiUsageLog Contract, Revision Uniqueness & Monetary BigInt Serialization', async (t) => {
  const { dbUrl } = createDisposableDbUrl(t, 'concurrency-versions');
  const mig1 = fs.readFileSync(path.join(PRISMA_DIR, 'migrations/20261105000000_0001_core_baseline/migration.sql'), 'utf8');
  const mig2 = fs.readFileSync(path.join(PRISMA_DIR, 'migrations/20261106000000_0002_five_modules_shared_schema/migration.sql'), 'utf8');

  const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  t.after(() => client.$disconnect());

  await applyMigrationsToClient(client, [mig1, mig2]);

  const role = await client.role.create({
    data: { roleCode: 'DESIGNER', roleName: 'Designer' },
  });
  const user = await client.user.create({
    data: {
      roleId: role.id,
      fullName: 'Phạm Thiết Kế',
      email: 'designer@toantrung.vn',
      passwordHash: 'scrypt$test$hash',
      department: 'marketing',
    },
  });

  // 1. Create a Lead with a multi-billion VND quote value (> 32-bit Int limit)
  const lead = await client.lead.create({
    data: {
      leadCode: 'TT-20261106-5001',
      contactChannel: 'hotline',
      phone: '0903123456',
      quoteValueVnd: 15_800_000_000n,
      createdByUserId: user.id,
    },
  });
  assert.equal(lead.version, 1);
  assert.equal(serializeBigInt(lead.quoteValueVnd), '15800000000');
  assert.equal(parseBigIntString('15800000000'), 15_800_000_000n);

  // 2. Conditional update with expectedVersion = 1 succeeds and increments version to 2
  const firstUpdate = await transitionLeadWithVersion(client, {
    leadId: lead.id,
    expectedVersion: 1,
    patch: { pipelineStatus: 'quoting' },
    activity: {
      actionType: 'status_change',
      oldStatus: 'new_lead',
      newStatus: 'quoting',
      actionById: user.id,
    },
  });
  assert.equal(firstUpdate.lead.version, 2);
  assert.equal(firstUpdate.lead.pipelineStatus, 'quoting');

  // 3. Stale concurrent update still passing expectedVersion = 1 must throw ConcurrencyConflictError and NOT write LeadActivity
  await assert.rejects(
    () =>
      transitionLeadWithVersion(client, {
        leadId: lead.id,
        expectedVersion: 1,
        patch: { pipelineStatus: 'lost', lostReason: 'Stale overwrite' },
        activity: {
          actionType: 'status_change',
          oldStatus: 'new_lead',
          newStatus: 'lost',
          actionById: user.id,
        },
      }),
    (err) => err instanceof ConcurrencyConflictError && err.code === 'CONCURRENCY_CONFLICT',
  );

  const activities = await client.leadActivity.findMany({ where: { leadId: lead.id } });
  assert.equal(activities.length, 1, 'Failed concurrent transition must atomically roll back history write');

  // 4. Independent Banner DesignRequest (leadId = null) + DesignAssetVersion per-parent uniqueness + AI Usage deduplication
  const bannerReq = await client.designRequest.create({
    data: {
      leadId: null,
      assignedDesignerId: user.id,
      requestType: 'banner',
      screenDimensions: '1920x1080',
      aspectRatio: '16:9',
      prompt: 'Banner hội nghị màn hình LED P2',
    },
  });
  assert.equal(bannerReq.leadId, null);

  // Attempt 1: Timeout with unknown tokens/cost, but measured durationMs = 5120
  const attempt1 = await recordAiUsageAttempt(client, {
    idempotencyKey: `m05:banner:${bannerReq.id}:attempt-1`,
    attemptNumber: 1,
    moduleCode: '05-ai-design',
    taskType: 'banner',
    userId: user.id,
    designRequestId: bannerReq.id,
    durationMs: 5120,
    status: 'timeout',
    errorMessage: 'Upstream timeout',
  });
  assert.equal(attempt1.deduplicated, false);
  assert.equal(attempt1.log.promptTokens, null);
  assert.equal(attempt1.log.costMicros, null);
  assert.equal(attempt1.log.durationMs, 5120);

  // Repeated callback for Attempt 1 is deduplicated
  const attempt1CallbackDup = await recordAiUsageAttempt(client, {
    idempotencyKey: `m05:banner:${bannerReq.id}:attempt-1`,
    attemptNumber: 1,
    moduleCode: '05-ai-design',
    taskType: 'banner',
    userId: user.id,
    designRequestId: bannerReq.id,
    durationMs: 5120,
    status: 'timeout',
  });
  assert.equal(attempt1CallbackDup.deduplicated, true);
  assert.equal(attempt1CallbackDup.log.id, attempt1.log.id);

  // Attempt 2: Genuine retry with fractional USD cost ($0.0425 = 42,500 micros)
  const attempt2 = await recordAiUsageAttempt(client, {
    idempotencyKey: `m05:banner:${bannerReq.id}:attempt-2`,
    attemptNumber: 2,
    moduleCode: '05-ai-design',
    taskType: 'banner',
    userId: user.id,
    designRequestId: bannerReq.id,
    promptTokens: 180,
    completionTokens: 420,
    totalTokens: 600,
    costMicros: decimalStringToMicros('0.0425'),
    costCurrency: 'USD',
    durationMs: 2340,
    status: 'success',
  });
  assert.equal(attempt2.deduplicated, false);
  assert.equal(microsToDecimalString(attempt2.log.costMicros), '0.0425');
  assert.equal(attempt2.log.costCurrency, 'USD');

  const v1 = await client.designAssetVersion.create({
    data: {
      designRequestId: bannerReq.id,
      versionNumber: 1,
      versionType: 'ai_draft',
      storageObjectKey: 'design/draft-banner-v1.png',
      aiUsageLogId: attempt2.log.id,
      uploadedByUserId: user.id,
    },
  });
  const v2 = await client.designAssetVersion.create({
    data: {
      designRequestId: bannerReq.id,
      versionNumber: 2,
      versionType: 'final_render',
      storageObjectKey: 'design/final-banner-v2.png',
      uploadedByUserId: user.id,
      isApprovedFinal: true,
    },
  });

  // Duplicate versionNumber on the same DesignRequest must be rejected
  await assert.rejects(() =>
    client.designAssetVersion.create({
      data: {
        designRequestId: bannerReq.id,
        versionNumber: 2,
        versionType: 'final_render',
        storageObjectKey: 'design/collision.png',
        uploadedByUserId: user.id,
      },
    }),
  );

  // Bind approvedVersionId on DesignRequest while preserving v1 draft history
  const approvedBanner = await client.designRequest.update({
    where: { id: bannerReq.id },
    data: {
      designStatus: 'completed',
      aiDraftImageUrl: v1.storageObjectKey,
      finalRenderUrl: v2.storageObjectKey,
      approvedVersionId: v2.id,
    },
    include: { assetVersions: true, approvedVersion: true },
  });
  assert.equal(approvedBanner.assetVersions.length, 2);
  assert.equal(approvedBanner.approvedVersion.id, v2.id);

  // 5. SeoArticleRevision per-parent uniqueness & approval binding to intended revision
  const article = await client.seoArticle.create({
    data: {
      topic: 'Màn hình LED Hội Trường P2',
      title: 'Giải pháp Màn hình LED Hội Trường P2 chuẩn 4K',
      slug: 'giai-phap-man-hinh-led-hoi-truong-p2',
      contentHtml: '<h2>Mở đầu</h2><p>Bản nháp AI đầu tiên</p>',
      targetWebsite: 'toantrung.com.vn',
      createdByUserId: user.id,
    },
  });

  const rev1 = await client.seoArticleRevision.create({
    data: {
      articleId: article.id,
      revisionNumber: 1,
      originType: 'ai_initial_draft',
      title: article.title,
      contentHtml: article.contentHtml,
      editedByUserId: user.id,
    },
  });

  const rev2 = await client.seoArticleRevision.create({
    data: {
      articleId: article.id,
      revisionNumber: 2,
      originType: 'human_edit',
      title: 'Giải pháp Màn hình LED Hội Trường P2 - Đã biên tập',
      contentHtml: '<h2>Mở đầu</h2><p>Nội dung đã được Marketing biên tập hoàn chỉnh</p>',
      changeNote: 'Chỉnh sửa tiêu đề và bổ sung thông số P2',
      editedByUserId: user.id,
    },
  });

  // Duplicate revisionNumber on same article must be rejected
  await assert.rejects(() =>
    client.seoArticleRevision.create({
      data: {
        articleId: article.id,
        revisionNumber: 2,
        title: 'Trùng số phiên bản',
        contentHtml: '<p>Collision</p>',
        editedByUserId: user.id,
      },
    }),
  );

  // Bind approval to rev2 while preserving rev1 history
  const approvedArticle = await client.seoArticle.update({
    where: { id: article.id },
    data: {
      status: 'approved_scheduled',
      currentRevisionId: rev2.id,
      approvedRevisionId: rev2.id,
      approvedByUserId: user.id,
      approvedAt: new Date(),
    },
    include: { revisions: true, approvedRevision: true },
  });
  assert.equal(approvedArticle.revisions.length, 2);
  assert.equal(approvedArticle.approvedRevision.id, rev2.id);

  // Safe JSON serialization of payload containing BigInt
  const jsonText = JSON.stringify(toJsonSafe({ lead, usage: attempt2.log }));
  assert.ok(jsonText.includes('"15800000000"'));
  assert.ok(jsonText.includes('"42500"'));
});
