# 02-tracking-sync — Tracking nguồn và đồng bộ dữ liệu đa kênh

**Nhóm 2 — Phụ trách: Cát Cần Sỹ.**  
Nhánh Git: `feature/tracking-integration`.  
Nguồn đặc tả chuẩn: **Tài liệu đặc tả BA (UC03: Tracking nguồn và đồng bộ dữ liệu)** ngày 05/11/2026.

---

## 1. Vùng phát triển của Nhóm 2

| Lớp | Đường dẫn mã nguồn |
| :--- | :--- |
| **Giao diện (Frontend)** | `apps/web/src/modules/02-tracking-sync/` |
| **Trang hiển thị (Page Route)** | `apps/web/src/app/(workspace)/tracking/page.tsx` |
| **Xử lý Backend** | `apps/api/src/modules/02-tracking-sync/` |
| **Endpoint API** | `apps/api/src/app/api/v1/tracking/route.ts` |
| **Hợp đồng dữ liệu (Contracts/DTO)** | `packages/contracts/src/02-tracking-sync/` |
| **Prisma Model** | `packages/database/prisma/models/02-tracking-sync.prisma` |
| **Kiểm thử E2E & Mock Fixture** | `tests/e2e/02-tracking-sync/` và `tests/fixtures/02-tracking-sync/` |
| **Task nhóm** | `docs/tasks/m02/` |

---

## 2. Mô tả tổng quan Use Case 03 (UC03)

- **Mục tiêu**:
  1. Xác định Lead đến từ đâu và ghi vào Lead cho UC01.
  2. Tự động đồng bộ số liệu nền tảng định kỳ (Google Ads, GA4, Search Console, Fanpage, Google Trends).
  3. Đối soát Lead với Google Ads để không bao giờ bị mất Lead.
  4. Cung cấp Dashboard cho Marketing/Ads theo dõi hiệu quả theo Nguồn và Chiến dịch (chỉ xem, không sửa Lead).
- **Ba trường nguồn độc lập của mỗi Lead**:
  1. `Kênh tiếp nhận`: Form website, Google lead form, Hotline, Zalo. (Hệ thống tự ghi với Lead tự động; NVKD chọn với Lead thủ công).
  2. `Nguồn marketing`: Google Ads, Tìm kiếm tự nhiên, Mạng xã hội, Website giới thiệu, Truy cập trực tiếp, Khác, Chưa xác định, Nhập tay. (Hệ thống tự động ghi).
  3. `Nguồn khách tự khai`: NVKD hỏi khách và nhập ở UC01 (không bắt buộc), dùng để đối chiếu với tracking, **không thay thế Nguồn marketing**.
- **Nguyên tắc bất biến**: Chiến dịch do hệ thống ghi nhận, không ai được sửa tay (kể cả Marketing, Ads). Lead thủ công không thuộc chiến dịch nào.

---

## 3. Bốn luồng xử lý chính

### Luồng A: Xác định nguồn của Lead

#### A1. Gắn nguồn khi có Lead mới (UC01 gọi UC03)
1. **Lead nhập tay (Hotline, Zalo)**: Kênh do NVKD chọn; Nguồn marketing là `Nhập tay`; không có Chiến dịch.
2. **Lead từ Google lead form**: Nguồn marketing là `Google Ads`; Chiến dịch lấy theo mã chiến dịch Google gửi kèm (không phụ thuộc UTM hay gclid).
3. **Lead từ form website**:
   - Nếu không có tracking $\rightarrow$ Nguồn marketing là `Chưa xác định` và gắn cờ `Chưa xác định nguồn`.
   - Nếu có khối tracking, thử lần lượt theo thứ tự ưu tiên:
     + **Có gclid**: Nguồn là `Google Ads`. Truy vấn Google Ads lấy tên chiến dịch. Nếu chưa có kết quả ngay: tạm gắn theo UTM (`UTM tạm`) hoặc để trống và gắn cờ `Chưa rõ chiến dịch` (sẽ tra lại ở A2).
     + **Không có gclid, UTM khớp danh mục**: Gắn Nguồn theo bảng ánh xạ BR1 và gắn Chiến dịch theo UTM.
     + **Có UTM nhưng không khớp danh mục**: Lưu UTM gốc để truy vết; Nguồn marketing theo `utm_source` nếu nhận ra, nếu không là `Khác`; Chiến dịch để trống; Lead vào danh sách `UTM chưa khớp` (A3).
     + **Không có gclid và UTM**: Xét `referrer`: Công cụ tìm kiếm $\rightarrow$ `Tìm kiếm tự nhiên`; Mạng xã hội $\rightarrow$ `Mạng xã hội`; Website khác $\rightarrow$ `Website giới thiệu`; Referrer rỗng $\rightarrow$ `Truy cập trực tiếp`.
