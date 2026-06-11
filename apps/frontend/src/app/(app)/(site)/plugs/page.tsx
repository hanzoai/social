import { Plugs } from '@social/frontend/components/plugs/plugs';
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@social/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Hanzo Social' : 'Hanzo Social'} Plugs`,
  description: '',
};
export default async function Index() {
  return <Plugs />;
}
