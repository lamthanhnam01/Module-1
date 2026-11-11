'use strict';
const { Prisma } = require('@prisma/client');

const MICRO_SCALE = 1_000_000n;

class ConcurrencyConflictError extends Error {
  constructor(entity, entityId, expectedVersion) {
    super(
      `Xung đột cập nhật đồng thời trên ${entity}#${entityId} (phiên bản kỳ vọng: v${expectedVersion}). Vui lòng tải lại dữ liệu mới nhất.`,
    );
    this.name = 'ConcurrencyConflictError';
    this.code = 'CONCURRENCY_CONFLICT';
    this.entity = entity;
    this.entityId = entityId;
    this.expectedVersion = expectedVersion;
  }
}

class IntakeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IntakeValidationError';
    this.code = 'INTAKE_VALIDATION_ERROR';
  }
}

function serializeBigInt(value) {
  if (value === null || value === undefined) return null;
  return value.toString(10);
}

function parseBigIntString(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new RangeError(`Giá trị số không phải số nguyên an toàn: ${value}`);
    }
    return BigInt(value);
  }
  const trimmed = String(value).trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new SyntaxError(`Chuỗi BigInt không hợp lệ: ${value}`);
  }
  return BigInt(trimmed);
}

function microsToDecimalString(micros) {
  if (micros === null || micros === undefined) return null;
  const isNegative = micros < 0n;
  const abs = isNegative ? -micros : micros;
  const whole = abs / MICRO_SCALE;
  const frac = abs % MICRO_SCALE;
  if (frac === 0n) {
    return `${isNegative ? '-' : ''}${whole.toString(10)}`;
  }
  const fracStr = frac.toString(10).padStart(6, '0').replace(/0+$/, '');
  return `${isNegative ? '-' : ''}${whole.toString(10)}.${fracStr}`;
}

function decimalStringToMicros(decimalStr) {
  const trimmed = String(decimalStr).trim();
  const match = trimmed.match(/^(-?)(\d+)(?:\.(\d{1,6})\d*)?$/);
  if (!match) {
    throw new SyntaxError(`Chuỗi tiền tệ thập phân không hợp lệ: ${decimalStr}`);
  }
  const sign = match[1] === '-' ? -1n : 1n;
  const whole = BigInt(match[2]);
  const fracPadded = (match[3] || '').padEnd(6, '0');
  const frac = BigInt(fracPadded);
  return sign * (whole * MICRO_SCALE + frac);
}

function toJsonSafe(input) {
  if (input === null || input === undefined) return input;
  if (typeof input === 'bigint') return input.toString(10);
  if (input instanceof Date) return input.toISOString();
  if (Array.isArray(input)) return input.map((item) => toJsonSafe(item));
  if (typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = toJsonSafe(v);
    }
    return out;
  }
  return input;
}

function validateLeadIntakeByChannel(input) {
  const phone = (input.phone || '').trim();
  if (!phone) {
    throw new IntakeValidationError('Số điện thoại liên hệ là bắt buộc.');
  }

  if (input.intakeSourceProvider === 'website_webhook') {
    const email = (input.email || '').trim();
    if (!email) {
      throw new IntakeValidationError('Lead từ form website bắt buộc có cả Số điện thoại và Email (UC01).');
    }
    if (!input.intakeSourceAccountKey || !input.externalSubmissionId) {
      throw new IntakeValidationError('Webhook từ website bắt buộc có định danh website (intakeSourceAccountKey) và mã gửi form (externalSubmissionId).');
    }
  } else if (input.intakeSourceProvider === 'google_lead_form') {
    if (!input.intakeSourceAccountKey || !input.externalSubmissionId) {
      throw new IntakeValidationError('Google Lead Form bắt buộc có mã tài khoản và externalSubmissionId.');
    }
  } else if (input.intakeSourceProvider === 'manual') {
    if (!input.createdByUserId) {
      throw new IntakeValidationError('Lead tạo thủ công (Hotline/Zalo) bắt buộc ghi nhận nhân sự tạo (createdByUserId).');
    }
  }
}

