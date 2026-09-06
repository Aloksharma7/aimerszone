# Automated deploy: push to GitHub → live on the VPS

## How it works

- `.github/workflows/deploy-api.yml` runs on every push to `main` that touches
  `nepal-lms-api/**`, and SSHes into the VPS to run `deploy/deploy-api.sh`.
- `.github/workflows/deploy-web.yml` does the same for `nepal-lms-frontend/**`,
  running `deploy/deploy-web.sh`.
- A frontend-only push never touches the API and vice versa.
- Nothing is exposed on the VPS — GitHub's runner opens an outbound SSH
  connection to your VPS, so there is no inbound webhook/port to secure.

Layout on the VPS:

```
/var/www/myapp/repo   single git clone, branch main (source of truth)
/var/www/myapp/api    symlink -> repo/nepal-lms-api
/var/www/myapp/web    symlink -> repo/nepal-lms-frontend/.next/standalone
```

`.env`, `storage/`, and `vendor/` for the API, and `node_modules/`/`.next/`
for the frontend, are all git-ignored — `git reset --hard` during a deploy
never touches them, so uploaded files, sessions-in-DB, and secrets survive
every deploy untouched.

PM2 keeps two long-running processes alive:
- `web` — the Next.js standalone server.
- `api-queue` — `php artisan queue:work`, needed because this app actually
  queues jobs (`ProvisionClassMeetings`, `RecalculateBatchProgress`,
  notifications) — this was very likely missing in production until now.

The Laravel scheduler (Zoom sync, and anything else on `Schedule::command`)
still needs a real system cron entry — PM2 doesn't replace that.

## One-time setup on the VPS

Run these once, logged in as `deploy@nest`.

### 1. Generate a deploy key so GitHub Actions can SSH in

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/gh_actions_deploy -N ""
cat ~/.ssh/gh_actions_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/gh_actions_deploy       # copy this whole block, private key
```

This is a *dedicated* keypair for GitHub Actions only — don't reuse your own
personal SSH key for this.

In GitHub: repo → **Settings → Secrets and variables → Actions → New
repository secret**, add:

| Secret        | Value                                              |
|---------------|-----------------------------------------------------|
| `VPS_HOST`    | the VPS's IP or hostname                            |
| `VPS_USER`    | `deploy`                                            |
| `VPS_SSH_KEY` | the private key printed above (the whole thing)     |

If SSH runs on a non-standard port, also add a `VPS_PORT` secret and add
`port: ${{ secrets.VPS_PORT }}` to both workflow files' `with:` blocks.

### 2. If the repo isn't private, skip to step 3. If it is private, let the VPS pull it

Generate a **second, separate** keypair — this one lets the VPS read the
repo, it's unrelated to the key from step 1:

```bash
ssh-keygen -t ed25519 -C "vps-deploy-pull" -f ~/.ssh/id_ed25519_deploy -N ""
cat ~/.ssh/id_ed25519_deploy.pub
```

GitHub repo → **Settings → Deploy keys → Add deploy key** → paste the
public key → leave "Allow write access" unchecked (read-only is enough).

Then tell git to use this key for this host, by adding to `~/.ssh/config`:

```
Host github.com
  IdentityFile ~/.ssh/id_ed25519_deploy
  IdentitiesOnly yes
```

### 3. Clone the repo and migrate any existing live app into it

First check what's actually in `api` and `web` right now — if they already
hold a running app, back up the parts that matter before doing anything else:

```bash
ls -la /var/www/myapp/api /var/www/myapp/web
```

Clone the repo:

```bash
git clone git@github.com:Aloksharma7/aimerszone.git /var/www/myapp/repo
# (use the https:// URL instead if the repo is public and you skipped step 2)
```

**If `api` already has a real `.env` and `storage/` with uploaded files**,
carry them into the clone before swapping the symlink in:

```bash
cp /var/www/myapp/api/.env /var/www/myapp/repo/nepal-lms-api/.env
rsync -a /var/www/myapp/api/storage/ /var/www/myapp/repo/nepal-lms-api/storage/
mv /var/www/myapp/api /var/www/myapp/api.bak   # keep as a safety net for now
ln -s /var/www/myapp/repo/nepal-lms-api /var/www/myapp/api
```

**If `api` is empty / not live yet**, just:

```bash
rm -rf /var/www/myapp/api
ln -s /var/www/myapp/repo/nepal-lms-api /var/www/myapp/api
cd /var/www/myapp/api
cp .env.example .env   # then fill in real production values, including the
                        # Zoom credentials from the earlier setup
```

Same idea for `web` — Next.js has no persistent data to preserve, so:

```bash
rm -rf /var/www/myapp/web
cd /var/www/myapp/repo/nepal-lms-frontend
npm ci
npm run build
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
ln -s /var/www/myapp/repo/nepal-lms-frontend/.next/standalone /var/www/myapp/web
```

Create `/var/www/myapp/repo/nepal-lms-frontend/.env.production.local` there
with the real production values (empty `NEXT_PUBLIC_API_BASE_URL`, the
correct `API_INTERNAL_URL`, etc.) — see the earlier discussion on env file
precedence; this file is git-ignored and must be created by hand once.

### 4. Install PHP deps and set up the database on the API side

```bash
cd /var/www/myapp/api
composer install --no-dev --optimize-autoloader
php artisan key:generate     # only if .env doesn't already have APP_KEY
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan storage:link
```

### 5. Install PM2 and start both processes

```bash
npm install -g pm2   # once, globally
cd /var/www/myapp/repo
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup          # run the command it prints, so PM2 survives a reboot
```

Check both are up: `pm2 status` should show `web` and `api-queue` as
`online`.

Point Nginx at `127.0.0.1:3000` for the web app and at `php-fpm` with
`root /var/www/myapp/api/public` for the API, if not already configured that
way.

### 6. Add the scheduler cron entry, if it isn't there already

```bash
crontab -e
```

Add:

```
* * * * * cd /var/www/myapp/api && php artisan schedule:run >> /dev/null 2>&1
```

### 7. Test it

Push any small change under `nepal-lms-api/` or `nepal-lms-frontend/` to
`main` and watch the run under the repo's **Actions** tab on GitHub. Then
`pm2 logs` on the VPS to confirm the restart happened.

## Editing the deploy steps later

`deploy/deploy-api.sh` and `deploy/deploy-web.sh` are just bash — edit them
like any other file in the repo and the next push picks up the new version
automatically (each script starts by pulling the latest code before doing
anything else). `deploy/ecosystem.config.js` is different: PM2 only reads it
when you run `pm2 start deploy/ecosystem.config.js` by hand, so a change
there needs a manual re-run on the VPS once.
