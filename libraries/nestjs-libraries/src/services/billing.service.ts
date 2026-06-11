// Hanzo Social billing — talks ONLY to commerce.hanzo.ai. No Stripe SDK,
// no Stripe code paths anywhere. The Hanzo billing portal lives at
// billing.hanzo.ai; customer portal links go there.
//
// Endpoint: COMMERCE_URL (default https://commerce.hanzo.ai).
// Portal:   BILLING_PORTAL_URL (default https://billing.hanzo.ai).
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

import { Injectable, HttpException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { BillingSubscribeDto } from '@gitroom/nestjs-libraries/dtos/billing/billing.subscribe.dto';
import { subscriptionPlans } from '@hanzo/plans';

// Commerce webhook event shape — mirrors the wire format emitted by
// commerce.hanzo.ai (see hanzo/commerce/webhook/spec.md). Fields:
//   type:   "subscription.created" | "subscription.updated" |
//           "subscription.deleted" | "invoice.payment_succeeded" |
//           "invoice.payment_failed"
//   data.object: the resource the event is about (CommerceSubscription
//                or CommerceInvoice).
//   data.object.metadata: caller-supplied metadata from subscribe()
//                         — { orgId, interval } for subscriptions.
export interface CommerceWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> & { metadata?: Record<string, string> } };
}

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
export class BillingService {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _organizationService: OrganizationService
  ) {}

  // ── Core flows ──────────────────────────────────────────────────

  async subscribe(
    _uniqueId: string,
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
    // Don't touch local subscription state here — the authoritative
    // record arrives via commerce.hanzo.ai webhook (subscription.created),
    // which calls createOrUpdateSubscription in createSubscription().
    // Returning early avoids double-write races between the API call and
    // the webhook.
    return { ok: true, subscriptionId: sub.id };
  }

  async cancelSubscription(organizationId: string) {
    const sub =
      await this._subscriptionService.getSubscriptionByOrganizationId(
        organizationId
      );
    const subscriptionId = sub?.identifier;
    if (!subscriptionId) {
      return { ok: false, reason: 'no active subscription' };
    }
    await commerceRequest<void>(
      `/v1/billing/subscriptions/${subscriptionId}/cancel`,
      { method: 'POST' }
    );
    await this._subscriptionService.deleteSubscriptionByCustomerId(
      organizationId
    );
    return { ok: true };
  }

  async setToCancel(organizationId: string) {
    // commerce.hanzo.ai cancels at period end via PATCH … {cancelAtPeriodEnd:true}.
    const sub =
      await this._subscriptionService.getSubscriptionByOrganizationId(
        organizationId
      );
    const subscriptionId = sub?.identifier;
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
    // The Hanzo billing portal is hosted at billing.hanzo.ai — it
    // consumes the user's IAM session so no Stripe-style return_url
    // round-trip is needed. Caller hands the URL to the FE.
    return {
      url: (
        process.env.BILLING_PORTAL_URL || 'https://billing.hanzo.ai'
      ).replace(/\/+$/, ''),
    };
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

  // ── Webhook handling (commerce.hanzo.ai → CommerceController) ──

  // HMAC-SHA256(body, secret) signature in X-Commerce-Signature header.
  // Throws HttpException(400) on bad signature. Returns the parsed event.
  validateRequest(
    rawBody: Buffer,
    signature: string,
    endpointSecret: string
  ): CommerceWebhookEvent {
    if (!signature || !endpointSecret) {
      throw new HttpException('missing commerce webhook signature', 400);
    }
    const expected = createHmac('sha256', endpointSecret)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new HttpException('invalid commerce webhook signature', 400);
    }
    return JSON.parse(rawBody.toString('utf8')) as CommerceWebhookEvent;
  }

  async createSubscription(event: CommerceWebhookEvent) {
    const sub = event.data.object as {
      id?: string;
      planId?: string;
      userId?: string;
      status?: string;
      cancelAt?: number;
      metadata?: { orgId?: string; interval?: string };
    };
    const orgId = sub.metadata?.orgId;
    const interval = (sub.metadata?.interval || 'monthly').toUpperCase();
    if (!sub.id || !orgId || !sub.planId || sub.planId === 'social-free') {
      return { ok: false };
    }
    const legacyTier = (HANZO_TO_LEGACY[sub.planId] || 'STANDARD') as
      | 'STANDARD'
      | 'TEAM'
      | 'PRO'
      | 'ULTIMATE';
    return this._subscriptionService.createOrUpdateSubscription(
      sub.status !== 'active',
      sub.id,
      orgId,
      0,
      legacyTier,
      interval as 'MONTHLY' | 'YEARLY',
      sub.cancelAt ?? null
    );
  }

  async updateSubscription(event: CommerceWebhookEvent) {
    return this.createSubscription(event);
  }

  async deleteSubscription(event: CommerceWebhookEvent) {
    const sub = event.data.object as { userId?: string; metadata?: { orgId?: string } };
    const customerId = sub.metadata?.orgId || sub.userId;
    if (!customerId) return { ok: false };
    return this._subscriptionService.deleteSubscriptionByCustomerId(customerId);
  }

  async paymentSucceeded(_event: CommerceWebhookEvent) {
    // commerce.hanzo.ai reconciles paid invoices server-side; nothing to
    // do here today. Hook left in place for future per-payment side effects.
    return { ok: true };
  }

  async createOrGetCustomer(organization: Organization) {
    return organization.paymentId || organization.id;
  }

  // ── Embedded / one-time flows via commerce.hanzo.ai ────────────

  // Postiz' old embedded() returned Stripe Elements client_secret. We
  // instead return a billing.hanzo.ai portal URL deep-linked to the
  // checkout-for-plan flow; the FE redirects there and billing.hanzo.ai
  // handles card capture (Square Web Payments SDK on commerce.hanzo.ai
  // backed by Hanzo Vault PCI tokenization).
  async embedded(
    _uniqueId: string,
    orgId: string,
    userId: string,
    body: BillingSubscribeDto,
    _allowTrial: boolean
  ) {
    const planId =
      LEGACY_TO_HANZO[body.billing.toUpperCase()] || body.billing.toLowerCase();
    const portal = (
      process.env.BILLING_PORTAL_URL || 'https://billing.hanzo.ai'
    ).replace(/\/+$/, '');
    const url = new URL(`${portal}/checkout`);
    url.searchParams.set('plan', planId);
    url.searchParams.set('interval', body.period?.toLowerCase() || 'monthly');
    url.searchParams.set('orgId', orgId);
    url.searchParams.set('userId', userId);
    url.searchParams.set(
      'returnUrl',
      `${process.env.FRONTEND_URL}/billing?status=success`
    );
    return { portal: url.toString() };
  }

  async prorate(organizationId: string, body: BillingSubscribeDto) {
    // Mid-cycle plan swap: PATCH the existing subscription to the new
    // planId; commerce.hanzo.ai handles the proration math server-side
    // and emits invoice.payment_succeeded back via webhook.
    const sub =
      await this._subscriptionService.getSubscriptionByOrganizationId(
        organizationId
      );
    const subscriptionId = sub?.identifier;
    if (!subscriptionId) {
      // No existing sub — fall through to a fresh subscribe.
      return this.subscribe('', organizationId, '', body, false);
    }
    const planId =
      LEGACY_TO_HANZO[body.billing.toUpperCase()] || body.billing.toLowerCase();
    const sub = await commerceRequest<CommerceSubscription>(
      `/v1/billing/subscriptions/${subscriptionId}`,
      { method: 'PATCH', body: { planId } }
    );
    return { ok: true, subscriptionId: sub.id };
  }

  async refundCharges(organizationId: string, chargeIds: string[]) {
    // commerce.hanzo.ai refund endpoint: POST /v1/billing/payments/{id}/refund.
    // Iterate so partial failures don't block the rest — collect results.
    const results = await Promise.all(
      chargeIds.map(async (id) => {
        try {
          await commerceRequest<unknown>(
            `/v1/billing/payments/${id}/refund`,
            { method: 'POST', body: { organizationId } }
          );
          return { id, ok: true };
        } catch (err) {
          return { id, ok: false, error: String(err) };
        }
      })
    );
    return { refunds: results };
  }

  async lifetimeDeal(organizationId: string, code: string) {
    // Lifetime SKU lives on commerce.hanzo.ai as a one-time credit grant
    // backed by a discount code. Validate the code, then grant.
    const valid = await commerceRequest<{ valid: boolean; plan?: string }>(
      '/v1/billing/discount/validate',
      { query: { code } }
    );
    if (!valid?.valid) {
      return { ok: false, reason: 'invalid code' };
    }
    await commerceRequest<unknown>('/v1/billing/credit-grants', {
      method: 'POST',
      body: {
        userId: organizationId,
        code,
        eligibility: ['lifetime'],
      },
    });
    return { ok: true };
  }
}
