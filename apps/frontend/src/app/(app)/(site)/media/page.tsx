import { MediaLayoutComponent } from '@social/frontend/components/new-layout/layout.media.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@social/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Hanzo Social' : 'Hanzo Social'} Media`,
  description: '',
};

export default async function Page() {
  return <MediaLayoutComponent />
}
