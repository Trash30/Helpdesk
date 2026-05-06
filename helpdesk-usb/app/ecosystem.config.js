module.exports = {
  apps: [
    {
      name: 'helpdesk-server',
      script: './server/dist/src/index.js',
      cwd: '/opt/helpdesk',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/opt/helpdesk/logs/server-error.log',
      out_file: '/opt/helpdesk/logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
