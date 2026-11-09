/**
 * Dịch vụ kiểm tra trùng Lead (UC01 - E0), ghép luật thuần túy với các "cổng"
 * (repository, kiểm tra NVKD còn nhận Lead, gửi thông báo).
 *
 * Dịch vụ không phụ thuộc Prisma hay Next.js: nhóm nối vào bằng cách viết các
 * adapter cho 3 interface bên dưới (xem INTEGRATION_NOTES.md).
 */
import { buildLeadKeys, normalizeEmail } from "./company-name";
import {
  evaluateDuplicate,
  type DuplicateCandidate,
  type DuplicateResult,
  type ExistingLead,
} from "./duplicate.rules";
import type { DuplicateFlag } from "./lead.constants";

// ---------------------------------------------------------------------------
// Cổng (ports)
// ---------------------------------------------------------------------------
export interface DuplicateQuery {
  companyKey: string | null;
  projectKey: string | null;
  normalizedPhone: string | null;
  emailKey: string | null;
  excludeLeadId?: number;
}

export interface DuplicateLeadRepository {
  /**
   * Trả về các Lead có thể trùng (thu hẹp bằng chỉ mục ở cơ sở dữ liệu):
   * cùng companyKey, hoặc (khi không có companyKey) cùng SĐT/email.
   * Có thể trả dư; luật thuần túy sẽ lọc lại.
   */
  findPotentialDuplicates(query: DuplicateQuery): Promise<ExistingLead[]>;
}

export interface AssigneeAvailability {
  /** Trong danh sách userIds, trả về những NVKD không còn nhận Lead. */
  getUnavailableUserIds(userIds: number[]): Promise<number[]>;
}

export interface DuplicateNotification {
  recipientUserId: number;
  /** Lead mới (hoặc Lead vừa sửa) gây ra cảnh báo trùng. */
  leadId: number;
  /** Lead cũ để người nhận bấm vào xem. */
  oldLeadId: number;
  flag: DuplicateFlag;
}

export interface DuplicateNotifier {
  notify(notification: DuplicateNotification): Promise<void>;
}

// ---------------------------------------------------------------------------
// Kiểu dữ liệu vào/ra
// ---------------------------------------------------------------------------
export interface LeadIdentityInput {
  phone: string | null | undefined; // SĐT đã chuẩn hóa (normalizedPhone)
  email?: string | null;
  companyName?: string | null;
  projectName?: string | null;
}

export interface PlannedNotification {
  recipientUserId: number;
  oldLeadId: number;
  flag: DuplicateFlag;
}

export interface DuplicateCheckOutcome {
  result: DuplicateResult;
  /** Các khóa đã tính, lưu vào cột companyKey/projectKey/emailKey của Lead. */
  keys: {
    companyKey: string | null;
    projectKey: string | null;
    emailKey: string | null;
  };
  /** Thông báo cần gửi sau khi Lead đã được lưu và có id. */
  plannedNotifications: PlannedNotification[];
}

function toCandidate(
  input: LeadIdentityInput,
  leadId?: number
): { candidate: DuplicateCandidate; emailKey: string | null } {
  const { companyKey, projectKey } = buildLeadKeys(input);
  const emailKey = normalizeEmail(input.email);
  const phone =
    typeof input.phone === "string" && input.phone.trim() !== ""
      ? input.phone.trim()
      : null;
  const candidate: DuplicateCandidate = {
    companyKey,
    projectKey,
    normalizedPhone: phone,
    emailKey,
  };
  if (leadId !== undefined) candidate.id = leadId;
  return { candidate, emailKey };
}

function uniqueRecipients(
  ids: Array<number | null | undefined>,
  oldLeadId: number,
  flag: DuplicateFlag
): PlannedNotification[] {
  const seen = new Set<number>();
  const out: PlannedNotification[] = [];
  for (const id of ids) {
    if (typeof id !== "number" || seen.has(id)) continue;
    seen.add(id);
    out.push({ recipientUserId: id, oldLeadId, flag });
  }
  return out;
}

export class DuplicateService {
  constructor(
    private readonly leads: DuplicateLeadRepository,
    private readonly availability: AssigneeAvailability,
    private readonly notifier: DuplicateNotifier
  ) {}

