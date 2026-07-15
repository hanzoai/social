// Hanzo Social — its OWN root layout (separate from the retired Postiz shell):
// html/body, the shared Jakarta font, and one minimal stylesheet. No Postiz
// providers, no NestJS fetch context. This is the app social.hanzo.ai serves.
import '../../hz/hz.css';
import { ReactNode } from 'react';
import clsx from 'clsx';
import { jakartaSans } from '@social/frontend/fonts/jakarta';

export const metadata = {
  title: 'Hanzo Social',
  description: 'Plan, schedule, and publish across every channel — powered by Hanzo.',
};

export default function SocialRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={clsx(jakartaSans.className, 'bg-[#0a0a0b] text-zinc-100 antialiased')}>
        {children}
      </body>
    </html>
  );
}
