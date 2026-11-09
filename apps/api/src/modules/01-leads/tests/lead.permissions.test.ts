import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_CODE, parseRoleCode, type RoleCode } from "../lead.constants";
import { LeadAccessError } from "../lead.errors";
import {
  PERMISSION,
  assertCan,
  assertLeadAccess,
  buildLeadVisibilityFilter,
  can,
  canAccessLead,
  getDashboardScope,
  getLeadViewScope,
  resolveActor,
  type Actor,
  type LeadAccessTarget,
  type Permission,
} from "../lead.permissions";

const ROLES = Object.values(ROLE_CODE) as RoleCode[];
const P = PERMISSION;

/** Bản chép lại ma trận trong đặc tả (hàng = quyền, cột = vai trò) để đối chiếu độc lập. */
const SPEC: Array<[Permission, RoleCode[]]> = [
  [P.LEAD_CREATE, ["SALES", "SALES_HEAD", "DIRECTOR", "ADMIN"]],
  [P.LEAD_VIEW_OWN, [...ROLES]], // Designer bị giới hạn bởi phạm vi, không bởi quyền
  [P.LEAD_VIEW_ALL, ["MARKETING", "ADS", "MARKETING_HEAD", "SALES_HEAD", "DIRECTOR", "ADMIN"]],
  [P.LEAD_UPDATE_PROGRESS, ["SALES", "SALES_HEAD", "DIRECTOR", "ADMIN"]],
  [P.LEAD_TRANSFER, ["SALES", "SALES_HEAD", "DIRECTOR", "ADMIN"]],
  [P.ATTACHMENT_ACCESS, ["SALES", "DESIGNER", "SALES_HEAD", "DIRECTOR", "ADMIN"]],
  [P.AI_DESIGN, ["DESIGNER", "ADMIN"]],
  [P.AI_MARKETING, ["MARKETING", "ADS", "MARKETING_HEAD", "ADMIN"]],
  [P.TRACKING, ["MARKETING", "ADS", "MARKETING_HEAD", "DIRECTOR", "ADMIN"]],
  [P.DASHBOARD_VIEW, [...ROLES]],
  [P.DATA_EXPORT, [...ROLES]],
  [P.SYSTEM_ADMIN, ["ADMIN"]],
];

test("ma trận RBAC khớp từng ô trong đặc tả (12 quyền x 8 vai trò)", () => {
  for (const [permission, allowed] of SPEC) {
    for (const role of ROLES) {
      const expected = allowed.includes(role);
      assert.equal(
        can({ id: 1, roleCode: role }, permission),
        expected,
        role + " / " + permission
      );
    }
  }
});

const own: LeadAccessTarget = { id: 1, assignedToId: 5, hasDesignRequest: false };
const other: LeadAccessTarget = { id: 2, assignedToId: 6, hasDesignRequest: false };
const withDesign: LeadAccessTarget = { id: 3, assignedToId: 6, hasDesignRequest: true };
const sales: Actor = { id: 5, roleCode: "SALES" };

test("Sales chỉ xem và thao tác trên Lead mình phụ trách", () => {
  assert.equal(canAccessLead(sales, "VIEW", own), true);
  assert.equal(canAccessLead(sales, "VIEW", other), false);
  for (const action of ["UPDATE_PROGRESS", "TRANSFER", "ATTACHMENT_VIEW", "ATTACHMENT_UPLOAD"] as const) {
    assert.equal(canAccessLead(sales, action, own), true, action);
    assert.equal(canAccessLead(sales, action, other), false, action);
  }
});

test("Designer chỉ thấy Lead có yêu cầu phối cảnh và chỉ làm việc với tài liệu", () => {
  const d: Actor = { id: 9, roleCode: "DESIGNER" };
  assert.equal(canAccessLead(d, "VIEW", withDesign), true);
  assert.equal(canAccessLead(d, "VIEW", other), false);
  assert.equal(canAccessLead(d, "ATTACHMENT_UPLOAD", withDesign), true);
  assert.equal(canAccessLead(d, "ATTACHMENT_VIEW", withDesign), true);
  assert.equal(canAccessLead(d, "ATTACHMENT_UPLOAD", other), false);
  assert.equal(canAccessLead(d, "UPDATE_PROGRESS", withDesign), false);
  assert.equal(canAccessLead(d, "TRANSFER", withDesign), false);
});

test("Marketing, Ads, Trưởng phòng MKT xem được mọi Lead nhưng không sửa, không đính kèm", () => {
  for (const role of ["MARKETING", "ADS", "MARKETING_HEAD"] as const) {
    const a: Actor = { id: 20, roleCode: role };
    assert.equal(canAccessLead(a, "VIEW", other), true, role);
    for (const action of ["UPDATE_PROGRESS", "TRANSFER", "ATTACHMENT_VIEW", "ATTACHMENT_UPLOAD"] as const) {
      assert.equal(canAccessLead(a, action, other), false, role + " " + action);
    }
  }
});

