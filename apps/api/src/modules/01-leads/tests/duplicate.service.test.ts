import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DuplicateService,
  type AssigneeAvailability,
  type DuplicateLeadRepository,
  type DuplicateNotification,
  type DuplicateNotifier,
  type DuplicateQuery,
} from "../duplicate.service";
import type { ExistingLead } from "../duplicate.rules";
import { buildCompanyKey, buildProjectKey } from "../company-name";
import { DUPLICATE_FLAG, LEAD_STATUS } from "../lead.constants";

function oldLead(id: number, over: Partial<ExistingLead> = {}): ExistingLead {
  return {
    id,
    status: LEAD_STATUS.QUOTING,
    companyKey: buildCompanyKey("Công ty ABC"),
    projectKey: buildProjectKey("Màn LED"),
    normalizedPhone: "0911111111",
    emailKey: null,
    assignedToId: 7,
    isSpam: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
  };
}

function setup(existing: ExistingLead[], unavailable: number[] = []) {
  const queries: DuplicateQuery[] = [];
  const sent: DuplicateNotification[] = [];
  const repo: DuplicateLeadRepository = {
    async findPotentialDuplicates(q) {
      queries.push(q);
      return existing;
    },
  };
  const availability: AssigneeAvailability = {
    async getUnavailableUserIds(ids) {
      return ids.filter((id) => unavailable.includes(id));
    },
  };
  const notifier: DuplicateNotifier = {
    async notify(n) {
      sent.push(n);
    },
  };
  return { service: new DuplicateService(repo, availability, notifier), queries, sent };
}

test("Lead tự động trùng: phân cho chủ Lead cũ và chỉ thông báo cho người đó", async () => {
  const { service, sent } = setup([oldLead(100)]);
  const out = await service.checkNewLead({
    lead: { phone: "0922222222", companyName: "CTY TNHH ABC", projectName: "man led" },
    isAutoLead: true,
  });
  assert.equal(out.result.flag, DUPLICATE_FLAG.HAS_OLD_LEAD);
  assert.deepEqual(out.result.assignment, { mode: "OLD_OWNER", userId: 7, oldLeadId: 100 });
  assert.equal(out.keys.companyKey, "abc");
  assert.deepEqual(out.plannedNotifications, [
    { recipientUserId: 7, oldLeadId: 100, flag: DUPLICATE_FLAG.HAS_OLD_LEAD },
  ]);
  await service.publishNotifications(555, out.plannedNotifications);
  assert.deepEqual(sent, [
    { recipientUserId: 7, leadId: 555, oldLeadId: 100, flag: DUPLICATE_FLAG.HAS_OLD_LEAD },
  ]);
});

test("Lead tự động trùng nhưng chủ Lead cũ nghỉ phép: không phân cho người đó, không thông báo", async () => {
  const { service } = setup([oldLead(100)], [7]);
  const out = await service.checkNewLead({
    lead: { phone: "0922222222", companyName: "ABC", projectName: "Màn LED" },
    isAutoLead: true,
  });
  assert.equal(out.result.assignment.mode, "NORMAL");
  assert.deepEqual(out.plannedNotifications, []);
});

test("Lead thủ công trùng: thông báo cho cả chủ Lead cũ và người nhập, người nhập vẫn phụ trách", async () => {
  const { service } = setup([oldLead(100)]);
  const out = await service.checkNewLead({
    lead: { phone: "0922222222", companyName: "ABC", projectName: "Màn LED" },
    isAutoLead: false,
    creatorId: 8,
  });
  assert.deepEqual(
    out.plannedNotifications.map((n) => n.recipientUserId).sort(),
    [7, 8]
  );
});

test("Lead thủ công, người nhập chính là chủ Lead cũ: chỉ một thông báo", async () => {
  const { service } = setup([oldLead(100)]);
  const out = await service.checkNewLead({
    lead: { phone: "0922222222", companyName: "ABC", projectName: "Màn LED" },
    isAutoLead: false,
    creatorId: 7,
  });
  assert.equal(out.plannedNotifications.length, 1);
});

test("không trùng: không thông báo", async () => {
  const { service } = setup([]);
  const out = await service.checkNewLead({
    lead: { phone: "0922222222", companyName: "Công ty Mới" },
    isAutoLead: false,
    creatorId: 8,
  });
  assert.equal(out.result.flag, null);
  assert.deepEqual(out.plannedNotifications, []);
});

test("Lead tự động chưa có tên công ty được tra theo SĐT/email", async () => {
  const { service, queries } = setup([oldLead(100, { companyKey: null, projectKey: null })]);
  const out = await service.checkNewLead({
    lead: { phone: "0911111111", email: " A@B.com " },
    isAutoLead: true,
  });
  assert.equal(out.result.flag, DUPLICATE_FLAG.SAME_PHONE_EMAIL);
  assert.equal(queries[0]!.emailKey, "a@b.com");
  assert.equal(out.result.assignment.mode, "OLD_OWNER");
});

test("sửa Lead (4.2): Lead thuộc B khác chủ Lead cũ A -> thông báo cả hai, không tự chuyển", async () => {
  const { service, queries } = setup([oldLead(100, { assignedToId: 7 })]);
  const out = await service.recheckAfterEdit({
    leadId: 200,
    lead: { phone: "0922222222", companyName: "ABC", projectName: "Màn LED" },
    currentOwnerId: 9,
  });
  assert.equal(queries[0]!.excludeLeadId, 200);
  assert.equal(out.result.flag, DUPLICATE_FLAG.HAS_OLD_LEAD);
  assert.deepEqual(
    out.plannedNotifications.map((n) => n.recipientUserId).sort(),
    [7, 9]
  );
});

test("sửa Lead (4.2): cùng một NVKD phụ trách cả hai thì không cần thông báo", async () => {
  const { service } = setup([oldLead(100, { assignedToId: 7 })]);
  const out = await service.recheckAfterEdit({
    leadId: 200,
    lead: { phone: "0922222222", companyName: "ABC", projectName: "Màn LED" },
    currentOwnerId: 7,
  });
  assert.equal(out.result.flag, DUPLICATE_FLAG.HAS_OLD_LEAD);
  assert.deepEqual(out.plannedNotifications, []);
});

test("không truy vấn trạng thái NVKD khi không có Lead cũ", async () => {
  let called = 0;
  const service = new DuplicateService(
    { async findPotentialDuplicates() { return []; } },
    { async getUnavailableUserIds() { called++; return []; } },
    { async notify() {} }
  );
  await service.checkNewLead({ lead: { phone: "0911111111", companyName: "X" }, isAutoLead: true });
  assert.equal(called, 0);
});
