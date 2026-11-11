# Các quyết định còn mở

Ngày 05/11/2026. Đây là sổ theo dõi các chỗ chưa đủ đặc tả để IT không đoán thay BA. **Không mở lại quyền BA đã chốt** và không chặn toàn bộ dự án: hoàn thành phần độc lập của task, chỉ làm rõ phần phụ thuộc cần quyết định.

Khi có quyết định: ghi người chốt/ngày/nguồn vào mục liên quan, cập nhật hồ sơ module/contract và ADR nếu ảnh hưởng kiến trúc. Chưa có câu trả lời thì giữ trạng thái mở, không tự điền giá trị mặc định thành chính sách.

## Q01

**Provider, major và hạ tầng.** Trạng thái: MỞ.

Nguồn/khác biệt: Blueprint đề xuất PostgreSQL; ERD dùng kiểu MySQL; version/runtime/host chưa chốt.

Đầu mối đề nghị: Trưởng dự án + người điều phối DB/IT.

Việc cần làm: Chốt provider/major/runtime rồi lập ADR trước khi scaffold DB. Không chặn việc đặt tài liệu.

## Q02

**UC03 và đặc tả Tracking/SEO (Mâu thuẫn quyền sửa Nguồn/Chiến dịch).** Trạng thái: MỞ.

Nguồn/khác biệt: Đã có tài liệu UC03 và UC05, tuy nhiên còn mâu thuẫn trực tiếp giữa **UC01 / PERMISSIONS.md** (ghi chỉ Nhân viên Ads được chỉnh Nguồn/Chiến dịch theo `UC03-4`) và **UC03 BR5** (ghi Chiến dịch/Nguồn marketing do hệ thống tự ghi nhận, không ai được sửa tay kể cả Marketing, Ads). Ngoài ra chưa chốt ai có thẩm quyền cuối cùng xác nhận Spam (`spamStatus = CONFIRMED`) khi Marketing và Kinh doanh đánh giá khác nhau.

Đầu mối đề nghị: BA + Nhóm 1 + Nhóm 2 + Nhóm 3.

Việc cần làm: BA xác nhận giữ quyền sửa tay có kiểm soát cho `ADS` (`UC03-4`) hay khóa hoàn toàn theo `UC03 BR5`, và chốt vai trò duyệt cuối cho Spam. Giữ nguyên ma trận quyền hiện tại, chưa tự ý mở hay đóng quyền này trong code.

## Q03

**Biểu diễn Lead ẩn danh.** Trạng thái: MỞ.

Nguồn/khác biệt: UC01 đã chốt Marketing/Ads xem ẩn danh; chưa có whitelist chính xác trường/ảnh/history/export.

Đầu mối đề nghị: BA + Core + Nhóm 1/2/4.

Việc cần làm: Chốt field-level contract, không đổi các ô quyền ma trận và không mở endpoint lộ định danh.

## Q04

**Chi tiết quyền chưa có use case.** Trạng thái: MỞ.

Nguồn/khác biệt: Ma trận đủ 8 vai trò và export có cho cả 8; UC chủ yếu mô tả tác nghiệp. Chưa rõ toàn bộ phạm vi/ngữ cảnh quản lý và các thao tác không có UC riêng.

Đầu mối đề nghị: BA + Core.

Việc cần làm: Giữ nguyên quyền BA; bổ sung scope/field theo hành vi, không thay bằng ma trận 4 vai trò cũ.

## Q05

**Field bắt buộc và kênh/nguồn.** Trạng thái: MỞ.

Nguồn/khác biệt: Feedback tối thiểu Tên+SĐT; UC01 web tối thiểu SĐT+email; ERD có NN thêm. UC01 dùng Webhook/Hotline/Zalo trong khi contact_channel khác.

Đầu mối đề nghị: BA + Nhóm 1/2 + DB.

Việc cần làm: Chốt field matrix theo webhook/nhập tay/sửa và mapping channel/source; không điền fake để đủ NN.

## Q06

**Loại tệp và giới hạn upload.** Trạng thái: MỞ.

Nguồn/khác biệt: UC01-4.3/E3 chỉ ảnh, chưa giới hạn dung lượng cụ thể; brief/UC02/ERD có tài liệu/bản vẽ; UC06 nói dung lượng cho phép.

Đầu mối đề nghị: BA + Nhóm 1/5 + storage.

Việc cần làm: Chốt định dạng theo từng luồng và cấu hình kỹ thuật. Không tự đặt một mức MB thành nghiệp vụ đã duyệt.

## Q07

**Online, tải việc và nhận Lead.** Trạng thái: MỞ.

