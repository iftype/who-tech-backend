import { rateLimit } from 'express-rate-limit';

// 비밀키 하나로 지키는 엔드포인트의 무차별 대입 방지. 실패(4xx)한 요청만 세므로 정상 호출은 막히지 않는다.
// IP는 nginx가 넘긴 X-Forwarded-For 기준 (app.set('trust proxy', 'loopback'))
export function createAuthFailureLimiter(opts: { windowMs?: number; limit?: number } = {}) {
  return rateLimit({
    windowMs: opts.windowMs ?? 15 * 60 * 1000,
    limit: opts.limit ?? 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests' },
  });
}
