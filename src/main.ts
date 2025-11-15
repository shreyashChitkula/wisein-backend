import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { options } from 'joi';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
    // Serve static files from /public
  app.use('/',
    express.static(join(__dirname, '..', 'public'))
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
