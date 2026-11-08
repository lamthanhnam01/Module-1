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
  id: "lead-01",
  status: "quoting",
  assignedTo: "sales-01",
  receivedBy: null,
  receivedAt: null,
  quoteSentAt: null,
  respondedAt: null,
  quoteValue: null,
  closedValue: null,
  closedAt: null,
};

test("Task 3 authorization maps BA permissions and restricts Sales to owned Leads", async () => {
  const salesAuthorizer = createTask3LeadAuthorizer({
    id: "sales-01",
    roleCode: "SALES",
  }, hasPermission);

  assert.equal(await salesAuthorizer("sales-01", lead, "UPDATE_PIPELINE"), true);
  assert.equal(await salesAuthorizer("sales-01", lead, "TRANSFER"), true);
  assert.equal(
    await salesAuthorizer(
      "sales-01",
      { ...lead, assignedTo: "sales-02" },
      "UPDATE_PIPELINE",
    ),
    false,
  );
  assert.equal(await salesAuthorizer("sales-01", lead, "RECEIVE"), true);
});

test("Task 3 authorization honors manager permissions without granting bypass", async () => {
  const salesLeadAuthorizer = createTask3LeadAuthorizer({
    id: "manager-01",
    roleCode: "SALES_LEAD",
  }, hasPermission);
  const marketingLeadAuthorizer = createTask3LeadAuthorizer({
    id: "marketing-01",
    roleCode: "MKT_LEAD",
  }, hasPermission);

  assert.equal(
    await salesLeadAuthorizer("manager-01", lead, "UPDATE_PIPELINE"),
    true,
  );
  assert.equal(
    await salesLeadAuthorizer("manager-01", lead, "TRANSFER"),
    true,
  );
  assert.equal(
    await marketingLeadAuthorizer("marketing-01", lead, "UPDATE_PIPELINE"),
    false,
  );
  assert.equal(
    await marketingLeadAuthorizer("marketing-01", lead, "TRANSFER"),
    false,
  );
});

test("Task 3 authorization rejects an actor different from the session identity", async () => {
  const authorizer = createTask3LeadAuthorizer({
    id: "sales-01",
    roleCode: "SALES",
  }, hasPermission);

  assert.equal(await authorizer("sales-02", lead, "UPDATE_PIPELINE"), false);
});
