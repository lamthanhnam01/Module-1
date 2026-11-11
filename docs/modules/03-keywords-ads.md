# 03-keywords-ads — Từ khóa, Ads và Nội dung SEO tích hợp AI

**Nhóm 3 — Phụ trách: Nguyễn Anh Quân.**  
Nhánh Git: `feature/ads-keywords`.  
Nguồn đặc tả chuẩn: **Tài liệu đặc tả BA (UC05: Nội dung SEO tích hợp AI)** ngày 05/11/2026.

---

## 1. Vùng phát triển của Nhóm 3

| Lớp | Đường dẫn mã nguồn |
| :--- | :--- |
| **Giao diện (Frontend)** | `apps/web/src/modules/03-keywords-ads/` |
| **Trang hiển thị (Page Route)** | `apps/web/src/app/(workspace)/ads/page.tsx` |
| **Xử lý Backend** | `apps/api/src/modules/03-keywords-ads/` |
| **Endpoint API** | `apps/api/src/app/api/v1/ads/route.ts` |
| **Hợp đồng dữ liệu (Contracts/DTO)** | `packages/contracts/src/03-keywords-ads/` |
| **Prisma Model** | `packages/database/prisma/models/03-keywords-ads.prisma` |
| **Kiểm thử E2E & Mock Fixture** | `tests/e2e/03-keywords-ads/` và `tests/fixtures/03-keywords-ads/` |
| **Task nhóm** | `docs/tasks/m03/` |

---

## 2. Mô tả tổng quan Use Case 05 (UC05)

- **Mục tiêu**:
  1. Cho phép nhân viên Marketing chọn từ khóa dựa trên dữ liệu hiệu quả và xu hướng tìm kiếm.
  2. Sử dụng AI để soạn bản nháp bài viết chuẩn SEO theo từ khóa và chủ đề đã chọn.
  3. Quản lý quy trình biên tập: Chỉnh sửa $\rightarrow$ Duyệt $\rightarrow$ Lên lịch $\rightarrow$ Tự động đăng tải lên 3 website Toàn Trung.
  4. Theo dõi hiệu quả bài viết sau khi đăng (lượt xem, thứ hạng, click) để tối ưu và làm mới bài viết cũ.
- **Vai trò & Tác nhân**:
  + **Tác nhân chính**: Nhân viên Marketing (toàn quyền chọn từ khóa, tạo nháp AI, sửa bài, duyệt, rút duyệt, đặt lịch đăng bài).
  + **Tác nhân phụ**:
    * **Nhân viên Ads**: Chỉ được xem danh sách từ khóa và xu hướng tìm kiếm để hỗ trợ Marketing; **không có quyền** tạo nháp AI, sửa bài, duyệt hoặc lên lịch đăng bài.
    * **Hệ thống AI**: Đóng vai trò trợ lý đề xuất bản nháp; mọi quyết định nội dung cuối cùng thuộc về Marketing.
    * **3 Website Toàn Trung**: Tiếp nhận bài viết tự động qua kết nối API.

---

## 3. Dòng sự kiện chính (Main Flow)

1. **Theo dõi từ khóa & Phân tích xu hướng**:
   - Marketing mở màn hình phân tích từ khóa.
   - Hệ thống hiển thị dữ liệu đồng bộ từ UC03: Từ khóa & lượt click (Google Ads); Từ khóa, lượt click & vị trí (Search Console); Xu hướng tìm kiếm (Google Trends).
2. **Chọn từ khóa & Khởi tạo yêu cầu**:
   - Marketing chọn từ khóa mục tiêu và chủ đề bài viết cần viết.
   - Nhập yêu cầu hoặc bấm "Soạn bản nháp bài viết chuẩn SEO bằng AI".
