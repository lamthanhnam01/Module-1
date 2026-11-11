import { CreateUserSchema, DeleteUserSchema, UpdateUserSchema } from '@toantrung/contracts';
import { getClientIp, jsonError, jsonSuccess } from '../../../../core/http';
import { requireAdminSession } from '../../../../core/permissions';
import {
  AuthServiceError,
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUser,
} from '../../../../core/auth/service';

export async function GET(req: Request) {
  const auth = await requireAdminSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;

  const users = await listAdminUsers();
  return jsonSuccess({ users });
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Dữ liệu gửi lên không hợp lệ.', 400);
  }

  const parsed = CreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Dữ liệu tạo tài khoản không hợp lệ.',
      400,
    );
  }

  try {
    const created = await createAdminUser(auth.user.id, parsed.data, getClientIp(req));
    return jsonSuccess({ user: created }, 201);
  } catch (err) {
    if (err instanceof AuthServiceError) {
      return jsonError(err.code, err.message, err.status);
    }
    return jsonError('USER_CREATE_ERROR', 'Không thể tạo tài khoản mới.', 500);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Dữ liệu gửi lên không hợp lệ.', 400);
  }

  const parsed = UpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Thông tin cập nhật tài khoản không hợp lệ.',
      400,
    );
  }

  try {
    const updated = await updateAdminUser(auth.user.id, parsed.data, getClientIp(req));
    return jsonSuccess({ user: updated });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      return jsonError(err.code, err.message, err.status);
    }
    return jsonError('USER_UPDATE_ERROR', 'Không thể cập nhật tài khoản.', 500);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Dữ liệu yêu cầu xóa không hợp lệ.', 400);
  }

  const parsed = DeleteUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Mã tài khoản cần xóa không hợp lệ.',
      400,
    );
  }

  try {
    const deleted = await deleteAdminUser(auth.user.id, parsed.data.userId, getClientIp(req));
    return jsonSuccess({ deleted });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      return jsonError(err.code, err.message, err.status);
    }
    return jsonError('USER_DELETE_ERROR', 'Không thể xóa tài khoản nhân sự lúc này.', 500);
  }
}
