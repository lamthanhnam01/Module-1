# Handoff 01-leads

Cập nhật: 20/11/2026. Nhóm 1 — Lâm Thành Nam. Branch hiện tại: `feature/module1-task3-pipeline`. Remote `origin`: `https://github.com/truongvanlong1905/ToanTrungMar.git`.

## Hiện trạng

Task 3 có workflow/policy/contracts, Prisma adapter và bốn route mutation. ID public là số; các field response theo tên schema M01. Mutation dùng `expectedVersion` và Prisma CAS (`id + version`, tăng version nguyên tử); phiên bản cũ không ghi activity. Không cho `won -> lost`, giữ `firstQuoteSentAt`, tăng `reopenCount` khi mở lại, và nhận actor/time tiếp nhận từ session/server clock. `task3-authorization.ts` áp quyền BA và giới hạn SALES vào Lead được giao. Adapter dùng parameterized SQL theo schema Task 1 đang ở branch/repo khác; schema chưa tích hợp vào checkout nên chưa thể chạy routes với DB hiện tại. Không tạo model trùng, `db:push` hoặc migration.

## File và bằng chứng

- `apps/api/src/modules/01-leads/task3-contracts.ts`, `task3-policy.ts`, `task3-repository.ts`, `task3-workflow.ts`, `task3-workflow.test.ts`.
- `apps/api/src/modules/01-leads/task3-authorization.ts`, `task3-authorization.test.ts`.
- `apps/api/src/modules/01-leads/task3-prisma-repository.ts`, `task3-http.ts`.
- `apps/api/src/app/api/v1/leads/[id]/{pipeline,reopen,transfer,receive}/route.ts`.
- `apps/api/src/modules/01-leads/README.md`.
- `packages/contracts/src/01-leads/task3.ts` and public export in `packages/contracts/src/common/index.ts`.
- `packages/contracts/src/01-leads/task3.test.mjs`.
- `docs/tasks/m01/M01-T03-pipeline.json`.
- `npm run db:generate`: PASS, Prisma Client 5.22.0 generated from the current Core-only local schema.
- `$env:DATABASE_URL='file:./dev.db'; npx prisma validate --schema=packages/database/prisma`: PASS.
- `node --experimental-strip-types --test apps/api/src/modules/01-leads/task3-workflow.test.ts apps/api/src/modules/01-leads/task3-authorization.test.ts packages/contracts/src/01-leads/task3.test.mjs`: PASS, 32/32.
- `npm run typecheck --workspace @toantrung/contracts`: PASS.
- `npm run typecheck --workspace @toantrung/api`: PASS.
- Targeted `npx tsc --noEmit --strict ...` over Task 3 workflow, auth test, Prisma adapter, HTTP helper, and four routes: PASS.
- `npm run check:scope -- --task docs/tasks/m01/M01-T03-pipeline.json`: PASS, 21 changed paths.
- `npm run check:docs`: PASS, 58 Markdown files and 6 task files checked.
- `git diff --check`: PASS.
- Đã ghi yêu cầu bổ sung vào hồ sơ module: webhook không tự điền trường thiếu; cờ trùng cần người xác minh để phân biệt khách quay lại/Spam; năm trạng thái Pipeline giữ nguyên và cờ tiếp nhận/trùng/Spam tách riêng; lịch sử cần actor/thời gian; nhắc theo giờ làm việc nhưng chưa tự đặt lịch.
- Đã ghi góp ý UI mới vào hồ sơ module: giao diện và trang tệp đính kèm/lịch sử được đánh giá tốt; đề xuất bỏ “Lead gần đây” và chuyển trạng thái khỏi “Thông tin chung” sang “Tiến độ”. Đây mới là ghi nhận góp ý, chưa triển khai.
- Ảnh 1+2 trong DOCX hiện tại là Use Case và ERD, không phải ảnh trạng thái. Người dùng sẽ gửi ảnh status đúng sau.

## Blocker và bước tiếp theo

SQLite hiện là provider local; production provider vẫn chưa chốt. Reopen route cần cấu hình `TASK3_REOPEN_WINDOW_MS`; transfer route trả 503 cho tới khi có nguồn presence/online và policy tải việc được duyệt. Workflow giữ kiểm tra catalogue lý do thất bại và route fail-closed nếu chưa có provider; không giả lập dữ liệu catalogue từ `lost_reason` text. Cần tích hợp Task 1 schema trước khi chạy routes với DB; không chạy `db:push`. Còn các blocker cũ: website intake/idempotency, duplicate disposition, reminders và ảnh status. Không tự điền trường thiếu, phân loại trùng, đặt lịch nhắc hoặc push lên `origin`.
