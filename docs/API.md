# API Reference

All API routes live under `/api`.

## Health

- `GET /api/health`
- `GET /api/health/live`
- `GET /api/health/ready`

## Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/request-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/reset-password`
- `POST /api/auth/oauth/exchange`
- `GET /api/auth/csrf`
- `GET /api/auth/me`
- `GET /api/auth/profile`
- `PATCH /api/auth/profile`
- `POST /api/auth/logout`
- `GET /api/auth/oauth/:provider/start`
- `GET /api/auth/oauth/:provider/callback`

## Analysis

- `POST /api/analysis`
- `GET /api/analysis`
- `GET /api/analysis/usage`
- `GET /api/analysis/jobs/:jobId`
- `GET /api/analysis/:id/tasks`
- `POST /api/analysis/:id/jobs/refresh`
- `PATCH /api/analysis/:id/tasks`
- `POST /api/analysis/:id/improved-resume`
- `GET /api/analysis/:id`
- `DELETE /api/analysis/:id`

## Jobs

- `GET /api/jobs/tracked`
- `POST /api/jobs/tracked`
- `PATCH /api/jobs/tracked/:externalId`
- `DELETE /api/jobs/tracked/:externalId`

## Notifications

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/read-all`
- `PATCH /api/notifications/:id/read`

## Support

- `POST /api/support/chat`

## Privacy

- `GET /api/privacy/export`
- `DELETE /api/privacy/resume-texts`
- `DELETE /api/privacy/analyses`
- `DELETE /api/privacy/account`

## Subscription

- `GET /api/subscription`
- `POST /api/subscription/checkout`
- `GET /api/subscription/checkout/:checkoutId`
- `POST /api/subscription/demo-checkout`
- `DELETE /api/subscription`
- `POST /api/subscription/webhook/mercadopago`

## Analytics

- `POST /api/analytics/events`

## Admin

- `GET /api/admin/dashboard`
- `POST /api/admin/analysis-jobs/:jobId/retry`

## Request Conventions

- Authenticated requests use the session cookie.
- Mutating requests should fetch a CSRF token from `/api/auth/csrf` and send it as `x-csrf-token`.
- Most endpoints return JSON in the form `{ success, ... }`.
- Uploads to `/api/analysis` accept multipart form data with the `resume` file field.
