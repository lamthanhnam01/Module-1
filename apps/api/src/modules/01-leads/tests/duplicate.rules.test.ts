import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCompanyKey, buildProjectKey } from "../company-name";
import {
  evaluateDuplicate,
  type DuplicateCandidate,
  type ExistingLead,
} from "../duplicate.rules";
import { DUPLICATE_FLAG, LEAD_STATUS, type LeadStatus } from "../lead.constants";

let nextId = 1;
function lead(over: Partial<ExistingLead> & { company?: string; project?: string }): ExistingLead {
  const { company, project, ...rest } = over;
  return {
    id: nextId++,
    status: LEAD_STATUS.NEW,
    companyKey: company !== undefined ? buildCompanyKey(company) : null,
    projectKey: project !== undefined ? buildProjectKey(project) : null,
    normalizedPhone: null,
    emailKey: null,
    assignedToId: 10,
    isSpam: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...rest,
  };
}

function cand(company?: string, project?: string, phone?: string, email?: string): DuplicateCandidate {
  return {
    companyKey: company !== undefined ? buildCompanyKey(company) : null,
    projectKey: project !== undefined ? buildProjectKey(project) : null,
    normalizedPhone: phone ?? null,
    emailKey: email ?? null,
  };
}

test("không có Lead cũ khớp: không cờ, phân công thường", () => {
  const r = evaluateDuplicate(cand("Công ty ABC", "Dự án 1"), [lead({ company: "XYZ", project: "Dự án 1" })]);
  assert.equal(r.flag, null);
  assert.equal(r.highlightRed, false);
  assert.equal(r.oldLeadId, null);
  assert.deepEqual(r.assignment, { mode: "NORMAL", reason: "NO_MATCH" });
});

test("TC: Lead cũ ở 'Vừa nhận thông tin' -> cờ Trùng, tô đỏ, phân cho chủ Lead cũ", () => {
  const old = lead({ company: "Cty TNHH ABC", project: "Màn LED", status: LEAD_STATUS.NEW, assignedToId: 7 });
  const r = evaluateDuplicate(cand("công ty abc", "MAN LED"), [old]);
  assert.equal(r.flag, DUPLICATE_FLAG.DUPLICATE);
  assert.equal(r.highlightRed, true);
  assert.equal(r.oldLeadId, old.id);
  assert.equal(r.basis, "COMPANY_PROJECT");
  assert.deepEqual(r.assignment, { mode: "OLD_OWNER", userId: 7, oldLeadId: old.id });
});

test("Lead cũ đang soạn/đã gửi báo giá -> 'Đã có Lead cũ', không tô đỏ", () => {
  for (const status of [LEAD_STATUS.QUOTING, LEAD_STATUS.QUOTE_SENT] as LeadStatus[]) {
    const r = evaluateDuplicate(cand("ABC", "P1"), [lead({ company: "ABC", project: "P1", status })]);
    assert.equal(r.flag, DUPLICATE_FLAG.HAS_OLD_LEAD, status);
    assert.equal(r.highlightRed, false, status);
    assert.equal(r.assignment.mode, "OLD_OWNER", status);
  }
});

test("Lead cũ đã chốt -> 'Đã có Lead cũ', không tô đỏ, vẫn phân cho NVKD đã chốt", () => {
  const r = evaluateDuplicate(cand("ABC", "P1"), [
    lead({ company: "ABC", project: "P1", status: LEAD_STATUS.WON, assignedToId: 5 }),
  ]);
  assert.equal(r.flag, DUPLICATE_FLAG.HAS_OLD_LEAD);
  assert.equal(r.highlightRed, false);
  assert.deepEqual(r.assignment, { mode: "OLD_OWNER", userId: 5, oldLeadId: r.oldLeadId! });
});

