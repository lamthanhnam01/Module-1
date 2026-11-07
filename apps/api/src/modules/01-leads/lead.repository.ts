import { PrismaClient, Prisma } from "@prisma/client";

export const prisma = new PrismaClient();

export async function createLead(
  data: Prisma.LeadUncheckedCreateInput,
  actorUserId: number
) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data,
    });

    await tx.leadHistory.create({
      data: {
        leadId: lead.id,
        actorUserId,
        action: "CREATE",
        newValue: JSON.stringify({
          leadId: lead.id,
          phone: lead.phone,
          status: lead.status,
        }),
      },
    });

    return lead;
  });
}

export async function getLeadById(leadId: number) {
  return prisma.lead.findUnique({
    where: {
      id: leadId,
    },
    include: {
      source: true,
      product: true,
      assignedTo: true,
      receivedBy: true,
      histories: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export type LeadFilters = {
  search?: string;
  status?: string;
  sourceId?: number;
  assignedToId?: number;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
};

export async function listLeads(filters: LeadFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 10));

  const where: Prisma.LeadWhereInput = {};

  if (filters.search?.trim()) {
    const search = filters.search.trim();

    where.OR = [
      { phone: { contains: search } },
      { companyName: { contains: search } },
      { projectName: { contains: search } },
      { installationAddress: { contains: search } },
    ];
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.sourceId !== undefined) {
    where.sourceId = filters.sourceId;
  }

  if (filters.assignedToId !== undefined) {
    where.assignedToId = filters.assignedToId;
  }

  if (filters.fromDate || filters.toDate) {
    where.createdAt = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      include: {
        source: true,
        product: true,
        assignedTo: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

type UpdateLeadData = {
  phone?: string;
  companyName?: string | null;
  projectName?: string | null;
  installationAddress?: string | null;
  productId?: number | null;
};

export async function updateLead(
  leadId: number,
  data: UpdateLeadData,
  actorUserId: number
) {
  return prisma.$transaction(async (tx) => {
    // 1. Lấy thông tin Lead hiện tại
    const oldLead = await tx.lead.findUnique({
      where: { id: leadId },
    });

    if (!oldLead) {
      throw new Error("Không tìm thấy Lead");
    }

    // 2. Chuẩn bị dữ liệu cập nhật
    const updateData: UpdateLeadData & {
      normalizedPhone?: string | null;
      phoneUnverified?: boolean;
    } = { ...data };

    // 3. Chuẩn hóa số điện thoại khi thay đổi
    if (data.phone !== undefined) {
      const rawPhone = data.phone.trim();
      const digits = rawPhone.replace(/\D/g, "");

      let normalizedPhone: string | null = null;

      if (/^0\d{9}$/.test(digits)) {
        normalizedPhone = digits;
      } else if (/^84\d{9}$/.test(digits)) {
        normalizedPhone = "0" + digits.slice(2);
      }

      updateData.phone = normalizedPhone ?? rawPhone;
      updateData.normalizedPhone = normalizedPhone;
      updateData.phoneUnverified = normalizedPhone === null;
    }

    // 4. Các trường cần theo dõi lịch sử
    const trackedFields = [
      "phone",
      "companyName",
      "projectName",
      "installationAddress",
      "productId",
    ] as const;

    const changes: {
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];

    // 5. So sánh giá trị cũ và mới
    for (const field of trackedFields) {
      if (data[field] === undefined) continue;

      const oldValue = oldLead[field];
      const newValue = updateData[field];

      if (oldValue !== newValue) {
        changes.push({
          fieldName: field,
          oldValue: oldValue == null ? null : String(oldValue),
          newValue: newValue == null ? null : String(newValue),
        });
      }
    }

    // 6. Không cập nhật nếu không có thay đổi
    if (changes.length === 0) {
      return oldLead;
    }

    // 7. Cập nhật Lead
    const updatedLead = await tx.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    // 8. Ghi lịch sử từng trường thay đổi
    await tx.leadHistory.createMany({
      data: changes.map((change) => ({
        leadId,
        actorUserId,
        action: "UPDATE",
        fieldName: change.fieldName,
        oldValue: change.oldValue,
        newValue: change.newValue,
      })),
    });

    return updatedLead;
  });
}