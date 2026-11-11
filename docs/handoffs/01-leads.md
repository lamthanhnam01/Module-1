# Handoff 01-leads — Quản lý Lead và Pipeline

Cập nhật: 06/11/2026.  
Nhóm 1 — Lâm Thành Nam.  
Nhánh Git: `feature/lead-management`.  
Kho mã nguồn GitHub: `https://github.com/truongvanlong1905/ToanTrungMar` (nhánh `main`).

---

## 1. Hiện trạng & Nguồn nghiệp vụ chuẩn
- Đã tiếp nhận và phân tích toàn diện **Tài liệu đặc tả BA (UC01, UC02, Sơ đồ tuần tự, Sơ đồ hoạt động, Sơ đồ BPMN As-is/To-be)**.
- Chi tiết đặc tả nghiệp vụ đầy đủ đã được ghi nhận tại [docs/modules/01-leads.md](../modules/01-leads.md).
- Mã nguồn hiện tại: Khung workspace đã sẵn sàng (`apps/web/src/modules/01-leads/`, `apps/api/src/modules/01-leads/`, `packages/contracts/src/01-leads/`), hiển thị trạng thái phát triển ban đầu.

---

## 2. Các nghiệp vụ trọng tâm đã chốt
1. **Tiếp nhận & Phân công Lead**:
   - Webhook tự động (Website, Google Ads) bóc tách UTM qua UC03 $\rightarrow$ Chuẩn hóa SĐT $\rightarrow$ Kiểm tra trùng $\rightarrow$ Phân NVKD online ít tải nhất (hoặc NVKD cũ).
   - Tạo thủ công từ Hotline/Zalo do NVKD tiếp nhận trực tiếp.
2. **Kiểm tra trùng Lead (E0)**:
   - Khớp Tên công ty + Tên dự án (chuẩn hóa không dấu, không tiền tố Cty) hoặc SĐT/Email.
   - Không tự gộp; gắn cờ "Trùng" tô đỏ (Lead cũ đang "Vừa nhận thông tin") hoặc "Đã có Lead cũ" (nếu Lead cũ đang báo giá / đã chốt / thất bại).
3. **Cảnh báo dò giá (Competitor Price Check)**:
   - NVKD đăng cảnh báo kèm căn cứ và ảnh chụp tin nhắn Zalo. Tự động gắn nhãn "Nghi dò giá" cho Lead mới trùng SĐT/công ty.
4. **Vận hành Pipeline 5 bước**:
   - `Vừa nhận thông tin` $\rightarrow$ `Đang soạn báo giá` $\rightarrow$ `Đã gửi báo giá` $\rightarrow$ `Chốt thành công` / `Thất bại`.
   - Bắt buộc có lý do khi Thất bại; cho phép lùi từ Đã gửi báo giá về Đang soạn báo giá; cho phép mở lại Lead đã đóng trong thời hạn.
5. **Chuyển giao Lead thông minh (Reassign)**:
   - Chuyển giao có lý do (Bận, Không đúng thế mạnh, Khác).
   - Khi lý do là "Bận": người nhận bắt buộc phải trực tuyến và có số Lead đang xử lý ít hơn hẳn người chuyển.
6. **Cơ chế theo dõi SLA & Tự chuyển giao**:
   - Nhắc khi chưa tiếp nhận hoặc đứng yên quá lâu theo giờ làm việc. Tự chuyển tối đa $N$ lần; quá $N$ lần gắn cờ "Cần xử lý".

---

## 3. Kế hoạch triển khai tiếp theo
1. **Database Model (Đã hoàn thiện tại `packages/database/prisma/models/01-leads.prisma`)**:
   - Gồm 6 bảng thuộc quyền ghi của Nhóm 1: `products` (25 sản phẩm chuẩn BA giữ nguyên ID `1..25`), `leads` (hỗ trợ `version` kiểm soát đồng thời, `phone` không unique, `contact_name`/`area_type`/`province`/`created_by_user_id` nullable kèm `created_by_actor_type` cho webhook, `quote_value`/`deal_value` kiểu `BigInt?` giữ ở tầng DB chờ chốt [Q08](../decisions/OPEN_QUESTIONS.md#q08)), `lead_products`, `lead_attachments`, `lead_activities`, `price_check_alerts`.
   - Cấu hình ngưỡng hệ thống dùng bảng `system_settings` của Core (chỉ giữ ngưỡng BA đã xác nhận, chờ chốt SLA chi tiết tại [Q07](../decisions/OPEN_QUESTIONS.md#q07) và [Q09](../decisions/OPEN_QUESTIONS.md#q09)).
2. **Contracts / Zod Schema**:
   - Viết các DTO tạo Lead, cập nhật trạng thái Pipeline (kèm `expectedVersion`), chuyển giao Lead, đăng cảnh báo dò giá tại `packages/contracts/src/01-leads/`.
3. **API & Service Backend**:
   - Triển khai `apps/api/src/modules/01-leads/` sử dụng `transitionLeadWithVersion` và các route handler tương ứng.
4. **Giao diện người dùng (Frontend)**:
   - Xây dựng bảng Kanban Pipeline và danh sách Lead trực quan tại `apps/web/src/modules/01-leads/`.
