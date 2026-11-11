# Handoff 03-keywords-ads — Từ khóa, Ads và Nội dung SEO tích hợp AI

Cập nhật: 06/11/2026.  
Nhóm 3 — Nguyễn Anh Quân.  
Nhánh Git: `feature/ads-keywords`.  
Kho mã nguồn GitHub: `https://github.com/truongvanlong1905/ToanTrungMar` (nhánh `main`).

---

## 1. Hiện trạng & Nguồn nghiệp vụ chuẩn
- Đã tiếp nhận và phân tích toàn diện **Tài liệu đặc tả BA: UC05 (Nội dung SEO tích hợp AI)**.
- Chi tiết đặc tả nghiệp vụ đầy đủ đã được ghi nhận tại [docs/modules/03-keywords-ads.md](../modules/03-keywords-ads.md).
- Khung thư mục mã nguồn đã sẵn sàng: `apps/web/src/modules/03-keywords-ads/`, `apps/api/src/modules/03-keywords-ads/`, `packages/contracts/src/03-keywords-ads/`.

---

## 2. Các nghiệp vụ trọng tâm đã chốt
1. **Theo dõi từ khóa & Phân tích xu hướng**:
   - Dữ liệu đồng bộ từ UC03 (Google Ads, Search Console, Google Trends).
   - Nhân viên Marketing chọn từ khóa và chủ đề bài viết. Nhân viên Ads chỉ xem số liệu để hỗ trợ.
2. **AI soạn thảo bản nháp SEO**:
   - Hệ thống gửi từ khóa và chủ đề sang AI để sinh bản nháp (tiêu đề, meta description, thẻ H2/H3, nội dung, mật độ từ khóa).
   - Lưu bài viết ở trạng thái `Nháp`.
3. **Biên tập & Phê duyệt (Approval)**:
   - Marketing chỉnh sửa nội dung, chèn ảnh thực tế (lưu lịch sử chỉnh sửa).
   - Gợi ý ngày/giờ đăng theo xu hướng từ khóa. Marketing chọn lịch và website đích.
   - Bấm "Duyệt bài" $\rightarrow$ Trạng thái chuyển sang `Đã duyệt - chờ đăng`. Cho phép rút duyệt về lại `Nháp`.
4. **Tự động đẩy bài lên 3 Website Toàn Trung**:
   - Đến giờ hẹn, worker tự động đẩy bài qua API lên website đích. Thành công $\rightarrow$ Trạng thái `Đã đăng` kèm link bài viết. Lỗi $\rightarrow$ Báo lỗi, giữ trạng thái chờ đăng.
5. **Đo lường & Tối ưu bài viết cũ**:
   - Theo dõi click, vị trí, thời gian đọc qua GA4/Search Console; rà soát và gợi ý tối ưu các bài viết có hiệu suất thấp.
6. **Database Model (Đã hoàn thiện tại `packages/database/prisma/models/03-keywords-ads.prisma`)**:
   - Gồm 3 bảng: `seo_keywords` (các cột metric được đánh dấu rõ là `cached_*` dẫn xuất từ bảng chuẩn `platform_daily_metrics` kèm cửa sổ thời gian và thời điểm làm mới), `seo_articles` (có `version`, `current_revision_id`, `approved_revision_id` khóa đúng phiên bản được duyệt, và `@@unique([target_website, slug])`), `seo_article_revisions` (`@@unique([article_id, revision_number])`).
   - Ghi nhận token/chi phí AI qua bảng dùng chung `ai_usage_logs` (`core.prisma`) và hàm `recordAiUsageAttempt`.
