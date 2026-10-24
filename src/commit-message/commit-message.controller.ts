import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CommitMessageService } from './commit-message.service.js';

@Controller('commit-message')
export class CommitMessageController {
  constructor(private readonly commitMessages: CommitMessageService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async generate(@Body() body: { diff?: unknown } | undefined) {
    const diff = body?.diff;
    if (typeof diff !== 'string' || !diff.trim()) {
      throw new BadRequestException('diff must be a non-empty string');
    }
    return { message: await this.commitMessages.generate(diff) };
  }
}
