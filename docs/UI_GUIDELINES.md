# Nhận diện, nội dung UI và danh mục sản phẩm

Nguồn: feedback giao diện [S02](sources/README.md#s02), brief [S01](sources/README.md#s01), profile/sản phẩm [S09/S10](sources/README.md), website chính thức [S11](sources/README.md#s11), hình đăng nhập người dùng gửi. Đây là hướng dẫn, chưa tạo giao diện.

## Nhận diện

Dùng logo/ảnh công ty từ nguồn chính thức; không tự vẽ logo mới hoặc coi logo trong ảnh concept là logo chính thức. Trang đăng nhập theo bố cục tham chiếu: hình ảnh thương hiệu bên trái, form gọn bên phải, responsive khi triển khai. Màu/token/font cụ thể lấy từ asset được chốt; chưa gán mã màu/font tự suy là brand standard.

Profile có thông tin năng lực, công nghệ và sản phẩm; không tự biến nội dung quảng bá, giá, thông số kỹ thuật hoặc cam kết thương mại trong brochure thành KPI/rule hệ thống.

## Giao diện theo feedback

- Login gọn; bỏ lời giới thiệu/thẻ/nhãn kỹ thuật thừa, tab đăng ký, điền nhanh vai trò, mật khẩu mặc định và thông báo cấu hình dành cho dev.
- Admin cấp tài khoản; thông tin công việc gồm họ tên, SĐT, email công việc. Không đưa quê quán/nơi ở/hồ sơ năng lực cá nhân vào luồng này.
- Chỉ hiện menu đúng chức năng được cấp; direct URL và API kiểm tra quyền. Thông báo và hồ sơ vẫn có cho mọi vai trò.
- Dashboard theo vai trò; sản phẩm quan tâm nhiều/ít; không dồn thống kê lên trang Lead. Không hiển thị doanh số/giá báo khách trong scope hiện tại chỉ vì hình tham chiếu có.
- Lead là nơi danh sách/nhập/sửa; bộ lọc gọn, tên sản phẩm đủ đọc, không ép bảng quá rộng. Bỏ AI phân loại/đọc nhanh Lead và nút gọi điện từ PC nếu không có task nghiệp vụ.
- Báo cáo đọc toàn trang; không nhốt nội dung dài trong khung nhỏ. Thông báo gồm tiêu đề, mô tả ngắn, thời gian và trạng thái chưa đọc rõ.
- Hồ sơ chỉ thông tin công việc; đổi mật khẩu tách khu vực phù hợp. Không hiện API key, .env, HttpOnly hoặc tên model cho người dùng cuối.
- AI Design cần khảo sát đúng dòng LED/kiểu dáng/tỷ lệ thực tế. Bản nháp AI cần được Designer chỉnh sửa; chưa đóng cứng vài hình dạng thay toàn danh mục.

## Danh mục theo brief

| Nhóm | Dòng sản phẩm/ngữ cảnh đã được cung cấp |
| --- | --- |
| Màn hình LED | Indoor, Outdoor, Cong, lưới, GOB, COB, LCD, Khác có nhập thông tin |
| Bảng điện tử | Năng suất, thi đấu thể thao, Marathon, Shotlock, an toàn lao động, LED xe buýt sân bay, Modbus, xe buýt, đồng hồ LED, nhiệt độ/độ ẩm, giá vàng, thu phí giữ xe, Khác có text dài |
| Khác/nhu cầu khác | Hỏi sửa chữa, chưa cung cấp thông tin, hỏi sản phẩm đặc biệt, thuê, không đúng nhu cầu |

Giữ tên nguồn (kể cả tên cần chuẩn hóa như Shotlock) đến khi danh mục BA chốt; không tự sửa thành mã sản phẩm đã seed. Nhóm Khác và trạng thái “không đúng nhu cầu” cần thống nhất cách mã hóa, không tự đổi Pipeline từ nhãn nhu cầu.

Thông số LED trong tài liệu kỹ thuật hỗ trợ Nhóm 5 hiểu module LED/khung/card/kích thước và công nghệ DIP/SMD/COB; không đưa toàn bộ thông số brochure lên form Lead. Kích thước phục vụ thiết kế khác giá/dự toán bán hàng.

## Khác biệt cần ghi nhận

Feedback nói tạo Lead tối thiểu Tên + SĐT; UC01 mới yêu cầu form website tối thiểu SĐT + email; ERD có thêm trường bắt buộc. Bộ này giữ cả nguồn và ghi [Q05](decisions/OPEN_QUESTIONS.md#q05), chưa tự thống nhất field required thay BA.
