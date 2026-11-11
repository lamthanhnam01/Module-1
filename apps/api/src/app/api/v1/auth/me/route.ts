import { jsonSuccess } from '../../../../../core/http';
import { requireAuthenticatedSession } from '../../../../../core/permissions';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedSession(req, { requireCsrf: false });
  if (!auth.ok) return auth.response;

  return jsonSuccess({ user: auth.user });
}

