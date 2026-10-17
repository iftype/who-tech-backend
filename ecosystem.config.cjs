const { existsSync } = require('node:fs');
const { homedir } = require('node:os');
const { join } = require('node:path');

// 서버에서는 deploy.sh가 .nvmrc 버전의 Node를 이 경로에 링크한다. 없으면(로컬) PATH의 node 사용
const nodeBin = join(homedir(), '.who-tech-backend-node');

module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/index.js',
      interpreter: existsSync(nodeBin) ? nodeBin : 'node',
      instances: 1,
      exec_mode: 'fork',
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 5000,
    },
  ],
};
