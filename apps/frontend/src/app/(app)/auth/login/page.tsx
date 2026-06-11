export const dynamic = 'force-dynamic';
import { Login } from '@social/frontend/components/auth/login';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@social/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Hanzo Social' : 'Hanzo Social'} Login`,
  description: '',
};
export default async function Auth() {
  return <Login />;
}
