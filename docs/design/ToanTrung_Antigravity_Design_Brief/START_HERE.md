# Toan Trung V2 — Design Brief & Start Here

Tài liệu này định hướng thiết kế giao diện chuẩn cho dự án **Toàn Trung V2** (hệ thống nội bộ Marketing & Kinh doanh), kết hợp từ bộ ảnh tham chiếu tại [README](../ToanTrung_V2_UI_Reference_Pack/README.md) và quyết định thiết kế cuối cùng.

## 1. Quyết định thiết kế cốt lõi (Final Overrides)

1. **Trang Đăng nhập (`/login`) — Hình nền toàn trang & Logo góc trên bên trái**:
   - Hình nền được chọn phủ kín toàn bộ khung nhìn màn hình (`full-viewport background`, `object-cover` không bị méo ảnh) kèm lớp phủ mờ tinh tế đảm bảo độ tương phản cao, thay thế cho khoảng trắng lớn phía sau hoặc dải ảnh hẹp gắn trên đỉnh thẻ đăng nhập.
   - Hiển thị **duy nhất 01 logo công ty ở góc trên bên trái màn hình** (giữ nguyên tỷ lệ gốc của logo tải lên). Không lặp lại logo bên trong khung biểu mẫu, không lặp lại tên công ty hoặc dòng chữ trang trí/chân trang dư thừa.
   - Khung biểu mẫu đăng nhập nhỏ gọn (`430–460px`), căn giữa màn hình trên cả Desktop và Mobile với hướng dẫn đăng nhập ngắn gọn, rõ ràng.
   - **Tuyệt đối không** đặt nút "Đổi hình nền", "Tải ảnh lên" hay cài đặt quản trị trên trang `/login`.

2. **Quản lý Cài đặt thương hiệu hợp nhất tại `/settings`**:
   - Toàn bộ cấu hình thương hiệu nằm tại `/settings` > mục **Cài đặt thương hiệu** (chỉ dành cho `ADMIN`).
   - Quản lý 3 phần độc lập:
     1. **Logo hiển thị** (tinh gọn: chỉ gồm xem trước logo hiện tại, tải ảnh/thay thế logo, khôi phục mặc định, Hủy và Lưu thay đổi; ẩn các trường văn bản tổ chức/lời chào/chân trang không cần thiết trên giao diện).
     2. **Hình nền trang Đăng nhập** (trình kéo chuột, 4 góc khung cắt, thanh trượt thu phóng, đặt lại; khung xem trước bên cạnh hiển thị **trọn vẹn toàn trang đăng nhập** gồm nền toàn màn hình, logo góc trên bên trái và thẻ đăng nhập ở chế độ Máy tính & Điện thoại).
     3. **Banner Dashboard** (2 tab Nội dung & Hình ảnh với bản xem trước trực tiếp).
   - Đường dẫn cũ `/admin/brand` được chuyển hướng (`redirect`) về `/settings` để tránh trùng lặp hai nơi cấu hình.
   - Thanh bên (`Sidebar`) trên máy tính luôn mở cố định (`256px`), không hiển thị nút thu gọn/mở rộng thanh bên trên thanh Header.

3. **Cảnh báo khác biệt Logo (Discrepancy Flag)**:
   - Ảnh chụp `01-login-chot-mau.png` hiển thị biến thể logo biểu tượng chữ **T** ("TOÀN TRUNG LED DISPLAY SOLUTIONS"), nhưng biến thể này chưa được cung cấp dưới dạng file gốc tách rời chất lượng cao.
   - Theo quy tắc bảo toàn thương hiệu, hệ thống sử dụng **Logo hồ sơ năng lực chính thức** đã xác minh (`logo-toan-trung.png` — "TOÀN TRUNG SINCE 2006") làm mặc định và cho phép Quản trị viên thay thế qua `/settings` sau khi công ty phê duyệt file gốc.

4. **5 Module Nghiệp vụ giữ trạng thái trống (`Blank Empty State`)**:
   - Các đường dẫn `/leads`, `/tracking`, `/ads`, `/reports`, `/design` chỉ hiển thị khung dùng chung (Sidebar, Topbar, Breadcrumbs), tiêu đề trang và trạng thái trống **"Module đang được phát triển"** theo mẫu `01-module-trong.png`.
   - Không tạo bảng biểu giả, không tạo dữ liệu khách hàng giả hay logic nghiệp vụ cho 5 module này.

5. **Chỉ số KPI Dashboard (`/dashboard`)**:
   - 4 thẻ màu ngữ nghĩa dịu nhẹ: Xanh dương (`#1553A2` / `#EFF5FF` — Tổng quan), Tím (`#7846FF` / `#F7F4FF` — Mới/Chờ xử lý), Vàng hổ phách (`#F59E0B` / `#FFFBEB` — Chờ phản hồi), Xanh ngọc (`#0BAF7C` / `#F0FDF7` — Hoàn thành).
   - Số liệu minh họa chỉ được phép hiển thị ở môi trường phát triển cục bộ kèm nhãn rõ ràng **"Dữ liệu minh họa"**, không chứa giá bán hoặc doanh thu.

