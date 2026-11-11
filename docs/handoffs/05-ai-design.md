# Handoff 05-ai-design — Hỗ trợ thiết kế & phối cảnh AI (Giai đoạn 2)

Cập nhật: 06/11/2026.  
Nhóm 5 — Lý Tăng Hữu.  
Nhánh Git: `feature/ai-design`.  
Kho mã nguồn GitHub: `https://github.com/truongvanlong1905/ToanTrungMar` (nhánh `main`).

---

## 1. Hiện trạng & Nguồn nghiệp vụ chuẩn
- Đã tiếp nhận và phân tích toàn diện **Tài liệu đặc tả BA: UC06 (Hỗ trợ thiết kế & phối cảnh AI)** kèm Sơ đồ hoạt động, Sơ đồ tuần tự và BPMN As-is/To-be.
- Chi tiết đặc tả nghiệp vụ đầy đủ đã được ghi nhận tại [docs/modules/05-ai-design.md](../modules/05-ai-design.md).
- Khung thư mục mã nguồn đã sẵn sàng: `apps/web/src/modules/05-ai-design/`, `apps/api/src/modules/05-ai-design/`, `packages/contracts/src/05-ai-design/`.

---

## 2. Các nghiệp vụ trọng tâm đã chốt
1. **Dựng nháp phối cảnh 3D màn hình LED bằng AI**:
   - Đầu vào: Ảnh hiện trạng công trình thực tế (từ máy hoặc đính kèm từ Lead UC01) + Chủng loại/kiểu dáng LED + Kích thước/vị trí trên ảnh + Prompt mô tả.
   - AI render màn hình LED 3D chân thực lên ảnh hiện trạng. Lưu vào Thư viện ấn phẩm, ghi nhận thời gian và chi phí token AI.
2. **Tạo hình ảnh & Banner bằng AI**:
   - Thiết lập kích thước pixel, tỷ lệ khung hình màn hình LED cần hiển thị.
   - AI sinh ảnh banner độ nét cao đúng tỷ lệ khung hình.
3. **Quản lý Thư viện ấn phẩm & Hoàn thiện**:
   - Lưu trữ bản nháp AI (`ai_draft_image_url`) và bản hoàn thiện sau khi Designer chỉnh sửa qua Photoshop/3DsMax (`final_render_url`).
   - Tải file độ phân giải cao bàn giao cho bộ phận Kinh doanh đính kèm báo giá.
4. **Bảo mật & Database Model (Đã hoàn thiện tại `packages/database/prisma/models/05-ai-design.prisma`)**:
   - Tuyệt đối không gửi thông tin cá nhân khách hàng (SĐT, email, tên công ty) sang AI bên thứ 3.
   - Gồm 2 bảng thuộc Nhóm 5: `design_requests` (hỗ trợ `lead_id` tùy chọn cho Banner độc lập, `version`, `approved_version_id`, `total_cost_micros BigInt?`) và `design_asset_versions` (`@@unique([design_request_id, version_number])`, lưu đầy đủ từng phiên bản nháp AI và bản hoàn thiện Designer).
   - Nhật ký từng lượt gọi AI (kể cả lỗi/timeout) dùng bảng chung `ai_usage_logs` tại `core.prisma` thông qua contract `recordAiUsageAttempt`. Quy tắc bắt buộc gắn Lead cho riêng phối cảnh 3D và điểm tạo ticket theo dõi tại [Q14](../decisions/OPEN_QUESTIONS.md#q14).
