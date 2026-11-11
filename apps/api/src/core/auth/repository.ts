import { prisma } from '@toantrung/database';

export async function findUserByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  const emailCandidate = normalized.includes('@') ? normalized : `${normalized}@toantrung.vn`;
  return prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ email: normalized }, { email: emailCandidate }],
    },
    include: { role: true },
  });
}

export async function findUserById(id: number) {
  return prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
}

export async function createSessionRecord(input: {
  tokenHash: string;
  csrfToken: string;
  userId: number;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}) {
  return prisma.userSession.create({
    data: {
      tokenHash: input.tokenHash,
      csrfToken: input.csrfToken,
      userId: input.userId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt: input.expiresAt,
    },
  });
}

export async function findActiveSessionByTokenHash(tokenHash: string) {
  return prisma.userSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: { role: true },
      },
    },
  });
}

export async function revokeSessionByTokenHash(tokenHash: string) {
  return prisma.userSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessionsExcept(userId: number, keepSessionId?: string) {
  return prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function listAllUsersWithRoles() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
    include: { role: true },
  });
}