function isUniqueConstraintError(err) {
  if (!err || typeof err !== 'object') return false;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return true;
  if (err.code === 'P2002') return true;
  const msg = String(err.message || '');
  return msg.includes('Unique constraint failed');
}

function isSqliteBusyError(err) {
  if (!err || typeof err !== 'object') return false;
  if (err.code === 'P2028' || err.code === 'P2034') return true;
  const msg = String(err.message || '');
  return (
    msg.includes('SQLITE_BUSY') ||
    msg.includes('database is locked') ||
    msg.includes('database table is locked') ||
    msg.includes('TransactionWriteConflict') ||
    msg.includes('Unable to start a transaction') ||
    msg.includes('Timed out')
  );
}

async function withConcurrencyRetry(fn, maxRetries = 12) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (isSqliteBusyError(err) && attempt < maxRetries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 25 * attempt));
        continue;
      }
      throw err;
    }
  }
}

async function ingestLeadWithTrackingIdempotent(client, input) {
  validateLeadIntakeByChannel(input);

  const provider = input.intakeSourceProvider;
  const accountKey = input.intakeSourceAccountKey.trim().toLowerCase();
  const submissionId = (input.externalSubmissionId && input.externalSubmissionId.trim()) || null;

  const findExisting = async () => {
    if (!submissionId) return null;
    const existingTracking = await client.marketingTracking.findUnique({
      where: {
        uq_tracking_source_submission: {
          intakeSourceProvider: provider,
          intakeSourceAccountKey: accountKey,
          externalSubmissionId: submissionId,
        },
      },
      include: { lead: true },
    });
    if (!existingTracking) return null;
    return {
      lead: existingTracking.lead,
      tracking: existingTracking,
      deduplicated: true,
    };
  };

  const preCheck = await withConcurrencyRetry(() => findExisting());
  if (preCheck) return preCheck;

  const actorType = provider === 'manual' ? 'user' : 'webhook';
  const actorRef =
    provider === 'manual'
      ? `user:${input.createdByUserId}`
      : `${provider}:${accountKey}`;

  try {
    return await withConcurrencyRetry(async () => {
      const existingBeforeTx = await findExisting();
      if (existingBeforeTx) return existingBeforeTx;
      return client.$transaction(async (tx) => {
        if (submissionId) {
          const insideTx = await tx.marketingTracking.findUnique({
            where: {
              uq_tracking_source_submission: {
                intakeSourceProvider: provider,
                intakeSourceAccountKey: accountKey,
                externalSubmissionId: submissionId,
              },
            },
            include: { lead: true },
          });
          if (insideTx) {
            return {
              lead: insideTx.lead,
              tracking: insideTx,
              deduplicated: true,
            };
          }
        }

        const lead = await tx.lead.create({
          data: {
            leadCode: input.leadCode,
            contactChannel: input.contactChannel,
            phone: input.phone.trim(),
            email: (input.email && input.email.trim()) || null,
            contactName: (input.contactName && input.contactName.trim()) || null,
            companyName: (input.companyName && input.companyName.trim()) || null,
            projectName: (input.projectName && input.projectName.trim()) || null,
            areaType: input.areaType || null,
            province: (input.province && input.province.trim()) || null,
            district: (input.district && input.district.trim()) || null,
            installationAddress: (input.installationAddress && input.installationAddress.trim()) || null,
            sourceWebsite: (input.sourceWebsite && input.sourceWebsite.trim()) || null,
            selfReportedSource: (input.selfReportedSource && input.selfReportedSource.trim()) || null,
            createdByUserId: input.createdByUserId ?? null,
            createdByActorType: actorType,
            createdByActorRef: actorRef,
            assignedSalesId: input.assignedSalesId ?? input.createdByUserId ?? null,
          },
        });

        const tracking = await tx.marketingTracking.create({
          data: {
            leadId: lead.id,
            intakeChannel: input.contactChannel,
            intakeSourceProvider: provider,
            intakeSourceAccountKey: accountKey,
            externalSubmissionId: submissionId,
            marketingSource:
              input.marketingSource ||
              (provider === 'manual'
                ? 'Nhập tay'
                : provider === 'google_lead_form'
                  ? 'Google Ads'
                  : 'Chưa xác định'),
            sourceResolutionMethod:
              input.sourceResolutionMethod ||
              (provider === 'manual'
                ? 'manual'
                : provider === 'google_lead_form'
                  ? 'google_lead_form'
                  : 'unknown'),
            utmSource: input.utmSource || null,
            utmMedium: input.utmMedium || null,
            utmCampaign: input.utmCampaign || null,
            campaignName: input.campaignName || null,
            gclid: input.gclid || null,
            referrerUrl: input.referrerUrl || null,
            landingPageUrl: input.landingPageUrl || null,
            deviceType: input.deviceType || null,
            ipAddress: input.ipAddress || null,
          },
        });

        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            actionType: 'create_lead',
            newStatus: lead.pipelineStatus,
            actionById: input.createdByUserId ?? null,
            actorType,
            actorRef,
            note: `Tiếp nhận Lead từ ${actorRef}`,
          },
        });

        return {
          lead,
          tracking,
          deduplicated: false,
        };
      }, { maxWait: 10000, timeout: 20000 });
    });
  } catch (err) {
    if (isUniqueConstraintError(err) && submissionId) {
      const winner = await withConcurrencyRetry(() => findExisting());
      if (winner) return winner;
    }
    throw err;
  }
}

