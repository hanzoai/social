import { Global, Module } from '@nestjs/common';
import { PrismaRepository, PrismaService, PrismaTransaction } from './prisma.service';
import { OrganizationRepository } from '@social/nestjs-libraries/database/prisma/organizations/organization.repository';
import { OrganizationService } from '@social/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@social/nestjs-libraries/database/prisma/users/users.service';
import { UsersRepository } from '@social/nestjs-libraries/database/prisma/users/users.repository';
import { SubscriptionService } from '@social/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { SubscriptionRepository } from '@social/nestjs-libraries/database/prisma/subscriptions/subscription.repository';
import { NotificationService } from '@social/nestjs-libraries/database/prisma/notifications/notification.service';
import { IntegrationService } from '@social/nestjs-libraries/database/prisma/integrations/integration.service';
import { IntegrationRepository } from '@social/nestjs-libraries/database/prisma/integrations/integration.repository';
import { PostsService } from '@social/nestjs-libraries/database/prisma/posts/posts.service';
import { PostsRepository } from '@social/nestjs-libraries/database/prisma/posts/posts.repository';
import { IntegrationManager } from '@social/nestjs-libraries/integrations/integration.manager';
import { MediaService } from '@social/nestjs-libraries/database/prisma/media/media.service';
import { MediaRepository } from '@social/nestjs-libraries/database/prisma/media/media.repository';
import { NotificationsRepository } from '@social/nestjs-libraries/database/prisma/notifications/notifications.repository';
import { EmailService } from '@social/nestjs-libraries/services/email.service';
import { BillingService } from '@social/nestjs-libraries/services/billing.service';
import { ExtractContentService } from '@social/nestjs-libraries/openai/extract.content.service';
import { OpenaiService } from '@social/nestjs-libraries/openai/openai.service';
import { AgenciesService } from '@social/nestjs-libraries/database/prisma/agencies/agencies.service';
import { AgenciesRepository } from '@social/nestjs-libraries/database/prisma/agencies/agencies.repository';
import { TrackService } from '@social/nestjs-libraries/track/track.service';
import { ShortLinkService } from '@social/nestjs-libraries/short-linking/short.link.service';
import { WebhooksRepository } from '@social/nestjs-libraries/database/prisma/webhooks/webhooks.repository';
import { WebhooksService } from '@social/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { SignatureRepository } from '@social/nestjs-libraries/database/prisma/signatures/signature.repository';
import { SignatureService } from '@social/nestjs-libraries/database/prisma/signatures/signature.service';
import { AutopostRepository } from '@social/nestjs-libraries/database/prisma/autopost/autopost.repository';
import { AutopostService } from '@social/nestjs-libraries/database/prisma/autopost/autopost.service';
import { SetsService } from '@social/nestjs-libraries/database/prisma/sets/sets.service';
import { SetsRepository } from '@social/nestjs-libraries/database/prisma/sets/sets.repository';
import { ThirdPartyRepository } from '@social/nestjs-libraries/database/prisma/third-party/third-party.repository';
import { ThirdPartyService } from '@social/nestjs-libraries/database/prisma/third-party/third-party.service';
import { VideoManager } from '@social/nestjs-libraries/videos/video.manager';
import { FalService } from '@social/nestjs-libraries/openai/fal.service';
import { RefreshIntegrationService } from '@social/nestjs-libraries/integrations/refresh.integration.service';
import { OAuthRepository } from '@social/nestjs-libraries/database/prisma/oauth/oauth.repository';
import { OAuthService } from '@social/nestjs-libraries/database/prisma/oauth/oauth.service';
import { AnnouncementsRepository } from '@social/nestjs-libraries/database/prisma/announcements/announcements.repository';
import { AnnouncementsService } from '@social/nestjs-libraries/database/prisma/announcements/announcements.service';
import { ErrorsRepository } from '@social/nestjs-libraries/database/prisma/errors/errors.repository';
import { ErrorsService } from '@social/nestjs-libraries/database/prisma/errors/errors.service';
import { AdminStatsRepository } from '@social/nestjs-libraries/database/prisma/admin-stats/admin-stats.repository';
import { AdminStatsService } from '@social/nestjs-libraries/database/prisma/admin-stats/admin-stats.service';

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [
    PrismaService,
    PrismaRepository,
    PrismaTransaction,
    UsersService,
    UsersRepository,
    OrganizationService,
    OrganizationRepository,
    SubscriptionService,
    SubscriptionRepository,
    NotificationService,
    NotificationsRepository,
    WebhooksRepository,
    WebhooksService,
    IntegrationService,
    IntegrationRepository,
    PostsService,
    PostsRepository,
    BillingService,
    SignatureRepository,
    AutopostRepository,
    AutopostService,
    SignatureService,
    MediaService,
    MediaRepository,
    AgenciesService,
    AgenciesRepository,
    IntegrationManager,
    RefreshIntegrationService,
    ExtractContentService,
    OpenaiService,
    FalService,
    EmailService,
    TrackService,
    ShortLinkService,
    SetsService,
    SetsRepository,
    ThirdPartyRepository,
    ThirdPartyService,
    OAuthRepository,
    OAuthService,
    VideoManager,
    AnnouncementsRepository,
    AnnouncementsService,
    ErrorsRepository,
    ErrorsService,
    AdminStatsRepository,
    AdminStatsService,
  ],
  get exports() {
    return this.providers;
  },
})
export class DatabaseModule {}
