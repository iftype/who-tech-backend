// 도메인 에러. 문자열(err.message === 'cancelled')로 구분하지 않고 타입으로 구분한다

/** 사용자가 싱크 작업을 취소했다. 메시지는 예전과 같은 'cancelled'라 로그·SSE 응답은 그대로다 */
export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

export function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new CancelledError();
}
