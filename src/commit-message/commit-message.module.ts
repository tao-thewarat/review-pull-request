import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiModule } from '../ai/ai.module.js';
import { bearerAuth } from '../common/middleware/bearer-auth.js';
import { CommitMessageController } from './commit-message.controller.js';
import { CommitMessageService } from './commit-message.service.js';

@Module({
  imports: [AiModule],
  controllers: [CommitMessageController],
  providers: [CommitMessageService],
})
export class CommitMessageModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        bearerAuth(this.config.getOrThrow<string>('COMMIT_MESSAGE_API_KEY')),
      )
      .forRoutes(CommitMessageController);
  }
}
