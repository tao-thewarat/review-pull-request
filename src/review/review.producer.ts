import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Octokit } from 'octokit';
import { ReviewStateService } from './review-state.service.js';
import { findTaskKeys } from '../task/task.utils.js';

export interface ReviewJob {
  owner: string;
  repo: string;
  pullNumber: number;
  baseRef: string;
  headSha: string;
  generation: number;
  taskKeys: string[];
}

@Injectable()
export class ReviewProducer {
  constructor(
    @InjectQueue('pr-review')
    private readonly queue: Queue<ReviewJob>,
    private readonly github: Octokit,
    private readonly state: ReviewStateService,
  ) {}

  // Returns null when there is nothing new to review.
  async enqueue(owner: string, repo: string, pullNumber: number) {
    // Webhooks can arrive out of order, so trust GitHub's current head, not the payload.
    const { data: pr } = await this.github.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    if (pr.state !== 'open') {
      return null;
    }

    // ponytail: bump and add are not atomic, a failed add leaves the SHA unqueued until the next push
    const generation = await this.state.bump(
      `${owner}/${repo}`,
      pullNumber,
      pr.head.sha,
    );
    if (generation === null) {
      return null;
    }

    // ponytail: listCommits returns at most 250 commits, enough for task keys in practice
    const commits = await this.github.paginate(
      this.github.rest.pulls.listCommits,
      { owner, repo, pull_number: pullNumber },
    );

    const jobId = (g: number) => `${owner}/${repo}#${pullNumber}@${g}`;
    // Drops the previous job if still waiting; an active one is left to fail its staleness check.
    await this.queue.remove(jobId(generation - 1));
    return this.queue.add(
      'review',
      {
        owner,
        repo,
        pullNumber,
        baseRef: pr.base.ref,
        headSha: pr.head.sha,
        generation,
        taskKeys: findTaskKeys(
          pr.head.ref,
          pr.title,
          pr.body,
          ...commits.map((c) => c.commit.message),
        ),
      },
      {
        jobId: jobId(generation),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000,
        },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    );
  }
}
