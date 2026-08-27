import { ensureSchema, getD1 } from '@/db';
import { userFromRequest } from '@/app/lib/server-auth';
import { encryptToken, YAHOO_TOKEN_URL, yahooConfig } from '@/app/lib/yahoo-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return Response.redirect(new URL('/?connection=auth-required', request.url));
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return Response.redirect(new URL('/?connection=denied', request.url));
  await ensureSchema();
  const saved = await getD1().prepare('SELECT user_id, expires_at FROM oauth_states WHERE state = ?').bind(state)
    .first<{ user_id: string; expires_at: number }>();
  if (!saved || saved.user_id !== user.userId || saved.expires_at < Date.now()) {
    return Response.redirect(new URL('/?connection=invalid-state', request.url));
  }
  const { clientId, clientSecret, encryptionKey } = yahooConfig();
  if (!clientId || !clientSecret || !encryptionKey) return Response.redirect(new URL('/?connection=needs-credentials', request.url));
  const callbackUrl = new URL('/api/yahoo/callback', request.url).toString();
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(YAHOO_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ redirect_uri: callbackUrl, code, grant_type: 'authorization_code' }),
  });
  if (!response.ok) return Response.redirect(new URL('/?connection=exchange-failed', request.url));
  const tokens = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!tokens.access_token || !tokens.refresh_token) return Response.redirect(new URL('/?connection=exchange-failed', request.url));
  const now = new Date().toISOString();
  const accessToken = await encryptToken(tokens.access_token, encryptionKey);
  const refreshToken = await encryptToken(tokens.refresh_token, encryptionKey);
  await getD1().batch([
    getD1().prepare(`INSERT INTO yahoo_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET access_token = excluded.access_token,
      refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, updated_at = excluded.updated_at`)
      .bind(user.userId, accessToken, refreshToken, Date.now() + (tokens.expires_in ?? 3600) * 1000, now),
    getD1().prepare('DELETE FROM oauth_states WHERE state = ?').bind(state),
    getD1().prepare(`INSERT INTO audit_events (user_id, team, action, details_json, created_at)
      VALUES (?, 'account', 'yahoo_connected', '{}', ?)`).bind(user.userId, now),
  ]);
  return Response.redirect(new URL('/?connection=connected', request.url));
}
