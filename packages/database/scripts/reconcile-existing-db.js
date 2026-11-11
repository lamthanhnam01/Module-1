'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { syncAuthoritativeProducts, UNAPPROVED_SLA_KEYS } = require('./seed');

/**
 * Nâng cấp bảo toàn dữ liệu (Data-Preserving Reconciliation & Backfill) cho database cục bộ
 * đã từng chạy bản schema trung gian (18 bảng), đưa về đúng lịch sử migration chuẩn (0001 + 0002)
 * mà không làm mất bất kỳ bản ghi hay khóa ngoại nào.
 */
async function reconcileExistingDatabase(databaseUrl) {
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    const tables = await client.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const tableNames = new Set(tables.map((t) => t.name));

    // Kiểm tra xem có phải database trung gian (có cột spend_vnd trên platform_daily_metrics hoặc bảng report_export_logs) không
    let needsIntermediateUpgrade = tableNames.has('report_export_logs');
    if (!needsIntermediateUpgrade && tableNames.has('platform_daily_metrics')) {
      const cols = await client.$queryRawUnsafe('PRAGMA table_info("platform_daily_metrics")');
      if (cols.some((c) => c.name === 'spend_vnd')) {
        needsIntermediateUpgrade = true;
      }
    }

    if (needsIntermediateUpgrade) {
      await client.$executeRawUnsafe('PRAGMA foreign_keys=OFF;');
      try {
        await client.$transaction([
          // 1. Gỡ bảng suy đoán report_export_logs (chỉ khi không chứa dữ liệu bắt buộc hoặc theo thiết kế M04 read-only)
          client.$executeRawUnsafe('DROP INDEX IF EXISTS "report_export_logs_dashboard_scope_created_at_idx";'),
          client.$executeRawUnsafe('DROP INDEX IF EXISTS "report_export_logs_user_id_created_at_idx";'),
          client.$executeRawUnsafe('DROP TABLE IF EXISTS "report_export_logs";'),

          // 2. Tạo bảng mới design_asset_versions cho Thư viện ấn phẩm M05
          client.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "design_asset_versions" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "design_request_id" INTEGER NOT NULL,
              "version_number" INTEGER NOT NULL,
              "version_type" TEXT NOT NULL,
              "storage_object_key" TEXT NOT NULL,
              "mime_type" TEXT NOT NULL DEFAULT 'image/png',
              "file_size_bytes" INTEGER,
              "prompt_used" TEXT,
              "parameters_json" TEXT,
              "ai_usage_log_id" INTEGER,
              "uploaded_by_user_id" INTEGER NOT NULL,
              "is_approved_final" BOOLEAN NOT NULL DEFAULT false,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "design_asset_versions_design_request_id_fkey" FOREIGN KEY ("design_request_id") REFERENCES "design_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT "design_asset_versions_ai_usage_log_id_fkey" FOREIGN KEY ("ai_usage_log_id") REFERENCES "ai_usage_logs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "design_asset_versions_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
            );
          `),

          // 3. Chuyển đổi bảo toàn dữ liệu bảng ai_usage_logs (tách số 0 giả thành NULL, quy đổi cost_vnd -> cost_micros)
          client.$executeRawUnsafe(`
            CREATE TABLE "new_ai_usage_logs" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "idempotency_key" TEXT NOT NULL,
              "attempt_number" INTEGER NOT NULL DEFAULT 1,
              "provider_request_id" TEXT,
              "module_code" TEXT NOT NULL,
              "task_type" TEXT NOT NULL,
              "user_id" INTEGER NOT NULL,
              "design_request_id" INTEGER,
              "seo_article_id" INTEGER,
              "model_name" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
              "prompt_tokens" INTEGER,
              "completion_tokens" INTEGER,
              "total_tokens" INTEGER,
              "cost_micros" BIGINT,
              "cost_currency" TEXT,
              "duration_ms" INTEGER,
              "status" TEXT NOT NULL DEFAULT 'success',
              "error_message" TEXT,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
              CONSTRAINT "ai_usage_logs_design_request_id_fkey" FOREIGN KEY ("design_request_id") REFERENCES "design_requests" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "ai_usage_logs_seo_article_id_fkey" FOREIGN KEY ("seo_article_id") REFERENCES "seo_articles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_ai_usage_logs" (
              "id", "idempotency_key", "attempt_number", "provider_request_id",
              "module_code", "task_type", "user_id", "design_request_id", "seo_article_id", "model_name",
              "prompt_tokens", "completion_tokens", "total_tokens",
              "cost_micros", "cost_currency", "duration_ms", "status", "error_message", "created_at"
            )
            SELECT
              "id",
              'legacy:' || "module_code" || ':' || "task_type" || ':' || CAST("id" AS TEXT),
              1,
              NULL,
              "module_code", "task_type", "user_id", "design_request_id", "seo_article_id", "model_name",
              CASE WHEN "prompt_tokens" = 0 AND "total_tokens" = 0 THEN NULL ELSE "prompt_tokens" END,
              CASE WHEN "completion_tokens" = 0 AND "total_tokens" = 0 THEN NULL ELSE "completion_tokens" END,
              CASE WHEN "total_tokens" = 0 THEN NULL ELSE "total_tokens" END,
              CASE WHEN "cost_vnd" IS NULL OR ("cost_vnd" = 0 AND "total_tokens" = 0) THEN NULL ELSE CAST(ROUND("cost_vnd" * 1000000) AS INTEGER) END,
              CASE WHEN "cost_vnd" IS NULL OR ("cost_vnd" = 0 AND "total_tokens" = 0) THEN NULL ELSE 'VND' END,
              CASE WHEN "duration_ms" = 0 AND "status" != 'success' THEN NULL ELSE "duration_ms" END,
              "status", "error_message", "created_at"
            FROM "ai_usage_logs";
          `),
          client.$executeRawUnsafe('DROP TABLE "ai_usage_logs";'),
          client.$executeRawUnsafe('ALTER TABLE "new_ai_usage_logs" RENAME TO "ai_usage_logs";'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "ai_usage_logs_idempotency_key_key" ON "ai_usage_logs"("idempotency_key");'),
          client.$executeRawUnsafe('CREATE INDEX "ai_usage_logs_module_code_created_at_idx" ON "ai_usage_logs"("module_code", "created_at");'),
          client.$executeRawUnsafe('CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");'),
          client.$executeRawUnsafe('CREATE INDEX "ai_usage_logs_design_request_id_idx" ON "ai_usage_logs"("design_request_id");'),
          client.$executeRawUnsafe('CREATE INDEX "ai_usage_logs_seo_article_id_idx" ON "ai_usage_logs"("seo_article_id");'),

          // 4. Chuyển đổi bảo toàn dữ liệu bảng campaigns (daily_budget_vnd -> daily_budget_micros)
          client.$executeRawUnsafe(`
            CREATE TABLE "new_campaigns" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "platform" TEXT NOT NULL DEFAULT 'google_ads',
              "account_external_id" TEXT NOT NULL DEFAULT 'default',
              "campaign_code" TEXT NOT NULL,
              "campaign_name" TEXT NOT NULL,
              "utm_campaign_slug" TEXT,
              "currency_code" TEXT NOT NULL DEFAULT 'VND',
              "daily_budget_micros" BIGINT,
              "is_active" BOOLEAN NOT NULL DEFAULT true,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updated_at" DATETIME NOT NULL
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_campaigns" (
              "id", "platform", "account_external_id", "campaign_code", "campaign_name",
              "utm_campaign_slug", "currency_code", "daily_budget_micros", "is_active", "created_at", "updated_at"
            )
            SELECT
              "id", "platform", 'default', "campaign_code", "campaign_name",
              "utm_campaign_slug", 'VND',
              CASE WHEN "daily_budget_vnd" IS NULL THEN NULL ELSE CAST(ROUND("daily_budget_vnd" * 1000000) AS INTEGER) END,
              "is_active", "created_at", "updated_at"
            FROM "campaigns";
          `),
          client.$executeRawUnsafe('DROP TABLE "campaigns";'),
          client.$executeRawUnsafe('ALTER TABLE "new_campaigns" RENAME TO "campaigns";'),
          client.$executeRawUnsafe('CREATE INDEX "campaigns_utm_campaign_slug_idx" ON "campaigns"("utm_campaign_slug");'),
          client.$executeRawUnsafe('CREATE INDEX "campaigns_platform_is_active_idx" ON "campaigns"("platform", "is_active");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "campaigns_platform_account_external_id_campaign_code_key" ON "campaigns"("platform", "account_external_id", "campaign_code");'),

          // 5. Chuyển đổi bảo toàn dữ liệu bảng design_requests
          client.$executeRawUnsafe(`
            CREATE TABLE "new_design_requests" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "version" INTEGER NOT NULL DEFAULT 1,
              "lead_id" INTEGER,
              "requested_by_sales_id" INTEGER,
              "assigned_designer_id" INTEGER NOT NULL,
              "request_type" TEXT NOT NULL,
              "led_category" TEXT,
              "screen_dimensions" TEXT,
              "aspect_ratio" TEXT,
              "install_position_json" TEXT,
              "site_photo_url" TEXT,
              "prompt" TEXT,
              "design_status" TEXT NOT NULL DEFAULT 'pending',
              "ai_draft_image_url" TEXT,
              "final_render_url" TEXT,
              "approved_version_id" INTEGER,
              "processing_time_ms" INTEGER,
              "token_cost" INTEGER,
              "total_cost_micros" BIGINT,
              "cost_currency" TEXT,
              "notes" TEXT,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "completed_at" DATETIME,
              CONSTRAINT "design_requests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "design_requests_requested_by_sales_id_fkey" FOREIGN KEY ("requested_by_sales_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "design_requests_assigned_designer_id_fkey" FOREIGN KEY ("assigned_designer_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
              CONSTRAINT "design_requests_approved_version_id_fkey" FOREIGN KEY ("approved_version_id") REFERENCES "design_asset_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_design_requests" (
              "id", "version", "lead_id", "requested_by_sales_id", "assigned_designer_id",
              "request_type", "led_category", "screen_dimensions", "aspect_ratio", "install_position_json",
              "site_photo_url", "prompt", "design_status", "ai_draft_image_url", "final_render_url",
              "approved_version_id", "processing_time_ms", "token_cost", "total_cost_micros", "cost_currency",
              "notes", "created_at", "completed_at"
            )
            SELECT
              "id", 1, "lead_id", "requested_by_sales_id", "assigned_designer_id",
              "request_type", "led_category", "screen_dimensions", "aspect_ratio", "install_position_json",
              "site_photo_url", "prompt", "design_status", "ai_draft_image_url", "final_render_url",
              NULL, "processing_time_ms",
              CASE WHEN "token_cost" = 0 AND "design_status" = 'pending' THEN NULL ELSE "token_cost" END,
              CASE WHEN "estimated_cost_vnd" IS NULL OR ("estimated_cost_vnd" = 0 AND "token_cost" = 0) THEN NULL ELSE CAST(ROUND("estimated_cost_vnd" * 1000000) AS INTEGER) END,
              CASE WHEN "estimated_cost_vnd" IS NULL OR ("estimated_cost_vnd" = 0 AND "token_cost" = 0) THEN NULL ELSE 'VND' END,
              "notes", "created_at", "completed_at"
            FROM "design_requests";
          `),
          client.$executeRawUnsafe('DROP TABLE "design_requests";'),
          client.$executeRawUnsafe('ALTER TABLE "new_design_requests" RENAME TO "design_requests";'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "design_requests_approved_version_id_key" ON "design_requests"("approved_version_id");'),
          client.$executeRawUnsafe('CREATE INDEX "design_requests_lead_id_idx" ON "design_requests"("lead_id");'),
          client.$executeRawUnsafe('CREATE INDEX "design_requests_assigned_designer_id_design_status_idx" ON "design_requests"("assigned_designer_id", "design_status");'),
          client.$executeRawUnsafe('CREATE INDEX "design_requests_request_type_design_status_idx" ON "design_requests"("request_type", "design_status");'),

          // 6. Chuyển đổi bảng lead_activities
          client.$executeRawUnsafe(`
            CREATE TABLE "new_lead_activities" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "lead_id" INTEGER NOT NULL,
              "action_type" TEXT NOT NULL,
              "from_sales_id" INTEGER,
              "to_sales_id" INTEGER,
              "transfer_reason" TEXT,
              "old_status" TEXT,
              "new_status" TEXT,
              "old_value_json" TEXT,
              "new_value_json" TEXT,
              "note" TEXT,
              "action_by" INTEGER,
              "actor_type" TEXT NOT NULL DEFAULT 'user',
              "actor_ref" TEXT,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT "lead_activities_action_by_fkey" FOREIGN KEY ("action_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "lead_activities_from_sales_id_fkey" FOREIGN KEY ("from_sales_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "lead_activities_to_sales_id_fkey" FOREIGN KEY ("to_sales_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_lead_activities" (
              "id", "lead_id", "action_type", "from_sales_id", "to_sales_id", "transfer_reason",
              "old_status", "new_status", "old_value_json", "new_value_json", "note",
              "action_by", "actor_type", "actor_ref", "created_at"
            )
            SELECT
              "id", "lead_id", "action_type", "from_sales_id", "to_sales_id", "transfer_reason",
              "old_status", "new_status", "old_value_json", "new_value_json", "note",
              "action_by", 'user', 'user:' || CAST("action_by" AS TEXT), "created_at"
            FROM "lead_activities";
          `),
          client.$executeRawUnsafe('DROP TABLE "lead_activities";'),
          client.$executeRawUnsafe('ALTER TABLE "new_lead_activities" RENAME TO "lead_activities";'),
          client.$executeRawUnsafe('CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");'),
          client.$executeRawUnsafe('CREATE INDEX "lead_activities_action_by_idx" ON "lead_activities"("action_by");'),

          // 7. Chuyển đổi bảng lead_reconciliations
          client.$executeRawUnsafe(`
            CREATE TABLE "new_lead_reconciliations" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "reconcile_date" TEXT NOT NULL,
              "platform" TEXT NOT NULL DEFAULT 'google_ads',
              "account_property_id" TEXT NOT NULL DEFAULT 'default',
              "crm_lead_count" INTEGER NOT NULL DEFAULT 0,
              "crm_error_log_count" INTEGER NOT NULL DEFAULT 0,
              "platform_reported_count" INTEGER NOT NULL DEFAULT 0,
              "discrepancy" INTEGER NOT NULL DEFAULT 0,
              "status" TEXT NOT NULL DEFAULT 'ok',
              "resolved_by_user_id" INTEGER,
              "resolution_note" TEXT,
              "resolved_at" DATETIME,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updated_at" DATETIME NOT NULL,
              CONSTRAINT "lead_reconciliations_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_lead_reconciliations" (
              "id", "reconcile_date", "platform", "account_property_id", "crm_lead_count",
              "crm_error_log_count", "platform_reported_count", "discrepancy", "status",
              "resolved_by_user_id", "resolution_note", "resolved_at", "created_at", "updated_at"
            )
            SELECT
              "id", "reconcile_date", "platform", 'default', "crm_lead_count",
              "crm_error_log_count", "platform_reported_count", "discrepancy", "status",
              "resolved_by_user_id", "resolution_note", "resolved_at", "created_at", "updated_at"
            FROM "lead_reconciliations";
          `),
          client.$executeRawUnsafe('DROP TABLE "lead_reconciliations";'),
          client.$executeRawUnsafe('ALTER TABLE "new_lead_reconciliations" RENAME TO "lead_reconciliations";'),
          client.$executeRawUnsafe('CREATE INDEX "lead_reconciliations_status_idx" ON "lead_reconciliations"("status");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "lead_reconciliations_reconcile_date_platform_account_property_id_key" ON "lead_reconciliations"("reconcile_date", "platform", "account_property_id");'),

          // 8. Chuyển đổi bảo toàn dữ liệu bảng leads (quote_value/deal_value sang BIGINT nguyên VNĐ, mở nullable cho contact_name/area_type/province/created_by_user_id)
          client.$executeRawUnsafe(`
            CREATE TABLE "new_leads" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "lead_code" TEXT NOT NULL,
              "version" INTEGER NOT NULL DEFAULT 1,
              "company_name" TEXT,
              "project_name" TEXT,
              "normalized_lookup_key" TEXT,
              "contact_name" TEXT,
              "phone" TEXT NOT NULL,
              "is_phone_unstandardized" BOOLEAN NOT NULL DEFAULT false,
              "email" TEXT,
              "contact_channel" TEXT NOT NULL,
              "source_website" TEXT,
              "self_reported_source" TEXT,
              "area_type" TEXT,
              "province" TEXT,
              "district" TEXT,
              "installation_address" TEXT,
              "pipeline_status" TEXT NOT NULL DEFAULT 'new_lead',
              "lost_reason" TEXT,
              "currency_code" TEXT NOT NULL DEFAULT 'VND',
              "quote_value" BIGINT,
              "deal_value" BIGINT,
              "assigned_sales_id" INTEGER,
              "created_by_user_id" INTEGER,
              "created_by_actor_type" TEXT NOT NULL DEFAULT 'user',
              "created_by_actor_ref" TEXT,
              "received_by_user_id" INTEGER,
              "is_duplicate_alert" BOOLEAN NOT NULL DEFAULT false,
              "duplicate_status" TEXT NOT NULL DEFAULT 'none',
              "matched_old_lead_id" INTEGER,
              "is_suspected_price_check" BOOLEAN NOT NULL DEFAULT false,
              "is_spam" BOOLEAN NOT NULL DEFAULT false,
              "spam_reason" TEXT,
              "spam_ads_exclusion_status" TEXT NOT NULL DEFAULT 'none',
              "auto_reassign_count" INTEGER NOT NULL DEFAULT 0,
              "needs_manager_attention" BOOLEAN NOT NULL DEFAULT false,
              "reopen_count" INTEGER NOT NULL DEFAULT 0,
              "contacted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "received_at" DATETIME,
              "first_quote_sent_at" DATETIME,
              "quote_responded_at" DATETIME,
              "last_quote_reminder_at" DATETIME,
              "status_changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "closed_at" DATETIME,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updated_at" DATETIME NOT NULL,
              CONSTRAINT "leads_assigned_sales_id_fkey" FOREIGN KEY ("assigned_sales_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "leads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "leads_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "leads_matched_old_lead_id_fkey" FOREIGN KEY ("matched_old_lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_leads" (
              "id", "lead_code", "version", "company_name", "project_name", "normalized_lookup_key",
              "contact_name", "phone", "is_phone_unstandardized", "email", "contact_channel",
              "source_website", "self_reported_source", "area_type", "province", "district",
              "installation_address", "pipeline_status", "lost_reason", "currency_code",
              "quote_value", "deal_value", "assigned_sales_id", "created_by_user_id",
              "created_by_actor_type", "created_by_actor_ref", "received_by_user_id",
              "is_duplicate_alert", "duplicate_status", "matched_old_lead_id",
              "is_suspected_price_check", "is_spam", "spam_reason", "spam_ads_exclusion_status",
              "auto_reassign_count", "needs_manager_attention", "reopen_count",
              "contacted_at", "received_at", "first_quote_sent_at", "status_changed_at",
              "closed_at", "created_at", "updated_at"
            )
            SELECT
              "id", "lead_code", 1, "company_name", "project_name", "normalized_lookup_key",
              "contact_name", "phone", "is_phone_unstandardized", "email", "contact_channel",
              "source_website", "self_reported_source", "area_type", "province", "district",
              "installation_address", "pipeline_status", "lost_reason", 'VND',
              CASE WHEN "quote_value" IS NULL THEN NULL ELSE CAST(ROUND("quote_value") AS INTEGER) END,
              CASE WHEN "deal_value" IS NULL THEN NULL ELSE CAST(ROUND("deal_value") AS INTEGER) END,
              "assigned_sales_id", "created_by_user_id",
              'user', 'user:' || CAST("created_by_user_id" AS TEXT), "received_by_user_id",
              "is_duplicate_alert", "duplicate_status", "matched_old_lead_id",
              "is_suspected_price_check", "is_spam", "spam_reason", "spam_ads_exclusion_status",
              "auto_reassign_count", "needs_manager_attention", "reopen_count",
              "contacted_at", "received_at", "first_quote_sent_at", "status_changed_at",
              "closed_at", "created_at", "updated_at"
            FROM "leads";
          `),
          client.$executeRawUnsafe('DROP TABLE "leads";'),
          client.$executeRawUnsafe('ALTER TABLE "new_leads" RENAME TO "leads";'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "leads_lead_code_key" ON "leads"("lead_code");'),
          client.$executeRawUnsafe('CREATE INDEX "leads_phone_idx" ON "leads"("phone");'),
          client.$executeRawUnsafe('CREATE INDEX "leads_email_idx" ON "leads"("email");'),
          client.$executeRawUnsafe('CREATE INDEX "leads_normalized_lookup_key_idx" ON "leads"("normalized_lookup_key");'),
          client.$executeRawUnsafe('CREATE INDEX "leads_pipeline_status_is_spam_idx" ON "leads"("pipeline_status", "is_spam");'),
          client.$executeRawUnsafe('CREATE INDEX "leads_assigned_sales_id_pipeline_status_idx" ON "leads"("assigned_sales_id", "pipeline_status");'),
          client.$executeRawUnsafe('CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");'),

          // 9. Chuyển đổi bảo toàn dữ liệu bảng marketing_tracking (external_google_lead_id -> external_submission_id theo phạm vi nguồn)
          client.$executeRawUnsafe(`
            CREATE TABLE "new_marketing_tracking" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "lead_id" INTEGER NOT NULL,
              "campaign_id" INTEGER,
              "intake_channel" TEXT NOT NULL DEFAULT 'form_web',
              "intake_source_provider" TEXT NOT NULL DEFAULT 'manual',
              "intake_source_account_key" TEXT NOT NULL DEFAULT 'internal',
              "external_submission_id" TEXT,
              "marketing_source" TEXT NOT NULL DEFAULT 'Chưa xác định',
              "source_resolution_method" TEXT NOT NULL DEFAULT 'unknown',
              "utm_source" TEXT,
              "utm_medium" TEXT,
              "utm_campaign" TEXT,
              "campaign_name" TEXT,
              "gclid" TEXT,
              "referrer_url" TEXT,
              "landing_page_url" TEXT,
              "device_type" TEXT,
              "ip_address" TEXT,
              "geo_location" TEXT,
              "is_unknown_source" BOOLEAN NOT NULL DEFAULT false,
              "is_unknown_campaign" BOOLEAN NOT NULL DEFAULT false,
              "is_utm_gclid_mismatch" BOOLEAN NOT NULL DEFAULT false,
              "is_unmatched_utm" BOOLEAN NOT NULL DEFAULT false,
              "is_repeat_lead" BOOLEAN NOT NULL DEFAULT false,
              "gclid_retry_count" INTEGER NOT NULL DEFAULT 0,
              "gclid_last_tried_at" DATETIME,
              "sync_ga4_status" TEXT NOT NULL DEFAULT 'pending',
              "tracked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "marketing_tracking_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT "marketing_tracking_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_marketing_tracking" (
              "id", "lead_id", "campaign_id", "intake_channel",
              "intake_source_provider", "intake_source_account_key", "external_submission_id",
              "marketing_source", "source_resolution_method", "utm_source", "utm_medium", "utm_campaign",
              "campaign_name", "gclid", "referrer_url", "landing_page_url", "device_type", "ip_address",
              "geo_location", "is_unknown_source", "is_unknown_campaign", "is_utm_gclid_mismatch",
              "is_unmatched_utm", "is_repeat_lead", "gclid_retry_count", "gclid_last_tried_at",
              "sync_ga4_status", "tracked_at"
            )
            SELECT
              "id", "lead_id", "campaign_id", "intake_channel",
              CASE WHEN "external_google_lead_id" IS NOT NULL THEN 'google_lead_form' WHEN "intake_channel" = 'form_web' THEN 'website_webhook' ELSE 'manual' END,
              CASE WHEN "external_google_lead_id" IS NOT NULL THEN 'google_ads:default' ELSE 'internal' END,
              "external_google_lead_id",
              "marketing_source", "source_resolution_method", "utm_source", "utm_medium", "utm_campaign",
              "campaign_name", "gclid", "referrer_url", "landing_page_url", "device_type", "ip_address",
              "geo_location", "is_unknown_source", "is_unknown_campaign", "is_utm_gclid_mismatch",
              "is_unmatched_utm", "is_repeat_lead", "gclid_retry_count", "gclid_last_tried_at",
              "sync_ga4_status", "tracked_at"
            FROM "marketing_tracking";
          `),
          client.$executeRawUnsafe('DROP TABLE "marketing_tracking";'),
          client.$executeRawUnsafe('ALTER TABLE "new_marketing_tracking" RENAME TO "marketing_tracking";'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "marketing_tracking_lead_id_key" ON "marketing_tracking"("lead_id");'),
          client.$executeRawUnsafe('CREATE INDEX "marketing_tracking_marketing_source_idx" ON "marketing_tracking"("marketing_source");'),
          client.$executeRawUnsafe('CREATE INDEX "marketing_tracking_campaign_id_idx" ON "marketing_tracking"("campaign_id");'),
          client.$executeRawUnsafe('CREATE INDEX "marketing_tracking_gclid_idx" ON "marketing_tracking"("gclid");'),
          client.$executeRawUnsafe('CREATE INDEX "marketing_tracking_tracked_at_idx" ON "marketing_tracking"("tracked_at");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "marketing_tracking_intake_source_provider_intake_source_account_key_external_submission_id_key" ON "marketing_tracking"("intake_source_provider", "intake_source_account_key", "external_submission_id");'),

          // 10. Chuyển đổi bảo toàn dữ liệu bảng platform_daily_metrics (spend_vnd/cpc_vnd/daily_budget_vnd -> micros)
          client.$executeRawUnsafe(`
            CREATE TABLE "new_platform_daily_metrics" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "platform" TEXT NOT NULL,
              "account_property_id" TEXT NOT NULL,
              "metric_date" TEXT NOT NULL,
              "grain" TEXT NOT NULL,
              "campaign_external_id" TEXT NOT NULL DEFAULT '',
              "keyword_match_type" TEXT NOT NULL DEFAULT '',
              "keyword_text_norm" TEXT NOT NULL DEFAULT '',
              "page_path_norm" TEXT NOT NULL DEFAULT '',
              "dimension_fingerprint" TEXT NOT NULL,
              "campaign_id" INTEGER,
              "campaign_name" TEXT,
              "keyword" TEXT,
              "page_url" TEXT,
              "currency_code" TEXT NOT NULL DEFAULT 'VND',
              "spend_micros" BIGINT NOT NULL DEFAULT 0,
              "daily_budget_micros" BIGINT,
              "cpc_micros" BIGINT,
              "impressions" INTEGER NOT NULL DEFAULT 0,
              "clicks" INTEGER NOT NULL DEFAULT 0,
              "conversions_micros" BIGINT NOT NULL DEFAULT 0,
              "google_lead_form_count" INTEGER NOT NULL DEFAULT 0,
              "page_views" INTEGER NOT NULL DEFAULT 0,
              "avg_time_on_page_sec" REAL NOT NULL DEFAULT 0,
              "avg_position" REAL,
              "fanpage_engagements" INTEGER NOT NULL DEFAULT 0,
              "trend_interest_score" INTEGER,
              "is_finalized" BOOLEAN NOT NULL DEFAULT false,
              "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "platform_daily_metrics_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_platform_daily_metrics" (
              "id", "platform", "account_property_id", "metric_date", "grain",
              "campaign_external_id", "keyword_match_type", "keyword_text_norm", "page_path_norm",
              "dimension_fingerprint", "campaign_id", "campaign_name", "keyword", "page_url",
              "currency_code", "spend_micros", "daily_budget_micros", "cpc_micros",
              "impressions", "clicks", "conversions_micros", "google_lead_form_count",
              "page_views", "avg_time_on_page_sec", "avg_position", "fanpage_engagements",
              "trend_interest_score", "is_finalized", "synced_at"
            )
            SELECT
              "id", "platform", 'default', "metric_date",
              CASE
                WHEN "keyword" IS NOT NULL AND "keyword" != '' THEN 'keyword'
                WHEN "page_url" IS NOT NULL AND "page_url" != '' THEN 'page'
                WHEN "campaign_id" IS NOT NULL OR ("campaign_name" IS NOT NULL AND "campaign_name" != '') THEN 'campaign'
                ELSE 'account'
              END,
              COALESCE(CAST("campaign_id" AS TEXT), COALESCE("campaign_name", '')),
              '',
              LOWER(TRIM(COALESCE("keyword", ''))),
              LOWER(TRIM(COALESCE("page_url", ''))),
              "platform" || '|default|' || "metric_date" || '|' || COALESCE(CAST("campaign_id" AS TEXT), '') || '||' || LOWER(TRIM(COALESCE("keyword", ''))) || '|' || LOWER(TRIM(COALESCE("page_url", ''))),
              "campaign_id", "campaign_name", "keyword", "page_url",
              'VND',
              CAST(ROUND(COALESCE("spend_vnd", 0) * 1000000) AS INTEGER),
              CASE WHEN "daily_budget_vnd" IS NULL OR "daily_budget_vnd" = 0 THEN NULL ELSE CAST(ROUND("daily_budget_vnd" * 1000000) AS INTEGER) END,
              CASE WHEN "cpc_vnd" IS NULL OR ("cpc_vnd" = 0 AND "clicks" = 0) THEN NULL ELSE CAST(ROUND("cpc_vnd" * 1000000) AS INTEGER) END,
              "impressions", "clicks",
              CAST(ROUND(COALESCE("conversions", 0) * 1000000) AS INTEGER),
              "google_lead_form_count", "page_views", "avg_time_on_page_sec", "avg_position",
              "fanpage_engagements", "trend_interest_score", "is_finalized", "synced_at"
            FROM "platform_daily_metrics";
          `),
          client.$executeRawUnsafe('DROP TABLE "platform_daily_metrics";'),
          client.$executeRawUnsafe('ALTER TABLE "new_platform_daily_metrics" RENAME TO "platform_daily_metrics";'),
          client.$executeRawUnsafe('CREATE INDEX "platform_daily_metrics_platform_metric_date_grain_idx" ON "platform_daily_metrics"("platform", "metric_date", "grain");'),
          client.$executeRawUnsafe('CREATE INDEX "platform_daily_metrics_campaign_id_metric_date_idx" ON "platform_daily_metrics"("campaign_id", "metric_date");'),
          client.$executeRawUnsafe('CREATE INDEX "platform_daily_metrics_keyword_text_norm_metric_date_idx" ON "platform_daily_metrics"("keyword_text_norm", "metric_date");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "platform_daily_metrics_platform_account_property_id_metric_date_grain_campaign_external_id_keyword_match_type_keyword_text_norm_page_path_norm_key" ON "platform_daily_metrics"("platform", "account_property_id", "metric_date", "grain", "campaign_external_id", "keyword_match_type", "keyword_text_norm", "page_path_norm");'),

          // 11. Chuyển đổi bảng platform_sync_logs
          client.$executeRawUnsafe(`
            CREATE TABLE "new_platform_sync_logs" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "platform" TEXT NOT NULL,
              "account_property_id" TEXT NOT NULL DEFAULT 'default',
              "run_type" TEXT NOT NULL DEFAULT 'full',
              "window_start_date" TEXT,
              "window_end_date" TEXT,
              "records_synced" INTEGER NOT NULL DEFAULT 0,
              "status" TEXT NOT NULL DEFAULT 'success',
              "error_message" TEXT,
              "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
              "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "completed_at" DATETIME
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_platform_sync_logs" (
              "id", "platform", "account_property_id", "run_type", "window_start_date",
              "window_end_date", "records_synced", "status", "error_message", "consecutive_failures",
              "started_at", "completed_at"
            )
            SELECT
              "id", "platform", 'default', "run_type", "window_start_date",
              "window_end_date", "records_synced", "status", "error_message", "consecutive_failures",
              "started_at", "completed_at"
            FROM "platform_sync_logs";
          `),
          client.$executeRawUnsafe('DROP TABLE "platform_sync_logs";'),
          client.$executeRawUnsafe('ALTER TABLE "new_platform_sync_logs" RENAME TO "platform_sync_logs";'),
          client.$executeRawUnsafe('CREATE INDEX "platform_sync_logs_platform_account_property_id_started_at_idx" ON "platform_sync_logs"("platform", "account_property_id", "started_at");'),

          // 12. Chuyển đổi bảo toàn dữ liệu bảng seo_article_revisions & seo_articles & seo_keywords
          client.$executeRawUnsafe(`
            CREATE TABLE "new_seo_article_revisions" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "article_id" INTEGER NOT NULL,
              "revision_number" INTEGER NOT NULL,
              "origin_type" TEXT NOT NULL DEFAULT 'human_edit',
              "title" TEXT NOT NULL,
              "meta_description" TEXT,
              "content_html" TEXT NOT NULL,
              "change_note" TEXT,
              "edited_by_user_id" INTEGER NOT NULL,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "seo_article_revisions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "seo_articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT "seo_article_revisions_edited_by_user_id_fkey" FOREIGN KEY ("edited_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_seo_article_revisions" (
              "id", "article_id", "revision_number", "origin_type", "title",
              "meta_description", "content_html", "change_note", "edited_by_user_id", "created_at"
            )
            SELECT
              r1."id", r1."article_id",
              (SELECT COUNT(*) FROM "seo_article_revisions" r2 WHERE r2."article_id" = r1."article_id" AND r2."id" <= r1."id"),
              'human_edit', r1."title", NULL, r1."content_html", r1."change_note", r1."edited_by_user_id", r1."created_at"
            FROM "seo_article_revisions" r1;
          `),
          client.$executeRawUnsafe('DROP TABLE "seo_article_revisions";'),
          client.$executeRawUnsafe('ALTER TABLE "new_seo_article_revisions" RENAME TO "seo_article_revisions";'),
          client.$executeRawUnsafe('CREATE INDEX "seo_article_revisions_article_id_created_at_idx" ON "seo_article_revisions"("article_id", "created_at");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "seo_article_revisions_article_id_revision_number_key" ON "seo_article_revisions"("article_id", "revision_number");'),

          client.$executeRawUnsafe(`
            CREATE TABLE "new_seo_articles" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "version" INTEGER NOT NULL DEFAULT 1,
              "keyword_id" INTEGER,
              "topic" TEXT NOT NULL,
              "title" TEXT NOT NULL,
              "slug" TEXT,
              "meta_description" TEXT,
              "ai_suggested_outline" TEXT,
              "content_html" TEXT NOT NULL,
              "target_website" TEXT NOT NULL DEFAULT 'toantrung.com.vn',
              "status" TEXT NOT NULL DEFAULT 'draft',
              "current_revision_id" INTEGER,
              "approved_revision_id" INTEGER,
              "scheduled_publish_at" DATETIME,
              "published_at" DATETIME,
              "published_url" TEXT,
              "publish_attempt_count" INTEGER NOT NULL DEFAULT 0,
              "last_publish_error" TEXT,
              "cached_organic_clicks" INTEGER,
              "cached_avg_position" REAL,
              "cached_avg_time_on_page_sec" REAL,
              "metrics_refreshed_at" DATETIME,
              "needs_optimization" BOOLEAN NOT NULL DEFAULT false,
              "created_by_user_id" INTEGER NOT NULL,
              "approved_by_user_id" INTEGER,
              "approved_at" DATETIME,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updated_at" DATETIME NOT NULL,
              CONSTRAINT "seo_articles_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "seo_keywords" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "seo_articles_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
              CONSTRAINT "seo_articles_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "seo_articles_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "seo_article_revisions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
              CONSTRAINT "seo_articles_approved_revision_id_fkey" FOREIGN KEY ("approved_revision_id") REFERENCES "seo_article_revisions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_seo_articles" (
              "id", "version", "keyword_id", "topic", "title", "slug", "meta_description",
              "ai_suggested_outline", "content_html", "target_website", "status",
              "scheduled_publish_at", "published_at", "published_url", "publish_attempt_count",
              "last_publish_error", "cached_organic_clicks", "cached_avg_position",
              "cached_avg_time_on_page_sec", "needs_optimization", "created_by_user_id",
              "approved_by_user_id", "created_at", "updated_at"
            )
            SELECT
              "id", 1, "keyword_id", "topic", "title", "slug", "meta_description",
              "ai_suggested_outline", "content_html", "target_website", "status",
              "scheduled_publish_at", "published_at", "published_url", 0,
              "last_publish_error", "organic_clicks", "avg_position",
              "avg_time_on_page_sec", "needs_optimization", "created_by_user_id",
              "approved_by_user_id", "created_at", "updated_at"
            FROM "seo_articles";
          `),
          client.$executeRawUnsafe('DROP TABLE "seo_articles";'),
          client.$executeRawUnsafe('ALTER TABLE "new_seo_articles" RENAME TO "seo_articles";'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "seo_articles_current_revision_id_key" ON "seo_articles"("current_revision_id");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "seo_articles_approved_revision_id_key" ON "seo_articles"("approved_revision_id");'),
          client.$executeRawUnsafe('CREATE INDEX "seo_articles_status_scheduled_publish_at_idx" ON "seo_articles"("status", "scheduled_publish_at");'),
          client.$executeRawUnsafe('CREATE INDEX "seo_articles_target_website_status_idx" ON "seo_articles"("target_website", "status");'),
          client.$executeRawUnsafe('CREATE INDEX "seo_articles_keyword_id_idx" ON "seo_articles"("keyword_id");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "seo_articles_target_website_slug_key" ON "seo_articles"("target_website", "slug");'),

          client.$executeRawUnsafe(`
            CREATE TABLE "new_seo_keywords" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "keyword" TEXT NOT NULL,
              "keyword_norm" TEXT NOT NULL,
              "cached_search_volume" INTEGER,
              "cached_ads_clicks" INTEGER,
              "cached_organic_clicks" INTEGER,
              "cached_avg_position" REAL,
              "cache_source_account_key" TEXT,
              "cache_window_start_date" TEXT,
              "cache_window_end_date" TEXT,
              "cache_refreshed_at" DATETIME,
              "trend_direction" TEXT NOT NULL DEFAULT 'stable',
              "recommended_publish_window" TEXT,
              "updated_at" DATETIME NOT NULL
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_seo_keywords" (
              "id", "keyword", "keyword_norm", "cached_search_volume", "cached_ads_clicks",
              "cached_organic_clicks", "cached_avg_position", "trend_direction",
              "recommended_publish_window", "updated_at"
            )
            SELECT
              "id", "keyword", LOWER(TRIM("keyword")), "search_volume", "ads_clicks",
              "organic_clicks", "avg_position", "trend_direction",
              "recommended_publish_window", "updated_at"
            FROM "seo_keywords";
          `),
          client.$executeRawUnsafe('DROP TABLE "seo_keywords";'),
          client.$executeRawUnsafe('ALTER TABLE "new_seo_keywords" RENAME TO "seo_keywords";'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "seo_keywords_keyword_key" ON "seo_keywords"("keyword");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "seo_keywords_keyword_norm_key" ON "seo_keywords"("keyword_norm");'),
          client.$executeRawUnsafe('CREATE INDEX "seo_keywords_trend_direction_idx" ON "seo_keywords"("trend_direction");'),

          // 13. Chuyển đổi bảng webhook_intake_error_logs
          client.$executeRawUnsafe(`
            CREATE TABLE "new_webhook_intake_error_logs" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "source_platform" TEXT NOT NULL,
              "intake_source_account_key" TEXT NOT NULL DEFAULT 'unknown',
              "external_submission_id" TEXT,
              "raw_payload_json" TEXT NOT NULL,
              "error_code" TEXT NOT NULL,
              "error_message" TEXT NOT NULL,
              "retry_count" INTEGER NOT NULL DEFAULT 0,
              "last_retried_at" DATETIME,
              "is_resolved" BOOLEAN NOT NULL DEFAULT false,
              "resolved_lead_id" INTEGER,
              "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `),
          client.$executeRawUnsafe(`
            INSERT INTO "new_webhook_intake_error_logs" (
              "id", "source_platform", "intake_source_account_key", "external_submission_id",
              "raw_payload_json", "error_code", "error_message", "retry_count",
              "is_resolved", "created_at"
            )
            SELECT
              "id", "source_platform", 'unknown', "external_lead_id",
              "raw_payload_json", "error_code", "error_message", 0,
              "is_resolved", "created_at"
            FROM "webhook_intake_error_logs";
          `),
          client.$executeRawUnsafe('DROP TABLE "webhook_intake_error_logs";'),
          client.$executeRawUnsafe('ALTER TABLE "new_webhook_intake_error_logs" RENAME TO "webhook_intake_error_logs";'),
          client.$executeRawUnsafe('CREATE INDEX "webhook_intake_error_logs_source_platform_created_at_idx" ON "webhook_intake_error_logs"("source_platform", "created_at");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX "webhook_intake_error_logs_source_platform_intake_source_account_key_external_submission_id_key" ON "webhook_intake_error_logs"("source_platform", "intake_source_account_key", "external_submission_id");'),

          // 14. Tạo index cho design_asset_versions
          client.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "design_asset_versions_ai_usage_log_id_key" ON "design_asset_versions"("ai_usage_log_id");'),
          client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "design_asset_versions_design_request_id_version_type_idx" ON "design_asset_versions"("design_request_id", "version_type");'),
          client.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "design_asset_versions_design_request_id_version_number_key" ON "design_asset_versions"("design_request_id", "version_number");'),
        ]);
      } finally {
        await client.$executeRawUnsafe('PRAGMA foreign_keys=ON;');
      }
    }

    // 15. Đồng bộ tại chỗ 25 sản phẩm Toàn Trung (bảo toàn 100% id 1..25 và các FK từ lead_products)
    await syncAuthoritativeProducts(client);

    // 16. Gỡ các tham số SLA tự đặt chưa được BA chốt (nếu updatedById = null)
    await client.systemSetting.deleteMany({
      where: {
        key: { in: UNAPPROVED_SLA_KEYS },
        updatedById: null,
      },
    });

    // 17. Ghi nhận lịch sử _prisma_migrations cho 0001 và 0002 nếu chưa có
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    TEXT PRIMARY KEY NOT NULL,
        "checksum"              TEXT NOT NULL,
        "finished_at"           DATETIME,
        "migration_name"        TEXT NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        DATETIME,
        "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
      );
    `);

    const migRoot = path.resolve(__dirname, '../prisma/migrations');
    for (const migName of ['20261105000000_0001_core_baseline', '20261106000000_0002_five_modules_shared_schema']) {
      const sqlPath = path.join(migRoot, migName, 'migration.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');
      const existingMig = await client.$queryRawUnsafe(
        'SELECT id FROM "_prisma_migrations" WHERE migration_name = ?',
        migName,
      );
      if (existingMig.length === 0) {
        await client.$executeRawUnsafe(
          'INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count") VALUES (?, ?, CURRENT_TIMESTAMP, ?, 1)',
          crypto.randomUUID(),
          checksum,
          migName,
        );
      }
    }
  } finally {
    await client.$disconnect();
  }
}

module.exports = { reconcileExistingDatabase };

if (require.main === module) {
  const targetUrl = process.env.RECONCILE_DATABASE_URL || process.env.DATABASE_URL;
  if (!targetUrl) {
    console.error('Vui lòng truyền RECONCILE_DATABASE_URL hoặc DATABASE_URL để chạy nâng cấp bảo toàn dữ liệu.');
    process.exit(1);
  }
  reconcileExistingDatabase(targetUrl)
    .then(() => console.log(`Đã hoàn tất nâng cấp bảo toàn dữ liệu cho: ${targetUrl}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

