import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { basicAuth } from './common/basic-auth.js';
import { GithubModule } from './github/github.module.js';
import { ReviewModule } from './review/review.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: Number(config.get<string>('REDIS_PORT') ?? 6379),
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // ponytail: schema sync on boot, switch to migrations before production data matters
        synchronize: true,
      }),
    }),
    BullBoardModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        route: '/queues',
        adapter: ExpressAdapter,
        middleware: basicAuth(
          config.getOrThrow<string>('BULL_BOARD_USER'),
          config.getOrThrow<string>('BULL_BOARD_PASSWORD'),
        ),
      }),
    }),
    GithubModule,
    ReviewModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
