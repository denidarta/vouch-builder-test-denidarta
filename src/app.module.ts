import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { HandoverModule } from './handover/handover.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        autoLogging: true,
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            correlationId: req.headers['x-request-id'],
          }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    CommonModule,
    HealthModule,
    HandoverModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
