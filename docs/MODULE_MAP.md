# Phân công 5 nhóm và quyền sở hữu đường dẫn

Nguồn: bảng phân nhóm người dùng cung cấp; [ảnh nguồn](sources/assets/team-assignment.png). Mỗi nhóm theo trọn FE–BE–DB–test của module. Đây là phân công phát triển, khác 8 vai trò đăng nhập trong ma trận BA.

| Nhóm | Phụ trách | Module | Route | Branch |
| --- | --- | --- | --- | --- |
| Nhóm 1 | Lâm Thành Nam | 01-leads | leads | feature/lead-management |
| Nhóm 2 | Cát Cần Sỹ | 02-tracking-sync | tracking | feature/tracking-integration |
| Nhóm 3 | Nguyễn Anh Quân | 03-keywords-ads | ads | feature/ads-keywords |
| Nhóm 4 | Nguyễn Hoàng Minh Khôi | 04-reports | reports | feature/reports-dashboard |
| Nhóm 5 | Lý Tăng Hữu | 05-ai-design | design | feature/ai-design |

## Đường dẫn đầy đủ của từng nhóm

### Nhóm 1 — 01-leads

- FE: `apps/web/src/modules/01-leads/`.
- FE route: `apps/web/src/app/(workspace)/leads/`.
- BE: `apps/api/src/modules/01-leads/`.
- API route: `apps/api/src/app/api/v1/leads/`.
- Contracts: `packages/contracts/src/01-leads/`.
- Model tương lai: `packages/database/prisma/models/01-leads.prisma`.
- E2E: `tests/e2e/01-leads/`.
- Fixture: `tests/fixtures/01-leads/`.
- Tài liệu: `docs/modules/01-leads.md`.

Model đã được định nghĩa tại `packages/database/prisma/models/` theo quyền sở hữu bảng tại [TABLE_OWNERSHIP](database/TABLE_OWNERSHIP.md). Unit/API integration đặt cạnh logic liên quan.

### Nhóm 2 — 02-tracking-sync

- FE: `apps/web/src/modules/02-tracking-sync/`.
- FE route: `apps/web/src/app/(workspace)/tracking/`.
- BE: `apps/api/src/modules/02-tracking-sync/`.
- API route: `apps/api/src/app/api/v1/tracking/`.
- Contracts: `packages/contracts/src/02-tracking-sync/`.
- Model tương lai: `packages/database/prisma/models/02-tracking-sync.prisma`.
- E2E: `tests/e2e/02-tracking-sync/`.
- Fixture: `tests/fixtures/02-tracking-sync/`.
- Tài liệu: `docs/modules/02-tracking-sync.md`.

Model đã được định nghĩa tại `packages/database/prisma/models/` theo quyền sở hữu bảng tại [TABLE_OWNERSHIP](database/TABLE_OWNERSHIP.md). Unit/API integration đặt cạnh logic liên quan.

### Nhóm 3 — 03-keywords-ads

- FE: `apps/web/src/modules/03-keywords-ads/`.
- FE route: `apps/web/src/app/(workspace)/ads/`.
- BE: `apps/api/src/modules/03-keywords-ads/`.
- API route: `apps/api/src/app/api/v1/ads/`.
- Contracts: `packages/contracts/src/03-keywords-ads/`.
- Model tương lai: `packages/database/prisma/models/03-keywords-ads.prisma`.
- E2E: `tests/e2e/03-keywords-ads/`.
- Fixture: `tests/fixtures/03-keywords-ads/`.
- Tài liệu: `docs/modules/03-keywords-ads.md`.

Model đã được định nghĩa tại `packages/database/prisma/models/` theo quyền sở hữu bảng tại [TABLE_OWNERSHIP](database/TABLE_OWNERSHIP.md). Unit/API integration đặt cạnh logic liên quan.

### Nhóm 4 — 04-reports

- FE: `apps/web/src/modules/04-reports/`.
- FE route: `apps/web/src/app/(workspace)/reports/`.
- BE: `apps/api/src/modules/04-reports/`.
- API route: `apps/api/src/app/api/v1/reports/`.
- Contracts: `packages/contracts/src/04-reports/`.
- Model tương lai: `packages/database/prisma/models/04-reports.prisma`.
- E2E: `tests/e2e/04-reports/`.
- Fixture: `tests/fixtures/04-reports/`.
- Tài liệu: `docs/modules/04-reports.md`.

Model đã được định nghĩa tại `packages/database/prisma/models/` theo quyền sở hữu bảng tại [TABLE_OWNERSHIP](database/TABLE_OWNERSHIP.md). Unit/API integration đặt cạnh logic liên quan.

### Nhóm 5 — 05-ai-design

- FE: `apps/web/src/modules/05-ai-design/`.
- FE route: `apps/web/src/app/(workspace)/design/`.
- BE: `apps/api/src/modules/05-ai-design/`.
- API route: `apps/api/src/app/api/v1/design/`.
- Contracts: `packages/contracts/src/05-ai-design/`.
- Model tương lai: `packages/database/prisma/models/05-ai-design.prisma`.
- E2E: `tests/e2e/05-ai-design/`.
- Fixture: `tests/fixtures/05-ai-design/`.
- Tài liệu: `docs/modules/05-ai-design.md`.

Model đã được định nghĩa tại `packages/database/prisma/models/` theo quyền sở hữu bảng tại [TABLE_OWNERSHIP](database/TABLE_OWNERSHIP.md). Unit/API integration đặt cạnh logic liên quan.

## Vùng dùng chung

Auth/session/users/permission; core HTTP/audit/storage/jobs/notifications/config; FE layout/UI/session; root wiring; contracts/common; DB client/schema/config/migrations; manifest/lockfile; scripts/CI/infra.

Người điều phối Core, reviewer migration, reviewer quyền và người quản lý manifest cần trưởng dự án phân công theo task; chưa gán mặc định tất cả cho Nhóm 1 và chưa bịa danh tính reviewer/GitHub username. Task có thể chạm phần chung tối thiểu và phải khai báo ảnh hưởng.

Một bảng có owner ghi theo [TABLE_OWNERSHIP](database/TABLE_OWNERSHIP.md). Không coi sở hữu module là quyền sửa mọi bảng liên quan. API route của nhóm và module folder đều thuộc phạm vi nhóm; các layout/root route có ảnh hưởng chung.

## Phân biệt số nghiệp vụ và số nhóm

DFD 1.0/2.0 → M01; 3.0 → M02; 4.0 → M04; 5.0 SEO → đề xuất M03; 6.0 → M05 giai đoạn 2; 7.0 → Core. Giữ 5 nhóm, không đặt M05 thành SEO vì trùng số 5.0.

Bảng phân nhóm ban đầu ghi đang nghiên cứu; bộ tài liệu không xác nhận source đã được push đủ hoặc chức năng hoàn thành. Cách mở PR/đồng bộ được quy định tại [QUY_TRINH](QUY_TRINH.md).
