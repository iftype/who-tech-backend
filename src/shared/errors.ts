import { HttpError } from './http.js';

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

/** 찾는 대상이 없다 → 404. 예전에는 일반 Error라 500 'internal server error'로 나갔다 */
export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
    this.name = 'NotFoundError';
  }
}
