// PM2 process definitions for the VPS. Run once during setup with:
//   pm2 start deploy/ecosystem.config.js
//   pm2 save
// Deploy scripts only ever `pm2 restart <name>` afterward — they never
// re-register these definitions, so editing this file requires re-running
// `pm2 start deploy/ecosystem.config.js` by hand on the VPS to pick it up.
//
// The web app is NOT here: it's owned by the aimerszone-next systemd unit,
// which already existed on this VPS before this file did. PM2 only manages
// the one process this VPS had nothing else running: the queue worker.
module.exports = {
  apps: [
    {
      name: "api-queue",
      // Symlink -> repo/nepal-lms-api (see deploy/README.md)
      cwd: "/var/www/myapp/api",
      script: "artisan",
      interpreter: "php",
      // max-time recycles the worker periodically so it can never keep
      // serving jobs against PHP classes a deploy already replaced on disk.
      args: "queue:work --sleep=3 --tries=3 --max-time=3600",
      autorestart: true,
    },
  ],
};
