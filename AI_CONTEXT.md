# Bối cảnh ngắn của dự án

Cập nhật: 06/11/2026. Core đã chạy: đăng nhập (scrypt, session HttpOnly, CSRF), 8 vai trò/12 quyền BA, quản lý tài khoản (khóa/mở, xóa mềm), hồ sơ/avatar, thông báo, cài đặt thương hiệu (logo, nền đăng nhập, banner Dashboard). **5 module nghiệp vụ còn trống**, hiển thị "Module đang được phát triển". DB local SQLite; production dự kiến PostgreSQL. CI GitHub Actions chạy check:docs, test:tooling, test:core, typecheck.

## Kiến trúc và phân công

Một npm monorepo: `apps/web` (FE), `apps/api` (BE modular monolith), `packages/database` (Prisma, một DB chung; model tách file theo nhóm trong `prisma/models/`), `packages/contracts` (DTO/Zod thuần). Mỗi nhóm làm đủ các lớp của module mình.

| Module | Nhóm / phụ trách | Branch |
| --- | --- | --- |
| 01-leads | 1 / Lâm Thành Nam | feature/lead-management |
| 02-tracking-sync | 2 / Cát Cần Sỹ | feature/tracking-integration |
| 03-keywords-ads | 3 / Nguyễn Anh Quân | feature/ads-keywords |
| 04-reports | 4 / Nguyễn Hoàng Minh Khôi | feature/reports-dashboard |
| 05-ai-design | 5 / Lý Tăng Hữu | feature/ai-design |

Stack: Next.js 14, React, TypeScript, Tailwind, Route Handlers, Prisma.

## Nguồn nghiệp vụ

8 vai trò: SALES, MKT_STAFF, DESIGNER, ADS, MKT_LEAD, SALES_LEAD, BOD, ADMIN. Giữ nguyên ma trận BA và chi tiết ẩn danh UC01. Không có tài khoản khách hàng. M01 Lead + Pipeline; M02 tracking; M03 Ads/từ khóa/SEO; M04 báo cáo; M05 thiết kế giai đoạn 2; Core dùng chung.

Không gửi thông tin khách vào AI. ERD gốc có 9 bảng; khoảng trống UC/DFD là quyết định mở. Không tự thêm giá bán hoặc tính doanh thu.

## Tìm sâu khi cần

Nghiệp vụ: `docs/modules/`; quyền + đăng nhập: `docs/PERMISSIONS.md`; DB: `docs/database/`; contract: `docs/API_CONTRACTS.md`; phạm vi/kiến trúc: `docs/PROJECT.md`; lệnh/Git/task/bàn giao: `docs/QUY_TRINH.md`; việc chưa chốt: `docs/decisions/OPEN_QUESTIONS.md`; ảnh/PDF BA: `docs/sources/`.

Handoff chỉ phản ánh trạng thái module, không thay nguồn BA hoặc code thật. Chỉ đọc phần liên quan task.
