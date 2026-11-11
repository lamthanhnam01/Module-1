# Contract giữa các nhóm — đề xuất kỹ thuật cần triển khai

Trạng thái: chưa có endpoint/DTO chạy thật. Các tên trường/vùng contract dưới đây là bản đồ trách nhiệm, chưa cố định kiểu ID, schema, pagination, TTL hoặc status code. Nghiệp vụ BA ở hồ sơ module và [PERMISSIONS](PERMISSIONS.md) là chuẩn.

## Quy ước chung dự kiến

API tại /api/v1; FE dùng HTTP client của module. Success `{ data, meta? }`; error `{ error: { code, message, requestId, details? } }`. Danh sách cần phân trang có giới hạn; cursor/pageSize và totalCount chọn theo query thật. Thời gian lưu/trao đổi UTC, lọc hiển thị nghiệp vụ Asia/Ho_Chi_Minh; ranh giới ngày phải có test.

Contracts không chứa DB type/Prisma model, credential, request server hoặc entity đầy đủ mặc định. ID và các enum phải do owner công bố; thay đổi có consumer thì phối hợp version/tương thích trước khi merge.

## Các điểm bàn giao

| Luồng | Bên cung cấp | Nội dung cần chốt |
| --- | --- | --- |
| Website → ingest | M02 + app composition | Website/event ID, trường tối thiểu, tracking thật, xác thực nguồn, idempotency, phản hồi lỗi |
| Bóc nguồn → tạo Lead | M02 → M01 public | Thông tin Lead hợp lệ + metadata nguồn, trạng thái nguồn chưa biết, service actor; owner M01 ghi Lead |
| Đổi Nguồn/Chiến dịch | M02/M01 phối hợp UC03-4 | Ads được sửa đúng 2 trường, lịch sử thay đổi; không có patch chung ghi mọi trường Lead |
| Tiến độ/quality → phân tích | M01 → public read M03/M04 | Trạng thái, sản phẩm, nguồn, Sales, lý do theo quyền; không gửi contact cho AI |
| Số liệu Google → Ads | M02 → public M03 khi owner thống nhất | Account/entity/date/grain/currency, metric có thật, checkpoint/replay |
| Yêu cầu thiết kế | Composition M01/M05 | Liên kết Lead/ảnh/thông số theo quyền; BA ticket Sales và UC06 cần thống nhất điểm bắt đầu |
| Kết quả thiết kế | M05 public read | Nháp/hoàn thiện, trạng thái và file reference, không lộ storage secret |
| Dashboard/export | M01/M02/M03/M05 → M04 | Dữ liệu có scope, bộ lọc, mốc cập nhật; M05 chỉ tích hợp khi giai đoạn 2 |
| AI usage | M03/M05 → Core usage contract dự kiến | Từng lượt, thời gian, token/chi phí thực; Core owner lưu dùng chung cần được phân công |

## Điều kiện ghép code

Mỗi public contract có owner, consumer, trường bắt buộc/tùy chọn, quyền/biểu diễn dữ liệu, lỗi và ca kiểm chứng bằng dữ liệu tổng hợp. Không để mỗi nhóm tự đoán payload hoặc dùng raw DB entity để tránh viết DTO.

Endpoint mutation phải chặn trường ngoài whitelist; request không hợp lệ không được ghi dở. Nếu dùng cookie, áp kiểm soát request mutation phù hợp. Provider/worker gọi ngoài transaction ngắn. Các mã lỗi HTTP được thống nhất khi có handlers, không tự bịa kết quả hiện đang trả.

Các quyết định về UC03, nguồn website, ID, session và model chưa chốt nằm ở [OPEN_QUESTIONS](decisions/OPEN_QUESTIONS.md); chốt phần cần cho task trước khi consumer triển khai.
