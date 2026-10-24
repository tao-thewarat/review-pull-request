import type { NextFunction, Request, Response } from 'express';
import { basicAuth } from './basic-auth.js';

describe('basicAuth', () => {
  const guard = basicAuth('admin', 'pw');
  const call = (authorization?: string) => {
    const res = { set: vi.fn(), status: vi.fn(), end: vi.fn() };
    res.set.mockReturnValue(res);
    res.status.mockReturnValue(res);
    const next = vi.fn();
    guard(
      { headers: { authorization } } as Request,
      res as unknown as Response,
      next as NextFunction,
    );
    return { res, next };
  };

  it('lets valid credentials through', () => {
    const { next, res } = call(
      `Basic ${Buffer.from('admin:pw').toString('base64')}`,
    );
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    `Basic ${Buffer.from('admin:wrong').toString('base64')}`,
  ])('challenges %s with 401', (authorization) => {
    const { next, res } = call(authorization);
    expect(next).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Basic realm="queues"',
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.end).toHaveBeenCalled();
  });
});
