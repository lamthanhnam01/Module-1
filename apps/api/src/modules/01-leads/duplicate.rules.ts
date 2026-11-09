/**
 * Luật phát hiện Lead trùng (UC01 - E0) dưới dạng hàm thuần túy:
 * không truy cập cơ sở dữ liệu, không gửi thông báo, nên kiểm thử được ngay.
 *
 * Tóm tắt luật theo đặc tả:
 *  - Khớp theo Tên công ty + Tên dự án đã chuẩn hóa (xem company-name.ts).
 *    Lead mới không có Tên dự án thì chỉ khớp theo Tên công ty.
 *  - Lead mới chưa có Tên công ty thì đối chiếu SĐT và email.
 *  - Lead cũ đã đánh dấu Spam (hoặc đã xóa mềm) không dùng để xét trùng.
 *  - Không tự gộp Lead. Chỉ gắn cờ, hiển thị Lead cũ và gợi ý người phụ trách.
 */
import {
  DUPLICATE_FLAG,
  LEAD_STATUS,
  isOpenLeadStatus,
  type DuplicateFlag,
  type LeadStatus,
} from "./lead.constants";

/** Lead đã có trong hệ thống, chỉ gồm các trường cần cho việc xét trùng. */
export interface ExistingLead {
  id: number;
  status: LeadStatus;
  companyKey: string | null;
  projectKey: string | null;
  normalizedPhone: string | null;
  emailKey: string | null;
  assignedToId: number | null;
  isSpam: boolean;
  /** true nếu đã xóa mềm. */
  isDeleted?: boolean;
  createdAt: Date;
  /** Thời điểm chốt hoặc thất bại (dùng để chọn Lead "gần nhất"). */
  closedAt?: Date | null;
  /** Lý do thất bại, để hiển thị cùng Lead cũ. */
  failureReason?: string | null;
}

/** Lead đang được kiểm tra (đã chuẩn hóa khóa). */
export interface DuplicateCandidate {
  /** Có giá trị khi kiểm tra lại sau khi sửa (4.2) để loại chính nó. */
  id?: number;
  companyKey: string | null;
  projectKey: string | null;
  normalizedPhone: string | null;
  emailKey: string | null;
}

export type MatchBasis = "COMPANY_PROJECT" | "COMPANY_ONLY" | "PHONE_EMAIL";

export interface DuplicateMatch {
  leadId: number;
  status: LeadStatus;
  assignedToId: number | null;
  basis: MatchBasis;
  failureReason: string | null;
}

export type NormalAssignmentReason =
  | "NO_MATCH"
  | "OLD_LEAD_LOST"
  | "OLD_OWNER_MISSING"
  | "OLD_OWNER_UNAVAILABLE";

/** Quyết định phân công theo mục 1.4a/1.4b của đặc tả. */
export type AssignmentDecision =
  | { mode: "OLD_OWNER"; userId: number; oldLeadId: number }
  | { mode: "NORMAL"; reason: NormalAssignmentReason };

export interface DuplicateResult {
  flag: DuplicateFlag | null;
  /** true chỉ khi cờ là "Trùng" (Lead cũ còn ở "Vừa nhận thông tin"). */
  highlightRed: boolean;
  basis: MatchBasis | null;
  /** Lead cũ đại diện: đang mở gần nhất, nếu không có thì đã chốt gần nhất. */
  oldLeadId: number | null;
  /** Tất cả Lead cũ khớp, đã sắp xếp theo thứ tự ưu tiên ở trên. */
  matches: DuplicateMatch[];
  assignment: AssignmentDecision;
}

export interface EvaluateOptions {
  /** NVKD đang nghỉ phép, tạm ngưng nhận Lead hoặc đã nghỉ việc. */
  unavailableUserIds?: ReadonlySet<number>;
}

function sameKey(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a === b;
}

