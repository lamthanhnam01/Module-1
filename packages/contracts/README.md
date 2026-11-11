# Package contracts

Nơi đặt DTO/schema thuần dùng chung FE–BE, chưa có source trong gói tài liệu. src/common/ cho envelope/kiểu dùng chung thực sự; 5 thư mục module giữ nguyên tên trong [MODULE_MAP](../../docs/MODULE_MAP.md).

Owner module công bố input/output/public lỗi và phối hợp consumer. Không import Prisma/DB model, Next server, FE/BE runtime hoặc secret. Không trả nguyên entity DB như DTO; trường ẩn danh theo UC01 phải được định nghĩa rõ và kiểm tra server-side.

Quy ước kỹ thuật dự kiến và các điểm bàn giao tại [API_CONTRACTS](../../docs/API_CONTRACTS.md). Khi đổi contract có người dùng, cập nhật consumer/test và review cùng owner; chưa tạo global types khổng lồ.
