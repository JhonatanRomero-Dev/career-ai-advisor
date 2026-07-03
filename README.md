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

## Environment Notes

- `AI_PROVIDER=auto` uses OpenAI when `OPENAI_API_KEY` is set, otherwise Groq when `GROQ_API_KEY` is set.
- `OPENAI_MODEL` defaults to `gpt-4o-mini`; `GROQ_MODEL` defaults to `llama-3.3-70b-versatile`.
- Without an AI key, resume analysis still works with the local heuristic fallback.
- Auth data is stored in SQLite. User passwords are saved as salted hashes, and verification/reset codes are saved as hashes with expiration.
- Configure SMTP before testing with real users. Without SMTP, auth code requests fail by default.
- For local-only auth testing without SMTP, set `ALLOW_DEV_EMAIL_FALLBACK=true` to print codes in the backend console. Set `EXPOSE_DEV_AUTH_CODE=true` and `VITE_SHOW_DEV_AUTH_CODE=true` only if you intentionally want the app to show test codes.
- To test SMTP directly, run `cd backend && npm run test:email -- your@email.com`. For Gmail, use an app password in `SMTP_PASS`, not your normal account password.
- In production, configure `AUTH_CODE_SECRET`, `OAUTH_STATE_SECRET`, SMTP, CORS and the frontend URL.
- `PAYMENT_GATEWAY=mercadopago` enables real checkout when `MERCADO_PAGO_ACCESS_TOKEN` is configured.
- `MERCADO_PAGO_WEBHOOK_SECRET` validates payment notifications before activating paid plans.
- `BACKEND_PUBLIC_URL` or `MERCADO_PAGO_NOTIFICATION_URL` should point to a public HTTPS backend URL for webhooks.
- `ALLOW_DEMO_CHECKOUT=true` enables the local demo checkout fallback; keep it `false` when testing a real gateway.
- `SQLITE_DB_PATH` can point the backend to a custom SQLite file, useful for automated tests.
- Uploaded resumes are parsed and deleted after successful analysis; structured results stay in SQLite.

## Current Product Scope

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
- Mercado Pago checkout for paid plans, with optional demo subscription activation for local tests

Demo limitations:

- Webhook delivery needs a public HTTPS backend URL; localhost requires a tunnel such as ngrok for end-to-end payment testing.
- Paid plans are activated after approved payment confirmation; recurring billing periods are not enforced yet.
- Job recommendations are generated/search-link based, not a live job-board integration.
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
npm run build
npm run test:backend
```

Backend smoke upload:

```bash
cd backend
npm test
npm run smoke:upload
```
