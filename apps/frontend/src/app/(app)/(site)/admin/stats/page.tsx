export const dynamic = 'force-dynamic';
import { AdminStatsComponent } from '@social/frontend/components/admin/admin-stats.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@social/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Hanzo Social' : 'Hanzo Social'} Admin Stats`,
  description: '',
};

export default async function Page() {
  return (
    <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[12px]">
      <AdminStatsComponent />
    </div>
  );
}
