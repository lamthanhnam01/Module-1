import { APP_CONFIG } from '../../../../../core/config';
import { getClientIp, jsonSuccess } from '../../../../../core/http';
import { logoutByToken } from '../../../../../core/auth/service';
import { extractSessionTokenFromRequest } from '../../../../../core/permissions';

export async function POST(req: Request) {
  const token = extractSessionTokenFromRequest(req);
  await logoutByToken(token, getClientIp(req));

  const isHttps =
    req.headers.get('x-forwarded-proto') === 'https' || req.url.startsWith('https://');
  const response = jsonSuccess({ loggedOut: true }, 200);
  response.cookies.set(APP_CONFIG.sessionCookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 0,
  });

  return response;
}

