import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// 어드민 비밀키 검사. 비밀키가 비어 있으면 어떤 토큰도 통과하지 못한다
// (`undefined !== undefined` 가 false 라서 열려 버리는 것을 막는다). 길이를 맞춘 뒤 상수 시간으로 비교한다
export function isAdminToken(token: string | undefined): boolean {
  const secret = process.env['ADMIN_SECRET'];
  if (!secret || !token) return false;
  const given = Buffer.from(token, 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function bearerToken(req: Request): string | undefined {
  return req.headers.authorization?.split(' ')[1];
}

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const headerToken = bearerToken(req);
  const queryToken = typeof req.query['token'] === 'string' ? req.query['token'] : undefined;
  if (!isAdminToken(headerToken ?? queryToken)) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  next();
}
