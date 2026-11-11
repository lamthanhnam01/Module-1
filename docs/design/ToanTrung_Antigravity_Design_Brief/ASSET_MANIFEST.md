# Danh mục Tài sản Thiết kế & Thương hiệu (Asset Manifest)

## 1. Tài sản thương hiệu chính thức đã xác minh (`02-company-brand-assets`)

Được lưu trữ tại `apps/web/public/brand/` và bản gốc tại `docs/design/ToanTrung_V2_UI_Reference_Pack/brand/`:

| Tên file | Đường dẫn public | Mục đích sử dụng | Trạng thái xác minh |
| :--- | :--- | :--- | :--- |
| `logo-toan-trung.png` | `/brand/logo-toan-trung.png` | Logo chính thức mặc định trên trang `/login` và `Sidebar` | Đã xác minh từ hồ sơ năng lực công ty (SINCE 2006). |
| `showroom-toan-trung.webp` | `/brand/showroom-toan-trung.webp` | Ảnh thực tế phòng trưng bày Toàn Trung dùng làm điểm nhấn trên `/login` và banner `/dashboard` | Đã xác minh từ ảnh thực tế công ty. |

> **Ghi chú phê duyệt thương hiệu:** Biến thể logo chữ T trong ảnh chụp tham chiếu `01-login-chot-mau.png` không có file vector/PNG gốc riêng biệt trong gói bàn giao. Hệ thống tuyệt đối không tự cắt từ ảnh chụp màn hình hoặc tự vẽ lại; sử dụng `/brand/logo-toan-trung.png` và hỗ trợ Admin tải lên bản chính thức tại `/settings` khi có file chuẩn.

## 2. Ảnh tham chiếu bố cục và màu sắc (`ToanTrung_V2_UI_Reference_Pack/references`)

| Thư mục / File | Vai trò tham chiếu | Lưu ý sử dụng |
| :--- | :--- | :--- |
| `01-login/01-login-chot-mau.png` | Phong cách màu sắc, nút bấm và trường nhập của trang đăng nhập | Ghi đè bố cục: Form đăng nhập phải căn giữa màn hình (centered card), dùng ảnh showroom thật thay cho tòa nhà dựng 3D. |
| `02-dashboard/01-dashboard-mang-mau.png` | 4 thẻ KPI màu nhấn ngữ nghĩa (Xanh dương, Tím, Vàng cam, Xanh lá) | Áp dụng đúng độ dịu của nền thẻ và thanh tiến độ. |
| `02-dashboard/02-dashboard-toan-trang-demo.png` | Bố cục tổng thể Sidebar, Topbar, Banner và nhãn `Dữ liệu minh họa` | Chỉ hiển thị dữ liệu minh họa ở môi trường dev có gắn nhãn rõ. |
| `02-dashboard/03-kpi-bon-mau-chi-tiet.png` | Chi tiết khoảng cách, bo góc (12–16px) và viền mảnh của 4 thẻ KPI | Dùng cho `/dashboard`. |
| `02-dashboard/04-sidebar-he-thong.png` | Nhóm điều hướng Cá nhân & Hệ thống trên Sidebar | Hợp nhất mục Thương hiệu vào trong `/settings`. |
| `03-system/01-thong-bao.png` | Giao diện trang `/notifications` | Có bộ lọc Tất cả / Chưa đọc / Đã đọc và đánh dấu đã đọc. |
| `03-system/02-ho-so-tai-khoan.png` | Giao diện trang `/profile` | Thông tin công việc (Họ tên, SĐT, Email) và khung Đổi mật khẩu tách biệt. |
| `03-system/03-thuong-hieu.png` | Giao diện cấu hình thương hiệu | Được tích hợp trực tiếp vào phần `Giao diện & thương hiệu` trong `/settings` (chỉ ADMIN). |
| `03-system/04-cai-dat-he-thong.png` | Giao diện trang `/settings` | Kết hợp bảo mật phiên, thông số môi trường và quản lý thương hiệu. |
| `04-other/01-module-trong.png` | Giao diện trạng thái trống cho 5 module nghiệp vụ | Áp dụng cho `/leads`, `/tracking`, `/ads`, `/reports`, `/design`. |
| `05-mobile/*.png` | Bố cục đáp ứng trên thiết bị di động (Mobile Responsive) | Đảm bảo không tràn ngang, không cắt chữ tiếng Việt. |

