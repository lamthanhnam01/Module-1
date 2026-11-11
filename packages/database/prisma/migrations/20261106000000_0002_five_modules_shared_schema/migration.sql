-- CreateTable
CREATE TABLE "products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category_group" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'm2',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "leads" (
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

-- CreateTable
CREATE TABLE "lead_products" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lead_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "custom_product_name" TEXT,
    "requested_dimension" TEXT,
    "note_specification" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_products_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_attachments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lead_id" INTEGER NOT NULL,
    "attachment_type" TEXT NOT NULL,
    "folder_path" TEXT,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size_kb" INTEGER NOT NULL,
    "uploaded_by" INTEGER NOT NULL,
    "uploaded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_attachments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_activities" (
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

-- CreateTable
CREATE TABLE "price_check_alerts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lead_id" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "company_name" TEXT,
    "normalized_lookup_key" TEXT,
    "reason" TEXT NOT NULL,
    "chat_screenshot_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "previous_alert_id" INTEGER,
    "created_by_user_id" INTEGER NOT NULL,
    "removed_by_user_id" INTEGER,
    "removed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "price_check_alerts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "price_check_alerts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "price_check_alerts_removed_by_user_id_fkey" FOREIGN KEY ("removed_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "campaigns" (
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

-- CreateTable
CREATE TABLE "marketing_tracking" (
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

-- CreateTable
CREATE TABLE "platform_daily_metrics" (
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

-- CreateTable
CREATE TABLE "platform_sync_logs" (
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

-- CreateTable
CREATE TABLE "lead_reconciliations" (
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

-- CreateTable
CREATE TABLE "webhook_intake_error_logs" (
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

-- CreateTable
CREATE TABLE "seo_keywords" (
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

-- CreateTable
CREATE TABLE "seo_articles" (
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

-- CreateTable
CREATE TABLE "seo_article_revisions" (
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

-- CreateTable
CREATE TABLE "design_requests" (
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

-- CreateTable
CREATE TABLE "design_asset_versions" (
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

-- CreateTable
CREATE TABLE "ai_usage_logs" (
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT 'sales',
    "specialty_group" TEXT,
    "is_receiving_leads" BOOLEAN NOT NULL DEFAULT true,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_users" ("avatar_url", "created_at", "deleted_at", "department", "email", "full_name", "id", "is_active", "password_hash", "phone", "role_id", "updated_at") SELECT "avatar_url", "created_at", "deleted_at", "department", "email", "full_name", "id", "is_active", "password_hash", "phone", "role_id", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_id_idx" ON "users"("role_id");
CREATE INDEX "users_department_is_active_is_receiving_leads_idx" ON "users"("department", "is_active", "is_receiving_leads");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");

-- CreateIndex
CREATE INDEX "products_category_group_is_active_idx" ON "products"("category_group", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "leads_lead_code_key" ON "leads"("lead_code");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_normalized_lookup_key_idx" ON "leads"("normalized_lookup_key");

-- CreateIndex
CREATE INDEX "leads_pipeline_status_is_spam_idx" ON "leads"("pipeline_status", "is_spam");

-- CreateIndex
CREATE INDEX "leads_assigned_sales_id_pipeline_status_idx" ON "leads"("assigned_sales_id", "pipeline_status");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "lead_products_lead_id_idx" ON "lead_products"("lead_id");

-- CreateIndex
CREATE INDEX "lead_products_product_id_idx" ON "lead_products"("product_id");

-- CreateIndex
CREATE INDEX "lead_attachments_lead_id_attachment_type_idx" ON "lead_attachments"("lead_id", "attachment_type");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "lead_activities_action_by_idx" ON "lead_activities"("action_by");

-- CreateIndex
CREATE INDEX "price_check_alerts_phone_status_idx" ON "price_check_alerts"("phone", "status");

-- CreateIndex
CREATE INDEX "price_check_alerts_normalized_lookup_key_status_idx" ON "price_check_alerts"("normalized_lookup_key", "status");

-- CreateIndex
CREATE INDEX "price_check_alerts_lead_id_idx" ON "price_check_alerts"("lead_id");

-- CreateIndex
CREATE INDEX "campaigns_utm_campaign_slug_idx" ON "campaigns"("utm_campaign_slug");

-- CreateIndex
CREATE INDEX "campaigns_platform_is_active_idx" ON "campaigns"("platform", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_platform_account_external_id_campaign_code_key" ON "campaigns"("platform", "account_external_id", "campaign_code");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_tracking_lead_id_key" ON "marketing_tracking"("lead_id");

-- CreateIndex
CREATE INDEX "marketing_tracking_marketing_source_idx" ON "marketing_tracking"("marketing_source");

-- CreateIndex
CREATE INDEX "marketing_tracking_campaign_id_idx" ON "marketing_tracking"("campaign_id");

-- CreateIndex
CREATE INDEX "marketing_tracking_gclid_idx" ON "marketing_tracking"("gclid");

-- CreateIndex
CREATE INDEX "marketing_tracking_tracked_at_idx" ON "marketing_tracking"("tracked_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_tracking_intake_source_provider_intake_source_account_key_external_submission_id_key" ON "marketing_tracking"("intake_source_provider", "intake_source_account_key", "external_submission_id");

-- CreateIndex
CREATE INDEX "platform_daily_metrics_platform_metric_date_grain_idx" ON "platform_daily_metrics"("platform", "metric_date", "grain");

-- CreateIndex
CREATE INDEX "platform_daily_metrics_campaign_id_metric_date_idx" ON "platform_daily_metrics"("campaign_id", "metric_date");

-- CreateIndex
CREATE INDEX "platform_daily_metrics_keyword_text_norm_metric_date_idx" ON "platform_daily_metrics"("keyword_text_norm", "metric_date");

-- CreateIndex
CREATE UNIQUE INDEX "platform_daily_metrics_platform_account_property_id_metric_date_grain_campaign_external_id_keyword_match_type_keyword_text_norm_page_path_norm_key" ON "platform_daily_metrics"("platform", "account_property_id", "metric_date", "grain", "campaign_external_id", "keyword_match_type", "keyword_text_norm", "page_path_norm");

-- CreateIndex
CREATE INDEX "platform_sync_logs_platform_account_property_id_started_at_idx" ON "platform_sync_logs"("platform", "account_property_id", "started_at");

-- CreateIndex
CREATE INDEX "lead_reconciliations_status_idx" ON "lead_reconciliations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lead_reconciliations_reconcile_date_platform_account_property_id_key" ON "lead_reconciliations"("reconcile_date", "platform", "account_property_id");

-- CreateIndex
CREATE INDEX "webhook_intake_error_logs_source_platform_created_at_idx" ON "webhook_intake_error_logs"("source_platform", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_intake_error_logs_source_platform_intake_source_account_key_external_submission_id_key" ON "webhook_intake_error_logs"("source_platform", "intake_source_account_key", "external_submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "seo_keywords_keyword_key" ON "seo_keywords"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "seo_keywords_keyword_norm_key" ON "seo_keywords"("keyword_norm");

-- CreateIndex
CREATE INDEX "seo_keywords_trend_direction_idx" ON "seo_keywords"("trend_direction");

-- CreateIndex
CREATE UNIQUE INDEX "seo_articles_current_revision_id_key" ON "seo_articles"("current_revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "seo_articles_approved_revision_id_key" ON "seo_articles"("approved_revision_id");

-- CreateIndex
CREATE INDEX "seo_articles_status_scheduled_publish_at_idx" ON "seo_articles"("status", "scheduled_publish_at");

-- CreateIndex
CREATE INDEX "seo_articles_target_website_status_idx" ON "seo_articles"("target_website", "status");

-- CreateIndex
CREATE INDEX "seo_articles_keyword_id_idx" ON "seo_articles"("keyword_id");

-- CreateIndex
CREATE UNIQUE INDEX "seo_articles_target_website_slug_key" ON "seo_articles"("target_website", "slug");

-- CreateIndex
CREATE INDEX "seo_article_revisions_article_id_created_at_idx" ON "seo_article_revisions"("article_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seo_article_revisions_article_id_revision_number_key" ON "seo_article_revisions"("article_id", "revision_number");

-- CreateIndex
CREATE UNIQUE INDEX "design_requests_approved_version_id_key" ON "design_requests"("approved_version_id");

-- CreateIndex
CREATE INDEX "design_requests_lead_id_idx" ON "design_requests"("lead_id");

-- CreateIndex
CREATE INDEX "design_requests_assigned_designer_id_design_status_idx" ON "design_requests"("assigned_designer_id", "design_status");

-- CreateIndex
CREATE INDEX "design_requests_request_type_design_status_idx" ON "design_requests"("request_type", "design_status");

-- CreateIndex
CREATE UNIQUE INDEX "design_asset_versions_ai_usage_log_id_key" ON "design_asset_versions"("ai_usage_log_id");

-- CreateIndex
CREATE INDEX "design_asset_versions_design_request_id_version_type_idx" ON "design_asset_versions"("design_request_id", "version_type");

-- CreateIndex
CREATE UNIQUE INDEX "design_asset_versions_design_request_id_version_number_key" ON "design_asset_versions"("design_request_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_logs_idempotency_key_key" ON "ai_usage_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "ai_usage_logs_module_code_created_at_idx" ON "ai_usage_logs"("module_code", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_logs_design_request_id_idx" ON "ai_usage_logs"("design_request_id");

-- CreateIndex
CREATE INDEX "ai_usage_logs_seo_article_id_idx" ON "ai_usage_logs"("seo_article_id");

