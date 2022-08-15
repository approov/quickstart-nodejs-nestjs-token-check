import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const HTTP_PORT = process.env.HTTP_PORT || 8002;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(HTTP_PORT);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
