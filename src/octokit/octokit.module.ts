import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, Octokit } from 'octokit';

// One GitHub client shared by every module, authenticated as a GitHub App installation.
// Installation tokens expire after an hour; the client mints and refreshes them itself.
// ponytail: one installation (one org); resolve per repo via apps.getRepoInstallation for more
@Module({
  providers: [
    {
      provide: Octokit,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new App({
          appId: config.getOrThrow<string>('GITHUB_APP_ID'),
          // .env files keep the PEM on one line with literal "\n".
          privateKey: config
            .getOrThrow<string>('GITHUB_APP_PRIVATE_KEY')
            .replace(/\\n/g, '\n'),
        }).getInstallationOctokit(
          Number(config.getOrThrow<string>('GITHUB_APP_INSTALLATION_ID')),
        ),
    },
  ],
  exports: [Octokit],
})
export class OctokitModule {}
