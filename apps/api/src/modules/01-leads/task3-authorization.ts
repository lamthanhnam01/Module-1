import type { BaPermissionKey, RoleCode } from "@toantrung/contracts";
import type { Task3LeadAction } from "./task3-contracts.ts";
import type { Task3LeadAuthorizer } from "./task3-policy.ts";

const requiredPermission: Record<Task3LeadAction, BaPermissionKey> = {
  UPDATE_PIPELINE: "LEAD_UPDATE_PIPELINE",
  UPDATE_VALUES: "LEAD_UPDATE_PIPELINE",
  REOPEN: "LEAD_UPDATE_PIPELINE",
  RECEIVE: "LEAD_CREATE",
  TRANSFER: "LEAD_REASSIGN",
}

export function createTask3LeadAuthorizer(actor: {
  id: string;
  roleCode: RoleCode;
}, hasPermission: (role: RoleCode, permission: BaPermissionKey) => boolean): Task3LeadAuthorizer {
  return async (actorId, lead, action) => {
    if (!actor.id.trim() || actor.id !== actorId) {
      return false;
    }

    if (!hasPermission(actor.roleCode, requiredPermission[action])) {
      return false;
    }

    const canViewLead =
      hasPermission(actor.roleCode, "LEAD_VIEW_ALL") ||
      (hasPermission(actor.roleCode, "LEAD_VIEW_OWN") &&
        lead.assignedTo === actor.id);

    return canViewLead;
  };
}