async function upsertPlatformMetricIdempotent(client, input) {
  const platform = input.platform.trim().toLowerCase();
  const accountPropertyId = input.accountPropertyId.trim();
  const metricDate = input.metricDate.trim();
  const grain = input.grain;
  const campaignExternalId = (input.campaignExternalId || '').trim();
  const keywordMatchType = (input.keywordMatchType || '').trim().toUpperCase();
  const keywordTextNorm = (input.keywordRaw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const pagePathNorm = (input.pageUrlRaw || '').trim().replace(/\/+$/, '').toLowerCase();

  const dimensionFingerprint = [
    platform,
    accountPropertyId,
    metricDate,
    grain,
    campaignExternalId,
    keywordMatchType,
    keywordTextNorm,
    pagePathNorm,
  ].join('|');

  const uniqueKey = {
    uq_platform_metric_scope: {
      platform,
      accountPropertyId,
      metricDate,
      grain,
      campaignExternalId,
      keywordMatchType,
      keywordTextNorm,
      pagePathNorm,
    },
  };

  const payload = {
    dimensionFingerprint,
    campaignId: input.campaignId ?? null,
    campaignName: input.campaignName ?? null,
    keywordRaw: input.keywordRaw ?? null,
    pageUrlRaw: input.pageUrlRaw ?? null,
    currencyCode: input.currencyCode || 'VND',
    spendMicros: input.spendMicros ?? 0n,
    dailyBudgetMicros: input.dailyBudgetMicros ?? null,
    cpcMicros: input.cpcMicros ?? null,
    impressions: input.impressions ?? 0,
    clicks: input.clicks ?? 0,
    conversionsMicros: input.conversionsMicros ?? 0n,
    googleLeadFormCount: input.googleLeadFormCount ?? 0,
    pageViews: input.pageViews ?? 0,
    avgTimeOnPageSec: input.avgTimeOnPageSec ?? 0,
    avgPosition: input.avgPosition ?? null,
    fanpageEngagements: input.fanpageEngagements ?? 0,
    trendInterestScore: input.trendInterestScore ?? null,
    isFinalized: input.isFinalized ?? false,
    syncedAt: new Date(),
  };

  return withConcurrencyRetry(async () => {
    try {
      return await client.platformDailyMetric.upsert({
        where: uniqueKey,
        update: payload,
        create: {
          platform,
          accountPropertyId,
          metricDate,
          grain,
          campaignExternalId,
          keywordMatchType,
          keywordTextNorm,
          pagePathNorm,
          ...payload,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return client.platformDailyMetric.update({
          where: uniqueKey,
          data: payload,
        });
      }
      throw err;
    }
  });
}

async function recordAiUsageAttempt(client, input) {
  const key = input.idempotencyKey.trim();
  const existing = await client.aiUsageLog.findUnique({
    where: { idempotencyKey: key },
  });
  if (existing) {
    return { log: existing, deduplicated: true };
  }

  try {
    const created = await withConcurrencyRetry(() =>
      client.aiUsageLog.create({
        data: {
          idempotencyKey: key,
          attemptNumber: input.attemptNumber ?? 1,
          providerRequestId: input.providerRequestId ?? null,
          moduleCode: input.moduleCode,
          taskType: input.taskType,
          userId: input.userId,
          designRequestId: input.designRequestId ?? null,
          seoArticleId: input.seoArticleId ?? null,
          modelName: input.modelName || 'gemini-2.5-flash',
          promptTokens: input.promptTokens ?? null,
          completionTokens: input.completionTokens ?? null,
          totalTokens: input.totalTokens ?? null,
          costMicros: input.costMicros ?? null,
          costCurrency: input.costMicros !== null && input.costMicros !== undefined ? (input.costCurrency || 'USD') : null,
          durationMs: input.durationMs ?? null,
          status: input.status,
          errorMessage: input.errorMessage ?? null,
        },
      }),
    );
    return { log: created, deduplicated: false };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const winner = await client.aiUsageLog.findUniqueOrThrow({
        where: { idempotencyKey: key },
      });
      return { log: winner, deduplicated: true };
    }
    throw err;
  }
}

async function transitionLeadWithVersion(client, input) {
  return withConcurrencyRetry(() =>
    client.$transaction(async (tx) => {
      const updatedCount = await tx.lead.updateMany({
        where: {
          id: input.leadId,
          version: input.expectedVersion,
        },
        data: {
          ...input.patch,
          statusChangedAt: input.patch.pipelineStatus ? new Date() : undefined,
          version: { increment: 1 },
        },
      });

      if (updatedCount.count === 0) {
        throw new ConcurrencyConflictError('Lead', input.leadId, input.expectedVersion);
      }

      const activity = await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          actionType: input.activity.actionType,
          fromSalesId: input.activity.fromSalesId ?? null,
          toSalesId: input.activity.toSalesId ?? null,
          transferReason: input.activity.transferReason ?? null,
          oldStatus: input.activity.oldStatus ?? null,
          newStatus: input.activity.newStatus ?? null,
          oldValueJson: input.activity.oldValueJson ?? null,
          newValueJson: input.activity.newValueJson ?? null,
          note: input.activity.note ?? null,
          actionById: input.activity.actionById ?? null,
          actorType: input.activity.actorType || 'user',
          actorRef: input.activity.actorRef ?? null,
        },
      });

      const lead = await tx.lead.findUniqueOrThrow({
        where: { id: input.leadId },
      });

      return { lead, activity };
    }),
  );
}

module.exports = {
  MICRO_SCALE,
  ConcurrencyConflictError,
  IntakeValidationError,
  serializeBigInt,
  parseBigIntString,
  microsToDecimalString,
  decimalStringToMicros,
  toJsonSafe,
  validateLeadIntakeByChannel,
  ingestLeadWithTrackingIdempotent,
  upsertPlatformMetricIdempotent,
  recordAiUsageAttempt,
  transitionLeadWithVersion,
};

