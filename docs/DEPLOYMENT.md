# Deployment

This project can run locally with SQLite or in production with stricter settings.

## Required Environment

Frontend:

- `VITE_API_BASE_URL` if the frontend must call a backend on a different origin.

Backend:

- `FRONTEND_URL`
- `CORS_ORIGIN`
- `DATABASE_PROVIDER=sqlite`
- `SQLITE_DB_PATH` set to an absolute path on a persistent mounted volume
- `AUTH_CODE_SECRET`
- `OAUTH_STATE_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

If you use payments:

- `PAYMENT_GATEWAY=mercadopago`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `BACKEND_PUBLIC_URL` or `MERCADO_PAGO_NOTIFICATION_URL`

If you use AI:

- `AI_PROVIDER=openai`, `groq` or `auto`
- `OPENAI_API_KEY` or `GROQ_API_KEY`

If you want encrypted resume text:

- `RESUME_TEXT_ENCRYPTION_KEY`

## Production Checklist

1. Set `NODE_ENV=production`.
2. Use public HTTPS URLs for frontend and backend.
3. Keep `AUTH_COOKIE_SECURE=true`.
4. Keep `AUTH_RETURN_TOKEN_IN_RESPONSE=false`.
5. Keep `ALLOW_DEV_EMAIL_FALLBACK=false`.
6. Keep `EXPOSE_DEV_AUTH_CODE=false`.
7. Keep `ALLOW_DEMO_CHECKOUT=false`.
8. Avoid `RESUME_TEXT_STORAGE=plain`.
9. Configure CORS with explicit origins only.
10. Point `SQLITE_DB_PATH` to a persistent volume and rehearse a backup restore.
11. Verify the backend health endpoints return `ready` and report the expected SQLite path.

## Runtime Notes

- The backend runtime uses SQLite. Production startup requires `DATABASE_PROVIDER=sqlite` and an absolute `SQLITE_DB_PATH` on storage that survives restarts and redeploys.
- `DATABASE_URL` is used by the Postgres migration runner. Postgres is not yet supported by the application runtime; production startup rejects a Postgres runtime configuration.
- A configured path alone does not make storage durable: mount a persistent volume at that path in the hosting platform.
- Webhooks need a public HTTPS backend URL; localhost is fine for development only when tunneled through a public endpoint.
- `public/maintenance.json` can be used to show a maintenance screen without redeploying the app shell.

## Recommended Release Flow

1. Run the validation commands.
2. Deploy the backend.
3. Confirm `/api/health/ready`.
4. Deploy the frontend.
5. Test login, resume upload, checkout, privacy export and admin access.
