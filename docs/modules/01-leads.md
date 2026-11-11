# 01-leads — Quản lý Lead và Pipeline kinh doanh

**Nhóm 1 — Phụ trách: Lâm Thành Nam.**  
Nhánh Git: `feature/lead-management`.  
Nguồn đặc tả chuẩn:
1. **Tài liệu đặc tả BA (UC01, UC02, Sơ đồ tuần tự, Sơ đồ hoạt động, Sơ đồ BPMN)** ngày 05/11/2026.
2. **Brief Mini CRM — Yêu cầu giao diện & dữ liệu thực tế từ Công ty Toàn Trung** ngày 06/11/2026.

---

## 1. Vùng phát triển của Nhóm 1

| Lớp | Đường dẫn mã nguồn |
| :--- | :--- |
| **Giao diện (Frontend)** | `apps/web/src/modules/01-leads/` |
| **Trang hiển thị (Page Route)** | `apps/web/src/app/(workspace)/leads/page.tsx` |
| **Xử lý Backend** | `apps/api/src/modules/01-leads/` |
| **Endpoint API** | `apps/api/src/app/api/v1/leads/route.ts` |
| **Hợp đồng dữ liệu (Contracts/DTO)** | `packages/contracts/src/01-leads/` |
| **Prisma Model** | `packages/database/prisma/models/01-leads.prisma` |
| **Kiểm thử E2E & Mock Fixture** | `tests/e2e/01-leads/` và `tests/fixtures/01-leads/` |
| **Task nhóm** | `docs/tasks/m01/` |

---

## 2. Danh mục sản phẩm & Địa bàn thực tế của Toàn Trung

### 2.1. Danh mục Sản phẩm quan tâm (Chuẩn hóa 3 nhóm)
Theo yêu cầu trực tiếp từ Brief Mini CRM của công ty, trường **Sản phẩm quan tâm** phân cấp thành:

1. **Màn hình LED**:
   - `Màn hình LED Indoor` (trong nhà)
   - `Màn hình LED Outdoor` (ngoài trời)
   - `Màn hình LED Cong`
   - `Màn hình LED lưới`
   - `Màn hình GOB`
   - `Màn hình COB`
   - `Màn hình LCD`
   - `Khác`: Có ô nhập text thông tin cụ thể
2. **Bảng Điện Tử**:
   - `Bảng Năng suất`
   - `Bảng thi đấu thể thao`
   - `Bảng Marathon`
   - `Bảng Shotlock`
   - `Bảng An toàn lao động`
   - `Bảng LED xe buýt sân bay`
   - `Bảng LED Modbus`
   - `Bảng LED xe buýt`
   - `Đồng hồ LED`
   - `Bảng hiển thị nhiệt độ độ ẩm`
   - `Bảng LED giá vàng`
   - `Bảng LED thu phí giữ xe`
3. **Nhu cầu Khác (Có ô nhập text dài)**:
   - `Hỏi sửa chữa`
   - `Không cung cấp thông tin`
   - `Hỏi sản phẩm đặc biệt`
   - `Hỏi thuê`
   - `Không đúng nhu cầu`

### 2.2. Địa chỉ lắp đặt
- **Khu vực TP. Hồ Chí Minh**: Danh sách dropdown các quận/huyện và TP. Thủ Đức (sau sáp nhập).
- **Các tỉnh khác**: Dropdown danh mục 62 tỉnh thành trên toàn quốc.
- **Hình ảnh hiện trạng công trình (Nếu có)**: Upload ảnh hiện trường thực tế để **kiểm tra trùng địa chỉ lắp đặt** và phục vụ Designer dựng phối cảnh 3D.

---

## 3. Cấu trúc trường thông tin một Lead (Data Fields)

Mỗi Lead trong hệ thống bao gồm đầy đủ các trường thông tin chuẩn hóa:
- **STT & Mã Lead**: Tự động sinh (`TT-YYYYMMDD-XXXX`).
- **Thời gian tiếp nhận**: Ngày và Giờ cụ thể (`DD/MM/YYYY HH:mm:ss`).
- **Tên công ty / Khách hàng**: Tên doanh nghiệp hoặc chủ dự án.
- **Kênh liên hệ**: `Hotline`, `Điền form`, `Email`, `Zalo`.
- **Số điện thoại liên hệ / Email**: Bắt buộc ít nhất SĐT.
- **Địa chỉ lắp đặt**: Khu vực HCM (chọn quận) hoặc Tỉnh thành khác, kèm địa chỉ số nhà/công trình cụ thể.
- **Sản phẩm quan tâm**: Chọn từ danh mục chuẩn (Màn hình LED, Bảng điện tử, Khác).
- **Hình hiện trạng**: Tệp ảnh đính kèm (dùng check trùng địa chỉ và phục vụ thiết kế).
- **Trạng thái / Tiến độ**: 5 bước Pipeline.
- **Ghi chú**: Nội dung trao đổi chi tiết.

