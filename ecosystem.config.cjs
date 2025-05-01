module.exports = {
  apps: [
    {
      name: "mcvu-ticketing",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      env: {
        PORT: 3000,
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://mcvu.perkimakassar.com"
      },
      max_memory_restart: "1G",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
