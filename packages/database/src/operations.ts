import { Prisma, type PrismaClient } from '@prisma/client';

export const MICRO_SCALE = 1_000_000n;

export class ConcurrencyConflictError extends Error {
  public readonly code = 'CONCURRENCY_CONFLICT';
  public readonly entity: string;
  public readonly entityId: number | string;
  public readonly expectedVersion: number;

  constructor(entity: string, entityId: number | string, expectedVersion: number) {
    super(
      `Xung đột cập nhật đồng thời trên ${entity}#${entityId} (phiên bản kỳ vọng: v${expectedVersion}). Vui lòng tải lại dữ liệu mới nhất.`,
    );
    this.name = 'ConcurrencyConflictError';
    this.entity = entity;
    this.entityId = entityId;
    this.expectedVersion = expectedVersion;
  }
}

export class IntakeValidationError extends Error {
  public readonly code = 'INTAKE_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'IntakeValidationError';
  }
}

/**
 * Chuyển đổi BigInt sang chuỗi số nguyên an toàn cho JSON API.
 */
export function serializeBigInt(value: bigint | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toString(10);
}

/**
 * Đọc chuỗi số nguyên hoặc number/bigint thành BigInt không mất độ chính xác.
 */
export function parseBigIntString(value: string | number | bigint | null | undefined): bigint | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      throw new RangeError(`Giá trị số không phải số nguyên an toàn: ${value}`);
    }
    return BigInt(value);
  }
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new SyntaxError(`Chuỗi BigInt không hợp lệ: ${value}`);
  }
  return BigInt(trimmed);
}

/**
 * Chuyển đổi đơn vị micros (1 đơn vị = 1,000,000 micros) sang chuỗi thập phân chính xác (không qua Float).
 */
export function microsToDecimalString(micros: bigint | null | undefined): string | null {
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

/**
 * Chuyển đổi chuỗi số thập phân (tối đa 6 chữ số thập phân) sang BigInt micros không qua Float.
 */
export function decimalStringToMicros(decimalStr: string): bigint {
  const trimmed = decimalStr.trim();
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

/**
 * Chuẩn hóa đệ quy object/array chứa BigInt hoặc Date để tuần tự hóa JSON an toàn.
 */
export function toJsonSafe<T>(input: T): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === 'bigint') return input.toString(10);
  if (input instanceof Date) return input.toISOString();
  if (Array.isArray(input)) return input.map((item) => toJsonSafe(item));
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = toJsonSafe(v);
    }
    return out;
  }
  return input;
}

export interface WebhookLeadIntakeInput {
  intakeSourceProvider: 'website_webhook' | 'google_lead_form' | 'manual';
  intakeSourceAccountKey: string; // VD: 'toantrung.com.vn' | 'bangled.vn' | 'gads:123-456-7890' | 'internal'
  externalSubmissionId?: string | null;
  leadCode: string;
  contactChannel: 'hotline' | 'form_web' | 'email' | 'fanpage' | 'zalo' | 'google_lead_form';
  phone: string;
  email?: string | null;
  contactName?: string | null;
  companyName?: string | null;
  projectName?: string | null;
  areaType?: 'tphcm' | 'other_province' | null;
  province?: string | null;
  district?: string | null;
  installationAddress?: string | null;
  sourceWebsite?: string | null;
  selfReportedSource?: string | null;
  createdByUserId?: number | null;
  assignedSalesId?: number | null;
  marketingSource?: string;
  sourceResolutionMethod?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  campaignName?: string | null;
  gclid?: string | null;
  referrerUrl?: string | null;
  landingPageUrl?: string | null;
  deviceType?: string | null;
  ipAddress?: string | null;
}

/**
 * Kiểm tra trường bắt buộc theo từng kênh tiếp nhận (UC01 & Q05) mà không cần điền dữ liệu giả hay Admin giả.
 */
export function validateLeadIntakeByChannel(input: WebhookLeadIntakeInput): void {
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

function isUniqueConstraintError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return true;
  if ((err as { code?: unknown }).code === 'P2002') return true;
  const msg = String((err as { message?: unknown }).message || '');
  return msg.includes('Unique constraint failed');
}

function isSqliteBusyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (code === 'P2028' || code === 'P2034') return true;
  const msg = String((err as { message?: unknown }).message || '');
  return (
    msg.includes('SQLITE_BUSY') ||
    msg.includes('database is locked') ||
    msg.includes('database table is locked') ||
    msg.includes('TransactionWriteConflict') ||
    msg.includes('Unable to start a transaction') ||
    msg.includes('Timed out')
  );
}