---

## 4. Đặc tả chi tiết Use Case 01: Quản lý Lead (UC01)

### 4.1. Luồng tiếp nhận Lead tự động (Form website, Google Ads lead form)
1. Webhook từ website/Google Ads gửi dữ liệu về hệ thống.
2. Gọi UC03 bóc tách khối tracking: `utm_source`, `utm_campaign`, `landing_page_url`, `gclid`, thiết bị, IP.
3. Chuẩn hóa số điện thoại: Bỏ dấu, dấu chấm, khoảng trắng, chuyển đầu `+84` về `0`. Lỗi gắn cờ `SĐT chưa chuẩn hóa` (E2).
4. Kiểm tra trùng thông tin (E0) và đối chiếu danh sách cảnh báo dò giá:
   - Trùng Tên công ty / Tên dự án hoặc SĐT/Email $\rightarrow$ Gắn cờ cảnh báo (xem mục 4.3).
   - Khớp SĐT hoặc Tên công ty trong danh sách dò giá $\rightarrow$ Gắn nhãn **"Nghi dò giá"** và thông báo NVKD.
5. Lưu Lead ở trạng thái `Vừa nhận thông tin` và phân công tự động:
   - Khách cũ đang chăm sóc hoặc đã chốt $\rightarrow$ Phân cho NVKD cũ phụ trách.
   - Khách mới $\rightarrow$ Phân cho NVKD đang trực tuyến có ít Lead chưa xử lý nhất (hoặc luân phiên).
   - Ngoài giờ làm việc: Phân công ngay, hạn SLA tính từ đầu giờ làm việc kế tiếp.
   - Chưa có NVKD online $\rightarrow$ Trạng thái `Chưa phân công`, hiển thị cho Quản lý.

### 4.2. Luồng tạo Lead thủ công (Hotline, Zalo)
1. NVKD mở Form Tạo mới: Chọn Nguồn (`Hotline`, `Zalo`), nhập SĐT (bắt buộc). NVKD có thể nhập ngay hoặc bổ sung sau: Tên công ty, Tên dự án, Địa chỉ lắp đặt, Sản phẩm quan tâm, Hình hiện trạng.
2. Mốc tiếp nhận tính từ "Thời điểm khách liên hệ" (mặc định là lúc tạo, NVKD được điều chỉnh theo tin nhắn/cuộc gọi).
3. Người nhập mặc định là người phụ trách Lead, không gắn chiến dịch quảng cáo.

### 4.3. Quy tắc kiểm tra Trùng & Tô đỏ cảnh báo (E0)
- **Tô đỏ cảnh báo**: Khi trùng **Tên và SĐT** hoặc trùng **Tên công ty / Tên dự án** mà Lead cũ đang ở trạng thái `Vừa nhận thông tin` $\rightarrow$ Gắn cờ **"Trùng" và tô đỏ nổi bật** trên giao diện danh sách Lead.
- Nếu Lead cũ đang ở `Đang soạn báo giá`, `Đã gửi báo giá`, `Chốt thành công` hoặc `Thất bại` $\rightarrow$ Gắn cờ **"Đã có Lead cũ"** (không tô đỏ), hiển thị thông tin Lead cũ kèm kết quả/lý do để NVKD nắm lịch sử.
- **Tuyệt đối KHÔNG tự gộp Lead** để bảo toàn lịch sử tương tác.

