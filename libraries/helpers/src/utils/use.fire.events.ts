import { createAnalytics } from '@hanzo/event';
import { useCallback, useMemo } from 'react';
import { useVariables } from '@social/react/helpers/variable.context';
import { useUser } from '@social/frontend/components/layout/user.context';

/**
 * The ONE event helper. It posts the single Hanzo front door
 * (api.hanzo.ai/v1/event), which Cloud lenses server-side into web (analytics),
 * product (insights) and error (sentry) views.
 *
 * It replaces a PostHog + Plausible pair that this fork inherited from upstream.
 * Their providers are gone from the layout, so `usePostHog()`/`usePlausible()`
 * here had no provider left to read — this is the other half of that change.
 *
 * Identity is the stable user id ONLY. The previous call shipped `email` and
 * `name` to PostHog on every fire; the id is what joins events server-side, so
 * the PII bought nothing and cost a lot.
 */
export const useFireEvents = () => {
  const { billingEnabled } = useVariables();
  const user = useUser();

  const analytics = useMemo(
    () => createAnalytics({ product: 'social', host: 'https://api.hanzo.ai' }),
    []
  );

  return useCallback(
    (name: string, props?: any) => {
      if (!billingEnabled) {
        return;
      }

      if (user) {
        analytics.identify(user.id);
      }

      analytics.track(name, props);
    },
    [analytics, billingEnabled, user]
  );
};
