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

/** SSE job을 실행하고 done/error 이벤트로 종료 */
export function runSseJob(res: Response, send: (event: string, data: unknown) => void, job: Promise<unknown>): void {
  job
    .then((result) => {
      send('done', result);
      if (!res.writableEnded) res.end();
    })
    .catch((err: unknown) => {
      send('error', { message: err instanceof Error ? err.message : 'sync failed' });
      if (!res.writableEnded) res.end();
    });
}
