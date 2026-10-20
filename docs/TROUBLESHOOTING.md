# Troubleshooting

## The app opens but login fails

- Confirm SMTP is configured.
- For local development, enable `ALLOW_DEV_EMAIL_FALLBACK=true` only when you want codes printed in the backend console.
- Check that `AUTH_CODE_SECRET` is set.

## Resume upload returns 415 or 422

- Only PDF and DOCX files are accepted.
- The file must really be a resume, not just a renamed document.
- Verify the file is smaller than 10 MB.

## Checkout or webhook updates do not arrive

- Confirm `PAYMENT_GATEWAY=mercadopago`.
- Confirm the webhook secret is set.
- Use a public HTTPS backend URL.
- If the app is local, use a tunnel such as ngrok for end-to-end webhook testing.

## Analysis falls back to heuristics

- Check `OPENAI_API_KEY` or `GROQ_API_KEY`.
- Review `AI_PROVIDER`.
- If no key is configured, the app still works, but analysis quality is limited.

## Profile or privacy actions return 403

- The request probably missed the CSRF token.
- Fetch `/api/auth/csrf` first and send `x-csrf-token`.
- Make sure the session cookie is included in the request.

## Health check is not ready

- Check that the configured database exists.
- If `DATABASE_URL` points to Postgres, confirm that Postgres is reachable.
- Review the backend logs for config validation errors.

## Mobile tests fail on profile actions

- This usually means a card or button layout is overlapping the target control.
- Check the profile privacy section and verify buttons remain full-width on small screens.
