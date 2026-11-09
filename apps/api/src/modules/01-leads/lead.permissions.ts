/**
 * Phân quyền theo ma trận RBAC trong tài liệu đặc tả (8 vai trò, 12 quyền).
 *
 * Nguyên tắc:
 *  - Mặc định từ chối: vai trò lạ, tài khoản bị khóa hoặc không đăng nhập đều bị chặn.
 *  - Quyền chỉ là điều kiện cần. Phạm vi dữ liệu (Lead của mình, Lead có yêu cầu
 *    phối cảnh...) được kiểm tra riêng bằng canAccessLead / buildLeadVisibilityFilter.
 *  - Kiểm tra luôn thực hiện ở máy chủ. Việc ẩn nút ở giao diện chỉ để tiện dùng.
 */
import { ROLE_CODE, parseRoleCode, type RoleCode } from "./lead.constants";
import { LeadAccessError } from "./lead.errors";

export const PERMISSION = {
  LEAD_CREATE: "LEAD_CREATE", // Tiếp nhận & Tạo mới Lead
  LEAD_VIEW_OWN: "LEAD_VIEW_OWN", // Xem Lead cá nhân phụ trách
  LEAD_VIEW_ALL: "LEAD_VIEW_ALL", // Xem toàn bộ Lead toàn công ty
  LEAD_UPDATE_PROGRESS: "LEAD_UPDATE_PROGRESS", // Cập nhật tiến độ & Pipeline báo giá
  LEAD_TRANSFER: "LEAD_TRANSFER", // Chuyển giao Lead sang Sales khác
  ATTACHMENT_ACCESS: "ATTACHMENT_ACCESS", // Upload/Xem ảnh hiện trạng & Bản vẽ
  AI_DESIGN: "AI_DESIGN", // AI Thiết kế: Phối cảnh 3D & Banner
  AI_MARKETING: "AI_MARKETING", // AI Marketing: Từ khóa SEO & Nội dung
  TRACKING: "TRACKING", // Tracking đa kênh & Tối ưu Google Ads
  DASHBOARD_VIEW: "DASHBOARD_VIEW", // Xem Dashboard báo cáo hiệu suất
  DATA_EXPORT: "DATA_EXPORT", // Xuất dữ liệu Excel / Google Sheets
  SYSTEM_ADMIN: "SYSTEM_ADMIN", // Cấu hình hệ thống & Quản lý User
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

const P = PERMISSION;
const R = ROLE_CODE;

/** Ma trận RBAC: mỗi vai trò có những quyền nào (dấu tích xanh trong đặc tả). */
export const ROLE_PERMISSIONS: Readonly<Record<RoleCode, readonly Permission[]>> = {
  [R.SALES]: [
    P.LEAD_CREATE,
    P.LEAD_VIEW_OWN,
    P.LEAD_UPDATE_PROGRESS,
    P.LEAD_TRANSFER,
    P.ATTACHMENT_ACCESS,
    P.DASHBOARD_VIEW,
    P.DATA_EXPORT,
  ],
  [R.MARKETING]: [
    P.LEAD_VIEW_OWN,
    P.LEAD_VIEW_ALL,
    P.AI_MARKETING,
    P.TRACKING,
    P.DASHBOARD_VIEW,
    P.DATA_EXPORT,
  ],
  [R.DESIGNER]: [
    P.LEAD_VIEW_OWN, // ô "3D, 2D": chỉ Lead có yêu cầu phối cảnh
    P.ATTACHMENT_ACCESS,
    P.AI_DESIGN,
    P.DASHBOARD_VIEW,
    P.DATA_EXPORT,
  ],
  [R.ADS]: [
    P.LEAD_VIEW_OWN,
    P.LEAD_VIEW_ALL,
    P.AI_MARKETING,
    P.TRACKING,
    P.DASHBOARD_VIEW,
    P.DATA_EXPORT,
  ],
  [R.MARKETING_HEAD]: [
    P.LEAD_VIEW_OWN,
    P.LEAD_VIEW_ALL,
    P.AI_MARKETING,
    P.TRACKING,
    P.DASHBOARD_VIEW,
    P.DATA_EXPORT,
  ],
  [R.SALES_HEAD]: [
    P.LEAD_CREATE,
    P.LEAD_VIEW_OWN,
    P.LEAD_VIEW_ALL,
    P.LEAD_UPDATE_PROGRESS,
    P.LEAD_TRANSFER,
    P.ATTACHMENT_ACCESS,
    P.DASHBOARD_VIEW,
    P.DATA_EXPORT,
  ],
  [R.DIRECTOR]: [
    P.LEAD_CREATE,
    P.LEAD_VIEW_OWN,
    P.LEAD_VIEW_ALL,
    P.LEAD_UPDATE_PROGRESS,
    P.LEAD_TRANSFER,
    P.ATTACHMENT_ACCESS,
    P.TRACKING,
    P.DASHBOARD_VIEW,
    P.DATA_EXPORT,
  ],
  [R.ADMIN]: [
    P.LEAD_CREATE,
    P.LEAD_VIEW_OWN,
    P.LEAD_VIEW_ALL,
    P.LEAD_UPDATE_PROGRESS,
    P.LEAD_TRANSFER,
    P.ATTACHMENT_ACCESS,
    P.AI_DESIGN,
    P.AI_MARKETING,
    P.TRACKING,
    P.DASHBOARD_VIEW,
    P.DATA_EXPORT,
    P.SYSTEM_ADMIN,
  ],
};

// ---------------------------------------------------------------------------
// Người thao tác
// ---------------------------------------------------------------------------
export interface Actor {
  id: number;
  /** Giá trị cột role_code đọc từ cơ sở dữ liệu hoặc từ phiên đăng nhập. */
  roleCode: string | null | undefined;
  /** false nếu tài khoản bị khóa/ngưng. Không truyền thì coi là đang hoạt động. */
  isActive?: boolean;
}

export interface ResolvedActor {
  id: number;
  role: RoleCode;
}

/** Xác thực người thao tác; ném lỗi 401/403 nếu không hợp lệ. */
export function resolveActor(actor: Actor | null | undefined): ResolvedActor {
  if (!actor || !Number.isInteger(actor.id) || actor.id <= 0) {
    throw new LeadAccessError("UNAUTHENTICATED", "Chưa đăng nhập");
  }
  if (actor.isActive === false) {
    throw new LeadAccessError("FORBIDDEN", "Tài khoản đã bị khóa");
  }
  const role = parseRoleCode(actor.roleCode);
  if (role === null) {
    throw new LeadAccessError("FORBIDDEN", "Vai trò không hợp lệ");
  }
  return { id: actor.id, role };
}

/** Vai trò có quyền này không (chưa xét phạm vi dữ liệu). */
export function roleHasPermission(role: RoleCode, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  try {
    const a = resolveActor(actor);
    return roleHasPermission(a.role, permission);
  } catch {
    return false;
  }
}

export function assertCan(actor: Actor | null | undefined, permission: Permission): ResolvedActor {
  const a = resolveActor(actor);
  if (!roleHasPermission(a.role, permission)) {
    throw new LeadAccessError("FORBIDDEN", "Không đủ quyền thực hiện thao tác này");
  }
  return a;
}

// ---------------------------------------------------------------------------
// Phạm vi dữ liệu
// ---------------------------------------------------------------------------
export type LeadScope = "ALL" | "OWN" | "DESIGN_REQUEST";

/** Phạm vi Lead mà vai trò được xem. */
export function getLeadViewScope(role: RoleCode): LeadScope | null {
  if (roleHasPermission(role, PERMISSION.LEAD_VIEW_ALL)) return "ALL";
  if (role === ROLE_CODE.DESIGNER) return "DESIGN_REQUEST";
  if (roleHasPermission(role, PERMISSION.LEAD_VIEW_OWN)) return "OWN";
  return null;
}

/** Phạm vi số liệu Dashboard: Sales chỉ xem số liệu của chính mình. */
export function getDashboardScope(role: RoleCode): "ALL" | "OWN" | null {
  if (!roleHasPermission(role, PERMISSION.DASHBOARD_VIEW)) return null;
  return role === ROLE_CODE.SALES ? "OWN" : "ALL";
}

/**
 * Điều kiện lọc danh sách Lead mà tầng truy vấn BẮT BUỘC áp dụng,
 * để người dùng không lấy được Lead ngoài phạm vi kể cả khi gọi API trực tiếp.
 */
export type LeadVisibilityFilter =
  | { kind: "ALL" }
  | { kind: "ASSIGNED_TO"; userId: number }
  | { kind: "DESIGN_REQUEST" };

export function buildLeadVisibilityFilter(actor: Actor | null | undefined): LeadVisibilityFilter {
  const a = resolveActor(actor);
  const scope = getLeadViewScope(a.role);
  switch (scope) {
    case "ALL":
      return { kind: "ALL" };
    case "DESIGN_REQUEST":
      return { kind: "DESIGN_REQUEST" };
    case "OWN":
      return { kind: "ASSIGNED_TO", userId: a.id };
    default:
      throw new LeadAccessError("FORBIDDEN", "Không có quyền xem Lead");
  }
}

// ---------------------------------------------------------------------------
// Quyền trên từng Lead cụ thể
// ---------------------------------------------------------------------------
export interface LeadAccessTarget {
  id: number;
  assignedToId: number | null;
  /** Lead có yêu cầu phối cảnh 3D/2D cho màn hình LED (Designer chỉ thấy các Lead này). */
  hasDesignRequest: boolean;
}

export type LeadAction =
  | "VIEW"
  | "UPDATE_PROGRESS"
  | "TRANSFER"
  | "ATTACHMENT_VIEW"
  | "ATTACHMENT_UPLOAD";

const ACTION_PERMISSION: Record<LeadAction, Permission> = {
  VIEW: PERMISSION.LEAD_VIEW_OWN,
  UPDATE_PROGRESS: PERMISSION.LEAD_UPDATE_PROGRESS,
  TRANSFER: PERMISSION.LEAD_TRANSFER,
  ATTACHMENT_VIEW: PERMISSION.ATTACHMENT_ACCESS,
  ATTACHMENT_UPLOAD: PERMISSION.ATTACHMENT_ACCESS,
};

function inViewScope(a: ResolvedActor, lead: LeadAccessTarget): boolean {
  switch (getLeadViewScope(a.role)) {
    case "ALL":
      return true;
    case "OWN":
      return lead.assignedToId === a.id;
    case "DESIGN_REQUEST":
      return lead.hasDesignRequest;
    default:
      return false;
  }
}

/**
 * Người thao tác có được làm hành động này trên Lead này không.
 *  - Xem: theo phạm vi xem.
 *  - Cập nhật/chuyển giao: Sales chỉ trên Lead mình phụ trách; Trưởng phòng
 *    Sales, Giám đốc, Quản trị viên trên mọi Lead.
 *  - Tài liệu: như trên, riêng Designer chỉ trên Lead có yêu cầu phối cảnh.
 */
export function canAccessLead(
  actor: Actor | null | undefined,
  action: LeadAction,
  lead: LeadAccessTarget
): boolean {
  let a: ResolvedActor;
  try {
    a = resolveActor(actor);
  } catch {
    return false;
  }
  if (!roleHasPermission(a.role, ACTION_PERMISSION[action])) return false;
  if (action === "VIEW") return inViewScope(a, lead);

  // Các hành động còn lại phải nằm trong phạm vi nhìn thấy trước.
  if (!inViewScope(a, lead)) return false;

  if (a.role === ROLE_CODE.SALES) return lead.assignedToId === a.id;
  if (a.role === ROLE_CODE.DESIGNER) {
    return (
      (action === "ATTACHMENT_VIEW" || action === "ATTACHMENT_UPLOAD") &&
      lead.hasDesignRequest
    );
  }
  return true; // Trưởng phòng Sales, Giám đốc, Quản trị viên
}

/**
 * Ném lỗi nếu không được phép.
 *  - Lead không tồn tại hoặc nằm ngoài phạm vi xem: NOT_FOUND (không tiết lộ Lead có tồn tại).
 *  - Xem được nhưng không đủ quyền thao tác: FORBIDDEN.
 */
export function assertLeadAccess(
  actor: Actor | null | undefined,
  action: LeadAction,
  lead: LeadAccessTarget | null | undefined
): ResolvedActor {
  const a = resolveActor(actor);
  if (!lead) throw new LeadAccessError("NOT_FOUND", "Không tìm thấy Lead");

  if (!roleHasPermission(a.role, PERMISSION.LEAD_VIEW_OWN) || !inViewScope(a, lead)) {
    // Vai trò không xem được Lead này (kể cả Designer với Lead ngoài phạm vi).
    // Riêng vai trò có quyền tài liệu nhưng không có quyền xem Lead đều đã được phủ ở trên.
    throw new LeadAccessError("NOT_FOUND", "Không tìm thấy Lead");
  }
  if (!canAccessLead(actor, action, lead)) {
    throw new LeadAccessError("FORBIDDEN", "Không đủ quyền thực hiện thao tác này");
  }
  return a;
}