3. **AI sinh bản nháp ban đầu**:
   - Hệ thống gửi prompt và từ khóa sang hệ thống AI.
   - AI trả về bản nháp bài viết (gồm tiêu đề chuẩn SEO, thẻ meta description, các thẻ H2/H3, nội dung thân bài và mật độ từ khóa gợi ý).
   - Hệ thống lưu bài viết ở trạng thái **`Nháp`** cùng với nội dung đề xuất của AI.
4. **Biên tập & Chỉnh sửa nội dung**:
   - Nhân viên Marketing trực tiếp chỉnh sửa câu từ, chèn hình ảnh sản phẩm màn hình LED thực tế.
   - Hệ thống lưu lịch sử các phiên bản chỉnh sửa; trạng thái bài viết vẫn là **`Nháp`**.
5. **Đề xuất lịch đăng & Chọn website đích**:
   - Hệ thống phân tích xu hướng tìm kiếm để gợi ý ngày/giờ đăng bài tối ưu.
   - Marketing chọn hoặc điều chỉnh ngày giờ đăng bài và chọn website đích trong số 3 website của công ty.
6. **Duyệt bài viết (Approval)**:
   - Marketing bấm "Duyệt bài".
   - Hệ thống chuyển trạng thái bài viết từ **`Nháp`** $\longrightarrow$ **`Đã duyệt - chờ đăng`**, khóa nội dung chỉnh sửa nhanh và đưa vào hàng đợi lịch phát hành.
7. **Tự động đăng bài lên Website**:
   - Đến đúng ngày giờ đã đặt lịch, hệ thống nền tự động đẩy bài viết qua API lên website đích đã chọn.
   - Đăng tải thành công $\rightarrow$ Chuyển trạng thái sang **`Đã đăng`** kèm đường dẫn (URL) bài viết thực tế.
8. **Đo lường & Tối ưu bài viết cũ**:
   - Marketing theo dõi lượt click, thứ hạng tìm kiếm và thời gian đọc trang qua dữ liệu Search Console / GA4 đồng bộ về.
   - Hệ thống hiển thị danh sách các bài viết cũ có hiệu suất thấp để Marketing rà soát, viết lại hoặc cập nhật từ khóa mới.

---

## 4. Các luồng sự kiện phụ & Xử lý ngoại lệ

- **A1. Rút duyệt bài viết**:
  + Áp dụng khi bài viết đang ở trạng thái `Đã duyệt - chờ đăng` nhưng Marketing muốn chỉnh sửa lại hoặc hủy lịch đăng.
  + Hệ thống chuyển trạng thái về lại `Nháp` và hủy bỏ lịch phát hành đã hẹn giờ.
- **A2. Lỗi đẩy bài lên website**:
  + Nếu kết nối website đích bị lỗi hoặc API website từ chối $\rightarrow$ Hệ thống giữ nguyên trạng thái `Đã duyệt - chờ đăng`, ghi nhật ký lỗi chi tiết và gửi thông báo cho Marketing.
  + Marketing có thể chọn: Thử đăng lại ngay, Đổi sang giờ/ngày khác, hoặc Rút duyệt về `Nháp`.
- **A3. Sự cố kết nối AI**:
  + Nếu AI quá tải, lỗi mạng hoặc không phản hồi $\rightarrow$ Hệ thống thông báo lỗi rõ ràng, không tạo bản nháp lỗi.
  + Marketing có thể chọn thử lại, hoặc tự soạn nội dung thủ công trên giao diện biên tập; hệ thống lưu ở trạng thái `Nháp` để tiếp tục làm việc bình thường.
- **A4. Giới hạn phân quyền của Nhân viên Ads**:
  + Nhân viên Ads truy cập chức năng chỉ nhìn thấy bảng dữ liệu số liệu từ khóa và biểu đồ xu hướng.
  + Không hiển thị các nút thao tác: "Tạo bài viết AI", "Sửa bài", "Duyệt bài", "Lên lịch", "Xem hiệu quả bài viết". Luồng của Ads kết thúc tại bước tra cứu số liệu.
