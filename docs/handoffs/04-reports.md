# Handoff 04-reports — Báo cáo & Dashboard điều hành

Cập nhật: 06/11/2026.  
Nhóm 4 — Nguyễn Hoàng Minh Khôi.  
Nhánh Git: `feature/reports-dashboard`.  
Kho mã nguồn GitHub: `https://github.com/truongvanlong1905/ToanTrungMar` (nhánh `main`).

---

## 1. Hiện trạng & Nguồn nghiệp vụ chuẩn
- Đã tiếp nhận và phân tích toàn diện **Tài liệu đặc tả BA: UC04 (Xem Dashboard)** kèm Sơ đồ hoạt động, Sơ đồ tuần tự và BPMN As-is/To-be.
- Chi tiết đặc tả nghiệp vụ đầy đủ đã được ghi nhận tại [docs/modules/04-reports.md](../modules/04-reports.md).
- Khung thư mục mã nguồn đã sẵn sàng: `apps/web/src/modules/04-reports/`, `apps/api/src/modules/04-reports/`, `packages/contracts/src/04-reports/`.

---

## 2. Các nghiệp vụ trọng tâm đã chốt
1. **Dashboard Tổng quan cho Giám đốc (BOD)**:
   - Tổng Lead, phân bổ theo NVKD, trạng thái Pipeline (Vừa nhận, Đang soạn BG, Đã gửi BG, Chốt, Thất bại) và chỉ số tài chính.
   - Bộ lọc thời gian: 1 tuần, 30 ngày, tùy chọn khoảng thời gian.
   - Xuất dữ liệu: Hỗ trợ xuất ra **Excel (.xlsx)** hoặc **Google Sheets**.
2. **Dashboard chuyên biệt theo từng phân hệ**:
   - **Marketing & Ads**: Thống kê Lead theo nguồn/sản phẩm; chi phí Ads kết hợp số Lead thực tế từ Kinh doanh $\rightarrow$ chi phí/Lead (CPL); hiệu suất & tỷ lệ chốt Lead.
   - **Kinh doanh**: Hiệu suất và tỷ lệ chốt đơn của cá nhân NVKD; **danh sách khách hàng đã gửi báo giá nhưng chưa phản hồi** để bám sát.
   - **Thiết kế (Designer)**: Thống kê ấn phẩm hoàn thành theo loại (3D, Banner); thống kê thời gian và chi phí token AI.
3. **Bảo mật phạm vi dữ liệu & Database Contract**:
   - Tuân thủ ma trận phân quyền 8 vai trò; NVKD chỉ thấy số liệu cá nhân của mình, Giám đốc và Trưởng phòng xem toàn cảnh theo thẩm quyền (ẩn danh Lead cho Marketing/Ads theo [Q03](../decisions/OPEN_QUESTIONS.md#q03); chỉ số doanh thu/ROAS chờ chốt hiển thị tại [Q08](../decisions/OPEN_QUESTIONS.md#q08)).
   - Nhóm 4 là **Read-only consumer** trên các bảng chuẩn D1–D6 (`packages/database/prisma/models/04-reports.prisma` không tạo bảng riêng; bảng suy đoán `report_export_logs` đã được loại bỏ).
