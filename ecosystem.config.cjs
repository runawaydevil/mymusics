"use strict";

/** PM2 process file — run from the `mymusics` directory after `npm run build`. */
module.exports = {
  apps: [
    {
      name: "mymusics",
      cwd: __dirname,
      script: "dist-server/server/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      env_production: {
        NODE_ENV: "production",
        // Uses predefined pool in config/ports.ts — set PORT_INDEX 0..3 or explicit PORT
        PORT_INDEX: "0",
        SERVE_STATIC: "true",
        // Required on VPS: repo has no metadata.tsv — upload the TSV and set absolute path:
        // METADATA_TSV: "/var/www/mymusics-data/metadata.tsv",
      },
    },
  ],
};
