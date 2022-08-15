import { Module, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ApproovTokenMiddleware } from './middleware/approov-token.middleware';
import { ApproovTokenBindingMiddleware } from './middleware/approov-token-binding.middleware';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApproovTokenMiddleware).forRoutes('*')
    consumer.apply(ApproovTokenBindingMiddleware).exclude('/auth/(.*)').forRoutes('*')
  }
}
