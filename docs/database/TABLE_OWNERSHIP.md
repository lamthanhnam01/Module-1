# Quyền sở hữu bảng và phân tách file Prisma theo 5 nhóm

Để tránh xung đột Git (`merge conflict`) khi 5 nhóm cùng phát triển trên một Database dùng chung, schema Prisma (`5.22.0`, tính năng `prismaSchemaFolder`) được tách tại `packages/database/prisma/models/` — mỗi nhóm sở hữu **1 file `.prisma` riêng biệt** với quyền ghi (Write Owner) và phạm vi đọc (Read Consumers) rõ ràng:

| File Prisma (`packages/database/prisma/models/`) | Nhóm sở hữu ghi (Write Owner) | Các bảng Database (`@@map`) trong file | Nguồn BA / Use Case hỗ trợ | Quy tắc truy cập cho các nhóm khác |
| --- | --- | --- | --- | --- |
| `core.prisma` | Core / Admin (Shared) | `roles`, `users`, `user_sessions`, `notifications`, `branding_assets`, `system_settings`, `audit_logs`, `ai_usage_logs` | ERD gốc (`roles`, `users`), Core Auth/Settings, và kho **D5** (`ai_usage_logs` dùng chung cho UC05 & UC06) | Không tự sửa nếu chưa thống nhất Core. M03 và M05 ghi log AI qua hàm dùng chung `recordAiUsageAttempt`; M04 đọc báo cáo token/chi phí |
| `01-leads.prisma` | Nhóm 1 (`01-leads`) | `products`, `leads`, `lead_products`, `lead_attachments`, `lead_activities`, `price_check_alerts` | ERD gốc (5 bảng) + UC01 mục 2.3 / E5 (`price_check_alerts` cảnh báo dò giá) | M02 tạo Lead tự động qua contract nguyên tử `ingestLeadWithTrackingIdempotent`; M03/M04/M05 chỉ đọc theo phân quyền |
| `02-tracking-sync.prisma` | Nhóm 2 (`02-tracking-sync`) | `campaigns`, `marketing_tracking`, `platform_daily_metrics`, `platform_sync_logs`, `lead_reconciliations`, `webhook_intake_error_logs` | ERD gốc (`marketing_tracking`) + Kho **D3** & UC03 Luồng A, B, D, E1, E2 | M01 gắn/tra nguồn qua contract; M03 đọc metric từ khóa/trang chuẩn từ `platform_daily_metrics`; M04 đọc CPL/ROAS |
| `03-keywords-ads.prisma` | Nhóm 3 (`03-keywords-ads`) | `seo_keywords`, `seo_articles`, `seo_article_revisions` | Kho **D4** (DFD 5.0) & UC05 (Từ khóa, bài viết SEO, lịch sử phiên bản & duyệt đăng) | `seo_keywords` chỉ lưu cache dẫn xuất có cửa sổ thời gian từ `platform_daily_metrics`; M04 đọc thống kê SEO |
| `04-reports.prisma` | Nhóm 4 (`04-reports`) | *(Không tạo bảng riêng — Read-only consumer)* | UC04 (Dashboard BOD, Marketing/Ads, Kinh doanh, Thiết kế) | Chỉ đọc dữ liệu chuẩn từ D1–D6. Bảng suy đoán `report_export_logs` đã được loại bỏ để tránh tạo bảng dư thừa khi BA chưa yêu cầu lưu lịch sử file xuất |
| `05-ai-design.prisma` | Nhóm 5 (`05-ai-design`) | `design_requests`, `design_asset_versions` | ERD gốc (`design_requests`), Kho **D6** & UC06 (Thư viện phiên bản nháp AI / bản hoàn thiện Designer) | M01 đọc bản vẽ bàn giao đính kèm báo giá; M04 đọc thống kê ấn phẩm theo loại (3D/Banner) |

## Bảng đã gắn cờ suy đoán và loại bỏ khỏi Schema

- `report_export_logs` (trước đây dự kiến ở `04-reports.prisma`): UC04 yêu cầu xuất Excel (`.xlsx`) / Google Sheets nhưng không yêu cầu lưu bảng lịch sử xuất file riêng (nếu cần audit hành vi nhạy cảm thì dùng `audit_logs` của Core). Giữ `04-reports.prisma` làm tài liệu hợp đồng chỉ đọc.

## Nguyên tắc chống xung đột Database giữa 5 nhóm

1. **Mỗi nhóm chỉ sửa file `.prisma` của module mình** khi cần bổ sung cột hoặc index nội bộ; mọi thay đổi trên `core.prisma` hoặc migration dùng chung phải qua điều phối DB.
2. **Bảo toàn tên bảng (`@@map`) và tên cột (`@map`) gốc của ERD BA** đã khóa trong [DATA_DICTIONARY.md](DATA_DICTIONARY.md).
3. **Danh mục 25 sản phẩm Toàn Trung (`products`)** trong `packages/database/scripts/seed.js` khớp chính xác 100% với *Brief Mini CRM* (`docs/modules/01-leads.md` mục 2.1: 8 Màn hình LED `1..8`, 12 Bảng điện tử `9..20`, 5 Khác `21..25`) và cập nhật tại chỗ (in-place) theo `id` để không bao giờ làm gãy khóa ngoại `lead_products.product_id`.
4. **Không tự đẩy lệnh phá dữ liệu lên DB đang làm việc**: Kiểm tra/diễn tập trên DB tạm trước; khi đồng bộ schema dùng `npm run db:generate` và script đối soát bảo toàn dữ liệu `packages/database/scripts/reconcile-existing-db.js`.
