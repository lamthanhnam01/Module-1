import { Prisma } from "@toantrung/database";
import { hasBaPermission } from "@toantrung/contracts";
import { listLeadRecords } from "../../../../modules/01-leads/lead.repository";
import { anonymizeLeadList } from "../../../../modules/01-leads/lead.serializer";

import {
  jsonError,
  jsonSuccess,
} from "../../../../core/http";

import {
  requireAuthenticatedSession,
  requirePermissionSession,
} from "../../../../core/permissions";

import {
  prepareCreateLead,
} from "../../../../modules/01-leads/lead.service";

import {
  createLeadRecord,
} from "../../../../modules/01-leads/lead.repository";

import type {
  CreateLeadInput,
} from "../../../../modules/01-leads/lead.validation";

export async function POST(req: Request) {
  // 1. Kiểm tra đăng nhập, quyền LEAD_CREATE và CSRF
  const auth = await requirePermissionSession(
    req,
    "LEAD_CREATE"
  );

  if (!auth.ok) {
    return auth.response;
  }

  // 2. Đọc dữ liệu JSON
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonError(
      "INVALID_JSON",
      "Dữ liệu gửi lên không phải JSON hợp lệ.",
      400
    );
  }

  // 3. Kiểm tra dữ liệu đầu vào
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

  let preparedLead;

  try {
    preparedLead = prepareCreateLead(
      body as CreateLeadInput
    );
  } catch (error) {
    return jsonError(
      "VALIDATION_ERROR",
      error instanceof Error
        ? error.message
        : "Thông tin Lead không hợp lệ.",
      400
    );
  }

  // 4. Lưu Lead vào database
  try {
    const lead = await createLeadRecord(
      preparedLead,
      {
        createdByUserId: auth.user.id,
      }
    );

    return jsonSuccess(
      { lead },
      201
    );
  } catch (error) {
    // Sản phẩm hoặc người dùng tham chiếu không tồn tại
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return jsonError(
        "INVALID_REFERENCE",
        "Sản phẩm hoặc thông tin liên kết không tồn tại.",
        400
      );
    }

    // Lỗi ràng buộc dữ liệu
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError(
        "DUPLICATE_VALUE",
        "Dữ liệu bị trùng. Vui lòng thử lại.",
        409
      );
    }

    console.error("CREATE_LEAD_ERROR", error);

    return jsonError(
      "LEAD_CREATE_ERROR",
      "Không thể tạo hồ sơ Lead lúc này.",
      500
    );
  }
}


export async function GET(req: Request) {
  const auth = await requireAuthenticatedSession(req, {
    requireCsrf: false,
  });

  if (!auth.ok) {
    return auth.response;
  }

  const roleCode = auth.user.roleCode;

  const canViewAll = hasBaPermission(
    roleCode,
    "LEAD_VIEW_ALL"
  );

  const canViewOwn = hasBaPermission(
    roleCode,
    "LEAD_VIEW_OWN"
  );

  if (!canViewAll && !canViewOwn) {
    return jsonError(
      "FORBIDDEN_PERMISSION",
      "Bạn không có quyền xem danh sách Lead.",
      403
    );
  }

  const url = new URL(req.url);

  const pageText = url.searchParams.get("page") ?? "1";
  const pageSizeText =
    url.searchParams.get("pageSize") ?? "10";
 
  const isAnonymizedRole =
  roleCode === "MKT_STAFF" || roleCode === "ADS";

  // TODO(Q03): Tạm tắt tìm kiếm cho Marketing/Ads
  // để tránh suy ra thông tin khách hàng từ kết quả.
  const searchInput =
  url.searchParams.get("search")?.trim() || undefined;

  if (isAnonymizedRole && searchInput) {
  return jsonError(
    "SEARCH_NOT_ALLOWED",
    "Chức năng tìm kiếm Lead đang chờ hoàn thiện phân quyền.",
    403
  );
}

  const search = searchInput;

  const status = url.searchParams.get("status") || undefined;
  const contactChannel =
  url.searchParams.get("contactChannel") || undefined;

  const assignedSalesIdText =
  url.searchParams.get("assignedSalesId");

  const dateFromText = url.searchParams.get("dateFrom");
  const dateToText = url.searchParams.get("dateTo");

  const page = Number(pageText);
  const pageSize = Number(pageSizeText);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    return jsonError(
      "VALIDATION_ERROR",
      "page phải >= 1 và pageSize phải từ 1 đến 100.",
      400
    );
  }
const allowedStatuses = [
  "new_lead",
  "quoting",
  "quote_sent",
  "won",
  "lost",
];

if (status && !allowedStatuses.includes(status)) {
  return jsonError(
    "VALIDATION_ERROR",
    "Trạng thái Lead không hợp lệ.",
    400
  );
}

const assignedSalesId =
  assignedSalesIdText === null
    ? undefined
    : Number(assignedSalesIdText);

if (
  assignedSalesId !== undefined &&
  (!Number.isSafeInteger(assignedSalesId) ||
    assignedSalesId <= 0)
) {
  return jsonError(
    "VALIDATION_ERROR",
    "assignedSalesId phải là số nguyên dương.",
    400
  );
}

const dateFrom = dateFromText
  ? new Date(dateFromText)
  : undefined;

const dateTo = dateToText
  ? new Date(dateToText)
  : undefined;

if (dateTo && !Number.isNaN(dateTo.getTime())) {
  dateTo.setUTCDate(dateTo.getUTCDate() + 1);
  dateTo.setUTCMilliseconds(dateTo.getUTCMilliseconds() - 1);
}

if (
  (dateFrom && Number.isNaN(dateFrom.getTime())) ||
  (dateTo && Number.isNaN(dateTo.getTime())) ||
  (dateFrom && dateTo && dateFrom > dateTo)
) {
  return jsonError(
    "VALIDATION_ERROR",
    "Khoảng thời gian lọc không hợp lệ.",
    400
  );
}

try {
  const result = await listLeadRecords({
    userId: auth.user.id,
    canViewAll,
    page,
    pageSize,
    search,
    status,
    contactChannel,
    assignedSalesId,
    dateFrom,
    dateTo,
  });

 
  // TODO(Q03): DTO tạm thời, chờ BA chốt danh sách trường ẩn danh.
  if (
    roleCode === "MKT_STAFF" ||
    roleCode === "ADS"
  ) {
    return jsonSuccess({
      leads: anonymizeLeadList(result.leads),
      pagination: result.pagination,
    });
  }

  return jsonSuccess(result);


} catch (error) {
  console.error("GET /api/v1/leads:", error);

  return jsonError(
    "LEAD_LIST_ERROR",
    "Không thể tải danh sách Lead lúc này.",
    500
  );
}
}
