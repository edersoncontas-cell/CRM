import { Sidebar } from "@/components/Sidebar";
import { InstalarIOS } from "@/components/InstalarIOS";
import { AuthPersist } from "@/components/AuthPersist";
import { SplashBoot } from "@/components/SplashBoot";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Migrações de schema pendentes rodam aqui, ANTES de qualquer tela — custa
  // 1 SELECT (memoizado) quando já está tudo em dia. Antes só algumas páginas
  // faziam essa checagem, e uma coluna nova no banco derrubava as demais (o
  // WhatsApp quebrou assim) até alguém abrir uma das páginas "certas".
  await garantirManutencaoSeNecessario().catch(() => {});

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8">{children}</main>
      <InstalarIOS />
      <AuthPersist modo="guardar" />
      <SplashBoot />
    </div>
  );
}
