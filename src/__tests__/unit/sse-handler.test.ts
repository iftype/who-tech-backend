import { describe, expect, it, jest, afterEach } from '@jest/globals';
import type { Response } from 'express';
import { runSseJob, SSE_HEARTBEAT_MS } from '../../shared/sse-handler.js';

function makeRes() {
  const written: string[] = [];
  const res = {
    writableEnded: false,
    destroyed: false,
    write: jest.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    end: jest.fn(() => {
      res.writableEnded = true;
    }),
  };
  return { res, written };
}

describe('runSseJob', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should write a comment heartbeat while the job waits and stop after it ends', async () => {
    jest.useFakeTimers();
    const { res, written } = makeRes();
    let finish!: (value: unknown) => void;
    const job = new Promise((resolve) => {
      finish = resolve;
    });
    const send = (event: string, data: unknown) => written.push(`event: ${event} ${JSON.stringify(data)}`);

    runSseJob(res as unknown as Response, send, job);
    jest.advanceTimersByTime(SSE_HEARTBEAT_MS * 2);
    expect(written).toEqual([': ping\n\n', ': ping\n\n']);

    finish({ ok: true });
    await jest.runOnlyPendingTimersAsync();
    await Promise.resolve();
    jest.advanceTimersByTime(SSE_HEARTBEAT_MS * 2);

    expect(written.slice(2)).toEqual(['event: done {"ok":true}']);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('should not write to a connection the client already closed', () => {
    jest.useFakeTimers();
    const { res } = makeRes();
    res.destroyed = true;

    runSseJob(res as unknown as Response, jest.fn(), new Promise(() => undefined));
    jest.advanceTimersByTime(SSE_HEARTBEAT_MS);

    expect(res.write).not.toHaveBeenCalled();
  });
});
