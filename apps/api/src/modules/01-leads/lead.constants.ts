/**
 * Hằng số dùng chung của Module 1 (Quản lý Lead).
 *
 * LƯU Ý: file này được Task 2 đề xuất để thống nhất tên trạng thái và mã vai trò
 * giữa Task 1, Task 2 và Task 3. Cần cả nhóm xác nhận trước khi gộp.
 */

// ---------------------------------------------------------------------------
// Trạng thái Lead (khớp giá trị mặc định "NEW" trong lead.prisma của Task 1)
// ---------------------------------------------------------------------------
export const LEAD_STATUS = {
  NEW: "NEW", // Vừa nhận thông tin
  QUOTING: "QUOTING", // Đang soạn báo giá
  QUOTE_SENT: "QUOTE_SENT", // Đã gửi báo giá
  WON: "WON", // Chốt thành công
  LOST: "LOST", // Thất bại
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "Vừa nhận thông tin",
  QUOTING: "Đang soạn báo giá",
  QUOTE_SENT: "Đã gửi báo giá",
  WON: "Chốt thành công",
  LOST: "Thất bại",
};

/** Các trạng thái Lead còn đang được NVKD chăm sóc. */
export const OPEN_LEAD_STATUSES: readonly LeadStatus[] = [
  LEAD_STATUS.NEW,
  LEAD_STATUS.QUOTING,
  LEAD_STATUS.QUOTE_SENT,
];

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    (Object.values(LEAD_STATUS) as string[]).includes(value)
  );
}

export function isOpenLeadStatus(status: LeadStatus): boolean {
  return OPEN_LEAD_STATUSES.includes(status);
}

// ---------------------------------------------------------------------------
// Cờ trùng lặp (UC01 - E0)
// ---------------------------------------------------------------------------
export const DUPLICATE_FLAG = {
  /** Lead cũ đang ở "Vừa nhận thông tin": gắn cờ "Trùng", tô đỏ. */
  DUPLICATE: "DUPLICATE",
  /** Lead cũ ở các trạng thái còn lại: gắn cờ "Đã có Lead cũ", không tô đỏ. */
  HAS_OLD_LEAD: "HAS_OLD_LEAD",
  /** Lead chưa có tên công ty nhưng cùng SĐT hoặc email với Lead cũ, không tô đỏ. */
  SAME_PHONE_EMAIL: "SAME_PHONE_EMAIL",
} as const;

export type DuplicateFlag = (typeof DUPLICATE_FLAG)[keyof typeof DUPLICATE_FLAG];

export const DUPLICATE_FLAG_LABEL: Record<DuplicateFlag, string> = {
  DUPLICATE: "Trùng",
  HAS_OLD_LEAD: "Đã có Lead cũ",
  SAME_PHONE_EMAIL: "Cùng SĐT/email với Lead cũ",
};

// ---------------------------------------------------------------------------
// Vai trò (ma trận RBAC trong tài liệu đặc tả)
// Giá trị phải khớp cột role_code trong bảng roles (seed của dự án).
// ---------------------------------------------------------------------------
export const ROLE_CODE = {
  SALES: "SALES", // Nhân viên Kinh doanh
  MARKETING: "MARKETING", // Nhân viên Marketing
  DESIGNER: "DESIGNER", // Designer
  ADS: "ADS", // Nhân viên Ads
  MARKETING_HEAD: "MARKETING_HEAD", // Trưởng phòng MKT
  SALES_HEAD: "SALES_HEAD", // Trưởng phòng Sales
  DIRECTOR: "DIRECTOR", // Giám đốc
  ADMIN: "ADMIN", // Quản trị viên
} as const;

export type RoleCode = (typeof ROLE_CODE)[keyof typeof ROLE_CODE];

export const ROLE_LABEL: Record<RoleCode, string> = {
  SALES: "Nhân viên Kinh doanh",
  MARKETING: "Nhân viên Marketing",
  DESIGNER: "Designer",
  ADS: "Nhân viên Ads",
  MARKETING_HEAD: "Trưởng phòng MKT",
  SALES_HEAD: "Trưởng phòng Sales",
  DIRECTOR: "Giám đốc",
  ADMIN: "Quản trị viên",
};

/**
 * Mã vai trò khác tên đang dùng trong dữ liệu thật của dự án.
 * Repo giao diện hiện có dùng "DESIGN" cho Designer. Cần đối chiếu với bảng roles
 * (seed) và bổ sung dòng tương ứng nếu mã thật khác (ví dụ trưởng phòng).
 */
export const ROLE_CODE_ALIASES: Readonly<Record<string, RoleCode>> = {
  DESIGN: ROLE_CODE.DESIGNER,
};

/** Chuẩn hóa mã vai trò đọc từ cơ sở dữ liệu; trả về null nếu không nhận ra. */
export function parseRoleCode(raw: unknown): RoleCode | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  const aliased = ROLE_CODE_ALIASES[value];
  if (aliased) return aliased;
  return (Object.values(ROLE_CODE) as string[]).includes(value)
    ? (value as RoleCode)
    : null;
}
