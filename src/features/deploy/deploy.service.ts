import { spawn as nodeSpawn } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export interface DeployLog {
  file: string;
  content: string;
}

export interface DeployService {
  start(): { logFile: string };
  readRecentLogs(): DeployLog[];
}

const LOG_FILE_PATTERN = /^who-tech-deploy-.*\.log$/;
const RECENT_LOG_COUNT = 10;
const TAIL_LINES = 30;

// 배포 스크립트 실행과 배포 로그 읽기. 셸 문자열을 만들지 않고 파일 시스템 API만 쓴다
export function createDeployService(opts: {
  scriptPath: string;
  logDir?: string;
  spawn?: typeof nodeSpawn;
  now?: () => number;
}): DeployService {
  const { scriptPath, logDir = '/tmp', spawn = nodeSpawn, now = Date.now } = opts;

  const start = (): { logFile: string } => {
    const child = spawn('bash', [scriptPath], { detached: true, stdio: 'ignore', shell: false });
    child.unref();
    return { logFile: join(logDir, `who-tech-deploy-${now()}.log`) };
  };

  const readRecentLogs = (): DeployLog[] => {
    let names: string[];
    try {
      names = readdirSync(logDir).filter((name) => LOG_FILE_PATTERN.test(name));
    } catch {
      return [];
    }
    return names
      .map((name) => {
        const file = join(logDir, name);
        try {
          return { file, mtime: statSync(file).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is { file: string; mtime: number } => entry !== null)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, RECENT_LOG_COUNT)
      .map(({ file }) => ({ file, content: tail(file) }));
  };

  return { start, readRecentLogs };
}

function tail(file: string): string {
  try {
    const lines = readFileSync(file, 'utf8').split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    return lines.slice(-TAIL_LINES).join('\n') + (lines.length > 0 ? '\n' : '');
  } catch {
    return 'Unable to read log\n';
  }
}
