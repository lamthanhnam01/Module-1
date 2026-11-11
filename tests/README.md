# Kiểm thử dự án

- `tests/tooling/` — test công cụ scope/context/link (`npm run test:tooling`). Git chỉ khởi tạo trong thư mục tạm.
- `apps/api/src/core/__tests__/` — test bảo mật Core (`npm run test:core`).
- `tests/e2e/auth/`, `tests/e2e/<module>/` — E2E theo 5 tên module chuẩn.
- `tests/fixtures/<module>/` — dữ liệu tổng hợp; không sao chép dữ liệu khách thật.
- Unit/API integration của module đặt cạnh logic trong `__tests__/`.

Kiểm tra hành vi và nhánh lỗi, không chỉ file tồn tại. Test transaction dùng DB riêng; provider mock ở adapter. Không gọi API tính phí hoặc reset DB thật trong CI. Tiêu chí nghiệm thu và ca trọng tâm từng module: [QUY_TRINH](../docs/QUY_TRINH.md#5-kiểm-tra-phạm-vi-và-nghiệm-thu).
