import { Module } from '@nestjs/common';
import { GithubService } from './github.service.js';
import { GithubController } from './github.controller.js';
import { ReviewModule } from '../review/review.module.js';

@Module({
  imports: [ReviewModule],
  providers: [GithubService],
  controllers: [GithubController],
})
export class GithubModule {}
