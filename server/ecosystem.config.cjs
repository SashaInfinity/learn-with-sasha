// PM2 ecosystem for the learn-with-sasha backend.
// Run from the server/ dir:  pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'learn-with-sasha',
      cwd: __dirname,
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/index.ts',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
