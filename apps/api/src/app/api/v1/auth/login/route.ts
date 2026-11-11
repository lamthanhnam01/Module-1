import { LoginRequestSchema } from '@toantrung/contracts';
import { APP_CONFIG } from '../../../../../core/config';
import { checkRateLimit, getClientIp, jsonError, jsonSuccess } from '../../../../../core/http';
import { authenticateUser, AuthServiceError } from '../../../../../core/auth/service';

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`login:${ip}`, 10, 60_000)) {
    return jsonError(
      'RATE_LIMITED',
      'Quá nhiều lần thử đăng nhập. Vui lòng đợi 1 phút rồi thử lại.',
      429,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('INVALID_JSON', 'Dữ liệu gửi lên không đúng định dạng JSON.', 400);
  }

  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message || 'Thông tin đăng nhập không hợp lệ.',
      400,
      parsed.error.flatten(),
    );
  }

  try {
    const result = await authenticateUser({
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    const isHttps =
      req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://');
    const response = jsonSuccess({ user: result.user }, 200);
    response.cookies.set(APP_CONFIG.sessionCookieName, result.rawSessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      expires: result.expiresAt,
    });

    return response;
  } catch (err) {
    if (err instanceof AuthServiceError) {
      return jsonError(err.code, err.message, err.status);
    }
    return jsonError(
      'AUTH_UNAVAILABLE',
      'Dịch vụ xác thực hiện chưa kết nối cơ sở dữ liệu.',
      503,
    );
  }
}

