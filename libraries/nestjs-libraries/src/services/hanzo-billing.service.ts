// Hanzo Billing service — replaces Stripe direct-SDK calls with
// commerce.hanzo.ai REST API calls. Public method shape mirrors
// StripeService so billing.controller can swap injection at boot.
//
// Feature flag: enable by setting HANZO_BILLING_ENABLED=true.
// Endpoint: COMMERCE_URL (default https://commerce.hanzo.ai).
//
// Plan IDs use the canonical Hanzo plan slugs (social-free, social-pro,
// social-team, social-team-max, social-enterprise). Legacy Postiz tier
// names (FREE/STANDARD/TEAM/PRO/ULTIMATE) are mapped by the LEGACY_TO_HANZO
// table mirrored from pricing.ts.
//
// Deferred (return 501 — tracked as separate tasks):
// - lifetimeDeal       — commerce.hanzo.ai has no lifetime SKU concept
// - refundCharges      — refund API surface still being designed
// - prorate            — partial: updateSubscription planId swap works,
//                        but mid-cycle credit math lives in commerce
// - embedded           — requires Square/Stripe Web SDK token flow on FE
// - getPackages        — return @hanzo/plans social-* tiers directly

import { Injectable, NotImplementedException } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { BillingSubscribeDto } from '@gitroom/nestjs-libraries/dtos/billing/billing.subscribe.dto';
import { subscriptionPlans } from '@hanzo/plans';

const COMMERCE_URL = () =>
  (process.env.COMMERCE_URL || 'https://commerce.hanzo.ai').replace(/\/+$/, '');

const LEGACY_TO_HANZO: Record<string, string> = {
  FREE: 'social-free',
  STANDARD: 'social-pro',
  TEAM: 'social-team',
  PRO: 'social-team-max',
  ULTIMATE: 'social-enterprise',
};
const HANZO_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_TO_HANZO).map(([k, v]) => [v, k])
);

interface CommerceSubscription {
  id?: string;
  planId?: string;
  userId?: string;
  status?: string;
  periodStart?: string;
  periodEnd?: string;
}

