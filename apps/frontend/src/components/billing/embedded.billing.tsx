'use client';

// Hanzo Social billing — handoff to billing.hanzo.ai/checkout.
//
// Hanzo Social upstream mounted Stripe Elements here (loadStripe + ConfirmPayment).
// We don't use Stripe — payment capture happens inside the Hanzo billing
// portal at billing.hanzo.ai, which is IAM-session-authenticated and
// shares state with commerce.hanzo.ai. The BillingService.embedded
// endpoint returns { portal: "https://billing.hanzo.ai/checkout?plan=…" }
// — we render a CTA button that redirects there.

import React, { FC, useCallback } from 'react';
import { useT } from '@social/react/translation/get.transation.service.client';

export const EmbeddedBilling: FC<{
  portal: string;
  showCoupon?: boolean;
  autoApplyCoupon?: boolean;
}> = ({ portal }) => {
  const t = useT();
  const go = useCallback(() => {
    if (portal) window.location.href = portal;
  }, [portal]);
  return (
    <div className="flex flex-col gap-[16px] p-[24px] rounded-[12px] border border-newColColor">
      <div className="text-[20px] font-[600]">
        {t('billing_complete_in_portal', 'Complete checkout on Hanzo Billing')}
      </div>
      <div className="text-[14px] opacity-80">
        {t(
          'billing_portal_redirect_explainer',
          'Card capture happens on billing.hanzo.ai (PCI-compliant). You will return here when payment succeeds.'
        )}
      </div>
      <button
        type="button"
        onClick={go}
        className="h-[44px] rounded-[6px] bg-customColor16 text-white font-[600] disabled:opacity-50"
        disabled={!portal}
      >
        {t('billing_continue_to_checkout', 'Continue to checkout')}
      </button>
    </div>
  );
};
