import { prisma } from "@toantrung/database";
import { jsonError, jsonSuccess } from "../../../../../core/http";
import { requireAuthenticatedSession } from "../../../../../core/permissions";
import { hasBaPermission } from "@toantrung/contracts";
import { prepareUpdateLead } from "../../../../../modules/01-leads/lead.service";
import { updateLeadRecord } from "../../../../../modules/01-leads/lead.repository";
import { anonymizeLeadDetail } from "../../../../../modules/01-leads/lead.serializer";  import type { UpdateLeadInput } from "../../../../../modules/01-leads/lead.validation";

export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAuthenticatedSession(req, {
    requireCsrf: false,
  });

  if (!auth.ok) return auth.response;

  const id = Number(context.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return jsonError("INVALID_LEAD_ID", "ID Lead không hợp lệ.", 400);
  }

  const canViewAll = hasBaPermission(auth.user.roleCode, "LEAD_VIEW_ALL");
  const canViewOwn = hasBaPermission(auth.user.roleCode, "LEAD_VIEW_OWN");

  if (!canViewAll && !canViewOwn) {
    return jsonError("FORBIDDEN_PERMISSION", "Không có quyền xem Lead.", 403);
  }

  const lead = await prisma.lead.findFirst({
    where: {
      id,
      ...(canViewAll
        ? {}
        : {
            OR: [
              { assignedSalesId: auth.user.id },
              { createdByUserId: auth.user.id },
            ],
          }),
    },
    include: {
      leadProducts: {
        include: { product: true },
      },
      activities: true,
    },
  });

  
  if (!lead) {
  return jsonError("LEAD_NOT_FOUND", "Không tìm thấy Lead.", 404);
  }

  // TODO(Q03): DTO ẩn danh tạm thời, chờ BA xác nhận.
  if (
  auth.user.roleCode === "MKT_STAFF" ||
  auth.user.roleCode === "ADS"
  ) {
  return jsonSuccess({
    lead: anonymizeLeadDetail(lead),
  });
  }

  return jsonSuccess({ lead });
}
export async function PATCH(
  req: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAuthenticatedSession(req);

  if (!auth.ok) return auth.response;

  const id = Number(context.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return jsonError(
      "INVALID_LEAD_ID",
      "ID Lead không hợp lệ.",
      400
    );
  }

  const canUpdatePipeline = hasBaPermission(
    auth.user.roleCode,
    "LEAD_UPDATE_PIPELINE"
  );

  if (!canUpdatePipeline) {
    return jsonError(
      "FORBIDDEN_PERMISSION",
      "Không có quyền cập nhật Lead.",
      403
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonError(
      "INVALID_JSON",
      "Dữ liệu gửi lên không hợp lệ.",
      400
    );
  }

  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return jsonError(
      "VALIDATION_ERROR",
      "Dữ liệu Lead phải là một đối tượng.",
      400
    );
  }

  let prepared;

  try {
    prepared = prepareUpdateLead(body as UpdateLeadInput);
  } catch (error) {
    return jsonError(
      "VALIDATION_ERROR",
      error instanceof Error
        ? error.message
        : "Dữ liệu cập nhật không hợp lệ.",
      400
    );
  }

  try {
    const updated = await updateLeadRecord(prepared, {
      leadId: id,
      updatedByUserId: auth.user.id,
      canUpdateAll: hasBaPermission(
        auth.user.roleCode,
        "LEAD_VIEW_ALL"
      ),
    });

    if (!updated) {
      return jsonError(
        "LEAD_NOT_FOUND",
        "Không tìm thấy Lead hoặc không có quyền cập nhật.",
        404
      );
    }

    return jsonSuccess({ lead: updated });
  } catch (error) {
    console.error("UPDATE_LEAD_ERROR", error);

    return jsonError(
      "UPDATE_LEAD_ERROR",
      "Không thể cập nhật Lead.",
      500
    );
  }
}

