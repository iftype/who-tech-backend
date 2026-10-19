export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}

// async 라우트 핸들러가 거부(throw)하면 Express 5가 next(err)로 errorHandler에 넘긴다 (예전 asyncHandler 래퍼는 필요 없다)
