import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  // Default 100kb is too small for large diffs and webhook payloads.
  app.useBodyParser('json', { limit: '5mb' });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
