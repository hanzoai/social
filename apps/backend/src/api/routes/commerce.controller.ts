import {
  Controller,
  HttpException,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BillingService } from '@gitroom/nestjs-libraries/services/billing.service';

// Webhook receiver for commerce.hanzo.ai → POST /commerce
//
// commerce.hanzo.ai signs each delivery with HMAC-SHA256 over the raw
// request body using the shared secret COMMERCE_WEBHOOK_SECRET (KMS
// social-secrets), and puts the hex digest in X-Commerce-Signature.
// BillingService.validateRequest verifies the signature in constant time
// and parses the body. Unknown event types are accepted as no-op so
// commerce can roll new events without breaking us.
@ApiTags('Commerce')
@Controller('/commerce')
export class CommerceController {
  constructor(private readonly _billing: BillingService) {}

  @Post('/')
  webhook(@Req() req: RawBodyRequest<Request>) {
    const event = this._billing.validateRequest(
      req.rawBody!,
      // @ts-ignore — express types miss header() at the typeguard level
      req.headers['x-commerce-signature'] as string,
      process.env.COMMERCE_WEBHOOK_SECRET!
    );

    try {
      switch (event.type) {
        case 'subscription.created':
          return this._billing.createSubscription(event);
        case 'subscription.updated':
          return this._billing.updateSubscription(event);
        case 'subscription.deleted':
          return this._billing.deleteSubscription(event);
        case 'invoice.payment_succeeded':
          return this._billing.paymentSucceeded(event);
        default:
          return { ok: true };
      }
    } catch (e) {
      throw new HttpException(`commerce webhook handler failed: ${e}`, 500);
    }
  }
}
