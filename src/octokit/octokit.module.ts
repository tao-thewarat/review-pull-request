import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from 'octokit';

// One authenticated GitHub API client shared by every module.
@Module({
  providers: [
    {
      provide: Octokit,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Octokit({ auth: config.getOrThrow<string>('GITHUB_TOKEN') }),
    },
  ],
  exports: [Octokit],
})
export class OctokitModule {}
