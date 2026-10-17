module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/index.js',
      // deploy.sh가 .nvmrc 버전의 Node를 이 경로에 링크한다. 롤백: ln -sfn /usr/bin/node ~/.who-tech-backend-node
      interpreter: `${process.env['HOME']}/.who-tech-backend-node`,
      instances: 1,
      exec_mode: 'fork',
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 5000,
    },
  ],
};
