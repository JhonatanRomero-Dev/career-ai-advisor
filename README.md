# Career AI Advisor

AI-powered resume analyzer with ATS scoring, skill detection, job recommendations, profile history and AI support.

## Stack

- Frontend: React, Vite, Tailwind, shadcn/ui, React Query
- Backend: Express, SQLite, Multer, pdfjs-dist, OpenAI/Groq SDK
- Auth: email/password plus 6-digit verification code

## Local Setup

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
```

Create environment files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Run backend:

```bash
cd backend
npm run dev
```

Run frontend:

```bash
npm run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`
- Readiness check: `http://localhost:3000/api/health/ready`

## Environment Notes

- `AI_PROVIDER=auto` uses OpenAI when `OPENAI_API_KEY` is set, otherwise Groq when `GROQ_API_KEY` is set.
- `OPENAI_MODEL` defaults to `gpt-4o-mini`; `GROQ_MODEL` defaults to `llama-3.3-70b-versatile`.
- Without an AI key, resume analysis still works with the local heuristic fallback.
- Auth data is stored in SQLite. User passwords are saved as salted hashes, and verification/reset codes are saved as hashes with expiration.
- Browser sessions use an `httpOnly` cookie by default, so the session token is not stored in frontend JavaScript. The frontend keeps only a non-sensitive user/expiration mirror in `localStorage` for UI state.
- Mutating API requests are protected with a CSRF token fetched from `/api/auth/csrf` and sent as `x-csrf-token`.
- Configure SMTP before testing with real users. The login page then offers a passwordless email code: enter an address, receive the six-digit code, and verify it. The account is created after a valid code if it does not exist yet. Without SMTP, existing verified accounts can still sign in with a password; code login, registration and password recovery are unavailable.
- For local-only auth testing without SMTP, set `ALLOW_DEV_EMAIL_FALLBACK=true` to print codes in the backend console. Set `EXPOSE_DEV_AUTH_CODE=true` and `VITE_SHOW_DEV_AUTH_CODE=true` only if you intentionally want the app to show test codes. Set `DEV_AUTH_TEST_EMAIL` to restrict this fallback to one test address when sharing a temporary tunnel.
- For an email-only mobile demo, build a separate frontend with `VITE_DEMO_EMAIL_LOGIN=true` and run a development backend with `DEMO_EMAIL_LOGIN=true`, `SQLITE_DB_PATH` pointing to `.codex-logs/mobile-demo.sqlite`, `ALLOW_DEV_EMAIL_FALLBACK=true`, and `EXPOSE_DEV_AUTH_CODE=true`. Set `FRONTEND_DIST_PATH` to the separate frontend build. This allows any email and shows its code only in the isolated demo database.
- To enable real email codes, fill `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` in `backend/.env`, then restart the backend. Keep `ALLOW_DEV_EMAIL_FALLBACK=false` and `EXPOSE_DEV_AUTH_CODE=false` outside isolated tests. Run `cd backend && npm run test:email -- your@email.com` to verify delivery. For Gmail, use an app password in `SMTP_PASS`, not your normal account password.
- In production, configure `AUTH_CODE_SECRET`, `OAUTH_STATE_SECRET`, SMTP, CORS and the frontend URL.
- In production, keep `AUTH_COOKIE_SECURE=true`. Use `AUTH_COOKIE_SAME_SITE=lax` when frontend/backend are same-site, or `none` with HTTPS when they are on truly cross-site domains. Set `AUTH_COOKIE_DOMAIN` only when sharing cookies across subdomains.
- Set `ASYNC_ANALYSIS_JOBS=true` to make resume uploads return a persisted job and process analysis in the backend queue. Queued/processing jobs are stored in the database and interrupted jobs are requeued on backend startup.
- Set `ADMIN_EMAILS=admin@example.com` or `ADMIN_USER_IDS=user_id` to grant access to `/admin`. The admin dashboard shows users, analysis jobs, payments, payment webhooks and AI failure/fallback events.
- Configure `RESUME_TEXT_ENCRYPTION_KEY` in production if you want to keep extracted resume text for improved-resume generation. With `RESUME_TEXT_STORAGE=auto`, extracted text is encrypted when a resume key or `AUTH_CODE_SECRET` exists; otherwise production stores no raw resume text.
- Set `RESUME_TEXT_STORAGE=off` to never persist extracted resume text, `encrypted` to require encryption, or `plain` only for trusted local development.
- Set `RESUME_TEXT_RETENTION_DAYS=30` or another non-negative value to automatically clear stored extracted resume text older than that many days while keeping the analysis report.
- LGPD/self-service privacy controls are available in Profile and through `/api/privacy/export`, `/api/privacy/resume-texts`, `/api/privacy/analyses` and `/api/privacy/account`.
- `API_RATE_LIMIT_WINDOW_MS` and `API_RATE_LIMIT_MAX` protect `/api` endpoints from abusive request bursts.
- The API sends CSP, anti-framing, content-type, referrer and permissions headers. Production also enables HSTS.
- `SHUTDOWN_TIMEOUT_MS` controls how long the backend waits for open requests during `SIGTERM`/`SIGINT` before forcing shutdown.
- `PAYMENT_GATEWAY=mercadopago` enables real checkout when `MERCADO_PAGO_ACCESS_TOKEN` is configured.
- `MERCADO_PAGO_WEBHOOK_SECRET` validates payment notifications before activating paid plans.
- Payment webhooks are stored with idempotency control, so repeated Mercado Pago notifications do not renew the same checkout twice.
- Return URLs include the local checkout id and the dashboard reconciles the checkout status after the user comes back from Mercado Pago.
- Paid subscriptions use Mercado Pago Preapproval for automatic monthly renewal, synchronize subscription/payment webhooks and retain access until the paid period ends after cancellation.
- Configure the `payment`, `subscription_preapproval` and `subscription_authorized_payment` webhook events in Mercado Pago.
- `BACKEND_PUBLIC_URL` or `MERCADO_PAGO_NOTIFICATION_URL` should point to a public HTTPS backend URL for webhooks.
- `ALLOW_DEMO_CHECKOUT=true` enables the local demo checkout fallback; keep it `false` when testing a real gateway.
- `SQLITE_DB_PATH` can point the backend to a custom SQLite file, useful for automated tests. Local SQLite databases under `backend/data` are ignored by Git.
- `DATABASE_URL=postgres://...` enables the migration runner to apply Postgres migrations with `cd backend && npm run migrate`. The app runtime still defaults to SQLite until the data adapter is switched.
- Uploaded resume files are parsed and deleted after analysis. Structured results stay in SQLite; extracted source text follows the `RESUME_TEXT_STORAGE` and `RESUME_TEXT_RETENTION_DAYS` privacy settings.
- First-party product analytics stores only allowlisted events/properties. User IDs are HMAC-pseudonymized; resume text, name and email are never analytics properties. Users can opt out in Profile and browser Do Not Track is respected.
- AI regression fixtures cover multiple career profiles. Run `npm run eval:ai` before changing prompts, models or scoring rules.
- Operational backup and incident procedures are documented in `docs/OPERATIONS.md`; run `cd backend && npm run backup` for a verified SQLite snapshot.

