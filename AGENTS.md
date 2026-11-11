# Quy tắc AI — Toàn Trung

Áp dụng toàn repo. Yêu cầu mới nhất của người dùng xác định việc được giao. Không tự sửa quy tắc/task để hợp thức hóa việc ngoài phạm vi.

## Đọc gọn trước khi làm

1. Kiểm tra root, nhánh và Git status; giữ thay đổi của người khác. Nếu chưa có Git, nói rõ.
2. Đọc task cụ thể, [AI_CONTEXT](AI_CONTEXT.md) và handoff đúng module trong `docs/handoffs/`. Có thể dùng gói do `scripts/prepare-context.js` tạo. Không đọc toàn repo, lockfile, ảnh/PDF/vendor/log dài mặc định.
3. Dùng `rg` tìm source/caller trực tiếp. Khi thay đổi nghiệp vụ, mở mục liên quan trong `docs/modules/<module>.md`; khi đụng quyền/auth, DB, contract hoặc UI, mở đúng tài liệu theo bảng tài liệu trong [README](README.md). Tóm tắt không thay source hiện tại.
4. Nêu ngắn mục tiêu, đường dẫn sửa, phần chung ảnh hưởng và cách kiểm tra; tiếp tục phần đã được giao rõ. Tư vấn/review không tự triển khai ứng dụng.

## Giữ phạm vi và phối hợp

- Bốn workspace: `apps/web`, `apps/api`, `packages/database`, `packages/contracts`; 5 nhóm sở hữu trọn FE–BE–DB–test module theo [MODULE_MAP](docs/MODULE_MAP.md).
- Chỉ sửa task và phụ thuộc tối thiểu. Không nhân tiện đổi UI, refactor/format toàn repo, nâng package, đổi stack/provider hay thêm chức năng.
- Task mỗi nhóm ở `docs/tasks/m01/`…`m05/`; mẫu JSON trạng thái `template` chưa phải việc được giao. Tạo task từ yêu cầu thực tế; không dùng một ACTIVE_TASK chung cho 5 nhóm.
- Phần dùng chung bắt buộc ghi đường dẫn cụ thể trong `allowedSharedPaths`, nêu ảnh hưởng và reviewer phù hợp. Không tự nới danh sách chỉ để qua check; không thêm vòng xin phép cho việc đã được giao rõ.
- Chạy `npm run check:scope -- --task <file>` khi có Git. PR cần diff `--base/--head`; cách dùng tại [QUY_TRINH](docs/QUY_TRINH.md#5-kiểm-tra-phạm-vi-và-nghiệm-thu). Checker chỉ kiểm tra đường dẫn, không thay reviewer/CI/quyền truy cập.
- Thấy diff ngoài phạm vi: phân biệt thay đổi có sẵn và thay đổi do mình tạo, giữ nguyên công việc người khác, báo phần chưa xử lý. Không reset/revert/xóa/ghi đè tự động. Chỉ sửa lại thay đổi của chính mình khi an toàn và nằm trong việc được giao.
- Không tự commit/push/merge/deploy khi chỉ được giao sửa cục bộ. Không force push hoặc upload đè cả dự án.

## Bất biến nghiệp vụ và dữ liệu

- Giữ nguyên 8 vai trò và mọi ô ma trận BA tại [PERMISSIONS](docs/PERMISSIONS.md). UC01 Marketing/Ads xem Lead ẩn danh; Ads chỉ sửa Nguồn/Chiến dịch theo UC03-4. Áp dụng ở backend/file/job/export, không chỉ menu.
- M01 gồm Lead và Pipeline (DFD 1/2); SEO DFD 5 đề xuất M03; M05 thiết kế DFD 6 là giai đoạn 2; DFD 7 là Core. Không tự tạo nhóm mới.
- Khách hàng là dữ liệu Lead, không có portal/tài khoản. Admin cấp tài khoản; không đăng ký công khai, mật khẩu mặc định hoặc nút điền nhanh role.
- Giữ 5 trạng thái Pipeline; Spam/trùng/tiếp nhận/phân công là trạng thái riêng. Chuyển/thất bại phải có lý do; chuyển hợp lệ giữ Pipeline, kiểm tra lại người nhận, lưu lịch sử/thông báo đúng UC.
- Không gửi SĐT/email/thông tin khách cho AI; xét cả prompt, tệp và metadata. AI thiết kế tạo bản nháp để Designer hoàn thiện. Không tự thêm giá bán/doanh thu/lợi nhuận; chi phí Ads/AI vẫn theo BA.
- FE chỉ gọi HTTP; không import DB/Prisma/secret. Module chỉ dùng public entry của module khác; core không import module, contracts không import server/DB. Không query bảng module khác tùy tiện.
- Một DB/migration history, một owner ghi mỗi bảng. ERD hiện có 9 bảng; chưa tự thêm schema cho các khoảng trống. Chốt provider và Prisma major trước khi tạo model/migration.
- Không sửa migration đã áp dụng, tự reset/db push/DROP/TRUNCATE hoặc dọn dữ liệu thật. Transaction ngắn, không gọi provider/upload bên trong; ingest/retry có chống lặp, checkpoint sau dữ liệu bền.
- Credential chỉ ở server/worker; không vào Git, FE, NEXT_PUBLIC_*, log/response. File nghiệp vụ private, kiểm tra quyền tải. Test dùng dữ liệu tổng hợp; không đưa dữ liệu khách/DB dump vào repo.
- Không báo success/KPI/nguồn/AI giả. Chưa cấu hình, lỗi và tập rỗng là các trạng thái khác nhau. Mâu thuẫn BA ghi đúng nguồn tại [OPEN_QUESTIONS](docs/decisions/OPEN_QUESTIONS.md), không tự sửa quyền để code dễ hơn.

## Kết thúc và chuyển AI

Chạy kiểm tra phù hợp từ [QUY_TRINH](docs/QUY_TRINH.md#1-lệnh-chạy-tại-thư-mục-có-packagejson), đọc diff; ghi lệnh/kết quả thực và phần chưa chạy. Cập nhật handoff module: trạng thái hiện tại, file/contract đã đổi, bằng chứng, blocker, bước tiếp theo. Giữ handoff ngắn; lịch sử dài ở task/PR. Tạo lại gói context sau khi task/handoff/HEAD thay đổi. Không báo hệ thống đã chạy từ kết quả kiểm tra tài liệu/tooling.
