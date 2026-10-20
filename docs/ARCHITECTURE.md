# Architecture

This project is split into a React frontend and an Express backend.

## Frontend

- `src/App.jsx` defines the route tree and lazy-loads pages.
- `src/components/layout/AppLayout.jsx` provides the authenticated shell with sidebar, top bar and notifications.
- `src/pages/` holds the main screens: landing, login, dashboard, upload, analysis, history, jobs, profile, support and admin.
- `src/api/base44Client.js` centralizes API access, auth, subscription, privacy and analytics calls.

## Backend

- `backend/server.js` boots Express, applies security headers, CORS, rate limiting and CSRF protection, then mounts the API routes.
- `backend/controllers/` contains the business logic.
- `backend/routes/` exposes the public API surface.
- `backend/src/db.js` and `backend/src/databaseProvider.js` handle persistence and runtime database selection.
- `backend/migrations/postgres/` stores the SQL migrations used when Postgres is configured.

## Main Flows

### Authentication

1. The user registers or logs in.
2. The backend sends or prints a verification code.
3. The frontend stores the session mirror locally and keeps the real session in an HTTP-only cookie.
4. Authenticated requests reuse the cookie and fetch a CSRF token from `/api/auth/csrf` before mutating data.

### Resume Analysis

1. The user uploads a PDF or DOCX resume.
2. The backend validates the file, extracts text and runs the analysis pipeline.
3. The result is stored in the database and shown in the analysis report.
4. When async mode is enabled, the upload returns a job and the frontend polls for completion.

### Jobs And Recommendations

- Tracked jobs live under `/api/jobs/tracked`.
- Analysis pages can refresh real job recommendations and keep a per-analysis checklist in sync.
- The frontend shows safe search links when verified matches are limited.

### Billing

- Checkout and subscription state are managed under `/api/subscription`.
- Mercado Pago webhooks update payment and subscription records.
- Demo checkout can be enabled for local testing only.

### Privacy And Admin

- Privacy endpoints export data, clear extracted text, delete analyses and delete the account.
- Admin access is restricted by configured admin emails or IDs.
- The admin dashboard surfaces users, jobs, payments, webhooks and AI fallback/failure events.

## Data Stores

- SQLite is the default runtime database.
- Postgres migrations exist, but the application runtime still defaults to SQLite until the adapter is switched.
- Uploaded resume files are parsed and deleted after analysis.
- Extracted resume text can be stored encrypted, stored in plain text only for trusted local dev, or disabled entirely.
