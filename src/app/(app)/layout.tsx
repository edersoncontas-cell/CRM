import { Sidebar } from "@/components/Sidebar";
import { InstalarIOS } from "@/components/InstalarIOS";
import { AuthPersist } from "@/components/AuthPersist";
import { SplashBoot } from "@/components/SplashBoot";
import { CurvasDeNivel } from "@/components/CurvasDeNivel";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { lerParametros } from "@/lib/parametros";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Migrações de schema pendentes rodam aqui, ANTES de qualquer tela — custa
  // 1 SELECT (memoizado) quando já está tudo em dia. Antes só algumas páginas
  // faziam essa checagem, e uma coluna nova no banco derrubava as demais (o
  // WhatsApp quebrou assim) até alguém abrir uma das páginas "certas".
  await garantirManutencaoSeNecessario().catch(() => {});
  const parametros = await lerParametros().catch(() => null);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mesma textura da tela de abertura, agora no CRM inteiro: fica presa
          na viewport (não rola junto) e atrás de tudo. Sai na impressão para
          não sujar relatório em PDF. */}
      <CurvasDeNivel className="fixed inset-0 -z-10 h-full w-full text-white opacity-[0.07] print:hidden" />
      <Sidebar nome={parametros?.nomeCrm} sub={parametros?.nomeEmpresa} />
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8">{children}</main>
      <InstalarIOS />
      <AuthPersist modo="guardar" />
      <SplashBoot />
    </div>
  );
}
