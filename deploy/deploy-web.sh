#!/usr/bin/env bash
#
# Deploys nepal-lms-frontend on the VPS. Run remotely by
# .github/workflows/deploy-web.yml over SSH after a push to main touches
# nepal-lms-frontend/**. Assumes:
#   - /var/www/myapp/repo is a git clone of this repo (branch: main)
#   - /var/www/myapp/web is a symlink -> repo/nepal-lms-frontend
#   - the aimerszone-next systemd unit runs `npm run start` with
#     WorkingDirectory=/var/www/myapp/web (already set up on this VPS —
#     see deploy/README.md) — this script does NOT use PM2 or the Next.js
#     standalone output, because that systemd unit already owns the process.
set -euo pipefail

# Non-interactive SSH sessions (this is one, via GitHub Actions) don't source
# .bashrc, so nvm's PATH additions never happen and `npm`/`node` aren't found
# even though they work fine when SSHing in by hand.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

REPO_DIR="/var/www/myapp/repo"
WEB_DIR="$REPO_DIR/nepal-lms-frontend"
# Shared with deploy-api.sh: both scripts git fetch/reset the same $REPO_DIR
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

echo "==> Installing dependencies and building"
cd "$WEB_DIR"
npm ci
npm run build

echo "==> Restarting web service"
sudo /usr/bin/systemctl restart aimerszone-next

echo "==> Web deploy complete"
