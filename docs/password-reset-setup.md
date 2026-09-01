# Password Reset Email Setup

The dashboard issues a new random temporary password and emails it directly to the address stored for the user account. There is no reset link or second confirmation step — this deployment rotates across several LAN IPs with no fixed domain, so a reset link's base URL would frequently point at a server the user isn't currently on. The server never sends the user's previous plaintext password (it isn't recoverable — only its salted hash is stored); it only sends the freshly generated replacement.

## Local SMTP configuration

Copy the values below into the local `.env` file. Do not commit the `.env` file or a real SMTP password.

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password-or-app-password
SMTP_FROM_EMAIL=no-reply@example.com
SMTP_FROM_NAME=SKBP Pipeline Finder
SMTP_STARTTLS=true
SMTP_USE_SSL=false
PASSWORD_RESET_RESEND_SECONDS=60
```

Use the hostname, port, sender address, and credentials supplied by the chosen mail relay. Port 587 normally uses `SMTP_STARTTLS=true`; a relay that explicitly requires implicit TLS normally uses port 465 with `SMTP_USE_SSL=true` and `SMTP_STARTTLS=false`.

## User experience and safety

- The dashboard shows a processing overlay while the SMTP request is in progress.
- It shows the success message only after the SMTP relay accepts the message; SMTP failures display a clear retry/contact-admin message instead, and the user's existing password is left untouched (the new password is only written to `data/users.json` after delivery succeeds, so a failed send never locks anyone out).
- The same generic success response is used for unknown email addresses, so the login screen does not disclose whether an account exists.
- A successful reset invalidates all existing sessions, and repeat requests within `PASSWORD_RESET_RESEND_SECONDS` (60 seconds by default) are rate-limited to a no-op response instead of issuing another password.
- Because the temporary password travels in plaintext over email, treat the mailbox holding it as sensitive and log in promptly after receiving it.
- Signing in with a temporary password (from a self-service reset or a developer-triggered admin reset) automatically opens the "비밀번호 변경" (change password) dialog so the user can set a password of their own choosing; it also stays reachable any time from the account menu. `POST /api/auth/change-password` requires the current password, keeps only the session making the request, and clears the temporary-password flag.

## Shortlisting Action Date reminders

The same SMTP settings send an Action Date reminder to a Shortlisting owner at 09:00 Korea Standard Time on the Action Date while the local server is running. `ACTION_DATE_REMINDER_DAYS=0` is the default; change it to a comma-separated list only if earlier reminders are wanted, or disable this feature with `ACTION_DATE_REMINDERS_ENABLED=false`.

The owner must be entered as the exact name or email address of an active local dashboard account. The dashboard stores that account ID and email with the Shortlisting item, and records each successful reminder once per Action Date, reminder lead time, and recipient. If the local server is not running at 09:00 KST, it cannot send that day's scheduled reminder.
