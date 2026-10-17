import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { GithubController } from './github.controller.js';
import type { GithubService } from './github.service.js';
import type { ReviewProducer } from '../review/review.producer.js';

describe('GithubController', () => {
  const verifySignature = vi.fn();
  const enqueue = vi.fn();
  const controller = new GithubController(
    { verifySignature } as unknown as GithubService,
    { enqueue } as unknown as ReviewProducer,
  );
  const request = (body: unknown) =>
    ({ rawBody: Buffer.from('raw'), body }) as RawBodyRequest<Request>;
  const pullRequest = (action: string) =>
    request({
      action,
      repository: { name: 'repo', owner: { login: 'owner' } },
      pull_request: { number: 7 },
    });

  beforeEach(() => vi.clearAllMocks());

  it('verifies the signature before anything else', async () => {
    verifySignature.mockImplementationOnce(() => {
      throw new Error('bad signature');
    });
    await expect(
      controller.eventPullRequestPush(
        pullRequest('opened'),
        'pull_request',
        'sig',
      ),
    ).rejects.toThrow('bad signature');
    expect(verifySignature).toHaveBeenCalledWith(Buffer.from('raw'), 'sig');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('answers ping', async () => {
    await expect(
      controller.eventPullRequestPush(request({}), 'ping', 'sig'),
    ).resolves.toEqual({ status: 'pong' });
  });

  it('ignores other events and actions', async () => {
    await expect(
      controller.eventPullRequestPush(pullRequest('opened'), 'push', 'sig'),
    ).resolves.toEqual({ status: 'ignored' });
    await expect(
      controller.eventPullRequestPush(
        pullRequest('closed'),
        'pull_request',
        'sig',
      ),
    ).resolves.toEqual({ status: 'ignored' });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('queues a review', async () => {
    enqueue.mockResolvedValueOnce({ id: 'owner/repo#7@1' });
    await expect(
      controller.eventPullRequestPush(
        pullRequest('synchronize'),
        'pull_request',
        'sig',
      ),
    ).resolves.toEqual({ status: 'queued', jobId: 'owner/repo#7@1' });
    expect(enqueue).toHaveBeenCalledWith('owner', 'repo', 7);
  });

  it('reports up-to-date when nothing new is queued', async () => {
    enqueue.mockResolvedValueOnce(null);
    await expect(
      controller.eventPullRequestPush(
        pullRequest('reopened'),
        'pull_request',
        'sig',
      ),
    ).resolves.toEqual({ status: 'up-to-date' });
  });
});
