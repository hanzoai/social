export const dynamic = 'force-dynamic';
import { LaunchesComponent } from '@social/frontend/components/launches/launches.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@social/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Hanzo Social Calendar' : 'Hanzo Social Launches'}`,
  description: '',
};
export default async function Index() {
  return <LaunchesComponent />;
}