function matchBasis(
  candidate: DuplicateCandidate,
  old: ExistingLead
): MatchBasis | null {
  if (candidate.companyKey !== null) {
    if (!sameKey(candidate.companyKey, old.companyKey)) return null;
    if (candidate.projectKey === null) return "COMPANY_ONLY";
    return sameKey(candidate.projectKey, old.projectKey)
      ? "COMPANY_PROJECT"
      : null;
  }
  // Lead chưa có Tên công ty: đối chiếu SĐT và email.
  if (
    sameKey(candidate.normalizedPhone, old.normalizedPhone) ||
    sameKey(candidate.emailKey, old.emailKey)
  ) {
    return "PHONE_EMAIL";
  }
  return null;
}

/** 0 = đang mở, 1 = đã chốt thành công, 2 = thất bại. */
function statusRank(status: LeadStatus): number {
  if (isOpenLeadStatus(status)) return 0;
  return status === LEAD_STATUS.WON ? 1 : 2;
}

function recencyTime(lead: ExistingLead): number {
  const t = lead.status === LEAD_STATUS.WON || lead.status === LEAD_STATUS.LOST
    ? (lead.closedAt ?? lead.createdAt)
    : lead.createdAt;
  return t.getTime();
}

function compareMatches(a: ExistingLead, b: ExistingLead): number {
  const byRank = statusRank(a.status) - statusRank(b.status);
  if (byRank !== 0) return byRank;
  const byTime = recencyTime(b) - recencyTime(a); // mới hơn đứng trước
  if (byTime !== 0) return byTime;
  return b.id - a.id;
}

function flagFor(
  basis: MatchBasis,
  matched: ExistingLead[]
): { flag: DuplicateFlag; highlightRed: boolean } {
  if (basis === "PHONE_EMAIL") {
    return { flag: DUPLICATE_FLAG.SAME_PHONE_EMAIL, highlightRed: false };
  }
  // Chỉ cần một Lead cũ còn ở "Vừa nhận thông tin" là cắm cờ đỏ,
  // vì Lead đó chưa ai tiếp nhận và dễ bị hai NVKD cùng chăm sóc.
  const hasUntouched = matched.some((l) => l.status === LEAD_STATUS.NEW);
  return hasUntouched
    ? { flag: DUPLICATE_FLAG.DUPLICATE, highlightRed: true }
    : { flag: DUPLICATE_FLAG.HAS_OLD_LEAD, highlightRed: false };
}

export function evaluateDuplicate(
  candidate: DuplicateCandidate,
  existing: readonly ExistingLead[],
  options: EvaluateOptions = {}
): DuplicateResult {
  const matched: Array<{ lead: ExistingLead; basis: MatchBasis }> = [];
  for (const old of existing) {
    if (old.isSpam || old.isDeleted) continue;
    if (candidate.id !== undefined && old.id === candidate.id) continue;
    const basis = matchBasis(candidate, old);
    if (basis !== null) matched.push({ lead: old, basis });
  }

  if (matched.length === 0) {
    return {
      flag: null,
      highlightRed: false,
      basis: null,
      oldLeadId: null,
      matches: [],
      assignment: { mode: "NORMAL", reason: "NO_MATCH" },
    };
  }

  matched.sort((x, y) => compareMatches(x.lead, y.lead));
  const rep = matched[0]!;
  const { flag, highlightRed } = flagFor(
    rep.basis,
    matched.map((m) => m.lead)
  );

  let assignment: AssignmentDecision;
  if (rep.lead.status === LEAD_STATUS.LOST) {
    assignment = { mode: "NORMAL", reason: "OLD_LEAD_LOST" };
  } else if (rep.lead.assignedToId === null) {
    assignment = { mode: "NORMAL", reason: "OLD_OWNER_MISSING" };
  } else if (options.unavailableUserIds?.has(rep.lead.assignedToId)) {
    assignment = { mode: "NORMAL", reason: "OLD_OWNER_UNAVAILABLE" };
  } else {
    assignment = {
      mode: "OLD_OWNER",
      userId: rep.lead.assignedToId,
      oldLeadId: rep.lead.id,
    };
  }

  return {
    flag,
    highlightRed,
    basis: rep.basis,
    oldLeadId: rep.lead.id,
    matches: matched.map((m) => ({
      leadId: m.lead.id,
      status: m.lead.status,
      assignedToId: m.lead.assignedToId,
      basis: m.basis,
      failureReason: m.lead.failureReason ?? null,
    })),
    assignment,
  };
}
