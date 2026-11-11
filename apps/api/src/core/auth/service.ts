import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '@toantrung/database';
import type {
  AdminUserDto,
  CreateUserDto,
  DepartmentCode,
  RoleCode,
  SessionUserDto,
  UpdateProfileDto,
  UpdateUserDto,
} from '@toantrung/contracts';
import { APP_CONFIG } from '../config';
import { recordAuditLog } from '../audit';
import { validateAndSanitizeImageBuffer } from '../storage/image-validator';
import {
  generateSessionTokens,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './password';
import {
  createSessionRecord,
  findActiveSessionByTokenHash,
  findUserById,
  findUserByIdentifier,
  listAllUsersWithRoles,
  revokeAllUserSessionsExcept,
  revokeSessionByTokenHash,
} from './repository';

export class AuthServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function getAvatarDir(): string {
  const dir = path.join(APP_CONFIG.getStorageRoot(), 'avatars');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function authenticateUser(input: {
  identifier: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ user: SessionUserDto; rawSessionToken: string; expiresAt: Date }> {
  const user = await findUserByIdentifier(input.identifier);
  if (!user || user.deletedAt || !verifyPassword(input.password, user.passwordHash)) {
    await recordAuditLog({
      actorUserId: user?.id ?? null,
      action: 'AUTH_LOGIN_FAILED',
      targetType: 'user',
      targetId: user ? String(user.id) : input.identifier,
      ipAddress: input.ipAddress,
    });
    throw new AuthServiceError(
      'INVALID_CREDENTIALS',
      'Tài khoản hoặc mật khẩu không chính xác.',
      401,
    );
  }

  if (!user.isActive) {
    await recordAuditLog({
      actorUserId: user.id,
      action: 'AUTH_LOGIN_BLOCKED_INACTIVE',
      targetType: 'user',
      targetId: String(user.id),
      ipAddress: input.ipAddress,
    });
    throw new AuthServiceError(
      'ACCOUNT_INACTIVE',
      'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên.',
      403,
    );
  }

  const { rawToken, tokenHash, csrfToken } = generateSessionTokens();
  const expiresAt = new Date(Date.now() + APP_CONFIG.sessionTtlMs);

  await createSessionRecord({
    tokenHash,
    csrfToken,
    userId: user.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    expiresAt,
  });

  await recordAuditLog({
    actorUserId: user.id,
    action: 'AUTH_LOGIN_SUCCESS',
    targetType: 'session',
    targetId: String(user.id),
    ipAddress: input.ipAddress,
  });

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roleCode: user.role.roleCode as RoleCode,
      roleName: user.role.roleName,
      department: user.department as DepartmentCode,
      isActive: user.isActive,
      csrfToken,
    },
    rawSessionToken: rawToken,
    expiresAt,
  };
}

export async function resolveSessionFromToken(rawToken: string | undefined | null): Promise<{
  sessionId: string;
  user: SessionUserDto;
} | null> {
  if (!rawToken) return null;
  const tokenHash = hashSessionToken(rawToken);
  const session = await findActiveSessionByTokenHash(tokenHash);
  if (!session) return null;
  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  if (!session.user.isActive || session.user.deletedAt) {
    return null;
  }
  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      fullName: session.user.fullName,
      email: session.user.email,
      phone: session.user.phone,
      avatarUrl: session.user.avatarUrl,
      roleCode: session.user.role.roleCode as RoleCode,
      roleName: session.user.role.roleName,
      department: session.user.department as DepartmentCode,
      isActive: session.user.isActive,
      csrfToken: session.csrfToken,
    },
  };
}

export async function logoutByToken(rawToken: string | undefined | null, ipAddress?: string) {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  const existing = await findActiveSessionByTokenHash(tokenHash);
  await revokeSessionByTokenHash(tokenHash);
  if (existing) {
    await recordAuditLog({
      actorUserId: existing.userId,
      action: 'AUTH_LOGOUT',
      targetType: 'session',
      targetId: existing.id,
      ipAddress,
    });
  }
}

export async function updateOwnProfile(
  userId: number,
  input: UpdateProfileDto,
  ipAddress?: string,
) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: input.fullName.trim(),
      phone: input.phone ? input.phone.trim() : null,
      ...(input.removeAvatar ? { avatarUrl: null } : {}),
    },
    include: { role: true },
  });

  await recordAuditLog({
    actorUserId: userId,
    action: 'PROFILE_UPDATED',
    targetType: 'user',
    targetId: String(userId),
    details: {
      fullName: updated.fullName,
      phone: updated.phone,
      removeAvatar: Boolean(input.removeAvatar),
    },
    ipAddress,
  });

  return updated;
}

