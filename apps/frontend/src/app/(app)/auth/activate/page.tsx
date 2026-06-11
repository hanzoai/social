export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { Activate } from '@social/frontend/components/auth/activate';
import { isGeneralServerSide } from '@social/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${
    isGeneralServerSide() ? 'Hanzo Social' : 'Hanzo Social'
  } - Activate your account`,
  description: '',
};
export default async function Auth() {
  return <Activate />;
}
