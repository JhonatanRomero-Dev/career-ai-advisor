# Contributing

## Local Setup

```bash
npm install
cd backend
npm install
```

Create the environment files:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

## Useful Commands

- `npm run lint`
- `npm run typecheck`
- `npm run build:check`
- `npm run test:backend`
- `npm run test:e2e`
- `npm run eval:ai`

Backend-only commands:

- `cd backend && npm test`
- `cd backend && npm run migrate`
- `cd backend && npm run smoke:upload`

## Suggested Workflow

1. Make a focused change.
2. Run the smallest relevant test first.
3. Expand to lint, typecheck and E2E if the change is cross-cutting.
4. Keep documentation updated when behavior changes.

## Notes

- Avoid committing generated databases or other runtime data.
- Prefer small, surgical changes.
- Keep new docs aligned with the actual routes and scripts in the repo.
