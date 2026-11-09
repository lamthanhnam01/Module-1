/**
 * Dịch vụ đính kèm tài liệu cho Lead (UC01 mục 4.3, E3; UC02 mục 4a).
 *
 * Quy tắc từ đặc tả:
 *  - Tải tệp hoặc thư mục, giữ nguyên cấu trúc thư mục.
 *  - Ghi lịch sử Lead khi đính kèm.
 *  - E3: tải lỗi thì KHÔNG gắn tệp lỗi vào Lead, vẫn giữ các tệp đã tải thành công
 *    và cho phép tải lại. Vì vậy mỗi tệp được xử lý độc lập, kết quả trả về theo từng tệp.
 *  - Lead chưa có tài liệu: báo "chưa có hình hiện trạng/tài liệu" (4a.1).
 */
import { randomUUID } from "node:crypto";
import {
  DEFAULT_ATTACHMENT_LIMITS,
  validateAttachmentFile,
  validateBatchLimits,
  type AttachmentErrorCode,
  type AttachmentKind,
  type AttachmentLimits,
  type IncomingFile,
} from "./attachment.validation";
import { LeadAccessError } from "./lead.errors";
import {
  assertLeadAccess,
  type Actor,
  type LeadAccessTarget,
} from "./lead.permissions";

// ---------------------------------------------------------------------------
// Cổng (ports)
// ---------------------------------------------------------------------------
export interface UploadedFile extends IncomingFile {
  /** Nội dung tệp. Adapter có thể truyền Buffer hoặc luồng đã đọc xong. */
  content: Uint8Array;
}

export interface AttachmentRecord {
  id: number;
  leadId: number;
  uploadedById: number;
  fileName: string;
  /** Thư mục tương đối, "" nếu ở gốc. */
  folderPath: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
}

export type NewAttachmentRecord = Omit<AttachmentRecord, "id" | "createdAt">;

export interface AttachmentStorage {
  save(storageKey: string, content: Uint8Array, mimeType: string): Promise<void>;
  remove(storageKey: string): Promise<void>;
}

export interface AttachmentRepository {
  create(record: NewAttachmentRecord): Promise<AttachmentRecord>;
  listByLead(leadId: number): Promise<AttachmentRecord[]>;
  findById(attachmentId: number): Promise<AttachmentRecord | null>;
}

export interface LeadLookup {
  findAccessTarget(leadId: number): Promise<LeadAccessTarget | null>;
}

export interface LeadHistoryEntry {
  leadId: number;
  actorId: number;
  action: "ATTACHMENT_ADDED";
  /** Mô tả ngắn để hiển thị trong lịch sử. */
  detail: string;
}

export interface LeadHistoryWriter {
  record(entry: LeadHistoryEntry): Promise<void>;
}

// ---------------------------------------------------------------------------
// Kết quả
// ---------------------------------------------------------------------------
export type UploadFailureCode = AttachmentErrorCode | "STORAGE_ERROR" | "DATABASE_ERROR";

export interface UploadFailure {
  /** Đường dẫn hiển thị: thư mục (nếu có) + tên tệp, để người dùng biết tệp nào lỗi. */
  displayName: string;
  code: UploadFailureCode;
  message: string;
}

export interface UploadResult {
  uploaded: AttachmentRecord[];
  failed: UploadFailure[];
  /** true nếu có ít nhất một tệp lỗi: giao diện nên cho phép "Tải lại". */
  canRetry: boolean;
}

export interface AttachmentListing {
  items: AttachmentRecord[];
  isEmpty: boolean;
  /** Thông báo cho trường hợp 4a.1; null nếu đã có tài liệu. */
  emptyMessage: string | null;
}

export interface FolderNode {
  name: string;
  path: string;
  folders: FolderNode[];
  files: AttachmentRecord[];
}

const EMPTY_MESSAGE = "Lead chưa có hình hiện trạng hoặc tài liệu đính kèm";

function displayName(folderPath: string, fileName: string): string {
  return folderPath === "" ? fileName : folderPath + "/" + fileName;
}

/** Dựng cây thư mục từ danh sách phẳng để giao diện hiển thị đúng cấu trúc đã tải lên. */
export function buildFolderTree(items: readonly AttachmentRecord[]): FolderNode {
  const root: FolderNode = { name: "", path: "", folders: [], files: [] };
  for (const item of items) {
    let node = root;
    if (item.folderPath !== "") {
      let current = "";
      for (const part of item.folderPath.split("/")) {
        current = current === "" ? part : current + "/" + part;
        let child = node.folders.find((f) => f.path === current);
        if (!child) {
          child = { name: part, path: current, folders: [], files: [] };
          node.folders.push(child);
        }
        node = child;
      }
    }
    node.files.push(item);
  }
  return root;
}

export interface AttachmentServiceDeps {
  leads: LeadLookup;
  repository: AttachmentRepository;
  storage: AttachmentStorage;
  history: LeadHistoryWriter;
  limits?: AttachmentLimits;
  /** Dùng để sinh tên lưu trữ; mặc định randomUUID. Cho phép thay khi kiểm thử. */
  generateId?: () => string;
}

