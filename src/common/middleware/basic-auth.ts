import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const digest = (value: string) => createHash('sha256').update(value).digest();

// HTTP Basic auth guard for the queue dashboard, which can retry and delete jobs.
export function basicAuth(user: string, password: string) {
  const expected = digest(
    `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
  );
  return (req: Request, res: Response, next: NextFunction) => {
    if (timingSafeEqual(digest(req.headers.authorization ?? ''), expected)) {
      return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="queues"').status(401).end();
  };
}
