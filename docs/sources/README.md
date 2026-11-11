# Nguồn tài liệu và thứ tự ưu tiên

Ngày tổng hợp/đọc lại nguồn Docs: **05/11/2026**. Các tài liệu trực tuyến có thể tiếp tục thay đổi; khi có cập nhật BA, ghi revision/ngày và đối chiếu trước khi sửa nghiệp vụ. Bản ảnh trong assets là snapshot nhận/đọc ở lần bàn giao này, không phải sơ đồ được AI vẽ lại.

## Thứ tự áp dụng

1. Yêu cầu trực tiếp mới nhất của người dùng về phạm vi task và việc giữ nghiệp vụ BA.
2. Ma trận quyền BA nguyên bản cho các ô quyền; use case BA làm rõ hành vi và dữ liệu ẩn danh. Không thay matrix 8 vai trò bằng bản 4 vai trò cũ.
3. DFD/BFD/ERD/UC/BPMN và feedback là nguồn cụ thể từng phần. Nếu khác nhau thật sự, ghi OPEN_QUESTIONS, không tự chọn bỏ một phần.
4. Bản kiến trúc kỹ thuật cũ hỗ trợ tổ chức code; không chốt lại nghiệp vụ, quyền hoặc các bảng chưa có trong ERD.

## S01