## Current Product Scope

The resume editor, saved versions, PDF/DOCX exports, vacancy adaptation, application reminders and user testing metrics are documented in [Resume journey](docs/RESUME_JOURNEY.md).

The six product improvement areas (job filters, professional profile, intelligent search, login, feedback and AI support) are documented in [Product improvements](docs/PRODUCT_IMPROVEMENTS.md), including provider setup and the user testing guide.

Implemented:

- Landing page
- Email/password registration and login with verification code
- Resume upload in PDF/DOCX
- Optional target-job description analysis with job match score
- ATS, clarity and market compatibility report
- Analysis history
- Recommended job search links
- Profile page
- AI support chat
- Per-user job notifications
- Synced improvement checklist per analysis
- Admin dashboard for users, analysis jobs, payments, webhooks and AI events
- LGPD controls to export data, clear extracted resume text, delete analyses and delete the account
- Mercado Pago checkout for paid plans, with optional demo subscription activation for local tests

Demo limitations:

- Webhook delivery needs a public HTTPS backend URL; localhost requires a tunnel such as ngrok for end-to-end payment testing.
- Paid plans require production Mercado Pago credentials and public signed webhooks for end-to-end renewal synchronization.
- Job recommendations combine live providers with safe search links when fewer verified matches are available.
- OAuth buttons require provider credentials before they work.

LinkedIn OAuth setup:

- In `backend/.env`, set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.
- In the LinkedIn Developer Portal, enable **Sign In with LinkedIn using OpenID Connect**.
- Add this local redirect URL: `http://localhost:3000/api/auth/oauth/linkedin/callback`.
- For deployed environments, also set `OAUTH_REDIRECT_BASE_URL` to the public backend URL and add the matching `/api/auth/oauth/linkedin/callback` URL in LinkedIn.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run build:check
npm run test:backend
npm run eval:ai
npm run test:e2e
```

## Documentation

- [`docs/ARCHITECTURE.md`](C:\Users\Pichau\OneDrive\Documentos\Career AI Advisor\docs\ARCHITECTURE.md)
- [`docs/API.md`](C:\Users\Pichau\OneDrive\Documentos\Career AI Advisor\docs\API.md)
- [`docs/DEPLOYMENT.md`](C:\Users\Pichau\OneDrive\Documentos\Career AI Advisor\docs\DEPLOYMENT.md)
- [`docs/TROUBLESHOOTING.md`](C:\Users\Pichau\OneDrive\Documentos\Career AI Advisor\docs\TROUBLESHOOTING.md)
- [`docs/CONTRIBUTING.md`](C:\Users\Pichau\OneDrive\Documentos\Career AI Advisor\docs\CONTRIBUTING.md)
- [`docs/OPERATIONS.md`](C:\Users\Pichau\OneDrive\Documentos\Career AI Advisor\docs\OPERATIONS.md)

Backend smoke upload:

```bash
cd backend
npm run migrate
npm test
npm run smoke:upload
```
