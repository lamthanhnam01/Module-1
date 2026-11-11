# Quy trình làm việc của 5 nhóm

Gộp từ các file cũ: lệnh chạy, Git, task, bàn giao AI, kiểm tra phạm vi và nghiệm thu. Quy tắc bắt buộc vẫn nằm ở [AGENTS.md](../AGENTS.md); file này hướng dẫn cách làm.

## 1. Lệnh chạy (tại thư mục có `package.json`)

| Mục đích | Lệnh |
| --- | --- |
| Cài thư viện (lần đầu) | `npm install` |
| Sinh Prisma Client | `npm run db:generate` |
| Tạo/cập nhật bảng SQLite local | `npm run db:push` |
| Nạp 8 vai trò, thương hiệu mặc định, tài khoản demo (chỉ dev) | `npm run db:seed` |
| Chạy web + API tại http://localhost:3000 | `npm run dev` |
| Kiểm tra kiểu TypeScript cả 4 workspace | `npm run typecheck` |
| Test bảo mật Core (hash, RBAC, lọc ảnh, khung cắt, chặn leo quyền) | `npm run test:core` |
| Build production | `npm run build` |
| Kiểm tra link/JSON trong tài liệu | `npm run check:docs` |
| Test công cụ nội bộ | `npm run test:tooling` |
| Tạo gói ngữ cảnh cho AI | `npm run context:task -- --module 01-leads --out .ai-context/m01.md` |
| Kiểm tra mình chỉ sửa đúng thư mục nhóm | `npm run check:scope -- --module 01-leads` |

GitHub Actions ([ci.yml](../.github/workflows/ci.yml)) tự chạy `check:docs`, `test:tooling`, `db:generate`, `db:push`, `test:core`, `typecheck` mỗi lần push/PR vào `main`.

## 2. Trình tự làm một task

1. Kiểm tra `git status`, đứng đúng nhánh nhóm theo [MODULE_MAP](MODULE_MAP.md). Không đổi/reset nhánh người khác.
2. Tạo task: copy `docs/tasks/m0x/TASK.example.json` thành `task.local.json` (làm cục bộ) hoặc `<ID>.json` (đưa vào PR). Điền `goal`, `acceptanceCriteria`, chuyển `status` sang `ready`.
3. Code trong thư mục nhóm. Nếu bắt buộc chạm phần chung, ghi đúng đường dẫn vào `allowedSharedPaths` và lý do ở `notes`.
4. Chạy kiểm tra phù hợp (mục 5), đọc lại diff, chạy `check:scope`.
5. Cập nhật handoff của module (mục 4).
6. Push nhánh nhóm, mở PR nhỏ vào `main` theo [mẫu PR](../.github/pull_request_template.md).

### Trường của task JSON

| Trường | Ý nghĩa |
| --- | --- |
| schemaVersion | Luôn là 1 |
| id / title / goal | Mã task, tên, mục tiêu cụ thể |
| status | `template` (mẫu, chưa giao) / `ready` / `blocked` / `completed` |
| modules | Module thực sự được giao, ví dụ `["01-leads"]` |
| acceptanceCriteria | Tiêu chí nghiệm thu quan sát được (ít nhất 1 khi `ready`) |
| allowedSharedPaths | Mặc định rỗng; chỉ ghi file chung bắt buộc, không mở cả thư mục lớn |
| readWhenNeeded | Tài liệu `.md` chỉ mở khi liên quan |
| notes | Nguồn BA, lý do chạm phần chung |

Không có một ACTIVE_TASK chung cho cả 5 nhóm. `*.local.json` bị Git bỏ qua.

## 3. Git và phối hợp

- Mỗi nhóm một nhánh `feature/...` (xem MODULE_MAP). Cần nhánh con thì dùng `task/m01-<ticket>`, không dùng `feature/lead-management/<ticket>` (xung đột tên ref).
- Không force push, không upload đè cả thư mục, không chọn toàn bộ ours/theirs để né conflict.
- Không đưa `.env`, token, DB dump, dữ liệu khách lên Git.
- DB: một migration history chung; không sửa migration đã áp dụng. Hai PR cùng đổi schema thì người điều phối DB quyết định thứ tự.

