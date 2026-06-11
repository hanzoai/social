import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthService } from '@social/backend/services/auth/auth.service';
import { BillingService } from '@social/nestjs-libraries/services/billing.service';
import { PoliciesGuard } from '@social/backend/services/auth/permissions/permissions.guard';
import { PermissionsService } from '@social/backend/services/auth/permissions/permissions.service';
import { IntegrationManager } from '@social/nestjs-libraries/integrations/integration.manager';
import { UploadModule } from '@social/nestjs-libraries/upload/upload.module';
import { OpenaiService } from '@social/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@social/nestjs-libraries/openai/extract.content.service';
import { CodesService } from '@social/nestjs-libraries/services/codes.service';
import { PublicIntegrationsController } from '@social/backend/public-api/routes/v1/public.integrations.controller';
import { PublicAuthMiddleware } from '@social/backend/services/auth/public.auth.middleware';

const authenticatedController = [PublicIntegrationsController];
@Module({
  imports: [UploadModule],
  controllers: [...authenticatedController],
  providers: [
    AuthService,
    BillingService,
    OpenaiService,
    ExtractContentService,
    PoliciesGuard,
    PermissionsService,
    CodesService,
    IntegrationManager,
  ],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class PublicApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PublicAuthMiddleware).forRoutes(...authenticatedController);
  }
}