async function commerceRequest<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    token?: string;
    query?: Record<string, string>;
  } = {}
): Promise<T> {
  const url = new URL(`${COMMERCE_URL()}${path}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      url.searchParams.set(k, v);
    }
  }
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url.toString(), {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `commerce.hanzo.ai ${init.method || 'GET'} ${path} failed: ${res.status} ${text}`
    );
  }
  return res.json() as Promise<T>;
}

@Injectable()
export class HanzoBillingService {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _organizationService: OrganizationService
  ) {}

  // ── Core flows ──────────────────────────────────────────────────

  async subscribe(
    orgId: string,
    userId: string,
    body: BillingSubscribeDto,
    _allowTrial: boolean
  ) {
    const planId =
      LEGACY_TO_HANZO[body.billing.toUpperCase()] || body.billing.toLowerCase();
    const sub = await commerceRequest<CommerceSubscription>(
      '/v1/billing/subscriptions',
      {
        method: 'POST',
        body: {
          planId,
          userId,
          // commerce.hanzo.ai accepts interval via planId suffix when
          // priced per-interval, or via metadata. @hanzo/plans models
          // monthly/yearly as priceMonthly/priceAnnual on the same plan;
          // interval is selected at checkout.
          metadata: { interval: body.period?.toLowerCase() || 'monthly', orgId },
        },
      }
    );
    // Mirror Stripe's createOrUpdateSubscription contract so existing
    // Postiz subscription state stays in sync.
    if (sub.id) {
      await this._subscriptionService.createOrUpdateSubscription(
        false,
        userId,
        sub.id,
        // channel count comes from the plan's limits — looked up from
        // @hanzo/plans on the next checkSubscription poll.
        0,
        HANZO_TO_LEGACY[planId] || body.billing,
        body.period
      );
    }
    return { ok: true, subscriptionId: sub.id };
  }

  async cancelSubscription(organizationId: string) {
    const org = await this._organizationService.getOrgById(organizationId);
    const subscriptionId = org?.subscription?.identifier;
    if (!subscriptionId) {
      return { ok: false, reason: 'no active subscription' };
    }
    await commerceRequest<void>(
      `/v1/billing/subscriptions/${subscriptionId}/cancel`,
      { method: 'POST' }
    );
    await this._subscriptionService.deleteSubscriptionByCustomerId(
      org!.paymentId!
    );
    return { ok: true };
  }

  async setToCancel(organizationId: string) {
    // commerce.hanzo.ai cancels at period end via PATCH … {cancelAtPeriodEnd:true}.
    const org = await this._organizationService.getOrgById(organizationId);
    const subscriptionId = org?.subscription?.identifier;
    if (!subscriptionId) {
      return { ok: false, reason: 'no active subscription' };
    }
    await commerceRequest<CommerceSubscription>(
      `/v1/billing/subscriptions/${subscriptionId}`,
      { method: 'PATCH', body: { cancelAtPeriodEnd: true } }
    );
    return { ok: true };
  }

  async createBillingPortalLink(_customerId: string) {
    // The Hanzo billing portal is hosted at https://billing.hanzo.ai —
    // it consumes the user's IAM session so no Stripe-style return_url
    // round-trip is needed. Caller just hands the URL to the FE.
    return { url: 'https://billing.hanzo.ai' };
  }

  async getCustomerByOrganizationId(organizationId: string) {
    const org = await this._organizationService.getOrgById(organizationId);
    // commerce.hanzo.ai uses the IAM user id (sub) as the customer id —
    // no separate customer creation step.
    return org?.paymentId || org?.id;
  }

  async checkSubscription(organizationId: string, subscriptionIdentifier: string) {
    if (!subscriptionIdentifier) return null;
    try {
      const sub = await commerceRequest<CommerceSubscription>(
        `/v1/billing/subscriptions/${subscriptionIdentifier}`
      );
      return {
        status: sub.status,
        planId: sub.planId,
        legacyTier: HANZO_TO_LEGACY[sub.planId || ''] || null,
        periodEnd: sub.periodEnd,
      };
    } catch {
      return null;
    }
  }

  async checkDiscount(_customerId: string) {
    // Hanzo billing manages discount eligibility centrally — if the
    // customer is eligible the portal surfaces a "discount available"
    // banner. Return null here so Postiz's offerCoupon path falls back
    // to "no offer".
    return null;
  }

  async applyDiscount(_customerId: string) {
    // Discount application is a portal-side action in Hanzo billing —
    // there is no per-subscription apply endpoint exposed to apps.
    return { ok: true };
  }

  async finishTrial(_customerId: string) {
    // Trials are managed centrally on commerce.hanzo.ai. No-op.
    return { ok: true };
  }

  async getCharges(_organizationId: string) {
    return commerceRequest<unknown>('/v1/billing/transactions', {
      query: { user: _organizationId },
    });
  }

  async getPackages() {
    // Surface @hanzo/plans social-* tiers directly to the FE — no need
    // to hit commerce.hanzo.ai.
    const socialPlans = (subscriptionPlans as Array<{
      id: string;
      name: string;
      category: string;
      priceMonthly: number;
      priceAnnual: number;
    }>).filter((p) => p.category === 'social');
    return {
      monthly: socialPlans.map((p) => ({
        name: p.name,
        recurring: 'month',
        price: p.priceMonthly,
      })),
      yearly: socialPlans.map((p) => ({
        name: p.name,
        recurring: 'year',
        price: p.priceAnnual / 12,
      })),
    };
  }

  // ── Pass-throughs that Postiz calls but we keep no-op for now ──

  // Webhook validation: Hanzo billing pushes lifecycle events via its
  // own webhook signing scheme (HMAC-SHA256 over body, secret from KMS
  // social-secrets/COMMERCE_WEBHOOK_SECRET). Mirror Stripe's
  // constructEvent shape so the WebhookController doesn't have to fork.
  validateRequest(_rawBody: Buffer, _signature: string, _endpointSecret: string) {
    return { type: 'noop', data: { object: {} } } as unknown as never;
  }

  async createSubscription(_event: unknown) {
    return { ok: true };
  }

  async updateSubscription(_event: unknown) {
    return { ok: true };
  }

  async deleteSubscription(_event: unknown) {
    return { ok: true };
  }

  async createOrGetCustomer(organization: Organization) {
    return organization.paymentId || organization.id;
  }

  // ── Deferred (501) ─────────────────────────────────────────────

  async embedded(
    _userId: string,
    _organizationId: string,
    _body: BillingSubscribeDto
  ): Promise<never> {
    throw new NotImplementedException(
      'embedded payment form not yet wired through commerce.hanzo.ai'
    );
  }

  async lifetimeDeal(_organizationId: string, _code: string): Promise<never> {
    throw new NotImplementedException(
      'lifetime deals not supported via commerce.hanzo.ai'
    );
  }

  async prorate(_organizationId: string, _body: BillingSubscribeDto): Promise<never> {
    throw new NotImplementedException(
      'mid-cycle proration not yet wired through commerce.hanzo.ai'
    );
  }

  async refundCharges(_organizationId: string, _chargeIds: string[]): Promise<never> {
    throw new NotImplementedException(
      'refunds not yet wired through commerce.hanzo.ai'
    );
  }
}