4. Ghi lại phương thức xác định nguồn: `form Google`, `gclid`, `UTM tạm`, `UTM`, `referrer` hoặc `không xác định`.
5. **Lead lặp (BR2)**: Nếu khách đã có Lead trước đó (UC01 nhận diện), mỗi Lead giữ tracking riêng của lần liên hệ đó, tính cho Nguồn và Chiến dịch của chính nó và đánh dấu `Lead lặp` để dashboard tách riêng (không ghi đè nguồn của Lead cũ).

#### A2. Tra lại gclid (Chạy tự động mỗi giờ)
- Google có độ trễ khi trả thông tin click qua API.
- Mỗi giờ, hệ thống quét các Lead có `gclid` đang thiếu chiến dịch hoặc đang ở `UTM tạm`, tạo chưa quá 7 ngày $\rightarrow$ Truy vấn Google Ads.
- Có kết quả: Gắn/ghi đè Chiến dịch theo `gclid`, bỏ cờ `Chưa rõ chiến dịch`. Nếu khác `UTM tạm` thì gắn cờ **"UTM lệch gclid"** để Marketing rà soát (BR4).
- Quá 7 ngày không có kết quả: Dừng thử, giữ nguyên cờ `Chưa rõ chiến dịch`.

#### A3. Danh mục chiến dịch & Xử lý UTM chưa khớp
- Chiến dịch Google Ads được tự động đồng bộ vào danh mục ở mỗi lần chạy luồng B; chiến dịch ngoài Google do Marketing khai báo.
- Khi chiến dịch mới xuất hiện trong danh mục $\rightarrow$ Hệ thống tự động quét và gắn lại cho các Lead đang ở trạng thái "Chiến dịch chưa khai báo" và các Lead có UTM gốc nay đã khớp.

---

### Luồng B: Đồng bộ số liệu nền tảng định kỳ

- **Lịch chạy (giờ Việt Nam)**:
  + **02:00 (Lần đầy đủ)**: Đồng bộ mọi nền tảng. Cửa sổ lấy lại là 7 ngày gần nhất, riêng Google Ads là 30 ngày.
  + **11:00 và 17:00 (Lần nhẹ)**: Chỉ chạy Google Ads, lấy lại số liệu hôm nay và hôm qua.
- **Nội dung thu thập**:
  + **Google Ads**: Danh sách chiến dịch, chi phí, ngân sách theo dõi ngày, CPC, hiển thị, lượt click, từ khóa, lượt chuyển đổi, số lượt gửi lead form. (Lưu riêng theo chiến dịch và theo từ khóa).
  + **GA4**: Lượt truy cập, thời gian truy cập theo trang.
  + **Search Console**: Từ khóa, lượt click, vị trí hiển thị.
  + **Fanpage**: Tương tác.
  + **Google Trends**: Xu hướng tìm kiếm (tham khảo).
- Mỗi nền tảng chạy độc lập; một bên lỗi không làm gián đoạn bên khác. Sau khi xong Google Ads, tự động kích hoạt A2 (tra lại gclid) và Luồng D (đối soát).
- Số liệu hôm nay luôn coi là chưa chốt (ghi đè ở mỗi lần chạy).

---

### Luồng C: Dashboard Marketing & Ads

- **Mặc định hiển thị 30 ngày gần nhất**:
  + Thống kê Lead theo Kênh, Nguồn, Chiến dịch, Landing page, Thiết bị: tách 2 cột **Lead thô (L1)** và **Lead hiệu quả (L3)**, kèm cột *"trong đó Lead lặp"*.
  + Phễu chuyển đổi: Lead hiệu quả $\rightarrow$ Đã báo giá $\rightarrow$ Chốt; tỷ lệ báo giá và tỷ lệ chốt.
  + Chi phí, CPC, ngân sách của từng chiến dịch; chi phí/Lead hiệu quả, chi phí/báo giá, chi phí/đơn chốt; **ROAS nội bộ** = Giá trị chốt (NVKD nhập) / Chi phí.
  + Số liệu chi tiết theo chiến dịch và từ khóa: clicks, chuyển đổi, tỷ lệ chuyển đổi, chi phí/chuyển đổi.
  + Biến động so với kỳ trước (cùng độ dài): chuyển đổi, tỷ lệ chuyển đổi, CPC.
  + Chất lượng tracking: tỷ lệ Lead chưa rõ nguồn/chiến dịch, số Lead "UTM lệch gclid", bảng đối chiếu Nguồn marketing với Nguồn khách tự khai.
  + Cảnh báo đối soát (Luồng D), cảnh báo đồng bộ (E2), hiển thị mốc "Cập nhật lúc...".
