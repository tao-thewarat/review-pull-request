import { Injectable } from '@nestjs/common';
import { Octokit } from 'octokit';
import { type DiffFile, parsePatch } from './utils/diff.utils.js';

@Injectable()
export class DiffService {
  constructor(private readonly github: Octokit) {}

  // Diff of the PR as of headSha (three-dot compare uses the merge base, like the PR view).
  // ponytail: compare API caps at 300 files and omits huge patches, page per file if needed
  async getDiff(
    owner: string,
    repo: string,
    baseRef: string,
    headSha: string,
  ): Promise<DiffFile[]> {
    const { data } = await this.github.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${baseRef}...${headSha}`,
    });
    return (data.files ?? []).map((file) => ({
      path: file.filename,
      ...(file.patch
        ? parsePatch(file.patch)
        : { annotated: null, lines: new Map<number, string>() }),
    }));
  }
}