export async function uploadOwnAvatar(input: {
  userId: number;
  fileBuffer: Buffer;
  declaredMimeType: string;
  ipAddress?: string;
}) {
  const validated = validateAndSanitizeImageBuffer(
    input.fileBuffer,
    input.declaredMimeType,
    APP_CONFIG.maxLogoSizeBytes, // 2 MB limit for avatars
  );

  const randomId = crypto.randomUUID();
  const objectKey = `avatar-${input.userId}-${randomId}-${validated.sha256.slice(0, 12)}.${validated.extension}`;
  const fullPath = path.join(getAvatarDir(), objectKey);

  fs.writeFileSync(fullPath, validated.sanitizedBuffer, { flag: 'wx' });

  const avatarUrl = `/api/v1/settings/branding/asset/${encodeURIComponent(objectKey)}`;
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: { avatarUrl },
    include: { role: true },
  });

  await recordAuditLog({
    actorUserId: input.userId,
    action: 'PROFILE_AVATAR_UPDATED',
    targetType: 'user',
    targetId: String(input.userId),
    details: {
      objectKey,
      mimeType: validated.mimeType,
      bytes: validated.sanitizedBuffer.length,
    },
    ipAddress: input.ipAddress,
  });

  return updated;
}

export async function changeOwnPassword(
  userId: number,
  currentSessionId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string,
) {
  const user = await findUserById(userId);
  if (!user || user.deletedAt || !verifyPassword(currentPassword, user.passwordHash)) {
    throw new AuthServiceError(
      'INVALID_CURRENT_PASSWORD',
      'Mật khẩu hiện tại không chính xác.',
      400,
    );
  }

  const newHash = hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  await revokeAllUserSessionsExcept(userId, currentSessionId);

  await recordAuditLog({
    actorUserId: userId,
    action: 'PASSWORD_CHANGED',
    targetType: 'user',
    targetId: String(userId),
    ipAddress,
  });
}

export async function listAdminUsers(): Promise<AdminUserDto[]> {
  const rows = await listAllUsersWithRoles();
  return rows.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    roleId: u.roleId,
    roleCode: u.role.roleCode as RoleCode,
    roleName: u.role.roleName,
    department: u.department as DepartmentCode,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }));
}

