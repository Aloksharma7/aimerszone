// PM2 process definitions for the VPS. Run once during setup with:
//   pm2 start deploy/ecosystem.config.js
//   pm2 save
// Deploy scripts only ever `pm2 restart <name>` afterward — they never
// re-register these definitions, so editing this file requires re-running
// `pm2 start deploy/ecosystem.config.js` by hand on the VPS to pick it up.
module.exports = {
  apps: [
    {
      name: "web",
      // Symlink -> repo/nepal-lms-frontend/.next/standalone (see deploy/README.md)
      cwd: "/var/www/myapp/web",
      script: "server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
      },
    },
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
