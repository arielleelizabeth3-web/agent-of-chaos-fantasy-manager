declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    YAHOO_CLIENT_ID?: string;
    YAHOO_CLIENT_SECRET?: string;
    TOKEN_ENCRYPTION_KEY?: string;
  }
}
