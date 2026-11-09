import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AttachmentService,
  buildFolderTree,
  type AttachmentRecord,
  type AttachmentRepository,
  type AttachmentStorage,
  type LeadHistoryEntry,
  type LeadHistoryWriter,
  type LeadLookup,
  type NewAttachmentRecord,
  type UploadedFile,
} from "../attachment.service";
import { LeadAccessError } from "../lead.errors";
import type { Actor, LeadAccessTarget } from "../lead.permissions";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]);

function upload(name: string, folder = "", header: Uint8Array = JPEG): UploadedFile {
  return {
    originalName: name,
    folderPath: folder,
    mimeType: "image/jpeg",
    size: 2048,
    header,
    content: new Uint8Array(2048),
  };
}

interface Options {
  failStorageFor?: string; // một đoạn của tên lưu trữ làm lưu thất bại
  failDbFor?: string; // tên tệp làm ghi CSDL thất bại
  failHistory?: boolean;
  leads?: Record<number, LeadAccessTarget>;
}

function setup(opts: Options = {}) {
  const stored = new Map<string, Uint8Array>();
  const records: AttachmentRecord[] = [];
  const history: LeadHistoryEntry[] = [];
  let seq = 0;
  let uid = 0;

  const leads: LeadLookup = {
    async findAccessTarget(id) {
      const all = opts.leads ?? { 1: { id: 1, assignedToId: 5, hasDesignRequest: false } };
      return all[id] ?? null;
    },
  };
  const storage: AttachmentStorage = {
    async save(key, content) {
      if (opts.failStorageFor && key.includes(opts.failStorageFor)) throw new Error("disk full");
      stored.set(key, content);
    },
    async remove(key) {
      stored.delete(key);
    },
  };
  const repository: AttachmentRepository = {
    async create(rec: NewAttachmentRecord) {
      if (opts.failDbFor && rec.fileName === opts.failDbFor) throw new Error("db down");
      const r: AttachmentRecord = { ...rec, id: ++seq, createdAt: new Date("2026-11-09T00:00:00Z") };
      records.push(r);
      return r;
    },
    async listByLead(leadId) {
      return records.filter((r) => r.leadId === leadId);
    },
    async findById(id) {
      return records.find((r) => r.id === id) ?? null;
    },
  };
  const historyWriter: LeadHistoryWriter = {
    async record(e) {
      if (opts.failHistory) throw new Error("history down");
      history.push(e);
    },
  };
  const service = new AttachmentService({
    leads,
    repository,
    storage,
    history: historyWriter,
    generateId: () => "id" + ++uid,
  });
  return { service, stored, records, history };
}

const sales: Actor = { id: 5, roleCode: "SALES" };

test("tải nhiều tệp và cả thư mục: giữ cấu trúc, ghi một dòng lịch sử", async () => {
  const { service, records, history, stored } = setup();
  const res = await service.upload(sales, 1, [
    upload("a.jpg"),
    upload("b.jpg", "Hien trang/Tang 1"),
    upload("c.jpg", "Hien trang/Tang 2"),
  ]);
  assert.equal(res.uploaded.length, 3);
  assert.equal(res.failed.length, 0);
  assert.equal(res.canRetry, false);
  assert.equal(records[1]!.folderPath, "Hien trang/Tang 1");
  assert.equal(stored.size, 3);
  assert.equal(history.length, 1);
  assert.equal(history[0]!.action, "ATTACHMENT_ADDED");
  assert.match(history[0]!.detail, /3 tệp/);
});

test("tên lưu trữ do máy chủ sinh, không chứa tên người dùng đặt", async () => {
  const { service, records } = setup();
  await service.upload(sales, 1, [upload("../../etc/passwd.jpg", "x")]);
  const key = records[0]!.storageKey;
  assert.equal(key, "leads/1/id1.jpg");
  assert.equal(key.includes("passwd"), false);
});

test("E3: một tệp không hợp lệ không làm mất các tệp còn lại", async () => {
  const { service, records } = setup();
  const res = await service.upload(sales, 1, [
    upload("ok1.jpg"),
    upload("virus.jpg", "", EXE),
    upload("ok2.jpg"),
    upload("macro.exe"),
  ]);
  assert.equal(res.uploaded.length, 2);
  assert.equal(res.failed.length, 2);
  assert.equal(res.canRetry, true);
  assert.deepEqual(res.failed.map((f) => f.displayName).sort(), ["macro.exe", "virus.jpg"]);
  assert.equal(records.length, 2);
});

test("E3: lỗi lưu trữ - không gắn tệp lỗi vào Lead, giữ tệp thành công, cho tải lại", async () => {
  const { service, records, stored } = setup({ failStorageFor: "id2" });
  const res = await service.upload(sales, 1, [upload("a.jpg"), upload("b.jpg"), upload("c.jpg")]);
  assert.equal(res.uploaded.length, 2);
  assert.equal(res.failed.length, 1);
  assert.equal(res.failed[0]!.code, "STORAGE_ERROR");
  assert.equal(res.failed[0]!.displayName, "b.jpg");
  assert.equal(res.canRetry, true);
  assert.equal(records.length, 2);
  assert.equal(stored.size, 2);
});

test("lỗi ghi CSDL: xóa tệp đã lưu để không để lại tệp mồ côi", async () => {
  const { service, records, stored } = setup({ failDbFor: "b.jpg" });
  const res = await service.upload(sales, 1, [upload("a.jpg"), upload("b.jpg")]);
  assert.equal(res.uploaded.length, 1);
  assert.equal(res.failed[0]!.code, "DATABASE_ERROR");
  assert.equal(records.length, 1);
  assert.equal(stored.size, 1);
});

