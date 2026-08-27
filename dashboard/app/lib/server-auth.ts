export type AuthenticatedUser = {
  userId: string;
  email: string;
  displayName: string;
};

export function userFromRequest(request: Request): AuthenticatedUser | null {
  const userId = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (userId && email) return { userId, email, displayName: displayName(request.headers, email) };

  if (process.env.NODE_ENV === 'development') {
    return { userId: 'local-preview-user', email: 'local@agentofchaos.test', displayName: 'Local preview' };
  }
  return null;
}

function displayName(headers: Headers, fallback: string) {
  const value = headers.get('oai-authenticated-user-full-name');
  if (!value || headers.get('oai-authenticated-user-full-name-encoding') !== 'percent-encoded-utf-8') return fallback;
  try { return decodeURIComponent(value); } catch { return fallback; }
}

export function unauthorized() {
  return Response.json({ error: 'Authentication required.' }, { status: 401 });
}
