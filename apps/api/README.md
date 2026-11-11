# Backend Toàn Trung (`apps/api`)

Route Handlers TypeScript, được `apps/web` re-export để chạy chung một server.

- `src/app/api/v1/` — HTTP. Core: `auth`, `users`, `profile`, `notifications`, `settings`. 5 nhóm: `leads`, `tracking`, `ads`, `reports`, `design`.
- `src/core/` — auth (scrypt, session, CSRF), permissions (8 vai trò/12 quyền), http, audit, storage (lọc ảnh, thương hiệu), notifications, config.
- `src/modules/<module>/` — logic nghiệp vụ của từng nhóm.
- `src/core/__tests__/` — test Core (`npm run test:core`).

Luồng: xác thực → quyền/phạm vi BA → kiểm tra input bằng schema → use case → repository → trả dữ liệu theo quyền (Marketing/Ads nhận DTO ẩn danh theo UC01). Module khác chỉ dùng `public.ts`; Core không import module. Transaction ngắn, không gọi provider/upload bên trong.

Xem [PERMISSIONS](../../docs/PERMISSIONS.md), [API_CONTRACTS](../../docs/API_CONTRACTS.md), [MODULE_MAP](../../docs/MODULE_MAP.md), [QUY_TRINH](../../docs/QUY_TRINH.md).
