import { Module } from '@nestjs/common';
import { PostActivity } from '@social/orchestrator/activities/post.activity';
import { getTemporalModule } from '@social/nestjs-libraries/temporal/temporal.module';
import { DatabaseModule } from '@social/nestjs-libraries/database/prisma/database.module';
import { AutopostService } from '@social/nestjs-libraries/database/prisma/autopost/autopost.service';
import { EmailActivity } from '@social/orchestrator/activities/email.activity';
import { IntegrationsActivity } from '@social/orchestrator/activities/integrations.activity';
import { HealthController } from '@social/orchestrator/health.controller';

const activities = [
  PostActivity,
  AutopostService,
  EmailActivity,
  IntegrationsActivity,
];
@Module({
  imports: [
    DatabaseModule,
    getTemporalModule(true, require.resolve('./workflows'), activities),
  ],
  controllers: [HealthController],
  providers: [...activities],
  get exports() {
    return [...this.providers, ...this.imports];
  },
})
export class AppModule {}
