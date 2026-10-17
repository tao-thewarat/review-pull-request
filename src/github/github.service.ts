import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class GithubService {
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.webhookSecret = config.getOrThrow<string>('GITHUB_WEBHOOK_SECRET');
  }

  verifySignature(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): void {
    if (!rawBody) {
      throw new BadRequestException('Raw body is unavailable');
    }
    if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const expected = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest();

    // The regex guarantees 64 hex chars, so both buffers are 32 bytes.
    const received = Buffer.from(signature.slice('sha256='.length), 'hex');
    if (!timingSafeEqual(received, expected)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
