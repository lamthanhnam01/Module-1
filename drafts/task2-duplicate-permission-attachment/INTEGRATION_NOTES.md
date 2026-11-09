# Task 2 - Trùng lặp, phân quyền, tài liệu: hướng dẫn tích hợp

Phạm vi theo đặc tả UC01: kiểm tra trùng Lead (E0), phân quyền theo ma trận RBAC,
đính kèm tài liệu (4.3, E3, 4a), màn xem tiến độ chỉ đọc cho Marketing/Ads (3.2).

Toàn bộ logic nghiệp vụ nằm trong `apps/api/src/modules/01-leads/`, viết dưới dạng
hàm thuần túy và các service nhận "cổng" (interface) thay vì gọi thẳng Prisma hay
Next.js. Nhờ vậy đã chạy kiểm thử độc lập, và nhóm chỉ cần viết adapter mỏng để nối vào.

## 1. Có gì trong Task 2

| File | Việc làm |
|---|---|
| `lead.constants.ts` | Trạng thái Lead, cờ trùng, mã vai trò (đề xuất chung cho cả 3 task) |
| `lead.errors.ts` | `LeadAccessError` (UNAUTHENTICATED 401, FORBIDDEN 403, NOT_FOUND 404) |
| `company-name.ts` | Chuẩn hóa tên công ty / dự án / email để so khớp (bỏ dấu, khoảng trắng, dấu câu, tiền tố loại hình) |
| `duplicate.rules.ts` | Luật E0 thuần túy: cờ Trùng / Đã có Lead cũ / Cùng SĐT-email, chọn Lead cũ, quyết định phân công |
| `duplicate.service.ts` | Ghép luật với repository, kiểm tra NVKD còn nhận Lead, kế hoạch thông báo (tạo mới và sửa 4.2) |
| `lead.permissions.ts` | Ma trận RBAC 8 vai trò x 12 quyền, phạm vi dữ liệu, bộ lọc truy vấn, 401/403/404 |
| `attachment.validation.ts` | Danh sách trắng loại tệp, kiểm tra chữ ký đầu tệp, làm sạch tên và đường dẫn thư mục |
| `attachment.service.ts` | Tải tệp/thư mục từng tệp độc lập (E3), lịch sử, danh sách, cây thư mục, tải về |
| `progress.service.ts` | Danh sách tiến độ chỉ đọc cho Marketing/Ads, lọc, phân trang, loại Spam |
| `tests/*.test.ts` | 82 test (node:test) |
| `packages/database/prisma/models/lead-attachment.prisma` | Model `LeadAttachment` (đề xuất) |
| `drafts/.../prisma-test/` | Bộ schema đã ghép Task 1 + Task 2 để chạy `prisma validate` |

Chạy test (không cần cơ sở dữ liệu):

```bash
npx tsx --test apps/api/src/modules/01-leads/tests/*.test.ts
```

Đã kiểm tra: TypeScript `strict` + `noUncheckedIndexedAccess` không lỗi; 82/82 test đạt;
bộ schema trong `prisma-test/` qua bước kiểm tra cú pháp và quan hệ của Prisma 5.22
(chưa chạy `prisma validate` đầy đủ và chưa migrate vì môi trường làm việc không tải được
engine của Prisma). Nhóm hãy chạy `npx prisma validate` ở máy mình trước khi gộp.

## 2. Schema: cần thống nhất với cả nhóm trước khi sửa

Task 2 cần thêm cột vào `Lead` (file của Task 1) và đổi kiểu một cột. Vì quy ước của
nhóm là không tự đổi DB dùng chung, các thay đổi dưới đây CHƯA áp vào `lead.prisma` gốc;
bản đã áp nằm trong `drafts/task2-duplicate-permission-attachment/prisma-test/lead.prisma`.

