# 01-leads — Quản lý Lead và Pipeline

**Nhóm 1 — phụ trách: Lâm Thành Nam.** Branch: `feature/lead-management`. Trạng thái: **Task 3 có workflow, contracts, Prisma adapter và bốn mutation routes; transfer vẫn fail-closed nếu chưa cấu hình presence/capacity policy**. Nguồn nghiệp vụ: [BA](../sources/README.md#s04), [ma trận quyền](../PERMISSIONS.md); mục bên dưới tóm tắt nghiệp vụ, không thay nguồn BA.

## Vùng phát triển của nhóm

| Lớp | Đường dẫn |
| --- | --- |
| FE | apps/web/src/modules/01-leads/ |
| FE route | apps/web/src/app/(workspace)/leads/ |
| BE | apps/api/src/modules/01-leads/ |
| API route | apps/api/src/app/api/v1/leads/ |
| Contracts | packages/contracts/src/01-leads/ |
| Model Task 3 | Chưa có trong checkout; tham chiếu schema Task 1 branch. Không tạo model trùng khi ghép branch |
| E2E/fixture | tests/e2e/01-leads/ và tests/fixtures/01-leads/ |

Các file chung và nguyên tắc public interface xem [MODULE_MAP](../MODULE_MAP.md), [ARCHITECTURE](../ARCHITECTURE.md), [API_CONTRACTS](../API_CONTRACTS.md). Tham chiếu Qxx trong hồ sơ này nằm ở [OPEN_QUESTIONS](../decisions/OPEN_QUESTIONS.md).


## Nghiệp vụ đã có — UC01 và UC02

M01 bao gồm tiếp nhận Lead và Pipeline; không tách thành nhóm thứ sáu. Nguồn tự động qua webhook gọi phần bóc tracking UC03, chuẩn hóa SĐT, kiểm tra trùng, lưu trạng thái Vừa nhận thông tin và tự giao Sales đủ điều kiện. Chưa có người phù hợp thì Chưa giao và tiếp tục phân khi có người phù hợp. Lead nhập tay từ Hotline/Zalo do NVKD tạo, mặc định người nhập phụ trách theo UC01.

NVKD xem Lead thuộc phạm vi được giao, xác nhận tiếp nhận có người/thời điểm; sửa SĐT/email/công ty/dự án/địa chỉ/sản phẩm và kiểm tra trùng lại; đính kèm ảnh theo UC01; đánh dấu/bỏ Spam và ghi lịch sử. Spam không đổi Pipeline. Chuẩn hóa thất bại gắn cờ SĐT chưa chuẩn hóa.

Trùng khi khớp SĐT hoặc email; có công ty/dự án thì đối chiếu thêm theo UC01. Gắn cờ, tô đỏ, hiển thị Lead cũ, không tự gộp. Mức chuẩn hóa/so khớp và field tối thiểu cần chốt ở Q05/Q13; không tự đặt unique phone cho mọi Lead.

| Mã Pipeline trong ERD | Hiển thị BA |
| --- | --- |
| new_lead | Vừa nhận thông tin |
| quoting | Đang soạn báo giá |
| quote_sent | Đã gửi báo giá |
| won | Chốt thành công |
| lost | Thất bại |

Thất bại bắt buộc có lý do. Chuyển Lead chỉ khi chưa Chốt thành công/Thất bại; phải có lý do và người nhận khác người chuyển, đang online/đủ điều kiện. Lý do Bận yêu cầu tải việc ít hơn hẳn theo định nghĩa BA cần chốt. Kiểm tra lại khi xác nhận; chuyển người phụ trách, giữ Pipeline, lưu lý do/lịch sử và thông báo hai bên. Không đủ điều kiện thì giữ nguyên dữ liệu.

Theo dõi danh sách đã gửi báo giá chưa phản hồi; DFD yêu cầu nhắc quá 7 ngày, mốc/nhắc lặp đang Q09. Không tự thêm giá bán/dự toán hoặc thẻ doanh số.

### Quy tắc pipeline trong Task 3

Task 3 tách policy/workflow/repository trong `task3-*`; Prisma mapping ở `task3-prisma-repository.ts`, HTTP composition ở `task3-http.ts`. API routes: `/api/v1/leads/{id}/pipeline`, `/reopen`, `/transfer`, `/receive`. IDs dùng số nguyên như `Lead.id`; các trường public dùng tên schema như `pipelineStatus`, `assignedSalesId`, `firstQuoteSentAt`, `quoteValueVnd`, `dealValueVnd`. Mỗi mutation yêu cầu `expectedVersion`; Prisma cập nhật `where: { id, version }` và tăng version nguyên tử, conflict không ghi activity.

Pipeline giữ năm trạng thái; `won` không thể chuyển thành `lost`, thất bại cần `lostReason`. `firstQuoteSentAt` là mốc gửi đầu tiên, không bị xóa khi lùi trạng thái hoặc mở lại; reopen tăng `reopenCount`. Xác nhận tiếp nhận lấy actor từ session và thời gian từ server, không lấy từ body. Thời hạn mở lại cấu hình bằng `TASK3_REOPEN_WINDOW_MS`; không nhận thời hạn từ client. Giá trị báo giá/chốt là số nguyên VND an toàn, lưu BigInt và ghi lịch sử trong transaction.

`PrismaTask3Repository` cùng transaction đọc/cập nhật Lead, kiểm tra người nhận và ghi activity bằng parameterized SQL. `task3-authorization.ts` ánh xạ quyền BA, giới hạn SALES vào Lead được giao và không cấp bypass cho ADMIN. Mọi route yêu cầu session/CSRF, request strict, actor lấy từ Core session. Task 1 branch là nguồn field mapping; model chưa được tích hợp vào checkout nên routes cần schema đó trước khi chạy thật. SQLite vẫn là local provider; không chạy `db:push` hoặc migration. Workflow giữ kiểm tra danh mục lý do thất bại; vì schema Task 1 chỉ có `lost_reason` text, route fail-closed nếu chưa cấu hình catalogue provider. Transfer cũng fail-closed với HTTP 503 đến khi composition cung cấp nguồn presence/online và policy tải việc được duyệt; không coi `isActive` là presence.

### Yêu cầu bổ sung được xác nhận ngày 07/11/2026

- **Nguồn website:** website công ty sẽ gửi Lead tự động khi được cấp quyền tích hợp. Không tự điền giá trị cho trường không có trong payload. Theo xác nhận hiện tại, có thể tạo Lead với trường thiếu để trống và đánh dấu cần bổ sung; danh sách trường bắt buộc cho từng website và cách retry/idempotency cần chốt trước adapter.
- **Trùng và khách quay lại:** đối chiếu SĐT, tên dự án và họ tên. Kết quả trùng chỉ là cờ cần xác minh; không tự kết luận là khách cũ quay lại hoặc Spam. Người có quyền xác minh chọn kết quả, lưu người và thời điểm. Chuẩn hóa từng khóa và hành động cho từng trường hợp cần hoàn thiện trong contract.
- **Trạng thái:** giữ đúng 5 trạng thái Pipeline ở trên. Tiếp nhận, trùng và Spam là thông tin/cờ riêng, không thêm thành trạng thái Pipeline. Ảnh 1+2 trong báo cáo DOCX hiện có là Use Case và ERD; ảnh trạng thái được người dùng sẽ cung cấp riêng.
- **Nhắc việc:** các nhóm nhắc gồm chưa tiếp nhận, Lead đứng yên, báo giá chưa phản hồi và đến lịch hẹn. Tính theo giờ làm việc; chưa cấu hình lịch/ ngày nghỉ, timezone, ngưỡng cho từng nhắc và người nhận. Không tự gắn lịch nhắc theo 1 ngày/1 tuần/1 tháng/1 năm hoặc đặt mặc định khi chưa chốt.
- **Lịch sử:** tạo Lead, xác nhận tiếp nhận, chuyển Sales và thay đổi thông tin trong Lead đều cần ghi người/nguồn thực hiện, thời gian và chi tiết cũ/mới thích hợp. Khi có DB, thao tác thay đổi Lead và activity tương ứng phải cùng transaction.

### Góp ý giao diện ghi nhận ngày 13/11/2026

- **Điểm làm tốt:** giao diện nhìn bắt mắt, có điểm nhấn; trang tệp đính kèm và lịch sử bắt mắt, dễ thao tác.
- **Đề xuất:** bỏ mục “Lead gần đây”; bỏ trạng thái khỏi “Thông tin chung” và thể hiện trạng thái ở “Tiến độ”.

Đây là góp ý về bố cục UI, chưa phải thay đổi BA hoặc logic nghiệp vụ và chưa được triển khai.

## Quyền và đầu vào/đầu ra

Giữ nguyên ma trận PERMISSIONS. UC01: Marketing chỉ xem ẩn danh; Ads xem ẩn danh và chỉ sửa Nguồn/Chiến dịch theo UC03-4. Không dùng một patch Lead chung để Ads sửa contact/Pipeline. Vai trò quản lý/Admin vẫn giữ các ô quyền BA đã tick; UC01 không liệt kê họ không có nghĩa xóa quyền.

Input có hai luồng web/nhập tay; web tối thiểu SĐT+email theo UC01, các field required còn khác feedback/ERD cần field matrix. Output gồm Lead đúng biểu diễn quyền, người phụ trách, trạng thái/cờ, lịch sử, tài liệu được phép và thông báo. Khách hàng không có tài khoản ứng dụng.

## Dữ liệu và phụ thuộc

Bảng ERD: leads, products, lead_products, lead_attachments, lead_activities. Danh mục LED dùng chung cả 5 module. Phân công/online/nhận Lead và account do Core phối hợp; metadata tracking do M02 sở hữu. M03/M04/M05 chỉ đọc qua public contract có scope. Composition gọi tracking rồi ingest tránh import M01↔M02.

ERD chưa có đầy đủ tên dự án/Spam/tiếp nhận/SĐT chưa chuẩn hóa, actor webhook và lịch sử các thao tác UC01. Chưa tự thêm DDL; xem ERD_COVERAGE. Danh sách không Lead/lỗi lưu/thiếu tài liệu phải hiện đúng trạng thái; lỗi cập nhật không được ghi dở.

## Tiêu chí nghiệm thu khi triển khai

- Tạo/sửa/trùng/SĐT/cờ đúng UC01; retry webhook không làm nhân bản cùng sự kiện, nhưng không tự gộp Lead thật trùng.
- Chưa có Sales phù hợp giữ Chưa giao; phân công cạnh tranh không giao một Lead cho hai người; tiếp nhận không đổi trạng thái.
- Chuyển/thất bại thiếu lý do hoặc người nhận hết điều kiện bị từ chối, Lead/lịch sử không ghi dở; chuyển thành công giữ Pipeline.
- Spam/bỏ Spam không đổi Pipeline; lịch sử phản ánh thao tác; file sai theo UC01 không lưu.
- Đủ vai trò theo matrix; DTO ẩn danh và quyền file/export không bị vượt qua đường API khác.

## Điểm còn mở

Q03–Q09, Q12–Q14: field ẩn danh/required, nguồn, file, online/tải việc, lịch sử/nhắc, model và ticket thiết kế. Không chặn các phần đã rõ khi task độc lập.
