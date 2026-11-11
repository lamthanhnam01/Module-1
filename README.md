# Toàn Trung V2 — Hệ thống nội bộ Marketing và Kinh doanh

Monorepo Next.js + Prisma. Core (đăng nhập, phân quyền 8 vai trò BA, tài khoản, hồ sơ, thông báo, cài đặt thương hiệu) đã chạy; 5 module nghiệp vụ đang trống chờ 5 nhóm.

## Chạy nhanh

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev        # http://localhost:3000
```

Tài khoản demo (chỉ môi trường dev): `admin@toantrung.vn`, `sales@toantrung.vn`, `marketing@toantrung.vn`, `designer@toantrung.vn` — mật khẩu `ToanTrung@2026`.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `apps/web` | Giao diện (route + Core UI + 5 module) |
| `apps/api` | Backend (auth, quyền, Core, 5 module) |
| `packages/database` | Prisma schema, một DB chung |
| `packages/contracts` | DTO/schema dùng chung FE–BE |
| `tests` | E2E và fixture theo module; test công cụ |
| `scripts` | Công cụ kiểm tra tài liệu, phạm vi, tạo ngữ cảnh AI |
| `docs` | Tài liệu (bên dưới) |

## Tài liệu — đọc theo nhu cầu

| Cần gì | File |
| --- | --- |
| **Quy tắc bắt buộc cho người và AI** | [AGENTS.md](AGENTS.md) |
| Bối cảnh ngắn cho AI | [AI_CONTEXT.md](AI_CONTEXT.md) |
| Nhóm nào code ở thư mục nào | [docs/MODULE_MAP.md](docs/MODULE_MAP.md) |
| Nghiệp vụ 5 module | [01-leads](docs/modules/01-leads.md) · [02-tracking-sync](docs/modules/02-tracking-sync.md) · [03-keywords-ads](docs/modules/03-keywords-ads.md) · [04-reports](docs/modules/04-reports.md) · [05-ai-design](docs/modules/05-ai-design.md) |
| Trạng thái hiện tại từng module | `docs/handoffs/<module>.md` |
| Lệnh, Git, task, bàn giao, nghiệm thu | [docs/QUY_TRINH.md](docs/QUY_TRINH.md) |
| Phạm vi dự án, nguồn BA, kiến trúc | [docs/PROJECT.md](docs/PROJECT.md) |
| Ma trận quyền 8 vai trò + đăng nhập | [docs/PERMISSIONS.md](docs/PERMISSIONS.md) |
| Quy ước API/contract giữa nhóm | [docs/API_CONTRACTS.md](docs/API_CONTRACTS.md) |
| An toàn dữ liệu | [docs/DATA_SAFETY.md](docs/DATA_SAFETY.md) |
| Giao diện/thương hiệu | [docs/UI_GUIDELINES.md](docs/UI_GUIDELINES.md), [design brief](docs/design/ToanTrung_Antigravity_Design_Brief/START_HERE.md) |
| Database (ERD, từ điển, owner bảng) | [docs/database/README.md](docs/database/README.md) |
| Việc chưa chốt với BA | [docs/decisions/OPEN_QUESTIONS.md](docs/decisions/OPEN_QUESTIONS.md) |
| Ảnh/PDF BA gốc | [docs/sources/README.md](docs/sources/README.md) |
