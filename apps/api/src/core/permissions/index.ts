import { cookies } from 'next/headers';
import {
  hasBaPermission,
  type BaPermissionKey,
  type SessionUserDto,
} from '@toantrung/contracts';
import { APP_CONFIG } from '../config';
import { jsonError } from '../http';
import { resolveSessionFromToken } from '../auth/service';

export function extractSessionTokenFromRequest(req?: Request): string | null {
  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${APP_CONFIG.sessionCookieName}=`));
    if (match) {
      return decodeURIComponent(match.slice(APP_CONFIG.sessionCookieName.length + 1));
    }
  }
  try {
    const store = cookies();
    return store.get(APP_CONFIG.sessionCookieName)?.value ?? null;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedSession(
  req: Request,
  options: { requireCsrf?: boolean } = {},
): Promise<
  | { ok: true; sessionId: string; user: SessionUserDto }
  | { ok: false; response: ReturnType<typeof jsonError> }
> {
  const rawToken = extractSessionTokenFromRequest(req);
  const resolved = await resolveSessionFromToken(rawToken);
  if (!resolved) {
    return {
      ok: false,
      response: jsonError(
        'UNAUTHENTICATED',
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
        401,
      ),
    };
  }

  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
  const checkCsrf = options.requireCsrf ?? isMutation;
  if (checkCsrf) {
    const csrfHeader = req.headers.get(APP_CONFIG.csrfHeaderName);
    if (!csrfHeader || csrfHeader !== resolved.user.csrfToken) {
      return {
        ok: false,
        response: jsonError(
          'CSRF_INVALID',
          'Yêu cầu bị từ chối do thiếu hoặc sai mã bảo vệ phiên (CSRF).',
          403,
        ),
      };
    }
  }

  return { ok: true, sessionId: resolved.sessionId, user: resolved.user };
}

export async function requireAdminSession(req: Request, options: { requireCsrf?: boolean } = {}) {
  const auth = await requireAuthenticatedSession(req, options);
  if (!auth.ok) return auth;

  if (
    auth.user.roleCode !== 'ADMIN' ||
    !hasBaPermission(auth.user.roleCode, 'SYSTEM_USER_ADMIN')
  ) {
    return {
      ok: false as const,
      response: jsonError(
        'FORBIDDEN_ADMIN_ONLY',
        'Chức năng này chỉ dành cho Quản trị viên (ADMIN) theo ma trận phân quyền BA.',
        403,
      ),
    };
  }

  return auth;
}

export async function requirePermissionSession(
  req: Request,
  permission: BaPermissionKey,
  options: { requireCsrf?: boolean } = {},
) {
  const auth = await requireAuthenticatedSession(req, options);
  if (!auth.ok) return auth;

  if (!hasBaPermission(auth.user.roleCode, permission)) {
    return {
      ok: false as const,
      response: jsonError(
        'FORBIDDEN_PERMISSION',
        `Vai trò ${auth.user.roleName} không có quyền thực hiện thao tác này.`,
        403,
      ),
    };
  }

  return auth;
}

