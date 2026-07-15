// The root of social.hanzo.ai. Server component: authenticated (session cookie
// OR an injected bearer) → the Social dashboard; anonymous → the hanzo.id
// sign-in. The cloud is the real authority; this only picks the surface.
import { resolveAuth } from '@social/frontend/hz/server';
import { Dashboard } from '@social/frontend/hz/components/Dashboard';
import { SignIn } from '@social/frontend/hz/components/SignIn';

export const dynamic = 'force-dynamic';

export default async function SocialHome({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const { authed, owner } = await resolveAuth();
  if (!authed) {
    const sp = await searchParams;
    return <SignIn error={sp?.auth_error} />;
  }
  return <Dashboard org={owner} />;
}
