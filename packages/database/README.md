# Package database

Một nơi quản lý Prisma model/client/migration cho toàn dự án; chưa có schema/client sinh hoặc DB được provision trong gói này. Nội dung chuẩn tại [docs/database](../../docs/database/README.md).

Model chia theo ownership nếu major/layout đã chốt hỗ trợ; migrations là lịch sử chung. Mỗi bảng có một owner ghi, FK/contract được các nhóm liên quan review. Các bảng chưa có trong ERD không được tự coi là đã chốt.

Chỉ backend repository/worker có quyền dùng DB theo thiết kế. Không export DB package sang FE/contracts. Giữ provider/version đã khóa của repo thật; không đổi MySQL/PostgreSQL hoặc chạy migration vì đọc file README.

Tham chiếu [từ điển ERD](../../docs/database/DATA_DICTIONARY.md), [đối chiếu](../../docs/database/ERD_COVERAGE.md), [an toàn dữ liệu](../../docs/DATA_SAFETY.md).
