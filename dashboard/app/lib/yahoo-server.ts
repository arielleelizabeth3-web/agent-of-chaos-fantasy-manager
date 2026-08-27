import { env } from 'cloudflare:workers';

export const YAHOO_AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth';
export const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

export function yahooConfig() {
  return {
    clientId: env.YAHOO_CLIENT_ID?.trim() ?? '',
    clientSecret: env.YAHOO_CLIENT_SECRET?.trim() ?? '',
    encryptionKey: env.TOKEN_ENCRYPTION_KEY?.trim() ?? '',
  };
}

export async function encryptToken(value: string, encodedKey: string) {
  const rawKey = Uint8Array.from(atob(encodedKey), (char) => char.charCodeAt(0));
  if (rawKey.byteLength !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes.');
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
