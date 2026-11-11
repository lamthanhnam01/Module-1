# Database dùng chung

Đọc [ERD gốc](../sources/assets/ba-erd.pdf), [từ điển ERD gốc](DATA_DICTIONARY.md) (giữ nguyên nguyên bản 9 bảng BA), [ownership](TABLE_OWNERSHIP.md) và [độ bao phủ](ERD_COVERAGE.md).

## Kiến trúc hiện tại & phân biệt nguồn

1. **Nguồn BA gốc được bảo toàn**: [DATA_DICTIONARY.md](DATA_DICTIONARY.md) giữ nguyên nguyên trạng 9 bảng từ ERD gốc (`roles`, `users`, `leads`, `products`, `lead_products`, `lead_attachments`, `lead_activities`, `marketing_tracking`, `design_requests`).
2. **Schema thực thi dùng chung (`prismaSchemaFolder`)**: Đặt tại `packages/database/prisma/` với Prisma `5.22.0` và provider phát triển `sqlite` (`prisma/schema.prisma` + `prisma/models/*.prisma`), cùng 1 lịch sử migration điều phối chung tại `prisma/migrations/`:
   - `20261105000000_0001_core_baseline`: Baseline 7 bảng Core hiện hữu (`roles`, `users`, `user_sessions`, `notifications`, `branding_assets`, `system_settings`, `audit_logs`).
   - `20261106000000_0002_five_modules_shared_schema`: Bổ sung bảng dùng chung `ai_usage_logs` (D5) trong `core.prisma` và 10 bảng nghiệp vụ của M01, M02, M03, M05 (tổng cộng 18 bảng). Bảng suy đoán `report_export_logs` (M04) đã được gắn cờ và loại khỏi schema dùng chung; `04-reports.prisma` chỉ giữ chú thích hợp đồng đọc dữ liệu.
3. **Một DB, một migration history**: Owner module quản lý nghiệp vụ/bảng của mình theo [TABLE_OWNERSHIP](TABLE_OWNERSHIP.md); không tách 5 DB hay 5 migrations độc lập. FE không import package DB; các repository backend dùng theo quyền/task và gọi các hàm giao dịch dùng chung tại `packages/database/src/operations.ts`.

## Quy ước kỹ thuật đã áp dụng và quyết định còn mở

- **Provider và hạ tầng ([Q01](../decisions/OPEN_QUESTIONS.md#q01))**: Giữ nguyên Prisma `5.22.0` và SQLite cho môi trường phát triển cục bộ; không tự ý đổi provider sang PostgreSQL hay nâng major khi chưa chốt hạ tầng production.
- **Biểu diễn tiền tệ & chi phí**:
  - Giá trị báo giá/hợp đồng VND (`leads.quote_value`, `leads.deal_value`): dùng `BigInt?` (đơn vị: đồng VND nguyên, kèm `currency_code`), hỗ trợ hợp đồng nhiều tỷ VND vượt giới hạn 32-bit `Int` mà không sai số dấu phẩy động. Các trường này được giữ ở tầng DB và **không tự động mở trên UI** khi [Q08](../decisions/OPEN_QUESTIONS.md#q08) đang mở.
  - Chi phí Ads/ngân sách/CPC và chi phí AI (`campaigns.daily_budget_micros`, `platform_daily_metrics.spend_micros` / `daily_budget_micros` / `cpc_micros`, `ai_usage_logs.cost_micros`, `design_requests.total_cost_micros`): dùng `BigInt` theo đơn vị **micros** (`1` đơn vị tiền tệ = `1,000,000` micros) kèm mã tiền tệ (`currency_code` / `cost_currency`), bảo toàn cả giá trị gốc từ Google Ads lẫn chi phí lẻ của mỗi lượt gọi AI mà không làm tròn cụt về VND nguyên.
  - Serialization qua API dùng helper chuẩn tại `packages/contracts/src/common/index.ts` (`MonetaryAmountDto`, `serializeBigInt`, `microsToDecimalString`).
- **Chống trùng (Idempotency) & Khóa duy nhất**:
  - Webhook intake định danh theo bộ 3 `(intake_source_provider, intake_source_account_key, external_submission_id)` và lưu Lead + Tracking + Activity nguyên tử qua `ingestLeadWithTrackingIdempotent`.
  - Số liệu đồng bộ đa kênh `platform_daily_metrics` khóa duy nhất theo `(platform, account_property_id, metric_date, grain, campaign_external_id, keyword_match_type, keyword_text_norm, page_path_norm)`.
- **Kiểm soát đồng thời (Optimistic Concurrency)**: Các bảng gốc có luồng duyệt/chuyển trạng thái (`leads`, `seo_articles`, `design_requests`) có cột `version` kiểm tra điều kiện `WHERE id = ? AND version = expectedVersion` và ghi lịch sử nguyên tử (`transitionLeadWithVersion`).
- An toàn dữ liệu, file và phục hồi tuân thủ [DATA_SAFETY](../DATA_SAFETY.md). File `packages/database/prisma/dev.db` hiện hữu không bị ghi đè tự động; việc diễn tập migration/backfill thực hiện trên bản sao tạm thời qua `packages/database/scripts/reconcile-existing-db.js`.
