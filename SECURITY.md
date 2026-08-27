# Security Policy

## Sensitive information

Never commit or share:

- `.env` files
- OpenAI API keys
- Yahoo client secrets
- Yahoo access or refresh tokens
- Yahoo passwords
- Private league exports or member information

OAuth credentials and tokens must be stored outside version control. Logs must redact secrets and authorization headers.

## Operating boundaries

- The application starts in dry-run mode.
- External writes are disabled unless explicitly enabled and supported by Yahoo.
- Trades and high-impact actions require human approval.
- Each team and league uses isolated state and audit history.

## Reporting an issue

Do not open a public issue containing credentials, tokens, private league data, or personal information. Revoke any exposed credential immediately and replace it before continuing.


