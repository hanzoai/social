'use client';

import React, { ReactNode, useCallback } from 'react';
import { Logo } from '@social/frontend/components/new-layout/logo';
import { Plus_Jakarta_Sans } from 'next/font/google';
const ModeComponent = dynamic(
  () => import('@social/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@social/helpers/utils/custom.fetch';
import { useVariables } from '@social/react/helpers/variable.context';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@social/frontend/components/layout/check.payment';
import { ToolTip } from '@social/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@social/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@social/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@social/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@social/react/toaster/toaster';
import { ShowPostSelector } from '@social/frontend/components/post-url-selector/post.url.selector';
import { NewSubscription } from '@social/frontend/components/layout/new.subscription';
import { Support } from '@social/frontend/components/layout/support';
import { ContinueProvider } from '@social/frontend/components/layout/continue.provider';
import { ContextWrapper } from '@social/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@social/react/helpers/mantine.wrapper';
import { Impersonate } from '@social/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@social/frontend/components/layout/announcement.banner';
import { Title } from '@social/frontend/components/layout/title';
import { TopMenu } from '@social/frontend/components/layout/top.menu';
import { LanguageComponent } from '@social/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@social/frontend/components/layout/chrome.extension.component';
import NotificationComponent from '@social/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@social/frontend/components/layout/organization.selector';
import { StreakComponent } from '@social/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@social/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@social/frontend/components/new-layout/sentry.feedback.component';
import { FirstBillingComponent } from '@social/frontend/components/billing/first.billing.component';
import { TrialTracker } from '@social/frontend/components/layout/gtm.component';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();

  // Feedback icon component attaches Sentry feedback to a top-bar icon when DSN is present
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        showDevConsole={false}
      >
        <MantineWrapper>
          <ToolTip />
          <Toaster />
          <TrialTracker />
          <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
            <ShowMediaBoxModal />
            <ShowLinkedinCompany />
            <MediaSettingsLayout />
            <ShowPostSelector />
            <PreConditionComponent />
            <NewSubscription />
            <ContinueProvider />
            <div
              className={clsx(
                'flex flex-col min-h-screen min-w-screen text-newTextColor p-[12px]',
                jakartaSans.className
              )}
            >
              <div>{user?.admin ? <Impersonate /> : <div />}</div>
              {user.tier === 'FREE' && isGeneral && billingEnabled ? (
                <FirstBillingComponent />
              ) : (
                <>
                  <AnnouncementBanner />
                  <div className="flex-1 flex gap-[8px]">
                    <Support />
                    <div className="flex flex-col bg-newBgColorInner w-[80px] rounded-[12px]">
                      <div
                        id="left-menu"
                        className={clsx(
                          'fixed h-full w-[64px] start-[17px] flex flex-1 top-0',
                          user?.admin && 'pt-[60px] max-h-[1000px]:w-[500px]'
                        )}
                      >
                        <div className="flex flex-col h-full gap-[32px] flex-1 py-[12px]">
                          <Logo />
                          <TopMenu />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px] blurMe">
                      <div className="flex bg-newBgColorInner h-[80px] px-[20px] items-center">
                        <div className="text-[24px] font-[600] flex flex-1">
                          <Title />
                        </div>
                        <div className="flex gap-[20px] text-textItemBlur">
                          <StreakComponent />
                          <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          <OrganizationSelector />
                          <div className="hover:text-newTextColor">
                            <ModeComponent />
                          </div>
                          <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          <LanguageComponent />
                          <ChromeExtensionComponent />
                          <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          <AttachToFeedbackIcon />
                          <NotificationComponent />
                        </div>
                      </div>
                      <div className="flex flex-1 gap-[1px]">{children}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
