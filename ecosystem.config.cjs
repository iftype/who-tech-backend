module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 5000,
    },
  ],
};