| Cột | Ghi chú |
|---|---|
| `email`, `emailKey` | Email khách và khóa so khớp (chữ thường) |
| `companyKey`, `projectKey` | Khóa chuẩn hóa, tính bằng `buildLeadKeys()` mỗi khi tạo hoặc sửa Lead |
| `duplicateFlag` | ĐỔI từ `Boolean` sang `String?`: `DUPLICATE`, `HAS_OLD_LEAD`, `SAME_PHONE_EMAIL`, `null` nếu không trùng. Task 1 cần đồng ý, vì cờ đỏ chỉ ứng với `DUPLICATE` |
| `isSpam` | Lead Spam không dùng để xét trùng và không vào số liệu pipeline |
| `hasDesignRequest` | Lead có yêu cầu phối cảnh 3D/2D: Designer chỉ thấy các Lead này |
| `failureReason`, `closedAt` | Để hiển thị Lead cũ kèm kết quả và chọn Lead "chốt gần nhất" |
| `deletedAt` | Xóa mềm (kế hoạch chống mất dữ liệu) |
| Chỉ mục | `(companyKey, projectKey)`, `normalizedPhone`, `emailKey` |

Quan hệ ngược cần thêm:

```prisma
// model Lead
attachments LeadAttachment[]

// model User (core.prisma)
leadAttachments LeadAttachment[] @relation("LeadAttachmentUploader")
```

Ngoài ra, bảng `users` chưa có cột cho "NVKD đang nhận Lead (nghỉ phép, tạm ngưng)" mà
đặc tả yêu cầu (tiền điều kiện cấu hình). Cần một cột kiểu `acceptsLeads Boolean @default(true)`
hoặc bảng cấu hình riêng; `AssigneeAvailability` sẽ đọc từ đó (cùng với `isActive`, `deletedAt`).

## 3. Cách nối vào dự án (adapter cần viết)

Mỗi interface dưới đây ứng với một adapter khoảng 10-30 dòng.

1. `DuplicateLeadRepository.findPotentialDuplicates(query)`: truy vấn Prisma đã thu hẹp,
   luật thuần túy sẽ lọc lại.

   ```ts
   const or = query.companyKey
     ? [{ companyKey: query.companyKey }]
     : [
         ...(query.normalizedPhone ? [{ normalizedPhone: query.normalizedPhone }] : []),
         ...(query.emailKey ? [{ emailKey: query.emailKey }] : []),
       ];
   if (or.length === 0) return [];
   return prisma.lead.findMany({
     where: {
       deletedAt: null, isSpam: false, OR: or,
       ...(query.excludeLeadId ? { id: { not: query.excludeLeadId } } : {}),
     },
   });
   ```

2. `AssigneeAvailability`: trả về những user `isActive = false`, `deletedAt != null`
   hoặc `acceptsLeads = false` trong danh sách `userIds`.
3. `DuplicateNotifier`: tạo một dòng `Notification` (bảng đã có trong core) cho người nhận,
   `actionUrl` trỏ tới Lead cũ (`oldLeadId`).
4. `LeadHistoryWriter`: ghi vào `LeadHistory` với `action = "ATTACHMENT_ADDED"`,
   `fieldName = "attachment"`, `newValue = detail`.
5. `AttachmentStorage`: lưu vào thư mục NGOÀI thư mục public (hoặc kho đối tượng), dùng
   `storageKey` làm đường dẫn tương đối. Không phục vụ tệp bằng đường dẫn tĩnh.
6. `AttachmentRepository`, `LeadLookup`, `LeadProgressRepository`: truy vấn Prisma thường.
   `LeadProgressRepository` PHẢI áp `visibility` vào `where` (xem `lead.permissions.ts`):
   `ALL` không lọc, `ASSIGNED_TO` lọc `assignedToId`, `DESIGN_REQUEST` lọc `hasDesignRequest = true`;
   luôn thêm `isSpam = false` và `deletedAt = null`.

Luồng tạo Lead (Task 1 gọi sang Task 2):

```ts
const prepared = prepareCreateLead(input);                       // Task 1
const dup = await duplicateService.checkNewLead({                // Task 2
  lead: { phone: prepared.phone, email, companyName: prepared.companyName, projectName: prepared.projectName },
  isAutoLead, creatorId,
});
// Lưu Lead với dup.keys (companyKey, projectKey, emailKey), duplicateFlag = dup.result.flag,
// oldLeadId = dup.result.oldLeadId; người phụ trách = dup.result.assignment.userId nếu
// mode = OLD_OWNER, ngược lại theo quy tắc phân công thường (1.4b).
await duplicateService.publishNotifications(savedLead.id, dup.plannedNotifications);
```

