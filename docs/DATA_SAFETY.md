# An toàn dữ liệu và thiết kế cho dữ liệu lớn

Đây là hướng dẫn kỹ thuật cần triển khai/kiểm chứng, không phải chứng nhận hệ thống đã an toàn. Provider DB, hạ tầng, dung lượng và chính sách phục hồi chưa chốt.

## Lưu trữ và môi trường

Một DB quan hệ qua Prisma cho dữ liệu nghiệp vụ; private object storage cho file/ấn phẩm. ERD dùng kiểu MySQL trong khi blueprint đề xuất PostgreSQL: giữ dấu khác biệt, chốt provider/major trước khi sinh schema. Một nguồn model và một migration history.

Không lưu binary/base64 trong Lead, không để file khách trong public/uploads hoặc filesystem tạm. DB lưu metadata/object reference; file thương hiệu công khai có luồng riêng. Tách dev/test/staging/prod và credential runtime, migration, backup; không cấp production rộng cho cả 5 nhóm theo mặc định.

Roadmap BA dùng dữ liệu mẫu khi phát triển và dữ liệu thật ở bước bàn giao cuối. Dùng dữ liệu tổng hợp, không chép bảng khách hàng trong ảnh mẫu vào fixture/Git. Các ảnh mẫu trong nguồn chỉ dùng hiểu cấu trúc, không được coi là dữ liệu seed.

## Ghi và đồng bộ

- Mỗi bảng có owner; đối chiếu [TABLE_OWNERSHIP](database/TABLE_OWNERSHIP.md). Không đặt unique phone cho toàn bộ Lead chỉ vì có cảnh báo trùng; BA yêu cầu gắn cờ và không tự gộp.
- Thay đổi Lead/phân công/trạng thái/lịch sử cần tính nhất quán; transaction ngắn, không gọi provider/upload bên trong. Xử lý cập nhật đồng thời để tránh hai người cùng giao/sửa ghi đè âm thầm.
- Webhook retry phải phân biệt gửi lặp cùng sự kiện với một Lead thật khác có SĐT trùng. Khóa idempotency theo định danh nguồn được chốt; không dùng riêng phone/IP làm định danh sự kiện.
- Sync theo batch có giới hạn, retry hữu hạn, checkpoint và khả năng resume; chỉ chốt checkpoint sau dữ liệu bền hoặc có replay an toàn.
- Lỗi webhook cần phản hồi/ghi lỗi theo UC01; log không chứa nguyên credential hoặc PII. Cơ chế lưu bản lỗi để không mất dữ liệu và retry cần được thiết kế theo [Q12](decisions/OPEN_QUESTIONS.md#q12).

## Đọc, báo cáo và tải lớn

Lọc quyền trước phân trang/export, select đúng cột; không đưa toàn bảng xuống FE để lọc. Có giới hạn trang/batch; index theo mẫu truy vấn thực và đo plan trên môi trường phù hợp. Không tự index mọi cột, partition hoặc sharding khi chưa đo workload.

KPI/export dùng cùng phạm vi ngày, scope và snapshot thích hợp; không chỉ tính từ trang đầu. Budget kết nối tính cả API, worker và replica; dùng client/pool đúng major/runtime. Job nhập/xuất lớn không giữ toàn bộ workbook trong RAM.

Trước khi chọn cấu hình cần số Lead/ngày, event/stat/ngày, thời gian giữ, GB file/tăng trưởng, user/job đồng thời và mức mất dữ liệu/gián đoạn chấp nhận. Không hứa chịu tải hoặc gán RAM/CPU từ số thành viên nhóm.

## File và AI

Validate loại file theo use case, quyền và giới hạn kỹ thuật được chốt; UC01 hiện chỉ nhận ảnh, chưa có số dung lượng BA cụ thể. Không tự gán mức MB thành quy định nghiệp vụ. Đối chiếu khác biệt ảnh/tài liệu ở [Q06](decisions/OPEN_QUESTIONS.md#q06).

Upload có trạng thái pending/ready phù hợp; verify trước khi dùng. Download kiểm tra quyền hoặc cấp URL có hạn sau kiểm tra. DB và storage không có transaction chung: xử lý orphan có thời gian đệm, không xóa file còn tham chiếu hoặc đang upload.

DFD cấm gửi thông tin khách sang AI. Chỉ cho phép trường cần thiết theo tác vụ, loại thông tin nhận dạng trong prompt/ảnh/metadata nếu có; không gửi toàn bộ Lead. Ghi thời gian/token/chi phí có thật theo từng lượt; không tạo 0 giả khi nguồn không cung cấp.

## Migration và phục hồi

Không sửa migration đã áp dụng; một người điều phối thứ tự merge. Kiểm tra migration trên DB trống và dữ liệu test đại diện; với thay đổi lớn dùng thêm cấu trúc → backfill có giới hạn → kiểm tra → chuyển code → gỡ ở đợt sau. Không tự db push/reset/DROP/TRUNCATE production.

RPO/RTO, retention, PITR và lịch restore chưa được doanh nghiệp chốt. Backup DB và file cần bản sao/credential tách runtime; restore thử sang môi trường cách ly, kiểm tra bản ghi, quan hệ, quyền và liên kết asset, ghi thời gian thực. File backup, replica hoặc soft delete không thay bằng chứng restore.

Không tự nhập/chuyển dữ liệu hệ cũ. Nếu được giao, giữ nguồn read-only, map trường/enum/ID/ngày, chạy staging theo batch, đối soát và có kế hoạch cutover/khôi phục. Xem [quy tr�nh](QUY_TRINH.md) để lập runbook thật khi có hạ tầng.
