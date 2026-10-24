import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Headers,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { GithubService } from './github.service.js';
import { ReviewProducer } from '../review/review.producer.js';

const REVIEW_ACTIONS = new Set([
  'opened',
  'synchronize',
  'reopened',
  'ready_for_review',
]);

@Controller('github')
export class GithubController {
  constructor(
    private readonly githubService: GithubService,
    private readonly reviewProducer: ReviewProducer,
  ) {}

  @Post('/event/pull-request')
  @HttpCode(HttpStatus.OK)
  async eventPullRequestPush(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    this.githubService.verifySignature(request.rawBody, signature);
    if (event === 'ping') {
      return { status: 'pong' };
    }
    const { action, repository, pull_request } = request.body;
    if (event !== 'pull_request') {
      return { status: 'ignored' };
    }
    if (action === 'closed') {
      // Merged or closed: no review should be posted any more.
      const removed = await this.reviewProducer.cancel(
        repository.owner.login,
        repository.name,
        pull_request.number,
      );
      return { status: 'cancelled', removedJob: removed };
    }
    if (!REVIEW_ACTIONS.has(action)) {
      return { status: 'ignored' };
    }
    const job = await this.reviewProducer.enqueue(
      repository.owner.login,
      repository.name,
      pull_request.number,
    );
    return job ? { status: 'queued', jobId: job.id } : { status: 'up-to-date' };
  }
}