  private async evaluate(
    candidate: DuplicateCandidate,
    emailKey: string | null
  ): Promise<DuplicateResult> {
    const query: DuplicateQuery = {
      companyKey: candidate.companyKey,
      projectKey: candidate.projectKey,
      normalizedPhone: candidate.normalizedPhone,
      emailKey,
    };
    if (candidate.id !== undefined) query.excludeLeadId = candidate.id;

    const existing = await this.leads.findPotentialDuplicates(query);

    // Chỉ cần hỏi tình trạng của chủ các Lead cũ đang mở hoặc đã chốt.
    const ownerIds = [
      ...new Set(
        existing
          .map((l) => l.assignedToId)
          .filter((id): id is number => typeof id === "number")
      ),
    ];
    const unavailable =
      ownerIds.length > 0
        ? new Set(await this.availability.getUnavailableUserIds(ownerIds))
        : new Set<number>();

    return evaluateDuplicate(candidate, existing, {
      unavailableUserIds: unavailable,
    });
  }

  /**
   * Gọi khi tạo Lead mới (tự động hoặc thủ công), TRƯỚC khi lưu.
   *  - Lead tự động: nếu Lead cũ đang do A chăm sóc hoặc đã được A chốt thì
   *    result.assignment cho biết phân cho A và gửi thông báo cho A.
   *  - Lead thủ công: người nhập vẫn là người phụ trách; thông báo cho cả A
   *    và người nhập, việc quyết định ai xử lý thực hiện ở UC02.
   */
  async checkNewLead(input: {
    lead: LeadIdentityInput;
    isAutoLead: boolean;
    creatorId?: number;
  }): Promise<DuplicateCheckOutcome> {
    const { candidate, emailKey } = toCandidate(input.lead);
    const result = await this.evaluate(candidate, emailKey);
    const keys = {
      companyKey: candidate.companyKey,
      projectKey: candidate.projectKey,
      emailKey,
    };

    const planned: PlannedNotification[] = [];
    if (result.flag !== null && result.oldLeadId !== null) {
      const oldOwner = result.matches[0]?.assignedToId ?? null;
      if (input.isAutoLead) {
        if (result.assignment.mode === "OLD_OWNER") {
          planned.push(
            ...uniqueRecipients(
              [result.assignment.userId],
              result.oldLeadId,
              result.flag
            )
          );
        }
      } else {
        planned.push(
          ...uniqueRecipients(
            [oldOwner, input.creatorId],
            result.oldLeadId,
            result.flag
          )
        );
      }
    }
    return { result, keys, plannedNotifications: planned };
  }

  /**
   * Gọi khi NVKD sửa SĐT/Tên công ty/Tên dự án (4.2). Không tự chuyển Lead:
   * nếu Lead đang thuộc B khác A (chủ Lead cũ) thì chỉ thông báo cho A và B.
   */
  async recheckAfterEdit(input: {
    leadId: number;
    lead: LeadIdentityInput;
    currentOwnerId: number | null;
  }): Promise<DuplicateCheckOutcome> {
    const { candidate, emailKey } = toCandidate(input.lead, input.leadId);
    const result = await this.evaluate(candidate, emailKey);
    const keys = {
      companyKey: candidate.companyKey,
      projectKey: candidate.projectKey,
      emailKey,
    };

    const planned: PlannedNotification[] = [];
    if (result.flag !== null && result.oldLeadId !== null) {
      const oldOwner = result.matches[0]?.assignedToId ?? null;
      const differentOwners =
        oldOwner !== null &&
        input.currentOwnerId !== null &&
        oldOwner !== input.currentOwnerId;
      if (differentOwners) {
        planned.push(
          ...uniqueRecipients(
            [oldOwner, input.currentOwnerId],
            result.oldLeadId,
            result.flag
          )
        );
      }
    }
    return { result, keys, plannedNotifications: planned };
  }

  /** Gửi các thông báo đã lên kế hoạch sau khi Lead đã có id. */
  async publishNotifications(
    leadId: number,
    planned: readonly PlannedNotification[]
  ): Promise<void> {
    for (const p of planned) {
      await this.notifier.notify({
        recipientUserId: p.recipientUserId,
        leadId,
        oldLeadId: p.oldLeadId,
        flag: p.flag,
      });
    }
  }
}
