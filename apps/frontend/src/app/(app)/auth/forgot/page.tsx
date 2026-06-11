export const dynamic = 'force-dynamic';
import { Forgot } from '@social/frontend/components/auth/forgot';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@social/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Hanzo Social' : 'Hanzo Social'} Forgot Password`,
  description: '',
};
export default async function Auth() {
  return <Forgot />;
}
