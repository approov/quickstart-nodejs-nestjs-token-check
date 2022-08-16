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
    // Ensure that the ApproovTokenMiddleware is always the first one to be
    // executed. For example, do not execute a rate limiter Middleware first.
    consumer.apply(ApproovTokenMiddleware).forRoutes('*')
    consumer.apply(ApproovTokenBindingMiddleware).exclude('/auth/(.*)').forRoutes('*')
  }
}