**FILE BRIEF MINI CRM** — [Google Docs](https://docs.google.com/document/d/1aYnJ0EibjMaik4yYW-Jt6g-92lJgMPiv1yxQoDqK1BE/edit). Đã đọc text/tab: Lead, sản phẩm, địa bàn, trạng thái, lý do, chuyển Sales, trùng, tracking và báo cáo. Ảnh bảng dữ liệu dùng hiểu cấu trúc, không sao chép bản ghi khách vào fixture/tài liệu.

## S02

**Feedback giao diện** — [Google Docs](https://docs.google.com/document/d/1jkROm9N9oB0wOdCTzTrhG_1ZPGLqu3aEPJ6Q5Szo_hQ/edit). Đã đọc cả feedback và tab bổ sung: nhận diện công ty, login, menu/quyền, Dashboard, Lead, thông báo, hồ sơ, AI Design. Các ảnh bảng dữ liệu không đóng gói lại để tránh dùng chúng như seed.

## S03

**Kế hoạch triển khai** — [Google Docs](https://docs.google.com/document/d/1a5bu2Xu-CK8ThbEbdYFlzSVn_tpUotvd/edit). Đã đọc mục tiêu, 5 module, kế hoạch tương đối 10 tuần và dữ liệu mẫu/thật. Chưa có ngày bắt đầu được chốt; không tạo lịch tự động từ thời lượng này.

## S04

**Tài liệu đặc tả BA** — [Google Docs](https://docs.google.com/document/d/1Ze_JbpB98_GGced80q_KU9XlQGcc8iUX9XVYW4cgJBg/edit?tab=t.vcwjlp21c8wx). Đã đọc text tất cả tab, bảng UC01/UC02/UC04/UC06 và xem các hình liên quan. Tab M02/M03 chưa có use case riêng; UC03 được tham chiếu từ UC01. Có ảnh dữ liệu mẫu chỉ dùng hiểu bối cảnh, không đưa dữ liệu cá nhân vào bộ bàn giao.

Hình sequence UC01 nhúng rất dài và chữ nhỏ; khi triển khai cần đối soát bằng file sơ đồ gốc ở kích thước đọc được. Bộ này ưu tiên mô tả UC bằng chữ cho chi tiết đã rõ và lưu ảnh nguồn để truy vết, không tự suy nội dung chữ không đọc rõ.

## S05

**DFD cấp 1 và sơ đồ BA người dùng gửi trực tiếp.** [DFD rõ](assets/ba-dfd-level1.png), [BFD](assets/ba-bfd.png), [ngữ cảnh](assets/ba-context.png), [liên kết module](assets/ba-module-links.png). Cùng nội dung trong tài liệu BA; phiên bản liên kết module trực tuyến có tiêu đề cập nhật. Giữ số tiến trình/kho và phân biệt với số module.

## S06

**ERD.pdf người dùng bàn giao** — [bản PDF nguyên trạng](assets/ba-erd.pdf). Có 2 trang cùng cấu trúc 9 bảng; trang sau nổi đường liên kết. Đã trích text và xem cả 2 trang. DBML trực tuyến: [ERD](https://dbdiagram.io/d/ERD-6ae3f3feaac330141060293a). Phân tích hiện tại dựa vào PDF đính kèm, không khẳng định DBML trực tuyến không thay đổi kể từ lần đọc trước.

## S07

**Ma trận RBAC BA** — [ảnh đầy đủ](assets/ba-rbac.png), lấy từ tab Chức năng và phân quyền. Đã đối chiếu với phần ảnh người dùng gửi; bản crop thiếu hàng dưới, vì vậy dùng ảnh đầy đủ để chép đủ 12 hàng/8 vai trò. Quyền BA giữ nguyên theo chỉ định người dùng.

## S08

**Bảng phân chia 5 nhóm** — [ảnh nguồn](assets/team-assignment.png). Đúng người phụ trách và branch được chép vào MODULE_MAP. Đây là nhóm phát triển, không phải role đăng nhập. Trạng thái ảnh là đang nghiên cứu, không xác nhận source đã push đủ.

## S09

**Profile công ty** — [Drive](https://drive.google.com/file/d/1zcUe3UszlKwvSHjcCxUCL2CEzW-zix8h/view?usp=sharing). Đã đọc nội dung trích xuất về công ty, sản phẩm và năng lực/nhận diện; chỉ dùng làm bối cảnh thương hiệu và sản phẩm. Không đưa thông tin quảng bá/giá/cam kết brochure thành nghiệp vụ hệ thống. PDF dung lượng lớn không sao chép vào Git bundle.

## S10

**Tài liệu LED** — [Drive](https://drive.google.com/file/d/19xaUysa1b1M5wfyCegbozvNdfB3UhHJf/view?usp=sharing). Nội dung về LED/DIP/SMD/COB, bảng quang báo, màn hình, module/card/khung và cách ghép; tham khảo cho danh mục/Designer, không tự suy giới hạn sản phẩm hoặc tính giá.

## S11

**Website và hình ảnh công ty** — [toantrung.com.vn](https://toantrung.com.vn/), [bangled.vn](https://bangled.vn/). Logo/ảnh đã được tham khảo ở các lượt trước; logo nguồn dùng để đối chiếu nhận diện, không phải tuyên bố guideline màu/font đã được chốt. Khi triển khai UI cần xác nhận asset đúng phiên bản đang dùng của công ty.

## S12

**Ảnh đăng nhập người dùng gửi** — ảnh tham chiếu bố cục. Đây là tham chiếu giao diện, không thay logo chính thức, ma trận BA hoặc chứng minh auth đã triển khai.

## S13

**ToanTrung_V2_KienTruc_Skill_Data (1).md** và đoạn kiến trúc người dùng dán trong hội thoại. Đã dùng phần kiến trúc, ranh giới, quy tắc dữ liệu lớn, kiểm tra và task. Phân công P1…P5, quyền 4 vai trò, bảng DB tưởng định và một số đề xuất cũ đã được thay bằng nguồn BA/bảng nhóm thật. Không cài/chỉnh skill, vendor hoặc chạy installer trong bộ tài liệu này.

## Những chỉ định hội thoại được giữ

- Người dùng đang tư vấn và chuẩn bị khung; tạo tài liệu không đồng nghĩa được triển khai web.
- Một repo, 5 nhóm theo trọn module; folder FE–BE–DB–contracts–test rõ ràng.
- 8 actor lấy từ RBAC; khách hàng chỉ là dữ liệu. Giữ nguyên ma trận BA.
- Trưởng phòng xem báo cáo phòng mình; không dùng điều này xóa các ô quyền Lead toàn công ty đã tick.
- Phần nghiệp vụ chưa triển khai để trống; không báo route/CI/provider/backup đã hoạt động từ file tài liệu.

## Hình chi tiết kèm theo

- [BPMN Lead AS-IS/TO-BE](assets/ba-detail-10.png).
- [Sequence UC01](assets/ba-detail-11.png).
- [Use case UC01](assets/ba-detail-12.png).
- [Sequence UC02](assets/ba-detail-13.png).
- [Activity UC02](assets/ba-detail-14.png).
- [Use case UC02](assets/ba-detail-16.png).
- [Activity UC04](assets/ba-detail-17.png).
- [BPMN báo cáo TO-BE](assets/ba-detail-18.png).
- [Use case UC04](assets/ba-detail-19.png).
- [Sequence UC04](assets/ba-detail-20.png).
- [BPMN báo cáo AS-IS](assets/ba-detail-21.png).
- [BPMN thiết kế TO-BE](assets/ba-detail-22.png).
- [Sequence UC06](assets/ba-detail-23.png).
- [BPMN thiết kế AS-IS](assets/ba-detail-24.png).
- [Activity UC06](assets/ba-detail-25.png).
- [Use case UC06](assets/ba-detail-26.png).

Không có signed URL ảnh Google, credential, bảng khách hàng thật hoặc DB dump trong gói. Nguồn online có thể thay đổi; ưu tiên đối chiếu BA khi cập nhật thay vì suy quyết định từ bản cũ.
