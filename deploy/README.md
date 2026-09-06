# Automated deploy: push to GitHub → live on the VPS

## How it works

- `.github/workflows/deploy-api.yml` runs on every push to `main` that touches
  `nepal-lms-api/**`, and SSHes into the VPS to run `deploy/deploy-api.sh`.
- `.github/workflows/deploy-web.yml` does the same for `nepal-lms-frontend/**`,
  running `deploy/deploy-web.sh`.
- A frontend-only push never touches the API and vice versa.
- Nothing is exposed on the VPS — GitHub's runner opens an outbound SSH
  connection to your VPS, so there is no inbound webhook/port to secure.

Actual layout on this VPS (discovered, not assumed — see below):

```
/var/www/myapp/repo   single git clone, branch main (source of truth)
/var/www/myapp/api    symlink -> repo/nepal-lms-api      (Laravel, via php-fpm)
/var/www/myapp/web    symlink -> repo/nepal-lms-frontend (Next.js, via systemd)
```

`.env`, `storage/`, and `vendor/` for the API, and `node_modules/`/`.next/`
for the frontend, are all git-ignored — `git reset --hard` during a deploy
never touches them, so uploaded files, sessions, and secrets survive every
deploy untouched.

**Two independent things keep the app running, and the deploy scripts only
ever restart them — they don't create or own them:**

- **`aimerszone-next` systemd unit** (`/etc/systemd/system/aimerszone-next.service`,
  already existed on this VPS) runs `npm run start` with
  `WorkingDirectory=/var/www/myapp/web`. `deploy-web.sh` runs
  `npm ci && npm run build`, then `sudo systemctl restart aimerszone-next`.
  This is a plain `next start` process, not the Next.js standalone build.
  `next.config.ts` no longer sets `output: "standalone"` — that setting is
  incompatible with `next start` (Next.js warns about it directly) and one
  real side effect was that `next start` silently skipped loading
  `.env.production.local`, which is how `API_INTERNAL_URL` ended up stuck on
  its `127.0.0.1:8000` fallback in production despite the file existing.
- **`api-queue` PM2 process** (defined in `deploy/ecosystem.config.js`) runs
  `php artisan queue:work`, because this app actually queues jobs
  (`ProvisionClassMeetings`, `RecalculateBatchProgress`, notifications) —
  this was missing in production until this setup. The API itself needs no
  process manager: PHP-FPM (`php8.3-fpm.service`) already serves it per
  request via the `aimerszone-api` nginx site.

The Laravel scheduler (Zoom sync, and anything else on `Schedule::command`)
needs a real system cron entry — neither PM2 nor systemd replaces that.

## One-time setup still needed on this VPS

Everything below reflects what's *actually* on this VPS, confirmed while
fixing the first deploy — not the generic assumption this file started with.

### 1. GitHub repo secrets (Settings → Secrets and variables → Actions)

| Secret        | Value                                                        |
|---------------|---------------------------------------------------------------|
| `VPS_HOST`    | the VPS's **real public IP or hostname** (`103.235.196.98`) — **not** a Tailscale IP (`100.x.x.x`); GitHub's runners aren't on your tailnet and can't reach one |
| `VPS_USER`    | `deploy`                                                       |
| `VPS_SSH_KEY` | a private key whose public half is in `deploy`'s `~/.ssh/authorized_keys` on the VPS |

Port 22 is already open to the internet on this VPS (`sudo ufw status` shows
`22/tcp ALLOW IN Anywhere`), so the real public IP works directly — no extra
firewall change needed.

**Set `VPS_SSH_KEY` with the GitHub CLI, not copy-paste.** A multi-line
private key pasted through a terminal is an easy way to silently corrupt it
(a wrapped line merges, a stray character sneaks in) — the symptom is
`ssh: no key found` in the Action's log even though the key file itself is
fine. From the VPS, once `gh auth login` is done:

```bash
gh secret set VPS_SSH_KEY --repo Aloksharma7/aimerszone < ~/.ssh/gh_actions_deploy
```

This pipes the file's exact bytes to GitHub's API — nothing to mistype or
mis-paste.

### 2. Let the deploy user restart the web service without a password

GitHub Actions SSHes in as `deploy` and needs `deploy-web.sh` to run
`sudo systemctl restart aimerszone-next` non-interactively. Scope the sudo
grant to exactly that one command:

```bash
sudo visudo -f /etc/sudoers.d/aimerszone-deploy
```

Add this single line, then save:

```
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart aimerszone-next
```

### 3. Create the frontend's production env file

