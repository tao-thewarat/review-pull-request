import type { NextFunction, Request, Response } from 'express';
import { bearerAuth } from './bearer-auth.js';

describe('bearerAuth', () => {
  const guard = bearerAuth('s3cret');
  const call = (authorization?: string) => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    const next = vi.fn();
    guard(
      { headers: { authorization } } as Request,
      res as unknown as Response,
      next as NextFunction,
    );
    return { res, next };
  };

  it('lets the right token through', () => {
    const { next, res } = call('Bearer s3cret');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([undefined, 'Bearer wrong', 's3cret'])('rejects %s', (header) => {
    const { next, res } = call(header);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Unauthorized',
    });
  });
});