test("Trưởng phòng Sales, Giám đốc, Quản trị viên thao tác trên mọi Lead", () => {
  for (const role of ["SALES_HEAD", "DIRECTOR", "ADMIN"] as const) {
    const a: Actor = { id: 30, roleCode: role };
    for (const action of ["VIEW", "UPDATE_PROGRESS", "TRANSFER", "ATTACHMENT_VIEW", "ATTACHMENT_UPLOAD"] as const) {
      assert.equal(canAccessLead(a, action, other), true, role + " " + action);
    }
  }
});

test("phạm vi xem Lead và Dashboard theo vai trò", () => {
  assert.equal(getLeadViewScope("SALES"), "OWN");
  assert.equal(getLeadViewScope("DESIGNER"), "DESIGN_REQUEST");
  for (const r of ["MARKETING", "ADS", "MARKETING_HEAD", "SALES_HEAD", "DIRECTOR", "ADMIN"] as const) {
    assert.equal(getLeadViewScope(r), "ALL", r);
  }
  assert.equal(getDashboardScope("SALES"), "OWN");
  assert.equal(getDashboardScope("DIRECTOR"), "ALL");
  assert.equal(getDashboardScope("DESIGNER"), "ALL");
});

test("bộ lọc phạm vi cho tầng truy vấn", () => {
  assert.deepEqual(buildLeadVisibilityFilter(sales), { kind: "ASSIGNED_TO", userId: 5 });
  assert.deepEqual(buildLeadVisibilityFilter({ id: 9, roleCode: "DESIGNER" }), { kind: "DESIGN_REQUEST" });
  assert.deepEqual(buildLeadVisibilityFilter({ id: 1, roleCode: "ADMIN" }), { kind: "ALL" });
});

test("mặc định từ chối: chưa đăng nhập, tài khoản khóa, vai trò lạ", () => {
  assert.equal(can(null, P.LEAD_VIEW_OWN), false);
  assert.equal(can(undefined, P.LEAD_VIEW_OWN), false);
  assert.equal(can({ id: 1, roleCode: "SALES", isActive: false }, P.LEAD_VIEW_OWN), false);
  assert.equal(can({ id: 1, roleCode: "HACKER" }, P.LEAD_VIEW_OWN), false);
  assert.equal(can({ id: 1, roleCode: null }, P.LEAD_VIEW_OWN), false);
  assert.equal(can({ id: 0, roleCode: "ADMIN" }, P.SYSTEM_ADMIN), false);
  assert.equal(canAccessLead({ id: 1, roleCode: "HACKER" }, "VIEW", own), false);
  assert.throws(() => resolveActor(null), (e) => e instanceof LeadAccessError && e.code === "UNAUTHENTICATED");
  assert.throws(
    () => resolveActor({ id: 1, roleCode: "SALES", isActive: false }),
    (e) => e instanceof LeadAccessError && e.code === "FORBIDDEN"
  );
  assert.throws(() => buildLeadVisibilityFilter({ id: 1, roleCode: "XYZ" }), LeadAccessError);
});

test("mã vai trò được chuẩn hóa hoa/thường, khoảng trắng và alias DESIGN", () => {
  assert.equal(parseRoleCode(" sales "), "SALES");
  assert.equal(parseRoleCode("DESIGN"), "DESIGNER");
  assert.equal(can({ id: 9, roleCode: "design" }, P.AI_DESIGN), true);
  assert.equal(parseRoleCode("Admin"), "ADMIN");
  assert.equal(parseRoleCode("root"), null);
  assert.equal(parseRoleCode(5), null);
});

test("assertCan ném 403 khi thiếu quyền", () => {
  assert.throws(
    () => assertCan({ id: 1, roleCode: "MARKETING" }, P.LEAD_CREATE),
    (e) => e instanceof LeadAccessError && e.code === "FORBIDDEN"
  );
  assert.equal(assertCan({ id: 1, roleCode: "SALES" }, P.LEAD_CREATE).role, "SALES");
});

test("assertLeadAccess: Lead ngoài phạm vi xem trả 404, trong phạm vi xem nhưng thiếu quyền trả 403", () => {
  // Sales xem Lead của người khác: 404 (không lộ Lead có tồn tại)
  assert.throws(
    () => assertLeadAccess(sales, "ATTACHMENT_VIEW", other),
    (e) => e instanceof LeadAccessError && e.code === "NOT_FOUND"
  );
  // Designer xem Lead không có yêu cầu phối cảnh: 404
  assert.throws(
    () => assertLeadAccess({ id: 9, roleCode: "DESIGNER" }, "ATTACHMENT_VIEW", other),
    (e) => e instanceof LeadAccessError && e.code === "NOT_FOUND"
  );
  // Marketing thấy Lead nhưng không được đính kèm: 403
  assert.throws(
    () => assertLeadAccess({ id: 20, roleCode: "MARKETING" }, "ATTACHMENT_UPLOAD", other),
    (e) => e instanceof LeadAccessError && e.code === "FORBIDDEN"
  );
  // Lead không tồn tại: 404
  assert.throws(
    () => assertLeadAccess(sales, "VIEW", null),
    (e) => e instanceof LeadAccessError && e.code === "NOT_FOUND"
  );
  // Hợp lệ
  assert.equal(assertLeadAccess(sales, "ATTACHMENT_UPLOAD", own).id, 5);
});