async function withConcurrencyRetry<T>(fn: () => Promise<T>, maxRetries = 12): Promise<T> {
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

/**
 * Tiếp nhận Lead + Tracking nguyên tử (atomic) với cơ chế chống lặp theo phạm vi nguồn:
 * (intakeSourceProvider, intakeSourceAccountKey, externalSubmissionId).
 */
export async function ingestLeadWithTrackingIdempotent(
  client: PrismaClient,
  input: WebhookLeadIntakeInput,
) {
  validateLeadIntakeByChannel(input);

  const provider = input.intakeSourceProvider;
  const accountKey = input.intakeSourceAccountKey.trim().toLowerCase();
  const submissionId = input.externalSubmissionId?.trim() || null;

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
            email: input.email?.trim() || null,
            contactName: input.contactName?.trim() || null,
            companyName: input.companyName?.trim() || null,
            projectName: input.projectName?.trim() || null,
            areaType: input.areaType || null,
            province: input.province?.trim() || null,
            district: input.district?.trim() || null,
            installationAddress: input.installationAddress?.trim() || null,
            sourceWebsite: input.sourceWebsite?.trim() || null,
            selfReportedSource: input.selfReportedSource?.trim() || null,
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

export interface UpsertPlatformMetricInput {
  platform: 'google_ads' | 'ga4' | 'search_console' | 'fanpage' | 'google_trends';
  accountPropertyId: string;
  metricDate: string; // YYYY-MM-DD
  grain: 'account' | 'campaign' | 'keyword' | 'page' | 'topic';
  campaignExternalId?: string | null;
  keywordMatchType?: string | null;
  keywordRaw?: string | null;
  pageUrlRaw?: string | null;
  campaignId?: number | null;
  campaignName?: string | null;
  currencyCode?: string;
  spendMicros?: bigint;
  dailyBudgetMicros?: bigint | null;
  cpcMicros?: bigint | null;
  impressions?: number;
  clicks?: number;
  conversionsMicros?: bigint;
  googleLeadFormCount?: number;
  pageViews?: number;
  avgTimeOnPageSec?: number;
  avgPosition?: number | null;
  fanpageEngagements?: number;
  trendInterestScore?: number | null;
  isFinalized?: boolean;
}

/**
 * Chuẩn hóa đầy đủ phạm vi (platform, accountPropertyId, metricDate, grain, campaignExternalId, keywordMatchType, keywordTextNorm, pagePathNorm)
 * và thực hiện upsert an toàn khi chạy lặp hoặc chạy đồng thời.
 */
export async function upsertPlatformMetricIdempotent(
  client: PrismaClient,
  input: UpsertPlatformMetricInput,
) {
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

export interface RecordAiUsageInput {
  idempotencyKey: string;
  attemptNumber?: number;
  providerRequestId?: string | null;
  moduleCode: '03-keywords-ads' | '05-ai-design';
  taskType: 'seo_outline' | 'seo_draft' | '3d_perspective' | 'banner';
  userId: number;
  designRequestId?: number | null;
  seoArticleId?: number | null;
  modelName?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  costMicros?: bigint | null;
  costCurrency?: string | null;
  durationMs?: number | null;
  status: 'success' | 'failed' | 'timeout';
  errorMessage?: string | null;
}

/**
 * Contract ghi nhật ký AI dùng chung (Kho D5):
 * - Chống nhân bản khi callback lặp (theo idempotencyKey) nhưng giữ riêng từng lần thử thật.
 * - Giữ null khi provider không trả về token/cost (không ghi số 0 giả).
 * - Ghi nhận durationMs kể cả khi failed/timeout.
 */
export async function recordAiUsageAttempt(
  client: PrismaClient,
  input: RecordAiUsageInput,
) {
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

export interface LeadVersionTransitionInput {
  leadId: number;
  expectedVersion: number;
  patch: {
    pipelineStatus?: string;
    assignedSalesId?: number | null;
    receivedByUserId?: number | null;
    receivedAt?: Date | null;
    lostReason?: string | null;
    quoteValueVnd?: bigint | null;
    dealValueVnd?: bigint | null;
    firstQuoteSentAt?: Date | null;
    quoteRespondedAt?: Date | null;
    isSpam?: boolean;
    spamReason?: string | null;
    spamAdsExclusionStatus?: string;
    reopenCount?: number;
    closedAt?: Date | null;
  };
  activity: {
    actionType: string;
    fromSalesId?: number | null;
    toSalesId?: number | null;
    transferReason?: string | null;
    oldStatus?: string | null;
    newStatus?: string | null;
    oldValueJson?: string | null;
    newValueJson?: string | null;
    note?: string | null;
    actionById?: number | null;
    actorType?: 'user' | 'webhook' | 'system';
    actorRef?: string | null;
  };
}

/**
 * Cập nhật có điều kiện theo phiên bản kỳ vọng (expectedVersion) kèm ghi LeadActivity nguyên tử.
 * Nếu một tác nhân khác đã cập nhật trước làm tăng version, ném lỗi ConcurrencyConflictError và rollback toàn bộ.
 */
export async function transitionLeadWithVersion(
  client: PrismaClient,
  input: LeadVersionTransitionInput,
) {
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

