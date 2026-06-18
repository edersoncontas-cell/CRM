import { Sidebar } from "@/components/Sidebar";
import { AssistenteIA } from "@/components/AssistenteIA";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8">{children}</main>
      <AssistenteIA />
    </div>
  );
}
