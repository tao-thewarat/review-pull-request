import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { GithubService } from './github.service.js';

describe('GithubService', () => {
  const secret = 'top-secret';
  const body = Buffer.from('{"action":"opened"}');
  const sign = (data: Buffer, key = secret) =>
    `sha256=${createHmac('sha256', key).update(data).digest('hex')}`;
  const service = new GithubService({
    getOrThrow: () => secret,
  } as unknown as ConfigService);

  it('accepts a valid signature', () => {
    expect(() => service.verifySignature(body, sign(body))).not.toThrow();
  });

  it('rejects a missing raw body', () => {
    expect(() => service.verifySignature(undefined, sign(body))).toThrow(
      BadRequestException,
    );
  });

  it.each([undefined, 'Helloworld', 'sha256=abc'])(
    'rejects a malformed signature %s',
    (signature) => {
      expect(() => service.verifySignature(body, signature)).toThrow(
        UnauthorizedException,
      );
    },
  );

  it('rejects a signature made with another secret', () => {
    expect(() => service.verifySignature(body, sign(body, 'other'))).toThrow(
      UnauthorizedException,
    );
  });
});
