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
LOCK_FILE="/tmp/deploy-api.lock"

exec 200>"$LOCK_FILE"
flock -n 200 || { echo "Another API deploy is already running, skipping."; exit 1; }

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
php artisan storage:link || true

echo "==> Restarting queue worker"
php artisan queue:restart
pm2 restart api-queue --update-env

echo "==> API deploy complete"
