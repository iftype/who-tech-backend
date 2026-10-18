import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../http.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ message: error.message });
    return;
  }

  // body-parser 등 express 미들웨어의 클라이언트 오류(잘못된 JSON 400, 너무 큰 본문 413)는 그대로 돌려준다
  if (isClientError(error)) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ message: 'internal server error' });
};

function isClientError(error: unknown): error is { status: number; message: string } {
  if (!(error instanceof Error)) return false;
  const { status, expose } = error as Error & { status?: unknown; expose?: unknown };
  return expose === true && typeof status === 'number' && status >= 400 && status < 500;
}
