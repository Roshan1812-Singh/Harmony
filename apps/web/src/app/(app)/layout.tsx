import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-28">
        <TopBar />
        <main className="flex-1 px-4 sm:px-6 py-4">{children}</main>
      </div>
    </div>
  );
}
