# 05-ai-design — Hỗ trợ thiết kế & phối cảnh AI (Giai đoạn 2)

**Nhóm 5 — Phụ trách: Lý Tăng Hữu.**  
Nhánh Git: `feature/ai-design`.  
Nguồn đặc tả chuẩn: **Tài liệu đặc tả BA (UC06: Hỗ trợ thiết kế & phối cảnh AI)** ngày 05/11/2026.

---

## 1. Vùng phát triển của Nhóm 5

| Lớp | Đường dẫn mã nguồn |
| :--- | :--- |
| **Giao diện (Frontend)** | `apps/web/src/modules/05-ai-design/` |
| **Trang hiển thị (Page Route)** | `apps/web/src/app/(workspace)/design/page.tsx` |
| **Xử lý Backend** | `apps/api/src/modules/05-ai-design/` |
| **Endpoint API** | `apps/api/src/app/api/v1/design/route.ts` |
| **Hợp đồng dữ liệu (Contracts/DTO)** | `packages/contracts/src/05-ai-design/` |
| **Prisma Model** | `packages/database/prisma/models/05-ai-design.prisma` |
| **Kiểm thử E2E & Mock Fixture** | `tests/e2e/05-ai-design/` và `tests/fixtures/05-ai-design/` |
| **Task nhóm** | `docs/tasks/m05/` |

---

## 2. Mô tả tổng quan Use Case 06 (UC06)

- **Mục tiêu**:
  1. Cho phép **Designer** sử dụng AI tạo bản nháp ban đầu:
     - **Dựng nháp phối cảnh 3D** màn hình LED trực tiếp lên ảnh hiện trạng thực tế công trình của khách hàng.
     - **Tạo hình ảnh & Banner** đúng kích thước, độ phân giải và tỷ lệ khung màn hình LED.
  2. Quản lý **Thư viện ấn phẩm**: Lưu trữ các phiên bản nháp do AI sinh ra và các bản thiết kế hoàn thiện sau khi Designer chỉnh sửa.
  3. Cho phép tải file thiết kế độ phân giải cao để bàn giao cho bộ phận Kinh doanh gửi khách hàng.
  4. Đo lường và kiểm soát: Ghi nhận thời gian xử lý và chi phí token AI tiêu thụ cho từng yêu cầu.
- **Nguyên tắc bất biến**: Kết quả do AI tạo ra là **bản nháp ban đầu** để Designer chỉnh sửa hoàn thiện, giúp rút ngắn thời gian dựng bản đầu. AI không thay thế con người; mọi bản vẽ gửi khách hàng đều do Designer phê duyệt và hoàn thiện.
- **Tác nhân**:
  + **Tác nhân chính**: Designer.
  + **Tác nhân phụ**: Hệ thống AI (Generative AI Image Service), Hệ thống CRM.

---

## 3. Dòng sự kiện chính (Main Flow)

### 3.1. Dựng nháp phối cảnh 3D màn hình LED bằng AI
1. Designer truy cập phân hệ **"Hỗ trợ thiết kế & phối cảnh AI"**.
2. Chọn chức năng **"Dựng nháp phối cảnh 3D bằng AI"**.
3. **Nạp dữ liệu đầu vào**:
   - Chọn ảnh hiện trạng công trình thực tế (tải lên từ máy hoặc chọn ảnh hiện trường đính kèm từ Lead của UC01).
   - Chọn kiểu dáng, chủng loại màn hình LED (màn hình LED cong, phẳng, trong nhà, ngoài trời, module P2, P3, P4...).
   - Cấu hình kích thước (chiều dài, chiều cao) và khoanh vùng vị trí lắp đặt màn hình trên ảnh hiện trạng.
   - Nhập **Prompt** mô tả yêu cầu bối cảnh, ánh sáng, góc nhìn.
