import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const digest = (value: string) => createHash('sha256').update(value).digest();

// "Authorization: Bearer <token>" guard for endpoints that spend AI credits.
export function bearerAuth(token: string) {
  const expected = digest(`Bearer ${token}`);
  return (req: Request, res: Response, next: NextFunction) => {
    if (timingSafeEqual(digest(req.headers.authorization ?? ''), expected)) {
      return next();
    }
    res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
  };
}
