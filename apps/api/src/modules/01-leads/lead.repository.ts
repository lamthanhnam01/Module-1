
import { Prisma, prisma } from "@toantrung/database";
import type {
  PreparedLead,
  PreparedLeadUpdate,
} from "./lead.service";

export interface CreateLeadRepositoryOptions {
  createdByUserId: number;
}

function formatLeadDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}${get("month")}${get("day")}`;
}

async function getNextLeadNumber(): Promise<number> {
  const existing = await prisma.lead.findMany({
    select: { leadCode: true },
  });

  let highest = 0;

  for (const lead of existing) {
    const match = /^TT-\d{8}-(\d+)$/.exec(lead.leadCode);

    if (match) {
      const number = Number(match[1]);

      if (Number.isSafeInteger(number)) {
        highest = Math.max(highest, number);
      }
    }
  }

  return highest + 1;
}

function isLeadCodeConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.some((field) =>
      String(field).includes("lead_code")
    );
  }

  return String(target ?? "").includes("lead_code");
}

export async function createLeadRecord(
  input: PreparedLead,
  options: CreateLeadRepositoryOptions
) {
  const userId = options.createdByUserId;

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("createdByUserId không hợp lệ");
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const nextNumber = await getNextLeadNumber();

    const leadCode =
      `TT-${formatLeadDate(new Date())}-${String(nextNumber).padStart(4, "0")}`;

    try {
      return await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: {
            leadCode,
            phone: input.phone,
            isPhoneUnstandardized:
              input.isPhoneUnstandardized,
            contactChannel: input.contactChannel,
            contactName: input.contactName,
            email: input.email,
            companyName: input.companyName,
            projectName: input.projectName,
            installationAddress:
              input.installationAddress,
            contactedAt: input.contactedAt,
            createdByUserId: userId,
            createdByActorType: "user",
            createdByActorRef: `user:${userId}`,
            assignedSalesId: userId,
          },
        });

        if (input.productId !== null) {
          await tx.leadProduct.create({
            data: {
              leadId: lead.id,
              productId: input.productId,
            },
          });
        }

        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            actionType: "create_lead",
            newStatus: lead.pipelineStatus,
            actionById: userId,
            actorType: "user",
            actorRef: `user:${userId}`,
            note: "Tạo hồ sơ Lead thủ công",
          },
        });

        return lead;
      });
    } catch (error) {
      if (isLeadCodeConflict(error) && attempt < 4) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Không thể cấp mã Lead duy nhất");
}

export interface ListLeadsOptions {
  userId: number;
  canViewAll: boolean;
  page?: number;
  pageSize?: number;

  search?: string;
  status?: string;
  contactChannel?: string;
  assignedSalesId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}
export async function listLeadRecords(options: ListLeadsOptions) {
  const {
  userId,
  canViewAll,
  page = 1,
  pageSize = 10,
  search,
  status,
  contactChannel,
  assignedSalesId,
  dateFrom,
  dateTo,
} = options;

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("userId không hợp lệ");
  }

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("page không hợp lệ");
  }

  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new Error("pageSize không hợp lệ");
  }

  const where: Prisma.LeadWhereInput = {
  AND: [
    // Giới hạn phạm vi Lead theo quyền
    canViewAll
      ? {}
      : { assignedSalesId: userId },

    // Tìm kiếm
    ...(search?.trim()
      ? [{         
            OR: [
          { leadCode: { contains: search.trim() } },
          { contactName: { contains: search.trim() } },
          { phone: { contains: search.trim() } },
          { companyName: { contains: search.trim() } },
          { projectName: { contains: search.trim() } },
          ],
        }]
      : []),

    // Lọc trạng thái
    ...(status
      ? [{ pipelineStatus: status }]
      : []),

    // Lọc kênh liên hệ
    ...(contactChannel
      ? [{ contactChannel }]
      : []),

    // Lọc Sales phụ trách
    ...(assignedSalesId !== undefined
      ? [{ assignedSalesId }]
      : []),

    // Lọc thời gian
    ...(dateFrom || dateTo
      ? [{
          createdAt: {
            ...(dateFrom ? { gte: dateFrom } : {}),
            ...(dateTo ? { lte: dateTo } : {}),
          },
        }]
      : []),
  ],
};

  const [total, leads] = await prisma.$transaction([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        leadProducts: {
          include: {
            product: true,
          },
        },
      },
    }),
  ]);

  return {
    leads,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}


export interface UpdateLeadRepositoryOptions {
  leadId: number;
  updatedByUserId: number;
  canUpdateAll: boolean;
}

export async function updateLeadRecord(
  input: PreparedLeadUpdate,
  options: UpdateLeadRepositoryOptions
) {
  const { leadId, updatedByUserId, canUpdateAll } = options;

  if (!Number.isSafeInteger(leadId) || leadId <= 0) {
    throw new Error("leadId không hợp lệ");
  }

  if (
    !Number.isSafeInteger(updatedByUserId) ||
    updatedByUserId <= 0
  ) {
    throw new Error("updatedByUserId không hợp lệ");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({
      where: {
        id: leadId,
        ...(canUpdateAll
          ? {}
          : { assignedSalesId: updatedByUserId }),
      },
      include: {
        leadProducts: true,
      },
    });

    if (!existing) {
      return null;
    }

    const {
      productId,
      ...leadFields
    } = input;

    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        ...leadFields,
        version: { increment: 1 },
      },
    });

    if (productId !== undefined) {
      await tx.leadProduct.deleteMany({
        where: { leadId },
      });

      if (productId !== null) {
        await tx.leadProduct.create({
          data: {
            leadId,
            productId,
          },
        });
      }
    }

    await tx.leadActivity.create({
      data: {
        leadId,
        actionType: "update_lead",
        actionById: updatedByUserId,
        actorType: "user",
        actorRef: `user:${updatedByUserId}`,
        note: "Cập nhật thông tin hồ sơ Lead",
        oldValueJson: JSON.stringify({
          phone: existing.phone,
          contactName: existing.contactName,
          email: existing.email,
          companyName: existing.companyName,
          projectName: existing.projectName,
          installationAddress: existing.installationAddress,
          productIds: existing.leadProducts.map(
            (item) => item.productId
          ),
        }),
        newValueJson: JSON.stringify({
          ...leadFields,
          productId,
        }),
      },
    });

    return updated;
  });
}