test("lỗi ghi lịch sử không làm mất kết quả tải", async () => {
  const { service } = setup({ failHistory: true });
  const res = await service.upload(sales, 1, [upload("a.jpg")]);
  assert.equal(res.uploaded.length, 1);
});

test("tất cả tệp lỗi thì không ghi lịch sử", async () => {
  const { service, history } = setup();
  const res = await service.upload(sales, 1, [upload("x.exe")]);
  assert.equal(res.uploaded.length, 0);
  assert.equal(history.length, 0);
});

test("quá giới hạn số tệp mỗi lần tải: từ chối cả lần, không lưu gì", async () => {
  const { service, stored } = setup();
  const files = Array.from({ length: 201 }, (_, i) => upload("f" + i + ".jpg"));
  const res = await service.upload(sales, 1, files);
  assert.equal(res.uploaded.length, 0);
  assert.equal(res.failed[0]!.code, "TOO_MANY_FILES");
  assert.equal(stored.size, 0);
});

test("phân quyền khi tải: Sales khác (404), Marketing (403), chưa đăng nhập (401), Designer đúng Lead (được)", async () => {
  const lead: Record<number, LeadAccessTarget> = {
    1: { id: 1, assignedToId: 5, hasDesignRequest: false },
    2: { id: 2, assignedToId: 5, hasDesignRequest: true },
  };
  const { service } = setup({ leads: lead });
  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return "ok";
    } catch (e) {
      return e instanceof LeadAccessError ? e.code : "other";
    }
  };
  assert.equal(await code(service.upload({ id: 6, roleCode: "SALES" }, 1, [upload("a.jpg")])), "NOT_FOUND");
  assert.equal(await code(service.upload({ id: 20, roleCode: "MARKETING" }, 1, [upload("a.jpg")])), "FORBIDDEN");
  assert.equal(await code(service.upload(null, 1, [upload("a.jpg")])), "UNAUTHENTICATED");
  assert.equal(await code(service.upload(sales, 999, [upload("a.jpg")])), "NOT_FOUND");
  assert.equal(await code(service.upload({ id: 9, roleCode: "DESIGNER" }, 1, [upload("a.jpg")])), "NOT_FOUND");
  assert.equal(await code(service.upload({ id: 9, roleCode: "DESIGNER" }, 2, [upload("a.jpg")])), "ok");
  assert.equal(await code(service.upload({ id: 1, roleCode: "SALES_HEAD" }, 1, [upload("b.jpg")])), "ok");
});

test("4a.1: Lead chưa có tài liệu -> thông báo; có rồi -> danh sách", async () => {
  const { service } = setup();
  const empty = await service.list(sales, 1);
  assert.equal(empty.isEmpty, true);
  assert.match(empty.emptyMessage ?? "", /chưa có hình hiện trạng/);
  await service.upload(sales, 1, [upload("a.jpg")]);
  const after = await service.list(sales, 1);
  assert.equal(after.isEmpty, false);
  assert.equal(after.emptyMessage, null);
  assert.equal(after.items.length, 1);
});

test("Marketing không xem được tài liệu (ma trận RBAC)", async () => {
  const { service } = setup();
  await assert.rejects(
    () => service.list({ id: 20, roleCode: "MARKETING" }, 1),
    (e) => e instanceof LeadAccessError && e.code === "FORBIDDEN"
  );
});

test("tải về: không lấy được tệp của Lead khác bằng cách đổi attachmentId", async () => {
  const leads: Record<number, LeadAccessTarget> = {
    1: { id: 1, assignedToId: 5, hasDesignRequest: false },
    2: { id: 2, assignedToId: 5, hasDesignRequest: false },
  };
  const { service } = setup({ leads });
  const up = await service.upload(sales, 1, [upload("a.jpg")]);
  const id = up.uploaded[0]!.id;
  const ok = await service.getForDownload(sales, 1, id);
  assert.equal(ok.fileName, "a.jpg");
  await assert.rejects(
    () => service.getForDownload(sales, 2, id),
    (e) => e instanceof LeadAccessError && e.code === "NOT_FOUND"
  );
  await assert.rejects(() => service.getForDownload(sales, 1, 12345), LeadAccessError);
});

test("dựng cây thư mục từ danh sách phẳng", () => {
  const mk = (id: number, folderPath: string, fileName: string): AttachmentRecord => ({
    id,
    leadId: 1,
    uploadedById: 5,
    fileName,
    folderPath,
    kind: "IMAGE",
    mimeType: "image/jpeg",
    size: 1,
    storageKey: "k" + id,
    createdAt: new Date(0),
  });
  const tree = buildFolderTree([
    mk(1, "", "goc.jpg"),
    mk(2, "A", "a1.jpg"),
    mk(3, "A/B", "b1.jpg"),
    mk(4, "A/B", "b2.jpg"),
    mk(5, "C", "c1.jpg"),
  ]);
  assert.deepEqual(tree.files.map((f) => f.fileName), ["goc.jpg"]);
  assert.deepEqual(tree.folders.map((f) => f.path), ["A", "C"]);
  const a = tree.folders[0]!;
  assert.deepEqual(a.files.map((f) => f.fileName), ["a1.jpg"]);
  assert.equal(a.folders[0]!.path, "A/B");
  assert.equal(a.folders[0]!.files.length, 2);
});