This is the actual root cause of the first production incident: nothing had
ever told the Next.js app where the API lives, so it fell back to
`http://127.0.0.1:8000` — a placeholder from the `.env.production.example`
template — while the real API is served at `https://api.aimerszone.edu.np`
(confirmed via the `aimerszone-api` nginx site, already enabled, proxying to
`php8.3-fpm.sock`).

Create `/var/www/myapp/repo/nepal-lms-frontend/.env.production.local`:

```
NODE_ENV="production"
NEXT_PUBLIC_APP_NAME="Aimers Zone"
NEXT_PUBLIC_APP_URL="https://aimerszone.edu.np"
NEXT_PUBLIC_SUPPORT_PHONE="<fill in>"
NEXT_PUBLIC_WHATSAPP_NUMBER="<fill in>"
NEXT_PUBLIC_SUPPORT_EMAIL="<fill in>"
NEXT_PUBLIC_ADDRESS="<fill in>"
NEXT_PUBLIC_MAP_URL="<fill in>"
NEXT_PUBLIC_SUPPORT_HOURS="<fill in>"

# Same-origin browser requests through Next.js rewrites — keep this empty.
NEXT_PUBLIC_API_BASE_URL=""
API_INTERNAL_URL="https://api.aimerszone.edu.np"
SESSION_COOKIE_NAME="lms_session"
NEXT_PUBLIC_ALLOWED_EXTERNAL_HOSTS="zoom.us,youtube.com,youtu.be,youtube-nocookie.com"

NEXT_PUBLIC_USE_MOCK_DATA="false"
ALLOW_MOCK_DATA_IN_PRODUCTION="false"
```

`SESSION_COOKIE_NAME` must match Laravel's `SESSION_COOKIE` value exactly
(it's `lms_session` in local dev — confirm the production API `.env` uses the
same value, or update whichever side doesn't match).

**This file is read at build time**, so after creating or editing it you
must rebuild, not just restart:

```bash
cd /var/www/myapp/repo/nepal-lms-frontend
npm run build
sudo systemctl restart aimerszone-next
```

### 4. Check the API's session/CORS config matches this same-origin setup

Because the browser only ever talks to `aimerszone.edu.np` (Next.js proxies
API calls to `api.aimerszone.edu.np` server-side, invisibly to the browser),
Laravel's session cookie must be scoped to the domain the *browser* sees,
not the API's own subdomain — otherwise the browser silently rejects the
`Set-Cookie` header and login/CSRF breaks with no obvious error.

Check the production API's actual values (don't paste the output anywhere —
just confirm they match) at `/var/www/myapp/api/.env`:

```bash
grep -n "^SESSION_DOMAIN\|^SANCTUM_STATEFUL_DOMAINS\|^SESSION_COOKIE\|^APP_URL" /var/www/myapp/api/.env
```

They should be:

```
APP_URL=https://api.aimerszone.edu.np
SESSION_DOMAIN=aimerszone.edu.np
SANCTUM_STATEFUL_DOMAINS=aimerszone.edu.np,www.aimerszone.edu.np
SESSION_COOKIE=lms_session
```

If any differ, edit `/var/www/myapp/api/.env` directly (it's outside git,
safe to hand-edit) and then:

```bash
cd /var/www/myapp/api
php artisan config:clear
php artisan config:cache
```

### 5. Start the queue worker under PM2

The queue worker has never run in production before this setup — confirm
with `ps aux | grep queue:work` (expect nothing) before starting it:

```bash
cd /var/www/myapp/repo
pm2 start deploy/ecosystem.config.js
pm2 status        # api-queue should show "online"
pm2 save
pm2 startup       # run the sudo command it prints, once, so PM2 survives a reboot
```

### 6. Confirm the scheduler cron entry exists

```bash
crontab -l | grep schedule:run
```

If nothing prints, add it:

```bash
crontab -e
```

```
* * * * * cd /var/www/myapp/api && php artisan schedule:run >> /dev/null 2>&1
```

### 7. Test it

Push a small change under `nepal-lms-api/` or `nepal-lms-frontend/` to
`main` and watch the run under the repo's **Actions** tab on GitHub. Then
`pm2 logs api-queue` or `sudo journalctl -u aimerszone-next -n 50` on the VPS
to confirm the restart happened cleanly.

## Editing the deploy steps later

`deploy/deploy-api.sh` and `deploy/deploy-web.sh` are just bash — edit them
like any other file in the repo and the next push picks up the new version
automatically (each script starts by pulling the latest code before doing
anything else). `deploy/ecosystem.config.js` is different: PM2 only reads it
when you run `pm2 start deploy/ecosystem.config.js` by hand, so a change
there needs a manual re-run on the VPS once.