### 4.4. Thao tác cập nhật sau tiếp nhận
1. **Xác nhận tiếp nhận**: NVKD bấm xác nhận $\rightarrow$ Hệ thống ghi nhận thời điểm tiếp nhận và người tiếp nhận, trạng thái giữ nguyên `Vừa nhận thông tin`.
2. **Sửa thông tin Lead**: Cập nhật thông tin công ty, địa chỉ, sản phẩm $\rightarrow$ Hệ thống kiểm tra trùng lại và đối chiếu lại cảnh báo dò giá.
3. **Đính kèm tài liệu & ảnh hiện trạng**: Upload tệp/thư mục bản vẽ kỹ thuật, ảnh hiện trường lắp đặt.
4. **Đánh dấu Spam**: Bắt buộc chọn lý do. Gắn cờ `Spam` (không đổi trạng thái Pipeline), loại khỏi danh sách làm việc của NVKD.
   - Tự động loại khỏi Báo cáo Ads nếu lý do là `SĐT không tồn tại`, `Nhầm máy`, `Sai số`.
   - Vào danh sách chờ duyệt nếu lý do là `Đối thủ khảo giá`.

### 4.5. Cơ chế Cảnh báo Dò giá (Competitor Price Check)
1. Khi phát hiện khách là đối thủ hoặc bên thứ ba chỉ dò giá: NVKD chọn "Đăng cảnh báo dò giá", nhập căn cứ xác định (bắt buộc) + ảnh chụp màn hình Zalo/cuộc trò chuyện (tùy chọn) $\rightarrow$ Lưu cảnh báo ở trạng thái `Đang hiển thị`.
2. Hệ thống gửi thông báo ngay cho toàn bộ NVKD, Marketing và Ads.
3. Khi phát sinh Lead mới trùng SĐT hoặc Tên công ty $\rightarrow$ Tự động gắn nhãn **"Nghi dò giá"** để NVKD cảnh giác.

---

## 5. Đặc tả chi tiết Use Case 02: Quản lý Pipeline kinh doanh (UC02)

### 5.1. Năm trạng thái tiến độ Pipeline
$$\text{Vừa nhận thông tin} \longrightarrow \text{Đang soạn báo giá} \longrightarrow \text{Đã gửi báo giá} \longrightarrow \text{Chốt thành công} \ / \ \text{Thất bại}$$

- **Vừa nhận thông tin**: Trạng thái ban đầu.
- **Đang soạn báo giá**: NVKD đang bóc tách khối lượng, làm phương án kỹ thuật màn hình LED.
- **Đã gửi báo giá**: Đã gửi báo giá cho khách (nhập giá trị báo giá tùy chọn).
  + Có danh sách theo dõi riêng các khách **đã gửi báo giá nhưng chưa phản hồi** để bám sát.
  + Được phép lùi trạng thái về `Đang soạn báo giá` khi khách yêu cầu chỉnh sửa lại phương án/kích thước.
- **Chốt thành công**: Đã ký hợp đồng / chốt đơn (nhập giá trị chốt tùy chọn).
- **Thất bại**: Bắt buộc nhập lý do từ danh mục (`Giá chưa tốt`, `Khách còn xem xét lại option`, `Đổi kế hoạch`...).
- **Mở lại Lead đã đóng**: Trong thời hạn cấu hình, NVKD được mở lại Lead kèm lý do bắt buộc; quá hạn thì khóa vĩnh viễn, khách quay lại sẽ tạo Lead mới.

### 5.2. Mục Chuyển kinh doanh khác (Reassign Form)
Theo brief giao diện thực tế:
- Ô này **không bắt buộc tick**.
- NVKD vẫn phải nhập đầy đủ thông tin khách hàng.
- Khi tick chọn **"Chuyển kinh doanh khác"**:
  + Hệ thống hiển thị danh sách (Sort) tên các Nhân viên kinh doanh đủ điều kiện nhận.
  + Hiển thị ô bắt buộc: **"Lý do chuyển"** (`Bận`, `Không đúng thế mạnh`, `Lý do khác`).
  + Nếu lý do là **"Bận"**: Hệ thống lọc ra các NVKD đang trực tuyến và có số Lead đang xử lý ít hơn hẳn người chuyển.
  + Kiểm tra concurrency ngay lúc bấm xác nhận để đảm bảo người nhận vẫn đủ điều kiện tải việc.

---

## 6. Theo dõi & Tự động nhắc nhở (SLA)
1. **Nhắc chưa nhận**: Nhắc NVKD khi chưa bấm xác nhận tiếp nhận sau thời gian quy định (tính theo giờ làm việc).
2. **Nhắc đứng yên**: Nhắc NVKD khi Lead ở một trạng thái quá lâu mà không có hoạt động mới.
3. **Tự động chuyển Lead**: Quá hạn tiếp nhận tự động chuyển cho NVKD khác (tối đa $N$ lần; quá $N$ lần gắn cờ "Cần xử lý" đưa lên màn hình Quản lý).
