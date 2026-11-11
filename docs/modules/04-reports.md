# 04-reports — Báo cáo & Dashboard điều hành

**Nhóm 4 — Phụ trách: Nguyễn Hoàng Minh Khôi.**  
Nhánh Git: `feature/reports-dashboard`.  
Nguồn đặc tả chuẩn:
1. **Tài liệu đặc tả BA (UC04: Xem Dashboard)** ngày 05/11/2026.
2. **Brief Mini CRM — Yêu cầu Báo cáo thực tế từ Công ty Toàn Trung** ngày 06/11/2026.

---

## 1. Vùng phát triển của Nhóm 4

| Lớp | Đường dẫn mã nguồn |
| :--- | :--- |
| **Giao diện (Frontend)** | `apps/web/src/modules/04-reports/` |
| **Trang hiển thị (Page Route)** | `apps/web/src/app/(workspace)/reports/page.tsx` |
| **Xử lý Backend** | `apps/api/src/modules/04-reports/` |
| **Endpoint API** | `apps/api/src/app/api/v1/reports/route.ts` |
| **Hợp đồng dữ liệu (Contracts/DTO)** | `packages/contracts/src/04-reports/` |
| **Prisma Model** | `packages/database/prisma/models/04-reports.prisma` |
| **Kiểm thử E2E & Mock Fixture** | `tests/e2e/04-reports/` và `tests/fixtures/04-reports/` |
| **Task nhóm** | `docs/tasks/m04/` |

---

## 2. Báo cáo & Dashboard thực tế theo Brief Mini CRM

Hệ thống tích hợp tự động phân loại Lead trong **1 tuần**, **30 ngày** hoặc **Tùy chỉnh khoảng thời gian**, thiết kế Dashboard và biểu đồ thể hiện các nhóm báo cáo sau:

### 2.1. Hiệu suất tổng quan (Overview)
- **Tổng số lượng Lead đổ về** trong tuần/tháng theo từng kênh (Website, Google Ads, Hotline, Zalo).
- **Phân bổ Lead theo từng Nhân viên Kinh doanh**:
  + Bảng tổng hợp theo NVKD: Tên Sales, Tổng Lead, Vừa nhận thông tin, Đang soạn báo giá, Đã gửi báo giá, Chốt thành công, Thất bại, Tỷ lệ chốt (%).
  + Chi tiết: Sales nào nhận khách nào, quan tâm dòng sản phẩm gì, trạng thái tiến độ ra sao.

### 2.2. Phân tích sản phẩm (Product Insights)
- Thống kê chi tiết số lượng khách hàng hỏi theo từng dòng sản phẩm cụ thể của công ty Toàn Trung:
  + **Màn hình LED**: `Indoor`, `Outdoor`, `Cong`, `Lưới`, `GOB`, `COB`, `LCD`.
  + **Bảng điện tử**: `Bảng năng suất`, `Bảng thi đấu thể thao`, `Đồng hồ LED`, `Bảng an toàn lao động`, `Bảng giá vàng`, `Bảng thu phí giữ xe`...
  + **Nhu cầu khác**: Sửa chữa, thuê màn hình, sản phẩm đặc biệt.

### 2.3. Báo cáo tiến độ tài chính / Báo giá (Sales Pipeline Report)
- **Số lượng khách hàng đã được gửi báo giá** trong kỳ.
- **Danh sách khách hàng đã gửi báo giá nhưng chưa phản hồi**:
  + Danh sách trích xuất chi tiết để NVKD và Trưởng phòng kinh doanh kịp thời bám sát (Follow-up), cảnh báo các trường hợp quá 7 ngày chưa phản hồi.
- **Báo cáo chi tiết từng Lead (Data Table)**:
  + Các cột: STT, Kinh doanh phụ trách, Thời gian nhận (Ngày/Giờ cụ thể), Tên khách hàng / Công ty, Số điện thoại, Nguồn Lead, Sản phẩm quan tâm, Trạng thái tiến độ, Ghi chú / Nguyên nhân.

### 2.4. Xuất dữ liệu thực tế (Export File)
- Cho phép trích xuất toàn bộ dữ liệu bảng báo cáo thành **1 file Excel (.xlsx)** hoặc **Google Sheets** phản ánh đúng bộ lọc thời gian và quyền xem của tài khoản.

---

## 3. Dashboard theo phân hệ từng vai trò

- **Giám đốc (BOD) & Quản trị viên (ADMIN)**: Xem toàn cảnh toàn công ty, biểu đồ phân bổ Lead theo NVKD, cơ cấu doanh số/tỷ lệ chốt, xuất báo cáo tổng hợp.
- **Marketing & Ads**: Thống kê Lead theo nguồn và chiến dịch quảng cáo; kết hợp chi phí Google Ads/GA4 để đo lường CPL (Chi phí/Lead hiệu quả), theo dõi tỷ lệ chốt Lead từ Ads.
- **Kinh doanh (SALES)**: Xem hiệu suất cá nhân của chính mình (Lead được giao, tiến độ báo giá, tỷ lệ chốt đơn của bản thân, danh sách khách cần bám sát).
- **Thiết kế (DESIGNER)**: Thống kê số lượng ấn phẩm hoàn thành (Phối cảnh 3D, Banner), thời gian xử lý và chi phí token AI.

---

## 4. Xử lý ngoại lệ
- Mẫu số bằng 0 hiển thị `—` (không hiển thị 0 hoặc lỗi chia).
- Kỳ lọc dưới 30 Lead / 100 click hiển thị ghi chú *"Mẫu nhỏ, chỉ mang tính tham khảo"*.
- Số liệu của ngày hôm nay ghi chú rõ *"Số liệu hôm nay chưa chốt, sẽ được cập nhật ở các lần đồng bộ sau"*.
