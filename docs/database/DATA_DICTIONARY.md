# Từ điển dữ liệu ERD BA hiện tại

Chép tên trường/kiểu từ [ERD PDF](../sources/assets/ba-erd.pdf), không phải schema đã triển khai. Chỉ ghi một số khóa/NN nhìn thấy rõ; bảng này không thay DBML để sinh DDL, không tự bổ sung default/unique/FK/cascade. Kiểu int unsigned/tinyint/datetime được giữ nguyên để tránh âm thầm chuyển provider. Nhận xét là đối chiếu use case, không phải thay đổi ERD.

## roles

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| role_code | varchar(50) | Unique trong ERD |
| role_name | varchar(100) | Tên vai trò |
| description | text | Mô tả |
| created_at | datetime | Thời điểm tạo |

## users

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| role_id | int unsigned | Liên kết roles |
| full_name | varchar(100) | Họ tên |
| email | varchar(100) | Unique trong ERD |
| phone | varchar(20) | Số điện thoại |
| password_hash | varchar(255) | Hash, không phải mật khẩu gốc |
| department | enum('marketing','sales','management','admin') | Giữ nguyên enum nguồn |
| is_active | tinyint(1) | Trạng thái tài khoản; không mặc định là presence/nhận Lead |
| created_at | datetime | Thời điểm tạo |
| updated_at | datetime | Thời điểm cập nhật |

## leads

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| lead_code | varchar(30) | Unique trong ERD |
| company_name | varchar(150) | Tên công ty |
| contact_name | varchar(100) | Tên liên hệ; có NN trong ERD |
| phone | varchar(20) | SĐT; có NN trong ERD |
| email | varchar(100) | Email |
| contact_channel | enum('hotline','form_web','email','fanpage') | Chưa khớp đầy đủ nhãn nguồn UC01 |
| source_website | varchar(100) | Website nguồn |
| area_type | enum('tphcm','other_province') | Có NN trong ERD |
| province | varchar(100) | Có NN trong ERD |
| district | varchar(100) | Quận/huyện |
| installation_address | text | Địa chỉ lắp đặt |
| pipeline_status | enum('new_lead','quoting','quote_sent','won','lost') | Năm trạng thái BA |
| lost_reason | text | UC02 yêu cầu khi thất bại |
| assigned_sales_id | int unsigned | Sales phụ trách; quan hệ tùy chọn |
| created_by_user_id | int unsigned | Có NN trong ERD; actor webhook cần chốt |
| is_duplicate_alert | tinyint(1) | Cờ cảnh báo trùng |
| created_at | datetime | Thời điểm tiếp nhận |
| updated_at | datetime | Cập nhật chung, không tự coi là mốc gửi báo giá |

## products

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| category_group | enum('led_screen','electronic_board','other') | Ba nhóm sản phẩm |
| product_code | varchar(50) | Unique trong ERD |
| product_name | varchar(150) | Tên sản phẩm |
| unit | varchar(20) | Đơn vị trong nguồn; không tự sinh giá bán |
| is_active | tinyint(1) | Trạng thái danh mục |
| created_at | datetime | Thời điểm tạo |

## lead_products

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| lead_id | int unsigned | Liên kết leads |
| product_id | int unsigned | Liên kết products |
| requested_dimension | varchar(100) | Thông số nhu cầu trong ERD; UI scope cần đối chiếu |
| note_specification | text | Ghi chú nhu cầu |
| created_at | datetime | Thời điểm tạo |

## lead_attachments

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| lead_id | int unsigned | Liên kết leads |
| attachment_type | enum('site_photo','customer_drawing_doc') | Loại tệp trong nguồn |
| file_name | varchar(255) | Tên tệp |
| file_url | varchar(500) | Reference trong ERD; không mặc định file public |
| file_size_kb | int unsigned | Metadata dung lượng, không phải hạn mức BA |
| uploaded_by | int unsigned | Actor tải lên, cần đối chiếu FK |
| uploaded_at | datetime | Thời điểm tải lên |

## lead_activities

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| lead_id | int unsigned | Liên kết leads |
| action_type | enum('reassign_sales','status_change','add_note') | Chưa biểu diễn hết hành vi UC01 mới |
| from_sales_id | int unsigned | Sales cũ nếu chuyển |
| to_sales_id | int unsigned | Sales nhận nếu chuyển |
| transfer_reason | text | Lý do chuyển theo UC02 |
| old_status | varchar(50) | Trạng thái trước |
| new_status | varchar(50) | Trạng thái sau |
| action_by | int unsigned | Actor thao tác |
| created_at | datetime | Thời điểm sự kiện |

## marketing_tracking

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| lead_id | int unsigned | Quan hệ một-một với leads trong hình |
| utm_source | varchar(100) | Nguồn ghi nhận |
| campaign_name | varchar(150) | Tên chiến dịch |
| landing_page_url | varchar(255) | Trang đích |
| device_type | varchar(50) | Thiết bị |
| ip_address | varchar(45) | IP, không được gửi AI |
| geo_location | varchar(100) | Vị trí |
| sync_ga4_status | enum('synced','pending','failed') | Trạng thái nguồn hiện có |
| tracked_at | datetime | Thời điểm tracking |

## design_requests

| Trường | Kiểu trong ERD | Ghi chú |
| --- | --- | --- |
| id | int unsigned | PK |
| lead_id | int unsigned | Có NN trong ERD; giai đoạn 2 |
| requested_by_sales_id | int unsigned | Sales yêu cầu theo nguồn |
| assigned_designer_id | int unsigned | Designer phụ trách |
| request_type | enum('3d_perspective','banner','video_short') | Giữ enum nguồn; video chưa có UC chi tiết |
| screen_dimensions | varchar(150) | Thông số màn hình |
| design_status | enum('pending','ai_drafting','completed','revision_needed') | Trạng thái thiết kế, khác Pipeline |
| ai_draft_image_url | varchar(500) | Nháp AI |
| final_render_url | varchar(500) | Bản hoàn thiện |
| notes | text | Ghi chú |
| created_at | datetime | Thời điểm yêu cầu |
| completed_at | datetime | Thời điểm hoàn thành |

## Phần chưa có

D4/D5 và các chi tiết UC mới không được tự chèn vào từ điển nguồn. Xem [ERD_COVERAGE](ERD_COVERAGE.md) và [OPEN_QUESTIONS](../decisions/OPEN_QUESTIONS.md) trước khi tạo model/migration.
