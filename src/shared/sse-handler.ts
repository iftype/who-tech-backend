import type { Response } from 'express';

/** SSE 헤더를 설정하고 send 함수를 반환 */
export function startSse(res: Response): (event: string, data: unknown) => void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  return (event: string, data: unknown) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

// 큐에서 기다리는 동안에도 바이트가 오가게 한다 (nginx proxy_read_timeout 300초에 끊기지 않게). 주석 줄이라 EventSource는 무시한다
export const SSE_HEARTBEAT_MS = 25_000;

/** SSE job을 실행하고 done/error 이벤트로 종료 */
export function runSseJob(res: Response, send: (event: string, data: unknown) => void, job: Promise<unknown>): void {
  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(': ping\n\n');
  }, SSE_HEARTBEAT_MS);

  job
    .finally(() => clearInterval(heartbeat))
    .then((result) => {
      send('done', result);
      if (!res.writableEnded) res.end();
    })
    .catch((err: unknown) => {
      send('error', { message: err instanceof Error ? err.message : 'sync failed' });
      if (!res.writableEnded) res.end();
    });
}
