import { ensureSchema, getD1 } from '@/db';
import { unauthorized, userFromRequest } from '@/app/lib/server-auth';
import { YAHOO_AUTH_URL, yahooConfig } from '@/app/lib/yahoo-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  const { clientId, clientSecret, encryptionKey } = yahooConfig();
  if (!clientId || !clientSecret || !encryptionKey) return Response.redirect(new URL('/?connection=needs-credentials', request.url));

  await ensureSchema();
  const state = crypto.randomUUID();
  await getD1().batch([
    getD1().prepare('DELETE FROM oauth_states WHERE expires_at < ?').bind(Date.now()),
    getD1().prepare('INSERT INTO oauth_states (state, user_id, expires_at) VALUES (?, ?, ?)').bind(state, user.userId, Date.now() + 10 * 60_000),
  ]);
  const callbackUrl = new URL('/api/yahoo/callback', request.url).toString();
  const target = new URL(YAHOO_AUTH_URL);
  target.searchParams.set('client_id', clientId);
  target.searchParams.set('redirect_uri', callbackUrl);
  target.searchParams.set('response_type', 'code');
  target.searchParams.set('state', state);
  return Response.redirect(target);
}