| Thay đổi | Cần ai review |
| --- | --- |
| Contract/DTO public | Owner module + nhóm dùng contract |
| Schema/migration/FK | Owner bảng + người điều phối DB |
| Auth/quyền/DTO ẩn danh | Người phụ trách Core (+ BA nếu đổi nghiệp vụ) |
| Layout/menu/UI chung | Người phụ trách FE chung |
| Dependency/lockfile/CI | Người duy trì phần chung |

## 4. Bàn giao giữa người/AI

- Mỗi module có 1 file trạng thái: `docs/handoffs/<module>.md`. Cuối task ghi: ngày, trạng thái, file/contract đã đổi, lệnh đã chạy + kết quả thật, blocker, việc tiếp theo. Giữ dưới 4.500 byte.
- Gói ngữ cảnh cho AI khác: `npm run context:task -- --task docs/tasks/m01/task.local.json --out .ai-context/task.md`. Gói chỉ chứa AGENTS, AI_CONTEXT, task và handoff (giới hạn 18.000 byte), có hash/HEAD để biết gói cũ. `.ai-context/` không lên Git.
- Không ghi PASS cho lệnh chưa chạy. Không ghi "toàn hệ thống xong" khi mới xong một module.

Prompt mẫu gửi AI:

```text
Đọc AGENTS.md và AI_CONTEXT.md rồi làm task sau: <nội dung>.
Nhóm/module: <01-leads ...>.
Lập task từ yêu cầu này, chỉ mở source/tài liệu liên quan.
Giữ nguyên quyền BA, sửa đúng phạm vi; xong thì cập nhật handoff module.
Chỉ sửa cục bộ, không tự push hoặc deploy.
```

## 5. Kiểm tra phạm vi và nghiệm thu

`check:scope` chỉ kiểm tra **tên đường dẫn** có thuộc module/task không; không kiểm tra nội dung code, quyền hay secret.

| Chế độ | Lệnh |
| --- | --- |
| Thay đổi chưa commit | `npm run check:scope -- --module 02-tracking-sync` |
| Theo task | `npm run check:scope -- --task docs/tasks/m02/task.local.json` |
| Khi review PR | `npm run check:scope -- --module 02-tracking-sync --base origin/main --head HEAD` |

Exit 0 = đúng phạm vi; 1 = có file ngoài phạm vi; 2 = lỗi input/Git. Có vi phạm thì đọc diff, giữ nguyên việc của người khác, không tự revert.

| Loại thay đổi | Bằng chứng cần có |
| --- | --- |
| Chữ/CSS nhỏ | Xem trực tiếp màn hình |
| Nghiệp vụ | Unit test đầu vào/đầu ra và nhánh lỗi |
| API/quyền/ẩn danh | Test handler thật, đủ 8 vai trò theo [PERMISSIONS](PERMISSIONS.md) |
| Transaction/DB | Lỗi giữa chừng không ghi dở |
| Đồng bộ/AI/Google | Mock adapter cho retry/lỗi/chống lặp |

Ca trọng tâm theo BA:

- **M01**: webhook/nhập tay, trùng không tự gộp, Spam giữ Pipeline, chuyển Sales hợp lệ, thất bại phải có lý do, DTO ẩn danh.
- **M02**: bóc nguồn thật, webhook lỗi không mất dấu, event lặp không nhân bản, checkpoint đồng bộ.
- **M03**: đơn vị/công thức chỉ số thống nhất, không gửi thông tin khách cho AI.
- **M04**: đúng phạm vi theo vai trò, Sales chỉ thấy số của mình, export cùng bộ lọc/ẩn danh.
- **M05**: provider lỗi không báo thành công, phân biệt nháp AI với bản hoàn thiện, ghi thời gian/token thật.

Task đạt khi: đúng tiêu chí, giữ quyền BA, không có diff ngoài phạm vi, tài liệu/handoff cập nhật, báo kết quả bằng PASS/FAIL/BLOCKED/NOT_RUN.

