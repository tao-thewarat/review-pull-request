import { Module } from '@nestjs/common';
import { OctokitModule } from '../octokit/octokit.module.js';
import { DiffService } from './diff.service.js';

@Module({
  imports: [OctokitModule],
  providers: [DiffService],
  exports: [DiffService],
})
export class DiffModule {}
