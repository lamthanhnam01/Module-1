## Vấn đề và kết quả

Mô tả trigger, hành vi trước/sau hoặc tài liệu được bổ sung. Nêu module và nguồn BA liên quan.

## Phạm vi

- Module/đường dẫn đã thay đổi:
- File dùng chung và nhóm bị ảnh hưởng:
- Contract/schema/migration/quyền/UI có thay đổi gì:
- Điểm ngoài task phải chạm và lý do:
- Task JSON / handoff module đã cập nhật:

## Kiểm tra thực tế

| Lệnh hoặc thao tác thật | Môi trường | Kết quả | Giới hạn |
| --- | --- | --- | --- |
| Điền sau khi thực hiện | Chưa ghi | NOT_RUN | Chưa ghi |

Không tích sẵn test pass; phân biệt unit/integration/E2E/provider/backup. Đối với chỉ sửa tài liệu, nêu kiểm tra link/nguồn/ma trận phù hợp.

## Dữ liệu và tích hợp

Ảnh hưởng dữ liệu, migration/backfill, cách khôi phục/forward-fix và provider đã xác minh nếu có. Không chèn secret hoặc dữ liệu khách hàng vào PR.

## Điểm cần review

Owner/reviewer phù hợp, quyền BA được giữ, consumer contract và phần chưa xác minh. Không ghi đã cấu hình protected main/CI nếu chưa thực hiện.
