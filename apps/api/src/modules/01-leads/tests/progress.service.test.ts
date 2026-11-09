import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LeadProgressService,
  sanitizeProgressFilter,
  type LeadProgressRepository,
  type LeadProgressSourceRow,
  type SanitizedProgressFilter,
} from "../progress.service";
import { LEAD_STATUS } from "../lead.constants";
import { LeadAccessError } from "../lead.errors";
import type { LeadVisibilityFilter } from "../lead.permissions";

function row(id: number, over: Partial<LeadProgressSourceRow> = {}): LeadProgressSourceRow {
  return {
    id,
    phone: "0911111111",
    companyName: "ABC",
    projectName: "P",
    source: { id: 1, name: "Website" },
    product: { id: 2, name: "Màn LED" },
    assignedTo: { id: 5, name: "Sales A" },
    status: LEAD_STATUS.NEW,
    failureReason: null,
    duplicateFlag: null,
    hasDesignRequest: false,
    createdAt: new Date("2026-11-01T00:00:00Z"),
    ...over,
  };
}

function setup(rows: LeadProgressSourceRow[]) {
  const calls: Array<{ visibility: LeadVisibilityFilter; filter: SanitizedProgressFilter }> = [];
  const repo: LeadProgressRepository = {
    async findMany(visibility, filter) {
      calls.push({ visibility, filter });
      return { rows, total: rows.length };
    },
    async countByStatus() {
      return { NEW: 2, WON: 1 };
    },
  };
  return { service: new LeadProgressService(repo), calls };
}

test("Marketing xem tất cả Lead, chỉ đọc, không có quyền sửa", async () => {
  const { service, calls } = setup([row(1), row(2, { status: LEAD_STATUS.LOST, failureReason: "Giá cao" })]);
  const page = await service.list({ id: 20, roleCode: "MARKETING" });
  assert.deepEqual(calls[0]!.visibility, { kind: "ALL" });
  assert.equal(page.rows.length, 2);
  for (const r of page.rows) {
    assert.equal(r.readOnly, true);
    assert.equal(r.canEdit, false);
  }
  assert.equal(page.rows[1]!.statusLabel, "Thất bại");
  assert.equal(page.rows[1]!.failureReason, "Giá cao");
});

test("Sales chỉ bị lọc theo Lead của mình và chỉ sửa được Lead của mình", async () => {
  const { service, calls } = setup([row(1), row(2, { assignedTo: { id: 6, name: "Sales B" } })]);
  const page = await service.list({ id: 5, roleCode: "SALES" });
  assert.deepEqual(calls[0]!.visibility, { kind: "ASSIGNED_TO", userId: 5 });
  assert.equal(page.rows[0]!.canEdit, true);
  assert.equal(page.rows[1]!.canEdit, false); // phòng hờ nếu tầng truy vấn trả dư
});

test("Designer bị lọc theo yêu cầu phối cảnh", async () => {
  const { service, calls } = setup([]);
  await service.list({ id: 9, roleCode: "DESIGNER" });
  assert.deepEqual(calls[0]!.visibility, { kind: "DESIGN_REQUEST" });
});

test("cờ Trùng tô đỏ, cờ 'Đã có Lead cũ' không tô đỏ", async () => {
  const { service } = setup([
    row(1, { duplicateFlag: "DUPLICATE" }),
    row(2, { duplicateFlag: "HAS_OLD_LEAD" }),
    row(3, { duplicateFlag: "SAME_PHONE_EMAIL" }),
    row(4),
  ]);
  const page = await service.list({ id: 1, roleCode: "ADMIN" });
  assert.deepEqual(page.rows.map((r) => r.highlightRed), [true, false, false, false]);
  assert.deepEqual(page.rows.map((r) => r.duplicateFlagLabel), [
    "Trùng",
    "Đã có Lead cũ",
    "Cùng SĐT/email với Lead cũ",
    null,
  ]);
});

test("luôn loại Lead Spam, kể cả khi người dùng cố truyền tham số", async () => {
  const { service, calls } = setup([]);
  await service.list({ id: 1, roleCode: "ADMIN" }, { includeSpam: true } as never);
  assert.equal(calls[0]!.filter.includeSpam, false);
});

test("số liệu theo trạng thái đủ 5 trạng thái, thiếu thì bằng 0", async () => {
  const { service } = setup([]);
  const page = await service.list({ id: 1, roleCode: "ADMIN" });
  assert.deepEqual(page.countsByStatus, { NEW: 2, QUOTING: 0, QUOTE_SENT: 0, WON: 1, LOST: 0 });
});

test("làm sạch bộ lọc: giá trị sai bị bỏ qua, pageSize bị chặn trần", () => {
  const f = sanitizeProgressFilter({
    status: "HACK",
    sourceId: -1,
    productId: 1.5,
    assignedToId: 3,
    search: "  abc  ",
    page: 0,
    pageSize: 100000,
    createdFrom: new Date("invalid"),
  });
  assert.equal(f.status, undefined);
  assert.equal(f.sourceId, undefined);
  assert.equal(f.productId, undefined);
  assert.equal(f.assignedToId, 3);
  assert.equal(f.search, "abc");
  assert.equal(f.page, 1);
  assert.equal(f.pageSize, 100);
  assert.equal(f.createdFrom, undefined);
  assert.equal(sanitizeProgressFilter({ status: "WON" }).status, "WON");
  assert.equal(sanitizeProgressFilter({ search: "x".repeat(500) }).search?.length, 100);
  assert.equal(sanitizeProgressFilter({}).pageSize, 20);
});

test("chưa đăng nhập hoặc vai trò lạ bị từ chối", async () => {
  const { service } = setup([]);
  await assert.rejects(() => service.list(null), (e) => e instanceof LeadAccessError && e.code === "UNAUTHENTICATED");
  await assert.rejects(() => service.list({ id: 1, roleCode: "X" }), (e) => e instanceof LeadAccessError && e.code === "FORBIDDEN");
});

test("tổng số trang tối thiểu là 1", async () => {
  const { service } = setup([]);
  const page = await service.list({ id: 1, roleCode: "ADMIN" });
  assert.equal(page.totalPages, 1);
});
