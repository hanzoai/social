import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController } from '@social/backend/api/routes/auth.controller';
import { AuthService } from '@social/backend/services/auth/auth.service';
import { UsersController } from '@social/backend/api/routes/users.controller';
import { AuthMiddleware } from '@social/backend/services/auth/auth.middleware';
import { CommerceController } from '@social/backend/api/routes/commerce.controller';
import { BillingService } from '@social/nestjs-libraries/services/billing.service';
import { AnalyticsController } from '@social/backend/api/routes/analytics.controller';
import { PoliciesGuard } from '@social/backend/services/auth/permissions/permissions.guard';
import { PermissionsService } from '@social/backend/services/auth/permissions/permissions.service';
import { IntegrationsController } from '@social/backend/api/routes/integrations.controller';
import { IntegrationManager } from '@social/nestjs-libraries/integrations/integration.manager';
import { SettingsController } from '@social/backend/api/routes/settings.controller';
import { PostsController } from '@social/backend/api/routes/posts.controller';
import { MediaController } from '@social/backend/api/routes/media.controller';
import { UploadModule } from '@social/nestjs-libraries/upload/upload.module';
import { BillingController } from '@social/backend/api/routes/billing.controller';
import { NotificationsController } from '@social/backend/api/routes/notifications.controller';
import { OpenaiService } from '@social/nestjs-libraries/openai/openai.service';
import { ExtractContentService } from '@social/nestjs-libraries/openai/extract.content.service';
import { CodesService } from '@social/nestjs-libraries/services/codes.service';
import { CopilotController } from '@social/backend/api/routes/copilot.controller';
import { PublicController } from '@social/backend/api/routes/public.controller';
import { RootController } from '@social/backend/api/routes/root.controller';
import { TrackService } from '@social/nestjs-libraries/track/track.service';
import { ShortLinkService } from '@social/nestjs-libraries/short-linking/short.link.service';
import { WebhookController } from '@social/backend/api/routes/webhooks.controller';
import { SignatureController } from '@social/backend/api/routes/signature.controller';
import { AutopostController } from '@social/backend/api/routes/autopost.controller';
import { SetsController } from '@social/backend/api/routes/sets.controller';
import { ThirdPartyController } from '@social/backend/api/routes/third-party.controller';
import { MonitorController } from '@social/backend/api/routes/monitor.controller';
import { NoAuthIntegrationsController } from '@social/backend/api/routes/no.auth.integrations.controller';
import { EnterpriseController } from '@social/backend/api/routes/enterprise.controller';
import { OAuthAppController } from '@social/backend/api/routes/oauth-app.controller';
import { ApprovedAppsController } from '@social/backend/api/routes/approved-apps.controller';
import { OAuthController, OAuthAuthorizedController } from '@social/backend/api/routes/oauth.controller';
import { AnnouncementsController } from '@social/backend/api/routes/announcements.controller';
import { AdminController } from '@social/backend/api/routes/admin.controller';
import { AuthProviderManager } from '@social/backend/services/auth/providers/providers.manager';
import { GithubProvider } from '@social/backend/services/auth/providers/github.provider';
import { GoogleProvider } from '@social/backend/services/auth/providers/google.provider';
import { FarcasterProvider } from '@social/backend/services/auth/providers/farcaster.provider';
import { WalletProvider } from '@social/backend/services/auth/providers/wallet.provider';
import { OauthProvider } from '@social/backend/services/auth/providers/oauth.provider';
import { HanzoIamProvider } from '@social/backend/services/auth/providers/hanzo-iam.provider';

const authenticatedController = [
  UsersController,
  AnalyticsController,
  IntegrationsController,
  SettingsController,
  PostsController,
  MediaController,
  BillingController,
  NotificationsController,
  CopilotController,
  WebhookController,
  SignatureController,
  AutopostController,
  SetsController,
  ThirdPartyController,
  OAuthAppController,
  ApprovedAppsController,
  OAuthAuthorizedController,
  AnnouncementsController,
  AdminController,
];
@Module({
  imports: [UploadModule],
  controllers: [
    RootController,
    CommerceController,
    AuthController,
    PublicController,
    MonitorController,
    EnterpriseController,
    NoAuthIntegrationsController,
    OAuthController,
    ...authenticatedController,
  ],
  providers: [
    AuthService,
    BillingService,
    OpenaiService,
    ExtractContentService,
    AuthMiddleware,
    PoliciesGuard,
    PermissionsService,
    CodesService,
    IntegrationManager,
    TrackService,
    ShortLinkService,
    AuthProviderManager,
    GithubProvider,
    GoogleProvider,
    FarcasterProvider,
    WalletProvider,
    OauthProvider,
    HanzoIamProvider,
  ],
  get exports() {
    return [...this.imports, ...this.providers];
  },
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes(...authenticatedController);
  }
}