export class AttachmentService {
  private readonly limits: AttachmentLimits;
  private readonly generateId: () => string;

  constructor(private readonly deps: AttachmentServiceDeps) {
    this.limits = deps.limits ?? DEFAULT_ATTACHMENT_LIMITS;
    this.generateId = deps.generateId ?? randomUUID;
  }

  /**
   * Tải lên một hoặc nhiều tệp (hoặc cả thư mục). Mỗi tệp độc lập: tệp lỗi
   * không làm mất các tệp đã tải thành công.
   */
  async upload(
    actor: Actor | null | undefined,
    leadId: number,
    files: readonly UploadedFile[]
  ): Promise<UploadResult> {
    const target = await this.deps.leads.findAccessTarget(leadId);
    const who = assertLeadAccess(actor, "ATTACHMENT_UPLOAD", target);

    const batch = validateBatchLimits(files, this.limits);
    if (!batch.ok) {
      return {
        uploaded: [],
        failed: [{ displayName: "(cả lần tải)", code: batch.code, message: batch.message }],
        canRetry: true,
      };
    }

    const uploaded: AttachmentRecord[] = [];
    const failed: UploadFailure[] = [];

    for (const file of files) {
      const shown = displayName(file.folderPath ?? "", file.originalName);
      const checked = validateAttachmentFile(file, this.limits);
      if (!checked.ok) {
        failed.push({ displayName: shown, code: checked.code, message: checked.message });
        continue;
      }
      const v = checked.value;
      const storageKey = "leads/" + leadId + "/" + this.generateId() + "." + v.extension;

      try {
        await this.deps.storage.save(storageKey, file.content, v.mimeType);
      } catch {
        failed.push({
          displayName: shown,
          code: "STORAGE_ERROR",
          message: "Lỗi lưu trữ, tệp chưa được gắn vào Lead",
        });
        continue;
      }

      try {
        const record = await this.deps.repository.create({
          leadId,
          uploadedById: who.id,
          fileName: v.fileName,
          folderPath: v.folderPath,
          kind: v.kind,
          mimeType: v.mimeType,
          size: v.size,
          storageKey,
        });
        uploaded.push(record);
      } catch {
        // Không để lại tệp "mồ côi" trong kho lưu trữ.
        try {
          await this.deps.storage.remove(storageKey);
        } catch {
          // Bỏ qua: tệp mồ côi sẽ được dọn bằng tác vụ định kỳ.
        }
        failed.push({
          displayName: shown,
          code: "DATABASE_ERROR",
          message: "Lỗi ghi dữ liệu, tệp chưa được gắn vào Lead",
        });
      }
    }

    if (uploaded.length > 0) {
      try {
        await this.deps.history.record({
          leadId,
          actorId: who.id,
          action: "ATTACHMENT_ADDED",
          detail:
            "Đính kèm " +
            uploaded.length +
            " tệp: " +
            uploaded
              .slice(0, 5)
              .map((r) => displayName(r.folderPath, r.fileName))
              .join(", ") +
            (uploaded.length > 5 ? ", ..." : ""),
        });
      } catch {
        // Tệp đã gắn thành công; lỗi ghi lịch sử không được làm mất kết quả tải.
        // Adapter nên tự ghi nhật ký lỗi để quản trị viên xử lý.
      }
    }

    return { uploaded, failed, canRetry: failed.length > 0 };
  }

  /** Danh sách tài liệu của Lead (4a). */
  async list(actor: Actor | null | undefined, leadId: number): Promise<AttachmentListing> {
    const target = await this.deps.leads.findAccessTarget(leadId);
    assertLeadAccess(actor, "ATTACHMENT_VIEW", target);
    const items = await this.deps.repository.listByLead(leadId);
    return {
      items,
      isEmpty: items.length === 0,
      emptyMessage: items.length === 0 ? EMPTY_MESSAGE : null,
    };
  }

  /**
   * Lấy thông tin để tải một tệp về. Route cần trả về với các tiêu đề:
   *   Content-Disposition: attachment; filename*=UTF-8''<tên đã mã hóa>
   *   X-Content-Type-Options: nosniff
   * để trình duyệt không tự mở/chạy nội dung.
   */
  async getForDownload(
    actor: Actor | null | undefined,
    leadId: number,
    attachmentId: number
  ): Promise<AttachmentRecord> {
    const target = await this.deps.leads.findAccessTarget(leadId);
    assertLeadAccess(actor, "ATTACHMENT_VIEW", target);
    const record = await this.deps.repository.findById(attachmentId);
    // So khớp leadId để không tải được tệp của Lead khác bằng cách đổi attachmentId.
    if (!record || record.leadId !== leadId) {
      throw new LeadAccessError("NOT_FOUND", "Không tìm thấy tệp");
    }
    return record;
  }
}