4. Hệ thống kiểm tra hợp lệ dữ liệu và gửi yêu cầu sang Hệ thống AI.
5. Hệ thống AI xử lý phối ghép, render màn hình LED 3D chân thực vào đúng vị trí trên ảnh công trình và trả kết quả về.
6. Hệ thống hiển thị bản nháp cho Designer xem trước, tự động lưu vào **Thư viện ấn phẩm** và ghi nhận thời gian xử lý + lượng token AI tiêu thụ.
7. Designer đánh giá bản nháp:
   - Nếu đạt $\rightarrow$ Tải về máy hoặc phê duyệt bản thiết kế.
   - Nếu chưa đạt $\rightarrow$ Chỉnh sửa Prompt / tham số để AI dựng lại, hoặc tải ảnh nháp về để tự xử lý thủ công bằng Photoshop/Illustrator.

---

### 3.2. Tạo hình ảnh & Banner bằng AI (Luồng phụ 2a)
1. Designer chọn **"Tạo hình ảnh & Banner bằng AI"**.
2. Thiết lập kích thước (pixel), tỷ lệ khung hình màn hình LED cần hiển thị (ví dụ 16:9, banner dọc, màn hình siêu dài P10).
3. Nhập Prompt mô tả nội dung banner, thông điệp truyền thông, màu sắc chủ đạo.
4. Hệ thống AI sinh hình ảnh banner độ nét cao đúng tỷ lệ khung hình.
5. Hệ thống hiển thị bản xem trước, lưu vào Thư viện ấn phẩm và ghi nhận chi phí token AI.

---

### 3.3. Quản lý Thư viện ấn phẩm, Phiên bản & Bàn giao (Luồng phụ 10a, 11a)
1. Designer truy cập **Thư viện ấn phẩm** để quản lý các mẫu thiết kế theo từng dự án/Lead hoặc ấn phẩm Banner độc lập:
   - **Liên kết Lead theo luồng**: Luồng tạo **Hình ảnh & Banner (3.2 / 2a)** cho phép tạo độc lập theo kích thước pixel/tỷ lệ khung hình màn hình LED mà không bắt buộc gắn Lead (`lead_id` tùy chọn). Đối với luồng **Dựng nháp phối cảnh 3D (3.1)** và điểm khởi tạo ticket giữa Sales/Designer, yêu cầu bắt buộc gắn Lead được theo dõi riêng tại [Q14](../decisions/OPEN_QUESTIONS.md#q14).
2. Mỗi lần AI sinh bản nháp hoặc Designer tải bản chỉnh sửa hoàn thiện từ bên ngoài (Photoshop/Corel/3DsMax) lên hệ thống được lưu thành một phiên bản riêng trong bảng `design_asset_versions` (`version_number` tăng dần duy nhất theo từng `design_request_id`, liên kết 1-1 với lượt gọi `ai_usage_logs` nếu do AI tạo), đồng thời cập nhật `approved_version_id` và các cột tương thích ERD (`ai_draft_image_url`, `final_render_url`) trên `design_requests`.
3. Xuất file gốc chất lượng cao (JPG/PNG) qua endpoint kiểm tra quyền `AI_DESIGN` / `ATTACHMENT_UPLOAD_VIEW` (không phơi bày URL storage công khai) để bàn giao cho NVKD đính kèm vào báo giá gửi khách hàng.

---

## 4. Xử lý ngoại lệ & Giới hạn kỹ thuật

- **3a. Ảnh hiện trạng không hợp lệ**: File tải lên không đúng định dạng (chỉ nhận PNG, JPG, WebP) hoặc dung lượng vượt quá giới hạn $\rightarrow$ Thông báo yêu cầu tải lại ảnh rõ nét.
- **6a. Prompt thiếu thông tin**: Prompt để trống hoặc thiếu kích thước màn hình $\rightarrow$ Yêu cầu nhập đầy đủ trước khi kích hoạt gọi AI.
- **8a. AI lỗi hoặc quá thời gian (Timeout)**: Hệ thống AI bên thứ ba bị gián đoạn $\rightarrow$ Báo lỗi cụ thể, không tính phí token ảo, cho phép Designer gửi lại yêu cầu hoặc chuyển sang dựng thủ công.
- **Bảo mật thông tin khách hàng**: Tuân thủ tuyệt đối quy tắc BA: **Không bao giờ gửi số điện thoại, email hoặc tên công ty/thông tin liên hệ của khách hàng vào prompt hoặc payload gửi sang AI bên thứ 3**.
