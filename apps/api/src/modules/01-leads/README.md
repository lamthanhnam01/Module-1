# M01 Task 3 — API Pipeline

Adapter Prisma dùng câu lệnh SQL có tham số và ánh xạ Task 3 theo schema chung của Task 1: `Lead.id`/`leads.id` kiểu số nguyên, cùng các field Prisma `pipelineStatus`, `assignedSalesId`, `receivedByUserId`, `firstQuoteSentAt`, `quoteRespondedAt`, `quoteValueVnd`, `dealValueVnd`, `version`, `reopenCount`, `statusChangedAt`, `closedAt`; cột DB tương ứng dùng `pipeline_status`, `assigned_sales_id`, `received_by_user_id`, `first_quote_sent_at`, `quote_responded_at`, `quote_value`, `deal_value`, `reopen_count`, `status_changed_at`, `closed_at`. Mỗi lần thay đổi Lead và ghi lịch sử vào `lead_activities` đều nằm trong cùng một Prisma transaction.

Model Task 1 hiện ở branch/repository riêng, chưa có trong checkout này. Adapter có thể được kiểm tra kiểu, nhưng cần tích hợp schema và các bảng dùng chung trước khi chạy route với DB. Schema Task 1 đã có ID số nguyên, version, bộ đếm mở lại, trường xác nhận tiếp nhận và mốc gửi báo giá đầu tiên. Khi ghép branch, không tạo model trùng. Task này không chạy `db:push` hoặc tạo migration.

## Các route

Mọi thao tác ghi đều yêu cầu phiên đăng nhập hợp lệ và CSRF header đã cấu hình. Actor và thời điểm thao tác lấy từ phiên đăng nhập và đồng hồ máy chủ, không nhận từ request body. Request bắt buộc có `expectedVersion`; nếu version đã cũ, API trả HTTP 409 và không ghi lịch sử.

| Phương thức và đường dẫn | Request body |
| --- | --- |
| `POST /api/v1/leads/{id}/pipeline` | `{ expectedVersion, nextStatus, lostReason?, quoteValueVnd?, dealValueVnd? }` |
| `POST /api/v1/leads/{id}/reopen` | `{ expectedVersion, nextStatus, reason }` |
| `POST /api/v1/leads/{id}/transfer` | `{ expectedVersion, receiverId, reason, note? }` |
| `POST /api/v1/leads/{id}/receive` | `{ expectedVersion }` |

Pipeline giữ nguyên năm trạng thái BA; không cho chuyển `won` sang `lost`. `firstQuoteSentAt` chỉ được thiết lập một lần và giữ nguyên khi Lead quay lại `quoting` hoặc được mở lại. Mỗi lần mở lại tăng `reopenCount`.

Đặt biến `TASK3_REOPEN_WINDOW_MS` trên API server để bật chức năng mở lại. Khi chuyển giao, adapter kiểm tra nhân viên Sales đang hoạt động và số Lead đang xử lý. Tuy nhiên, route mặc định trả HTTP 503 nếu server chưa cung cấp nguồn dữ liệu trạng thái online/presence. Lý do `BUSY` cũng cần chính sách tải việc đã được duyệt; không tự đặt ngưỡng.

Workflow vẫn kiểm tra lý do thất bại có trong danh mục đang hoạt động. Schema Task 1 hiện chỉ lưu `lost_reason` dạng văn bản và chưa có danh mục trong checkout này. Cần cấu hình provider danh mục phía server trước khi cho phép chuyển sang `lost`; nếu chưa cấu hình, route trả HTTP 503. Bộ xử lý route nhận repository factory phía server để cung cấp danh mục và điều kiện chuyển giao; factory mặc định từ chối an toàn khi thiếu cấu hình.

## Kiểm tra

Chạy các lệnh sau tại thư mục gốc repository:

```powershell
node --experimental-strip-types --test apps/api/src/modules/01-leads/task3-workflow.test.ts apps/api/src/modules/01-leads/task3-authorization.test.ts packages/contracts/src/01-leads/task3.test.mjs
npm run typecheck --workspace @toantrung/api
npm run typecheck --workspace @toantrung/contracts
```