Khi sửa Lead (4.2) gọi `recheckAfterEdit` thay cho `checkNewLead`; hàm này không tự chuyển người phụ trách.

## 4. Khi viết route/API (bắt buộc, vì dữ liệu là dữ liệu thật)

- Lấy `Actor` từ phiên đăng nhập ở máy chủ (`id`, `roleCode`, `isActive`). Không tin `role` do giao diện gửi lên.
- Ánh xạ `LeadAccessError.code` sang HTTP: UNAUTHENTICATED 401, FORBIDDEN 403, NOT_FOUND 404.
- Tải về tệp phải trả `Content-Disposition: attachment` và `X-Content-Type-Options: nosniff`.
- Đặt giới hạn kích thước body ở tầng route trùng với `DEFAULT_ATTACHMENT_LIMITS` (25 MB/tệp,
  200 tệp, 200 MB mỗi lần) để chặn trước khi đọc hết dữ liệu vào bộ nhớ.
- Đọc `SIGNATURE_BYTES` (16) byte đầu của tệp để điền `header`; không dùng MIME trình duyệt gửi làm căn cứ duy nhất.
- Route cập nhật tiến độ, chuyển giao, tạo Lead: gọi `assertCan` / `assertLeadAccess` trước khi làm gì khác.

## 5. Giả định cần BA xác nhận

1. Lead mới có Tên dự án nhưng Lead cũ không có Tên dự án: coi là KHÔNG trùng (đặc tả chỉ nói Lead không có dự án thì khớp theo công ty).
2. Đã có Tên công ty nhưng trùng SĐT với Lead cũ khác công ty: hiện KHÔNG gắn cờ (đặc tả chỉ đối chiếu SĐT/email khi chưa có Tên công ty). Yêu cầu ở buổi họp là tìm trùng theo SĐT, nên cần hỏi có muốn cảnh báo thêm không.
3. Đối chiếu SĐT/email khi chưa có Tên công ty: hiện áp dụng cho cả Lead thủ công (đặc tả chỉ nêu Lead tự động).
4. Nhiều Lead cũ: gắn cờ đỏ nếu có BẤT KỲ Lead cũ nào còn "Vừa nhận thông tin"; Lead dùng để phân công vẫn là Lead đang mở gần nhất theo 1.4a.
5. Giới hạn tệp (25 MB, 200 tệp) và danh sách loại tệp (ảnh, PDF, Word, Excel, DWG, DXF; không nhận zip, SVG, tệp thực thi): cần xác nhận công ty có dùng thêm loại nào không.
6. Mã vai trò thật trong bảng `roles`: repo giao diện đang dùng `DESIGN`, `ADMIN`, `DIRECTOR`, `SALES`, `MARKETING`, `ADS`; chưa thấy mã cho Trưởng phòng MKT và Trưởng phòng Sales. Nếu mã khác, sửa `ROLE_CODE` hoặc thêm vào `ROLE_CODE_ALIASES`. Vai trò lạ bị từ chối (an toàn).
7. Marketing/Ads xem đủ thông tin Lead theo 3.2 (có SĐT khách). Nếu công ty muốn che SĐT với hai vai trò này thì cần BA chốt.

## 6. Chưa làm trong Task 2

- Route/API và giao diện (chưa có cấu trúc route của repo chính trong bản Task 1).
- Adapter Prisma, migration, kho lưu trữ thực.
- Xóa tệp đính kèm (đặc tả chưa nêu).
- Phân công tự động 1.4b và hàng chờ (ngoài phạm vi Task 2; Task 2 chỉ trả `assignment.mode = NORMAL`).
- Đánh dấu Spam (4.4), cảnh báo dò giá (4.5): Task 2 chỉ dùng cờ `isSpam` để loại khỏi xét trùng.
