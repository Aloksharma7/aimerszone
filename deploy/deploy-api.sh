#!/usr/bin/env bash
#
# Deploys nepal-lms-api on the VPS. Run remotely by
# .github/workflows/deploy-api.yml over SSH after a push to main touches
# nepal-lms-api/**. Assumes:
#   - /var/www/myapp/repo is a git clone of this repo (branch: main)
#   - /var/www/myapp/api is a symlink -> /var/www/myapp/repo/nepal-lms-api
#     (see deploy/README.md for the one-time setup that creates this)
set -euo pipefail

# Non-interactive SSH sessions (this is one, via GitHub Actions) don't source
# .bashrc, so nvm's PATH additions never happen and `pm2` isn't found even
# though it works fine when SSHing in by hand.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

REPO_DIR="/var/www/myapp/repo"
API_DIR="$REPO_DIR/nepal-lms-api"
# Shared with deploy-web.sh: both scripts git fetch/reset the same $REPO_DIR
# checkout, so an API deploy and a web deploy triggered by the same push
# must never touch git at the same time — a per-script lock file wouldn't
# stop that, since it only ever serializes a script against itself.
LOCK_FILE="/tmp/aimerszone-deploy.lock"

exec 200>"$LOCK_FILE"
echo "Waiting for any other deploy in progress..."
flock 200

echo "==> Pulling latest code"
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

echo "==> Installing PHP dependencies"
cd "$API_DIR"
composer install --no-dev --optimize-autoloader --no-interaction

echo "==> Running migrations and rebuilding caches"
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
[ -L public/storage ] || php artisan storage:link

echo "==> Reloading PHP-FPM"
# OPcache keeps the previous deploy's compiled bytecode in memory — including
# bootstrap/cache/packages.php and services.php — until PHP-FPM reloads, so
# without this a correct redeploy can silently keep serving the old broken
# state indefinitely (this is exactly how the CollisionServiceProvider bug
# survived several deploys that should have fixed it).
sudo /usr/bin/systemctl reload php8.3-fpm.service

echo "==> Restarting queue worker"
php artisan queue:restart
pm2 restart api-queue --update-env

echo "==> API deploy complete"
