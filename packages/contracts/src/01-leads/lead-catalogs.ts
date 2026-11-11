/**
 * Danh mục dùng chung cho hồ sơ Lead (Task 1).
 * Các danh mục khác sẽ bổ sung sau khi đối chiếu BA.
 */

export const LEAD_CONTACT_CHANNELS = [
  "hotline",
  "form_web",
  "email",
  "fanpage",
  "zalo",
  "google_lead_form",
] as const;

export type LeadContactChannel =
  (typeof LEAD_CONTACT_CHANNELS)[number];

/**
 * Danh mục lý do chuyển giao Lead theo BA UC02.
 * Chỉ khai báo dữ liệu, không xử lý chuyển giao.
 */
export const LEAD_TRANSFER_REASONS = [
  "Bận",
  "Không đúng thế mạnh",
  "Lý do khác",
] as const;

export type LeadTransferReason =
  (typeof LEAD_TRANSFER_REASONS)[number];

/**
 * Danh mục lý do đánh dấu Spam theo BA UC01.
 * Chỉ khai báo dữ liệu, chưa xử lý nghiệp vụ Spam.
 */
export const LEAD_SPAM_REASONS = [
  "SĐT không tồn tại",
  "Nhầm máy",
  "Sai số",
  "Đối thủ khảo giá",
] as const;

export type LeadSpamReason =
  (typeof LEAD_SPAM_REASONS)[number];

/**
 * Nhóm sản phẩm quan tâm theo BA UC01.
 */
export const LEAD_PRODUCT_GROUPS = [
  "Màn hình LED",
  "Bảng Điện Tử",
  "Nhu cầu Khác",
] as const;

export type LeadProductGroup =
  (typeof LEAD_PRODUCT_GROUPS)[number];
