import { env } from 'cloudflare:workers';
import { ensureSchema, getD1 } from '@/db';
import { unauthorized, userFromRequest } from '@/app/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  await ensureSchema();
  const token = await getD1().prepare('SELECT expires_at FROM yahoo_tokens WHERE user_id = ?').bind(user.userId)
    .first<{ expires_at: number }>();
  const callbackUrl = new URL('/api/yahoo/callback', request.url).toString();
  return Response.json({
    configured: Boolean(env.YAHOO_CLIENT_ID && env.YAHOO_CLIENT_SECRET && env.TOKEN_ENCRYPTION_KEY),
    connected: Boolean(token),
    expiresAt: token?.expires_at ?? null,
    callbackUrl,
    accessMode: 'read-only',
  });
}
