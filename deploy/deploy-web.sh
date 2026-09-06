#!/usr/bin/env bash
#
# Deploys nepal-lms-frontend on the VPS. Run remotely by
# .github/workflows/deploy-web.yml over SSH after a push to main touches
# nepal-lms-frontend/**. Assumes:
#   - /var/www/myapp/repo is a git clone of this repo (branch: main)
#   - /var/www/myapp/web is a symlink ->
#     /var/www/myapp/repo/nepal-lms-frontend/.next/standalone
#     (see deploy/README.md for the one-time setup that creates this)
set -euo pipefail

REPO_DIR="/var/www/myapp/repo"
WEB_DIR="$REPO_DIR/nepal-lms-frontend"
LOCK_FILE="/tmp/deploy-web.lock"

exec 200>"$LOCK_FILE"
flock -n 200 || { echo "Another web deploy is already running, skipping."; exit 1; }

echo "==> Pulling latest code"
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

echo "==> Installing dependencies and building"
cd "$WEB_DIR"
npm ci
npm run build

# Next.js standalone output does not include public/ or .next/static — the
# framework's own docs say to copy them in by hand after every build, or the
# server serves 404s for every asset and page background image.
echo "==> Assembling standalone output"
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static

echo "==> Reloading web process"
pm2 restart web --update-env

echo "==> Web deploy complete"