test("Lead cũ Thất bại -> 'Đã có Lead cũ', phân công theo quy tắc thường", () => {
  const r = evaluateDuplicate(cand("ABC", "P1"), [
    lead({ company: "ABC", project: "P1", status: LEAD_STATUS.LOST, failureReason: "Giá cao" }),
  ]);
  assert.equal(r.flag, DUPLICATE_FLAG.HAS_OLD_LEAD);
  assert.equal(r.highlightRed, false);
  assert.deepEqual(r.assignment, { mode: "NORMAL", reason: "OLD_LEAD_LOST" });
  assert.equal(r.matches[0]!.failureReason, "Giá cao");
});

test("Lead mới không có tên dự án chỉ khớp theo tên công ty", () => {
  const old = lead({ company: "ABC", project: "Dự án A" });
  const r = evaluateDuplicate(cand("ABC"), [old]);
  assert.equal(r.flag, DUPLICATE_FLAG.DUPLICATE);
  assert.equal(r.basis, "COMPANY_ONLY");
});

test("cùng công ty nhưng khác dự án thì không trùng", () => {
  const r = evaluateDuplicate(cand("ABC", "Dự án B"), [lead({ company: "ABC", project: "Dự án A" })]);
  assert.equal(r.flag, null);
});

test("Lead mới có dự án, Lead cũ không có dự án: không trùng (E0 yêu cầu khớp cả hai)", () => {
  const r = evaluateDuplicate(cand("ABC", "Dự án B"), [lead({ company: "ABC" })]);
  assert.equal(r.flag, null);
});

test("Lead cũ là Spam hoặc đã xóa không dùng để xét trùng", () => {
  const spam = lead({ company: "ABC", project: "P", isSpam: true });
  const deleted = lead({ company: "ABC", project: "P", isDeleted: true });
  const r = evaluateDuplicate(cand("ABC", "P"), [spam, deleted]);
  assert.equal(r.flag, null);
});

test("kiểm tra lại sau khi sửa: không tự so với chính Lead đó", () => {
  const self = lead({ company: "ABC", project: "P" });
  const r = evaluateDuplicate({ ...cand("ABC", "P"), id: self.id }, [self]);
  assert.equal(r.flag, null);
});

test("chưa có tên công ty: đối chiếu SĐT -> 'Cùng SĐT/email với Lead cũ', không tô đỏ", () => {
  const old = lead({ normalizedPhone: "0912345678", status: LEAD_STATUS.NEW, assignedToId: 3 });
  const r = evaluateDuplicate(cand(undefined, undefined, "0912345678"), [old]);
  assert.equal(r.flag, DUPLICATE_FLAG.SAME_PHONE_EMAIL);
  assert.equal(r.highlightRed, false);
  assert.equal(r.basis, "PHONE_EMAIL");
  assert.deepEqual(r.assignment, { mode: "OLD_OWNER", userId: 3, oldLeadId: old.id });
});

test("chưa có tên công ty: đối chiếu email", () => {
  const old = lead({ emailKey: "a@b.com" });
  const r = evaluateDuplicate(cand(undefined, undefined, undefined, "a@b.com"), [old]);
  assert.equal(r.flag, DUPLICATE_FLAG.SAME_PHONE_EMAIL);
});

test("đã có tên công ty thì không xét SĐT (theo đặc tả)", () => {
  const old = lead({ company: "Công ty khác", normalizedPhone: "0912345678" });
  const r = evaluateDuplicate(cand("ABC", undefined, "0912345678"), [old]);
  assert.equal(r.flag, null);
});

test("SĐT rỗng không bao giờ khớp nhau", () => {
  const r = evaluateDuplicate(cand(undefined, undefined, undefined), [lead({})]);
  assert.equal(r.flag, null);
});

