import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '@social/nestjs-libraries/database/prisma/database.module';
import { ApiModule } from '@social/backend/api/api.module';
import { APP_GUARD } from '@nestjs/core';
import { PoliciesGuard } from '@social/backend/services/auth/permissions/permissions.guard';
import { PublicApiModule } from '@social/backend/public-api/public.api.module';
import { ThrottlerBehindProxyGuard } from '@social/nestjs-libraries/throttler/throttler.provider';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentModule } from '@social/nestjs-libraries/agent/agent.module';
import { ThirdPartyModule } from '@social/nestjs-libraries/3rdparties/thirdparty.module';
import { VideoModule } from '@social/nestjs-libraries/videos/video.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { FILTER } from '@social/nestjs-libraries/sentry/sentry.exception';
import { ChatModule } from '@social/nestjs-libraries/chat/chat.module';
import { getTemporalModule } from '@social/nestjs-libraries/temporal/temporal.module';
import { TemporalRegisterMissingSearchAttributesModule } from '@social/nestjs-libraries/temporal/temporal.register';
import { InfiniteWorkflowRegisterModule } from '@social/nestjs-libraries/temporal/infinite.workflow.register';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ioRedis } from '@social/nestjs-libraries/redis/redis.service';

@Global()
@Module({
  imports: [
    SentryModule.forRoot(),
    DatabaseModule,
    ApiModule,
    PublicApiModule,
    AgentModule,
    ThirdPartyModule,
    VideoModule,
    ChatModule,
    getTemporalModule(false),
    TemporalRegisterMissingSearchAttributesModule,
    InfiniteWorkflowRegisterModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 3600000,
          limit: process.env.API_LIMIT ? Number(process.env.API_LIMIT) : 90,
        },
      ],
      storage: new ThrottlerStorageRedisService(ioRedis),
    }),
  ],
  controllers: [],
  providers: [
    FILTER,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PoliciesGuard,
    },
  ],
  exports: [
    DatabaseModule,
    ApiModule,
    PublicApiModule,
    AgentModule,
    ThrottlerModule,
    ChatModule,
  ],
})
export class AppModule {}
