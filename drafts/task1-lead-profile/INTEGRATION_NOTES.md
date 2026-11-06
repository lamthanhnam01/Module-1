
# Task 1 - Lead Profile: Integration Notes

## Quan hệ cần bổ sung vào model User

Khi tích hợp lead.prisma với core.prisma,
bổ sung các trường sau trong model User:

```prisma
assignedLeads Lead[] @relation("AssignedLeads")
receivedLeads Lead[] @relation("ReceivedLeads")
leadHistories LeadHistory[] @relation("LeadHistoryActor")
```

## Lưu ý

- Chưa chỉnh sửa core.prisma của dự án tổng.
- Chưa chạy migration.
- Cần thống nhất schema với nhóm trước khi tích hợp.
- LeadHistory là đề xuất riêng, cần đối chiếu với AuditLog chung.
- LeadProduct cần đối chiếu với danh mục sản phẩm hiện có.