test("nhiều Lead cũ: lấy Lead đang mở gần nhất để phân công", () => {
  const oldOpen = lead({
    company: "ABC",
    status: LEAD_STATUS.QUOTING,
    assignedToId: 1,
    createdAt: new Date("2026-08-01T00:00:00Z"),
  });
  const newerOpen = lead({
    company: "ABC",
    status: LEAD_STATUS.QUOTE_SENT,
    assignedToId: 2,
    createdAt: new Date("2026-09-01T00:00:00Z"),
  });
  const won = lead({
    company: "ABC",
    status: LEAD_STATUS.WON,
    assignedToId: 3,
    createdAt: new Date("2026-10-15T00:00:00Z"),
    closedAt: new Date("2026-10-20T00:00:00Z"),
  });
  const r = evaluateDuplicate(cand("ABC"), [oldOpen, won, newerOpen]);
  assert.equal(r.oldLeadId, newerOpen.id);
  assert.deepEqual(r.matches.map((m) => m.leadId), [newerOpen.id, oldOpen.id, won.id]);
  assert.deepEqual(r.assignment, { mode: "OLD_OWNER", userId: 2, oldLeadId: newerOpen.id });
});

test("không có Lead đang mở: lấy Lead đã chốt gần nhất, Lead thất bại xếp cuối", () => {
  const lost = lead({ company: "ABC", status: LEAD_STATUS.LOST, closedAt: new Date("2026-10-30T00:00:00Z") });
  const wonOld = lead({ company: "ABC", status: LEAD_STATUS.WON, assignedToId: 4, closedAt: new Date("2026-06-01T00:00:00Z") });
  const wonNew = lead({ company: "ABC", status: LEAD_STATUS.WON, assignedToId: 5, closedAt: new Date("2026-09-01T00:00:00Z") });
  const r = evaluateDuplicate(cand("ABC"), [lost, wonOld, wonNew]);
  assert.deepEqual(r.matches.map((m) => m.leadId), [wonNew.id, wonOld.id, lost.id]);
  assert.equal(r.assignment.mode, "OLD_OWNER");
  if (r.assignment.mode === "OLD_OWNER") assert.equal(r.assignment.userId, 5);
});

test("nhiều Lead cũ, một Lead còn ở 'Vừa nhận thông tin' thì vẫn tô đỏ", () => {
  const untouched = lead({ company: "ABC", status: LEAD_STATUS.NEW, createdAt: new Date("2026-08-01T00:00:00Z") });
  const quoting = lead({ company: "ABC", status: LEAD_STATUS.QUOTING, createdAt: new Date("2026-09-01T00:00:00Z") });
  const r = evaluateDuplicate(cand("ABC"), [untouched, quoting]);
  assert.equal(r.flag, DUPLICATE_FLAG.DUPLICATE);
  assert.equal(r.highlightRed, true);
  assert.equal(r.oldLeadId, quoting.id); // Lead đang mở gần nhất
});

test("chủ Lead cũ nghỉ phép/nghỉ việc -> phân công theo quy tắc thường", () => {
  const old = lead({ company: "ABC", assignedToId: 9 });
  const r = evaluateDuplicate(cand("ABC"), [old], { unavailableUserIds: new Set([9]) });
  assert.equal(r.flag, DUPLICATE_FLAG.DUPLICATE);
  assert.deepEqual(r.assignment, { mode: "NORMAL", reason: "OLD_OWNER_UNAVAILABLE" });
});

test("Lead cũ chưa có người phụ trách -> phân công theo quy tắc thường", () => {
  const r = evaluateDuplicate(cand("ABC"), [lead({ company: "ABC", assignedToId: null })]);
  assert.deepEqual(r.assignment, { mode: "NORMAL", reason: "OLD_OWNER_MISSING" });
});

test("hai Lead cùng thời điểm: chọn Lead có id lớn hơn, kết quả ổn định", () => {
  const a = lead({ company: "ABC", status: LEAD_STATUS.QUOTING });
  const b = lead({ company: "ABC", status: LEAD_STATUS.QUOTING });
  const r1 = evaluateDuplicate(cand("ABC"), [a, b]);
  const r2 = evaluateDuplicate(cand("ABC"), [b, a]);
  assert.equal(r1.oldLeadId, b.id);
  assert.equal(r2.oldLeadId, b.id);
});
