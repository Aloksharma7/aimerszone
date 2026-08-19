# Production deployment

`.env.example` is tuned for local development. Every value below must change
before this is exposed to real students and real money.

## Required environment changes

```env
APP_ENV=production
APP_DEBUG=false                 # leaking stack traces exposes schema and paths
APP_URL=https://api.your-domain
FRONTEND_URL=https://your-domain

SESSION_SECURE_COOKIE=true      # the session cookie must be HTTPS-only
SESSION_DOMAIN=.your-domain     # shared parent domain for API and frontend
SANCTUM_STATEFUL_DOMAINS=your-domain
CORS_ALLOWED_ORIGINS=https://your-domain

MAIL_MAILER=smtp                # "log" silently discards every reset link
QUEUE_CONNECTION=database       # or redis
CACHE_STORE=redis               # database cache works, redis is better
```

Generate a fresh `APP_KEY` on the production host. Never reuse the development
key — it decrypts two-factor secrets and every encrypted setting.

## Required processes

```
# scheduler — attempt expiry, Zoom sync, enrollment expiry, health checks
* * * * * cd /path/to/api && php artisan schedule:run >> /dev/null 2>&1

# queue worker — password reset emails and batch progress recalculation
php artisan queue:work --tries=3 --timeout=300
```

**The queue worker is not optional.** Password reset emails and post-attendance
progress recalculation are queued. Without a worker, reset links are never sent
and progress figures stop updating — with no visible error.

Run the worker under a supervisor (systemd, Supervisor, or the platform's
equivalent) so it restarts on failure and on deploy.

## Deploy sequence

```bash
php artisan down --render=errors::503
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan queue:restart          # workers must reload the new code
php artisan up
```

Do not run `php artisan db:seed` on an existing production database — the
seeders are idempotent for roles and settings, but `AdministratorSeeder` should
run exactly once, at first install.

Never run `DemoContentSeeder` in production. It refuses without an interactive
confirmation, but the safe habit is simply not to invoke it.

## First-install checklist

1. `php artisan migrate --seed` — note the administrator password it prints once
2. Sign in, change that password immediately (the account is flagged to force it)
3. `/admin/settings` — institution identity, support contacts, security thresholds
4. `/admin/settings` — real payment account numbers and QR images
5. Create the enrollment officer, accountant and teacher accounts
6. `/admin/integrations` — connect Zoom and YouTube once credentials exist
7. Confirm `/admin/dashboard` readiness scores are green before opening registration

## Storage and backups

Payment evidence lives on the private disk at `storage/app/private`. It is
**not** in the database and **not** in a database dump.

Back up both, together:

- the MySQL database (money, enrollments, audit trail)
- `storage/app/private` (the evidence behind every approved payment)

A database restored without the matching evidence directory leaves approved
payments with no supporting document, which is exactly what an auditor asks for.
Test a restore before you need one.

## Security posture already in place

- Sanctum stateful cookies; no bearer tokens issued to browsers
- Credentialed CORS with explicit origins, never a wildcard
- Uniform login failure regardless of whether the account exists
- Progressive account lockout on repeated failures, thresholds admin-controlled
- Every privileged and money-touching action written to an append-only audit log
- Payment evidence on a private disk, served only through short-lived signed
  routes that re-run authorization when opened
- Stored evidence MIME detected from file content, never the client's claim
- Separation of duties on payments, refunds and enrollment exceptions
- Idempotency keys on every sensitive mutation
- CSV exports escape formula-leading characters

## Known gaps to accept or close before launch

| Gap | Impact | Suggested action |
|---|---|---|
| Receipt PDFs are not generated | Students see receipt data but download yields nothing | Close before launch if receipts are promised |
| No automated backup verification | A silent backup failure is invisible | Close before launch |
| `topic_performance` returns empty | Result screen shows no topic breakdown | Acceptable at launch |
| Zoom attendance import needs a paid plan | Import returns an explanatory empty result | Acceptable — manual marking works |
| No APM or error tracking configured | Production failures found only via logs | Add Sentry or equivalent |
| Rate limits are per-instance | Multi-server deployments need shared state | Point the cache store at Redis |
