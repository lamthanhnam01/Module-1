# Phân quyền — giữ nguyên ma trận BA

Người dùng đã chỉ định ma trận BA là nguồn chuẩn. Bảng dưới chép lại ô quyền từ [ảnh BA đầy đủ](sources/assets/ba-rbac.png), đọc lại từ tab “Chức năng và phân quyền” ngày 05/11/2026. Không dùng ma trận 4 vai trò đề xuất cũ và không tự điều chỉnh các dấu quyền của BA.

## Vai trò

| Mã quy ước kỹ thuật | Tên vai trò BA |
| --- | --- |
| SALES | Nhân viên Kinh doanh |
| MKT_STAFF | Nhân viên Marketing |
| DESIGNER | Designer |
| ADS | Nhân viên Ads |
| MKT_LEAD | Trưởng phòng Marketing |
| SALES_LEAD | Trưởng phòng Sales |
| BOD | Giám đốc |
| ADMIN | Quản trị viên |

Mã là ánh xạ tên cho tài liệu/contracts, không chứng minh enum hoặc seed đã tồn tại.

## Ma trận nguyên quyền chức năng

| Quyền | SALES | MKT_STAFF | DESIGNER | ADS | MKT_LEAD | SALES_LEAD | BOD | ADMIN |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tiếp nhận và tạo mới Lead | Có | — | — | — | — | Có | Có | Có |
| Xem Lead cá nhân phụ trách | Có | Có | 3D, 2D | Có | Có | Có | Có | Có |
| Xem toàn bộ Lead toàn công ty | — | Có | — | Có | Có | Có | Có | Có |
| Cập nhật tiến độ và Pipeline báo giá | Có | — | — | — | — | Có | Có | Có |
| Chuyển giao Lead sang Sales khác | Có | — | — | — | — | Có | Có | Có |
| Upload/Xem ảnh hiện trạng và bản vẽ | Có | — | Có | — | — | Có | Có | Có |
| AI thiết kế: phối cảnh 3D và banner | — | — | Có | — | — | — | — | Có |
| AI Marketing: từ khóa SEO và nội dung | — | Có | — | Có | Có | — | — | Có |
| Tracking đa kênh và tối ưu Google Ads | — | Có | — | Có | Có | — | Có | Có |
| Xem Dashboard báo cáo hiệu suất | Lead cá nhân | Có | Có | Có | Có | Có | Có | Có |
| Xuất dữ liệu Excel/Google Sheets | Có | Có | Có | Có | Có | Có | Có | Có |
| Cấu hình hệ thống và quản lý User | — | — | — | — | — | — | — | Có |

“Có” tương ứng dấu tick; “—” tương ứng ô trống, không được cấp quyền chức năng đó. Giữ nguyên hàng gộp Upload/Xem của BA; việc tách action kỹ thuật không được làm thay đổi quyền đã cấp.

Chú thích BA: “3D, 2D” chỉ Lead có yêu cầu phối cảnh màn hình LED, không phải Lead báo giá thông thường. “Lead cá nhân” ở Dashboard Sales nghĩa số liệu của chính mình; không xem số liệu thật của Sales khác. Quyền xem toàn bộ Lead không biến dữ liệu ẩn danh thành dữ liệu định danh.

## Chi tiết dữ liệu theo use case BA

| Vai trò/tình huống | Quy tắc đã mô tả |
| --- | --- |
| NVKD trong UC01/UC02 | Xem đầy đủ Lead thuộc phạm vi được giao; thao tác đúng quyền và điều kiện use case |
| Marketing trong UC01 | Xem Lead dạng ẩn danh, chỉ xem |
| Nhân viên Ads trong UC01 | Xem Lead dạng ẩn danh; chỉ được sửa Nguồn và Chiến dịch theo UC03-4, không sửa trường Lead khác |
| Marketing/Ads xem tiến độ UC02-9a | Đọc nguồn, sản phẩm quan tâm, Sales phụ trách, trạng thái, lý do thất bại; không đổi Pipeline |
| Designer | Áp chú thích 3D/2D của ma trận; không tự suy điều kiện “chỉ người được giao” nếu BA chưa mô tả nó |
| Trưởng phòng | Giữ các quyền Lead toàn công ty đã tick. Phạm vi báo cáo theo phòng mình theo yêu cầu người dùng; không đánh đồng quyền Lead với phạm vi báo cáo |
| Xuất báo cáo | Cả 8 vai trò đều được cấp trong ma trận; dùng đúng tập dữ liệu/bộ lọc và biểu diễn dữ liệu vai trò được xem |

UC01 mô tả vai trò tác nghiệp chính; không dùng việc UC không liệt kê hết quản lý/Admin để xóa quyền họ đã có trong ma trận. UC03-4 chưa có mô tả riêng: đã ghi nhận quyền Ads chỉnh Nguồn/Chiến dịch, còn rule kiểm tra và lịch sử chờ đặc tả; không suy quyền sửa mọi thông tin Lead.

Danh sách chính xác trường bị ẩn/dạng ẩn danh, khả năng chỉnh nguồn của vai trò quản lý và ngữ cảnh báo cáo chưa được mô tả hết: xem [Q03/Q04](decisions/OPEN_QUESTIONS.md). Không tự xuất contact/free text/tệp từ endpoint khác để vượt biểu diễn ẩn danh.

## Áp dụng trong code khi được triển khai

Backend kiểm tra session còn hiệu lực, user active, action, scope tài nguyên rồi mới đọc/ghi; serializer chỉ trả trường cho phép. Áp cùng rule cho list/detail/search/history/file/job/export và URL trực tiếp. FE dùng capability tương ứng để dựng menu; ẩn menu không thay kiểm tra API.

Role Admin có các ô được cấp như ma trận; không tự thêm “bypass mọi rule nghiệp vụ”. Các quy tắc lý do, trạng thái, lưu lịch sử vẫn là bất biến use case trừ khi BA có ngoại lệ rõ.

Không tự tạo public signup, tài khoản mặc định hoặc nút điền nhanh vai trò. Tài khoản do Admin cấp.

## Đăng nhập, phiên và credential (Core đã triển khai)

| Thành phần | Hiện trạng |
| --- | --- |
| Mật khẩu | Lưu `password_hash` bằng scrypt; không lưu/ghi log mật khẩu gốc |
| Phiên | Cookie `HttpOnly`, `SameSite=Lax`, `Secure` ở production; bảng `user_sessions` lưu hash token, hết hạn 12 giờ, thu hồi khi đăng xuất/khóa/xóa tài khoản |
| CSRF | Mọi request ghi phải gửi header `x-csrf-token` khớp phiên |
| Kiểm tra quyền | Backend kiểm tra phiên, tài khoản active, action, phạm vi trước khi đọc/ghi; ẩn menu ở FE không thay kiểm tra API |
| Credential Google/AI/storage | Chỉ ở backend/worker; không đưa vào UI, `NEXT_PUBLIC_*`, Git, log hoặc response lỗi |

Các ca phải có test khi module dùng quyền: đăng nhập sai, tài khoản khóa, phiên hết hạn/thu hồi, truy cập URL trực tiếp, ID ngoài phạm vi, DTO ẩn danh, export/file/job dùng cùng quyền. Danh tính webhook/service cần cơ chế riêng, không gán mọi Lead tự động cho một Admin giả. Điểm còn mở về phiên/token: [Q11](decisions/OPEN_QUESTIONS.md#q11).
