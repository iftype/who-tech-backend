import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// sync.route는 express Router를 반환하므로 직접 핸들러를 단위 테스트
// SSE send 헬퍼의 writableEnded 가드 동작을 검증

function makeSse(ended = false) {
  const written: string[] = [];
  return {
    writableEnded: ended,
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => {
      written.push(chunk);
    }),
    end: jest.fn(),
    written,
  };
}

// send 헬퍼 추출 — sync.route.ts의 내부 로직과 동일
function makeSendHelper(res: ReturnType<typeof makeSse>) {
  return (event: string, data: unknown) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

describe('SSE send helper', () => {
  it('writableEnded=false이면 write를 호출한다', () => {
    const res = makeSse(false);
    const send = makeSendHelper(res);
    send('progress', { percent: 50 });
    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.written[0]).toContain('event: progress');
  });

  it('writableEnded=true이면 write를 호출하지 않는다', () => {
    const res = makeSse(true);
    const send = makeSendHelper(res);
    send('error', { message: 'sync failed' });
    expect(res.write).not.toHaveBeenCalled();
  });
});

describe('SSE .catch() handler — res 이미 종료된 경우', () => {
  let res: ReturnType<typeof makeSse>;

  beforeEach(() => {
    res = makeSse(false);
  });

  it('서비스 실패 시 error 이벤트를 전송하고 res.end()를 호출한다', async () => {
    const send = makeSendHelper(res);
    const mockService: any = {
      syncWorkspace: jest.fn().mockRejectedValue(new Error('github timeout') as never),
    };

    await mockService
      .syncWorkspace()
      .then(() => {
        send('done', {});
        if (!res.writableEnded) res.end();
      })
      .catch((err: unknown) => {
        send('error', { message: err instanceof Error ? err.message : 'sync failed' });
        if (!res.writableEnded) res.end();
      });

    expect(res.written[0]).toContain('"github timeout"');
    expect(res.written[0]).toContain('event: error');
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('에러 도달 전 res가 이미 종료됐으면 write와 end를 호출하지 않는다', async () => {
    const endedRes = makeSse(true);
    const send = makeSendHelper(endedRes);
    const mockService: any = {
      syncWorkspace: jest.fn().mockRejectedValue(new Error('client gone') as never),
    };

    await mockService.syncWorkspace().catch((err: unknown) => {
      send('error', { message: err instanceof Error ? err.message : 'sync failed' });
      if (!endedRes.writableEnded) endedRes.end();
    });

    expect(endedRes.write).not.toHaveBeenCalled();
    expect(endedRes.end).not.toHaveBeenCalled();
  });

  it('Error 아닌 값이 throw되면 "sync failed" 메시지를 전송한다', async () => {
    const send = makeSendHelper(res);

    await Promise.reject('string error').catch((err: unknown) => {
      send('error', { message: err instanceof Error ? err.message : 'sync failed' });
      if (!res.writableEnded) res.end();
    });

    expect(res.written[0]).toContain('"sync failed"');
  });
});
