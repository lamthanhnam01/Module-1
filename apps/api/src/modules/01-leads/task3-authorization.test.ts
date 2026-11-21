import assert from "node:assert/strict";
import test from "node:test";

import { createTask3LeadAuthorizer } from "./task3-authorization.ts";
import type { BaPermissionKey, RoleCode } from "@toantrung/contracts";
import type { Task3Lead } from "./task3-contracts.ts";

const rolePermissions: Record<RoleCode, readonly BaPermissionKey[]> = {
  SALES: [
    "LEAD_CREATE",
    "LEAD_VIEW_OWN",
    "LEAD_UPDATE_PIPELINE",
    "LEAD_REASSIGN",
  ],
  MKT_STAFF: ["LEAD_VIEW_OWN", "LEAD_VIEW_ALL"],
  DESIGNER: ["LEAD_VIEW_OWN"],
  ADS: ["LEAD_VIEW_OWN", "LEAD_VIEW_ALL"],
  MKT_LEAD: ["LEAD_VIEW_OWN", "LEAD_VIEW_ALL"],
  SALES_LEAD: [
    "LEAD_CREATE",
    "LEAD_VIEW_OWN",
    "LEAD_VIEW_ALL",
    "LEAD_UPDATE_PIPELINE",
    "LEAD_REASSIGN",
  ],
  BOD: [
    "LEAD_CREATE",
    "LEAD_VIEW_OWN",
    "LEAD_VIEW_ALL",
    "LEAD_UPDATE_PIPELINE",
    "LEAD_REASSIGN",
  ],
  ADMIN: [
    "LEAD_CREATE",
    "LEAD_VIEW_OWN",
    "LEAD_VIEW_ALL",
    "LEAD_UPDATE_PIPELINE",
    "LEAD_REASSIGN",
  ],
};

const hasPermission = (role: RoleCode, permission: BaPermissionKey) =>
  rolePermissions[role].includes(permission);

const lead: Task3Lead = {
  id: 1,
  version: 1,
  status: "quoting",
  assignedTo: 101,
  receivedBy: null,
  receivedAt: null,
  quoteSentAt: null,
  respondedAt: null,
  quoteValue: null,
  closedValue: null,
  closedAt: null,
  statusChangedAt: new Date("2026-11-07T10:00:00.000Z"),
  lostReason: null,
  reopenCount: 0,
};

test("Task 3 authorization maps BA permissions and restricts Sales to owned Leads", async () => {
  const salesAuthorizer = createTask3LeadAuthorizer({
    id: 101,
    roleCode: "SALES",
  }, hasPermission);

  assert.equal(await salesAuthorizer(101, lead, "UPDATE_PIPELINE"), true);
  assert.equal(await salesAuthorizer(101, lead, "TRANSFER"), true);
  assert.equal(
    await salesAuthorizer(
      101,
      { ...lead, assignedTo: 102 },
      "UPDATE_PIPELINE",
    ),
    false,
  );
  assert.equal(await salesAuthorizer(101, lead, "RECEIVE"), true);
});

test("Task 3 authorization honors manager permissions without granting bypass", async () => {
  const salesLeadAuthorizer = createTask3LeadAuthorizer({
    id: 201,
    roleCode: "SALES_LEAD",
  }, hasPermission);
  const marketingLeadAuthorizer = createTask3LeadAuthorizer({
    id: 301,
    roleCode: "MKT_LEAD",
  }, hasPermission);

  assert.equal(
    await salesLeadAuthorizer(201, lead, "UPDATE_PIPELINE"),
    true,
  );
  assert.equal(
    await salesLeadAuthorizer(201, lead, "TRANSFER"),
    true,
  );
  assert.equal(
    await marketingLeadAuthorizer(301, lead, "UPDATE_PIPELINE"),
    false,
  );
  assert.equal(
    await marketingLeadAuthorizer(301, lead, "TRANSFER"),
    false,
  );
});

test("Task 3 authorization rejects an actor different from the session identity", async () => {
  const authorizer = createTask3LeadAuthorizer({
    id: 101,
    roleCode: "SALES",
  }, hasPermission);

  assert.equal(await authorizer(102, lead, "UPDATE_PIPELINE"), false);
});
