import { prisma } from '@toantrung/database';

export interface AuditEntryInput {
  actorUserId?: number | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function recordAuditLog(input: AuditEntryInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      detailsJson: input.details ? JSON.stringify(input.details) : null,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

export async function listRecentAuditLogs(limit = 25) {
  return prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });
}