- **Quy tắc hiển thị**:
  + Bảng Lead có dòng riêng cho "Chưa xác định", "Nhập tay" và "Chiến dịch chưa khai báo" để tổng cộng luôn khớp 100%.
  + Mẫu số bằng 0 hiển thị "—" (không hiển thị 0 hoặc 0%). Lead nhập tay không có chi phí: ô để trống.
  + Kỳ lọc có số click nhỏ (<30 Lead hoặc <100 click): ghi chú *"mẫu nhỏ, chỉ tham khảo"*.

---

### Luồng D: Đối soát Lead (Reconciliation)

1. Sau mỗi lần đồng bộ Google Ads, hệ thống so khớp theo từng ngày:  
   $$\text{Số Lead Google form trong CRM (cộng cả bản ghi lỗi E1)} \quad \longleftrightarrow \quad \text{Số lượt gửi form do Google báo}$$
2. **Cảnh báo chênh lệch**: Nếu chênh lệch $\ge 2$ Lead $\rightarrow$ Hiện cảnh báo nổi bật trên Dashboard và gửi thông báo cho Marketing + Quản lý.
3. Marketing đối chiếu danh sách tải từ Google Ads để đề nghị Quản trị viên nhập bổ sung hoặc gửi lại webhook.
4. Cảnh báo tự đóng khi chênh lệch hạ dưới ngưỡng, hoặc Marketing xác nhận "Đã xử lý" kèm ghi chú.

---

## 4. Các quy tắc nghiệp vụ bất biến (Business Rules)

* **BR1 (Ánh xạ UTM & Nguồn)**:
  - Google Ads: `google` + `cpc`, `gclid`, hoặc `Google lead form`.
  - Mạng xã hội: `facebook`, `zalo`, `youtube`, `tiktok` (từ UTM hoặc referrer).
  - Tìm kiếm tự nhiên: Referrer từ Google, Bing, Cốc Cốc...
  - Website giới thiệu: Referrer từ domain khác ngoài MXH/tìm kiếm.
  - Truy cập trực tiếp: Đủ tracking nhưng không có UTM, gclid, referrer.
* **BR2 (Lead lặp)**: Mỗi Lead giữ tracking độc lập của lần điền form đó; không ghi đè nguồn của Lead cũ.
* **BR3 (Chiến dịch chưa khai báo)**: Vẫn lưu Lead, gắn nhãn tạm kèm mã gốc; tự map lại khi chiến dịch được tạo.
* **BR4 (Ưu tiên tín hiệu)**: $\text{gclid} > \text{UTM} > \text{Referrer}$. Khác nhau thì lấy theo `gclid` và gắn cờ `UTM lệch gclid`.
* **BR5 (Quy tắc sửa Nguồn/Chiến dịch — đang chờ chốt Q02)**: Tài liệu UC03 BR5 ghi cấm sửa tay Nguồn/Chiến dịch của Lead (chỉ cập nhật qua tra lại gclid hoặc map danh mục tự động), trong khi UC01 / `PERMISSIONS.md` có nêu ngoại lệ cho phép Nhân viên Ads chỉnh sửa Nguồn/Chiến dịch theo `UC03-4`. Điểm khác biệt này được giữ mở tại [Q02](../decisions/OPEN_QUESTIONS.md#q02) để BA chốt chính thức trước khi mở thao tác sửa tay trên UI/API.
* **BR6 (Nguồn sự thật & 3 cấp đếm Lead)**:
  - **L1 (Lead thô)**: Mọi Lead được tạo, kể cả Spam.
  - **L2 (Lead hợp lệ)**: L1 trừ Lead có cờ Spam (kể cả chờ xác nhận). Dùng cho Pipeline của UC01.
  - **L3 (Lead hiệu quả)**: L1 trừ Spam tự động và Spam đã được Marketing xác nhận (chờ xác nhận vẫn tính). Dùng tính chi phí/Lead và đánh giá chiến dịch.
  - **Nguồn số liệu**: Số Lead/chốt/giá trị lấy từ CRM; Chi phí/click/CPC/chuyển đổi lấy từ Google Ads; Truy cập/thời gian lấy từ GA4; Từ khóa SEO lấy từ Search Console; Xu hướng lấy từ Google Trends.
