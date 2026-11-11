# Frontend Toàn Trung (`apps/web`)

Next.js 14 App Router + React + Tailwind. Chạy cùng API bằng `npm run dev` tại thư mục gốc.

- `src/app/(auth)/login` — trang đăng nhập (Core).
- `src/app/(workspace)/` — các trang sau đăng nhập. Core: `dashboard`, `notifications`, `profile`, `admin`, `settings`. 5 nhóm: `leads`, `tracking`, `ads`, `reports`, `design`.
- `src/core/` — layout, session, HTTP client dùng chung (Core, không tự sửa).
- `src/modules/<module>/` — giao diện của từng nhóm theo [MODULE_MAP](../../docs/MODULE_MAP.md).
- `src/app/api/` — chỉ re-export route handler từ `apps/api`.

Quy tắc: FE chỉ gọi HTTP bằng DTO trong `packages/contracts`; không import DB, Prisma, secret. Ẩn menu không thay kiểm tra quyền ở API. Hiển thị đúng loading/empty/error; không dùng số mẫu làm dữ liệu thật. Xem [quyền BA](../../docs/PERMISSIONS.md), [UI](../../docs/UI_GUIDELINES.md), [quy trình](../../docs/QUY_TRINH.md).
