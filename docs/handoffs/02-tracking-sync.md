# Handoff 02-tracking-sync — Tracking nguồn và đồng bộ dữ liệu

Cập nhật: 06/11/2026.  
Nhóm 2 — Cát Cần Sỹ.  
Nhánh Git: `feature/tracking-integration`.  
Kho mã nguồn GitHub: `https://github.com/truongvanlong1905/ToanTrungMar` (nhánh `main`).

---

## 1. Hiện trạng & Nguồn nghiệp vụ chuẩn
- Đã tiếp nhận và phân tích toàn diện **Tài liệu đặc tả BA: UC03 (Tracking nguồn và đồng bộ dữ liệu đa kênh)**.
- Chi tiết đặc tả nghiệp vụ đầy đủ đã được ghi nhận tại [docs/modules/02-tracking-sync.md](../modules/02-tracking-sync.md).
- Khung thư mục mã nguồn đã sẵn sàng: `apps/web/src/modules/02-tracking-sync/`, `apps/api/src/modules/02-tracking-sync/`, `packages/contracts/src/02-tracking-sync/`.

---

## 2. Các nghiệp vụ trọng tâm đã chốt
1. **Quản lý 3 trường nguồn độc lập của Lead**:
   - `Kênh tiếp nhận`: Form website, Google lead form, Hotline, Zalo.
   - `Nguồn marketing`: Google Ads, Tìm kiếm tự nhiên, Mạng xã hội, Website giới thiệu, Truy cập trực tiếp, Khác, Chưa xác định, Nhập tay.
   - `Nguồn khách tự khai`: NVKD hỏi khách và nhập ở UC01 để đối chiếu (không thay thế Nguồn marketing).
2. **Luồng A — Bóc tách nguồn & Tra lại gclid**:
   - Ưu tiên: $\text{gclid} > \text{UTM} > \text{Referrer}$. Gắn cờ "UTM lệch gclid" khi có mâu thuẫn.
   - Job nền chạy mỗi giờ tra lại gclid cho các Lead tạo chưa quá 7 ngày. Lead lặp giữ tracking riêng, không ghi đè.
3. **Luồng B — Đồng bộ số liệu nền tảng**:
   - Chạy 02:00 (đầy đủ mọi nền tảng, cửa sổ 7 ngày, Google Ads 30 ngày); chạy 11:00 & 17:00 (chỉ Google Ads, hôm nay và hôm qua).
   - Thu thập: Chi phí, ngân sách ngày, CPC, click, hiển thị, từ khóa Google Ads; truy cập GA4; vị trí Search Console; tương tác Fanpage.
4. **Luồng C — Dashboard Marketing & Ads**:
   - 3 cấp đếm Lead: **L1 Lead thô** (tất cả), **L2 Lead hợp lệ** (trừ Spam cho Pipeline), **L3 Lead hiệu quả** (trừ Spam đã xác nhận để tính chi phí/CPL).
   - Tính ROAS nội bộ, chi phí/Lead, chi phí/báo giá, chi phí/chốt.
5. **Luồng D — Đối soát Lead (Reconciliation)**:
   - So khớp tự động số Lead form Google trong CRM với số lượt gửi form do Google báo. Chênh lệch $\ge 2$ Lead $\rightarrow$ Cảnh báo trên dashboard.
6. **Database Model (Đã hoàn thiện tại `packages/database/prisma/models/02-tracking-sync.prisma`)**:
   - Gồm 6 bảng: `campaigns` (khóa duy nhất theo `platform + account_external_id + campaign_code`), `marketing_tracking` (khóa chống trùng webhook theo `intake_source_provider + intake_source_account_key + external_submission_id`), `platform_daily_metrics` (chi phí/ngân sách/CPC lưu bằng `BigInt` micros kèm `currency_code`, khóa duy nhất đủ 8 chiều chuẩn hóa), `platform_sync_logs`, `lead_reconciliations`, `webhook_intake_error_logs`.
   - Đã có hàm giao dịch nguyên tử `ingestLeadWithTrackingIdempotent` và `upsertPlatformMetricIdempotent` tại `packages/database/src/operations.ts`. Quyền sửa tay Nguồn/Chiến dịch chờ BA chốt giữa `UC03-4` và `UC03 BR5` tại [Q02](../decisions/OPEN_QUESTIONS.md#q02).