Nguồn/khác biệt: DFD ghi công tắc Đang nhận lead; UC01 tự phân theo online/đủ tải; UC02 lý do Bận cần ít Lead hơn hẳn. Chưa có ngưỡng/cách đo.

Đầu mối đề nghị: BA + Nhóm 1 + Core.

Việc cần làm: Chốt presence, capacity, số Lead đang xử lý, ngưỡng ít hơn hẳn và phân công cạnh tranh; tách khỏi account active.

## Q08

**Doanh thu, ROI và phê duyệt ngân sách.** Trạng thái: MỞ.

Nguồn/khác biệt: Một số hình liên kết/sequence/BPMN có doanh thu, ROI và duyệt ngân sách; feedback UI loại giá/doanh số; UC04/ERD chưa đủ nguồn/công thức/luồng.

Đầu mối đề nghị: BA + Nhóm 3/4 + trưởng dự án.

Việc cần làm: Giữ dấu nguồn; chưa tự triển khai hoặc xóa nghiệp vụ. Chốt scope và cách đo trước task liên quan.

## Q09

**Mốc nhắc báo giá và phản hồi.** Trạng thái: MỞ.

Nguồn/khác biệt: DFD cảnh báo quá 7 ngày; UC02 báo giá chưa phản hồi. Chưa rõ ngày lịch/ngày làm việc, mốc gửi, phản hồi và nhắc lặp.

Đầu mối đề nghị: BA + Nhóm 1/4.

Việc cần làm: Chốt rule và nguồn thời gian/lịch sử trước làm job. Không tự dùng updated_at chung.

## Q10

**Giai đoạn SEO và phạm vi video.** Trạng thái: MỞ.

Nguồn/khác biệt: Roadmap M03 ở GĐ2; DFD 5.0 không đánh giai đoạn; UC06 ảnh/banner/3D trong khi roadmap/ERD có video_short.

Đầu mối đề nghị: BA + trưởng dự án + Nhóm 3/5.

Việc cần làm: Giữ M05 GĐ2; chốt mốc SEO/video riêng, chưa cam kết video hoàn chỉnh.

## Q11

**Cơ chế auth/session và kỹ thuật dùng chung.** Trạng thái: MỞ.

Nguồn/khác biệt: ERD có users/roles; chưa khóa session/token/TTL/revocation/ID/cookie và người điều phối Core/DB.

Đầu mối đề nghị: IT + trưởng dự án.

Việc cần làm: Lập ADR/task hạ tầng, giữ quyền BA. Không báo auth đang chạy hoặc tự thêm dịch vụ.

## Q12

**Webhook, nguồn website và chống lặp.** Trạng thái: MỞ.

Nguồn/khác biệt: BA nói 3 website nhưng mới có 2 URL chính thức trong trao đổi; webhook/error/retry/service actor và định danh sự kiện chưa đủ.

Đầu mối đề nghị: BA + Nhóm 2/1 + quản trị website.

Việc cần làm: Chốt đủ nguồn, auth webhook, idempotency và lưu lỗi an toàn; không bịa website thứ ba hay user Admin tạo Lead tự động.

## Q13

**Hoàn thiện model theo DFD/UC.** Trạng thái: MỞ.

Nguồn/khác biệt: ERD thiếu D4/D5, metric Ads và các chi tiết UC01/UC06 mới; nhiều FK phụ không vẽ trong PDF.

Đầu mối đề nghị: DB + owner module + BA.

Việc cần làm: Đối chiếu DBML đầy đủ, model có owner và một migration history; chưa tự thêm bảng từ tên kho.

## Q14

**Yêu cầu thiết kế và liên kết Lead.** Trạng thái: MỞ.

Nguồn/khác biệt: BPMN có Sales tạo ticket; UC06 Designer tạo từ thư viện; ERD bắt lead_id và Sales/Designer. Banner có thể khác phối cảnh theo Lead.

Đầu mối đề nghị: BA + Nhóm 1/5.

Việc cần làm: Chốt entry point, liên kết Lead, thư viện/phiên bản, tải lên bản hoàn thiện và quyền tài liệu.

## Q15

**AI usage, quota và vận hành.** Trạng thái: MỞ.

Nguồn/khác biệt: Hình UC06 kiểm tra token theo user/dự án; chưa có giá trị/hạn mức, cách ghi chi phí từ provider, RPO/RTO/retention/tải thực tế.

Đầu mối đề nghị: BA + Core + Nhóm 3/5 + vận hành.

Việc cần làm: Chốt chính sách và nguồn metric; không giả token/cost, không tự mua/cấp dịch vụ hoặc hứa tải/restore.
