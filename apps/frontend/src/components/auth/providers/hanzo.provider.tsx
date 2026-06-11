import { useCallback } from 'react';
import { useFetch } from '@social/helpers/utils/custom.fetch';
import { useT } from '@social/react/translation/get.transation.service.client';

// "Sign in with Hanzo" button — triggers the HANZO OAuth provider in
// apps/backend/.../providers/hanzo-iam.provider.ts. The button is omitted
// at runtime when IAM_CLIENT_ID is unset (env not configured).

export const HanzoProvider = () => {
  const fetch = useFetch();
  const t = useT();
  const gotoLogin = useCallback(async () => {
    const link = await (await fetch('/auth/oauth/HANZO')).text();
    window.location.href = link;
  }, []);
  return (
    <div
      onClick={gotoLogin}
      className="cursor-pointer bg-black text-white h-[44px] rounded-[4px] flex justify-center items-center gap-[8px]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M4 4h3v7h10V4h3v16h-3v-6H7v6H4V4z" />
      </svg>
      <div>{t('sign_in_with_hanzo', 'Sign in with Hanzo')}</div>
    </div>
  );
};