export async function createAdminUser(
  actorUserId: number,
  input: CreateUserDto,
  ipAddress?: string,
): Promise<AdminUserDto> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing && !existing.deletedAt) {
    throw new AuthServiceError(
      'EMAIL_ALREADY_EXISTS',
      'Email công việc này đã tồn tại trên hệ thống.',
      409,
    );
  }

  const role = await prisma.role.findUnique({
    where: { roleCode: input.roleCode },
  });
  if (!role) {
    throw new AuthServiceError('ROLE_NOT_FOUND', 'Vai trò BA không tồn tại.', 400);
  }

  const created = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: input.fullName.trim(),
          phone: input.phone ? input.phone.trim() : null,
          roleId: role.id,
          department: input.department,
          passwordHash: hashPassword(input.initialPassword),
          isActive: true,
          deletedAt: null,
        },
        include: { role: true },
      })
    : await prisma.user.create({
        data: {
          fullName: input.fullName.trim(),
          email: normalizedEmail,
          phone: input.phone ? input.phone.trim() : null,
          roleId: role.id,
          department: input.department,
          passwordHash: hashPassword(input.initialPassword),
          isActive: true,
        },
        include: { role: true },
      });

  await prisma.notification.create({
    data: {
      userId: created.id,
      title: 'Tài khoản Toàn Trung V2 đã được khởi tạo',
      summary: `Quản trị viên đã cấp quyền ${role.roleName} cho tài khoản của bạn.`,
      category: 'Hệ thống',
      actionLabel: 'Xem hồ sơ tài khoản',
      actionUrl: '/profile',
    },
  });

  await recordAuditLog({
    actorUserId,
    action: 'ADMIN_USER_CREATED',
    targetType: 'user',
    targetId: String(created.id),
    details: {
      email: created.email,
      roleCode: role.roleCode,
      department: created.department,
    },
    ipAddress,
  });

  return {
    id: created.id,
    fullName: created.fullName,
    email: created.email,
    phone: created.phone,
    avatarUrl: created.avatarUrl,
    roleId: created.roleId,
    roleCode: created.role.roleCode as RoleCode,
    roleName: created.role.roleName,
    department: created.department as DepartmentCode,
    isActive: created.isActive,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function updateAdminUser(
  actorUserId: number,
  input: UpdateUserDto,
  ipAddress?: string,
): Promise<AdminUserDto> {
  const target = await findUserById(input.userId);
  if (!target || target.deletedAt) {
    throw new AuthServiceError('USER_NOT_FOUND', 'Không tìm thấy tài khoản nhân sự.', 404);
  }

  if (target.id === actorUserId && input.isActive === false) {
    throw new AuthServiceError(
      'CANNOT_DISABLE_SELF',
      'Quản trị viên không thể tự khóa tài khoản đang đăng nhập của chính mình.',
      400,
    );
  }

  if (target.id === actorUserId && input.roleCode && input.roleCode !== 'ADMIN') {
    throw new AuthServiceError(
      'CANNOT_DEMOTE_SELF',
      'Quản trị viên không thể tự hạ quyền của chính mình.',
      400,
    );
  }

  // Prevent locking or demoting the last active Admin
  if (
    target.role.roleCode === 'ADMIN' &&
    target.isActive &&
    (input.isActive === false || (input.roleCode && input.roleCode !== 'ADMIN'))
  ) {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        deletedAt: null,
        isActive: true,
        role: { roleCode: 'ADMIN' },
        id: { not: target.id },
      },
    });
    if (otherActiveAdmins < 1) {
      throw new AuthServiceError(
        'CANNOT_REMOVE_LAST_ADMIN',
        'Hệ thống phải có ít nhất một Quản trị viên đang hoạt động.',
        400,
      );
    }
  }

  let roleId = target.roleId;
  if (input.roleCode) {
    const role = await prisma.role.findUnique({ where: { roleCode: input.roleCode } });
    if (!role) {
      throw new AuthServiceError('ROLE_NOT_FOUND', 'Vai trò BA không hợp lệ.', 400);
    }
    roleId = role.id;
  }

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone ? input.phone.trim() : null } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.resetPassword ? { passwordHash: hashPassword(input.resetPassword) } : {}),
      roleId,
    },
    include: { role: true },
  });

  if (
    input.isActive === false ||
    input.resetPassword ||
    (input.roleCode && input.roleCode !== target.role.roleCode)
  ) {
    await revokeAllUserSessionsExcept(updated.id);
  }

  await recordAuditLog({
    actorUserId,
    action: 'ADMIN_USER_UPDATED',
    targetType: 'user',
    targetId: String(updated.id),
    details: {
      roleCode: updated.role.roleCode,
      department: updated.department,
      isActive: updated.isActive,
      passwordReset: Boolean(input.resetPassword),
    },
    ipAddress,
  });

  return {
    id: updated.id,
    fullName: updated.fullName,
    email: updated.email,
    phone: updated.phone,
    avatarUrl: updated.avatarUrl,
    roleId: updated.roleId,
    roleCode: updated.role.roleCode as RoleCode,
    roleName: updated.role.roleName,
    department: updated.department as DepartmentCode,
    isActive: updated.isActive,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteAdminUser(
  actorUserId: number,
  targetUserId: number,
  ipAddress?: string,
): Promise<{ deletedId: number; email: string }> {
  if (targetUserId === actorUserId) {
    throw new AuthServiceError(
      'CANNOT_DELETE_SELF',
      'Quản trị viên không thể xóa tài khoản đang đăng nhập của chính mình.',
      400,
    );
  }

  const deletedTarget = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      include: { role: true },
    });

    if (!target || target.deletedAt) {
      throw new AuthServiceError(
        'USER_NOT_FOUND',
        'Tài khoản nhân sự không tồn tại hoặc đã bị xóa trước đó.',
        404,
      );
    }

    if (target.role.roleCode === 'ADMIN' && target.isActive) {
      const otherActiveAdmins = await tx.user.count({
        where: {
          deletedAt: null,
          isActive: true,
          role: { roleCode: 'ADMIN' },
          id: { not: target.id },
        },
      });
      if (otherActiveAdmins < 1) {
        throw new AuthServiceError(
          'CANNOT_DELETE_LAST_ADMIN',
          'Không thể xóa Quản trị viên đang hoạt động cuối cùng của hệ thống.',
          400,
        );
      }
    }

    const now = new Date();
    // Soft-delete account: preserves all related Leads, ownership references, uploaded assets, and audit logs
    await tx.user.update({
      where: { id: target.id },
      data: {
        deletedAt: now,
        isActive: false,
      },
    });

    // Immediately revoke all active sessions of the deleted user
    await tx.userSession.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: now },
    });

    return target;
  });

  await recordAuditLog({
    actorUserId,
    action: 'ADMIN_USER_DELETED',
    targetType: 'user',
    targetId: String(deletedTarget.id),
    details: {
      email: deletedTarget.email,
      fullName: deletedTarget.fullName,
      roleCode: deletedTarget.role.roleCode,
    },
    ipAddress,
  });

  return {
    deletedId: deletedTarget.id,
    email: deletedTarget.email,
  };
}
