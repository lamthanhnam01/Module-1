/**
 * Màn hình xem tiến độ Lead ở chế độ chỉ đọc (UC01 mục 3.2).
 *
 * Nhân viên Marketing và Ads xem được thông tin nguồn đổ về để đánh giá quảng cáo
 * nhưng không được sửa. Dịch vụ này:
 *  - luôn áp dụng bộ lọc phạm vi theo vai trò ở tầng truy vấn;
 *  - loại Lead đã đánh dấu Spam khỏi danh sách và số liệu pipeline;
 *  - trả về cờ readOnly/canEdit để giao diện chỉ hiện nút khi được phép.
 */
import {
  DUPLICATE_FLAG_LABEL,
  LEAD_STATUS,
  LEAD_STATUS_LABEL,
  isLeadStatus,
  type DuplicateFlag,
  type LeadStatus,
} from "./lead.constants";
import {
  assertCan,
  buildLeadVisibilityFilter,
  canAccessLead,
  PERMISSION,
  type Actor,
  type LeadVisibilityFilter,
} from "./lead.permissions";

export interface LeadProgressFilter {
  status?: string;
  sourceId?: number;
  productId?: number;
  assignedToId?: number;
  /** Tìm theo SĐT, tên công ty, tên dự án. */
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page?: number;
  pageSize?: number;
}

/** Bộ lọc đã làm sạch, truyền xuống tầng truy vấn. */
export interface SanitizedProgressFilter {
  status?: LeadStatus;
  sourceId?: number;
  productId?: number;
  assignedToId?: number;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  pageSize: number;
  /** Luôn false: Lead Spam không nằm trong danh sách làm việc và số liệu pipeline. */
  includeSpam: false;
}

export interface LeadProgressSourceRow {
  id: number;
  phone: string;
  companyName: string | null;
  projectName: string | null;
  source: { id: number; name: string } | null;
  product: { id: number; name: string } | null;
  assignedTo: { id: number; name: string } | null;
  status: LeadStatus;
  failureReason: string | null;
  duplicateFlag: DuplicateFlag | null;
  hasDesignRequest: boolean;
  createdAt: Date;
}

export interface LeadProgressRepository {
  findMany(
    visibility: LeadVisibilityFilter,
    filter: SanitizedProgressFilter
  ): Promise<{ rows: LeadProgressSourceRow[]; total: number }>;
  countByStatus(
    visibility: LeadVisibilityFilter,
    filter: SanitizedProgressFilter
  ): Promise<Partial<Record<LeadStatus, number>>>;
}

export interface LeadProgressRow extends LeadProgressSourceRow {
  statusLabel: string;
  duplicateFlagLabel: string | null;
  /** Chỉ cờ "Trùng" được tô đỏ. */
  highlightRed: boolean;
  /** Giao diện này luôn chỉ đọc; canEdit cho biết người xem có thể sửa ở màn khác không. */
  readOnly: true;
  canEdit: boolean;
}

export interface LeadProgressPage {
  rows: LeadProgressRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  countsByStatus: Record<LeadStatus, number>;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function validDate(value: unknown): Date | undefined {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : undefined;
}

/** Làm sạch bộ lọc từ yêu cầu của người dùng; giá trị sai bị bỏ qua thay vì ném lỗi. */
export function sanitizeProgressFilter(input: LeadProgressFilter = {}): SanitizedProgressFilter {
  const out: SanitizedProgressFilter = {
    page: positiveInt(input.page) ?? 1,
    pageSize: Math.min(positiveInt(input.pageSize) ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    includeSpam: false,
  };
  if (isLeadStatus(input.status)) out.status = input.status;
  const sourceId = positiveInt(input.sourceId);
  if (sourceId !== undefined) out.sourceId = sourceId;
  const productId = positiveInt(input.productId);
  if (productId !== undefined) out.productId = productId;
  const assignedToId = positiveInt(input.assignedToId);
  if (assignedToId !== undefined) out.assignedToId = assignedToId;
  if (typeof input.search === "string") {
    const s = input.search.trim().slice(0, MAX_SEARCH_LENGTH);
    if (s !== "") out.search = s;
  }
  const from = validDate(input.createdFrom);
  if (from) out.createdFrom = from;
  const to = validDate(input.createdTo);
  if (to) out.createdTo = to;
  return out;
}

function emptyCounts(): Record<LeadStatus, number> {
  return {
    [LEAD_STATUS.NEW]: 0,
    [LEAD_STATUS.QUOTING]: 0,
    [LEAD_STATUS.QUOTE_SENT]: 0,
    [LEAD_STATUS.WON]: 0,
    [LEAD_STATUS.LOST]: 0,
  };
}

export class LeadProgressService {
  constructor(private readonly repository: LeadProgressRepository) {}

  async list(actor: Actor | null | undefined, input: LeadProgressFilter = {}): Promise<LeadProgressPage> {
    // Cần ít nhất quyền xem Lead; phạm vi do bộ lọc quyết định.
    assertCan(actor, PERMISSION.LEAD_VIEW_OWN);
    const visibility = buildLeadVisibilityFilter(actor);
    const filter = sanitizeProgressFilter(input);

    const [{ rows, total }, counts] = await Promise.all([
      this.repository.findMany(visibility, filter),
      this.repository.countByStatus(visibility, filter),
    ]);

    const countsByStatus = emptyCounts();
    for (const status of Object.values(LEAD_STATUS)) {
      const n = counts[status];
      if (typeof n === "number" && n > 0) countsByStatus[status] = n;
    }

    return {
      rows: rows.map((r) => ({
        ...r,
        statusLabel: LEAD_STATUS_LABEL[r.status],
        duplicateFlagLabel: r.duplicateFlag ? DUPLICATE_FLAG_LABEL[r.duplicateFlag] : null,
        highlightRed: r.duplicateFlag === "DUPLICATE",
        readOnly: true,
        canEdit: canAccessLead(actor, "UPDATE_PROGRESS", {
          id: r.id,
          assignedToId: r.assignedTo?.id ?? null,
          hasDesignRequest: r.hasDesignRequest,
        }),
      })),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
      countsByStatus,
    };
  }
}
