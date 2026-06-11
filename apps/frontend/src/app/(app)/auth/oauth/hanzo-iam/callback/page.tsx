'use client';

// Hanzo IAM OAuth callback — bridges hanzo.id's redirect back into the
// existing Hanzo Social registration/login flow. Hanzo IAM is configured to
// redirect to https://social.hanzo.ai/auth/oauth/hanzo-iam/callback
// (init_data.json hanzo-social app). We forward to /auth?provider=HANZO&code=...
// which the upstream Register/Login components already handle.

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function HanzoIamCallback() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const code = params?.get('code');
    if (!code) {
      router.replace('/auth/login');
      return;
    }
    router.replace(`/auth?provider=HANZO&code=${encodeURIComponent(code)}`);
  }, [params, router]);
  return null;
}
