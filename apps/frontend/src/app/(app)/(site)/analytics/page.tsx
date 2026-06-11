export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { PlatformAnalytics } from '@social/frontend/components/platform-analytics/platform.analytics';
import { isGeneralServerSide } from '@social/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Hanzo Social' : 'Hanzo Social'} Analytics`,
  description: '',
};
export default async function Index() {
  return <PlatformAnalytics />;
}
