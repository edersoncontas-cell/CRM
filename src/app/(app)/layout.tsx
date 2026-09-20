import { Sidebar } from "@/components/Sidebar";
import { InstalarIOS } from "@/components/InstalarIOS";
import { AuthPersist } from "@/components/AuthPersist";
import { SplashBoot } from "@/components/SplashBoot";
import { CurvasDeNivel } from "@/components/CurvasDeNivel";
import { RodapeMercado } from "@/components/RodapeMercado";
import { LembreteVisitasDoDia } from "@/components/LembreteVisitasDoDia";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { lerParametros } from "@/lib/parametros";
import { carregarChavesIA } from "@/lib/ai/chaves";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Migrações de schema pendentes rodam aqui, ANTES de qualquer tela — custa
  // 1 SELECT (memoizado) quando já está tudo em dia. Antes só algumas páginas
  // faziam essa checagem, e uma coluna nova no banco derrubava as demais (o
  // WhatsApp quebrou assim) até alguém abrir uma das páginas "certas".
  await garantirManutencaoSeNecessario().catch(() => {});
  // As chaves de IA que o vendedor salvou pela tela do CRM entram no ambiente
  // aqui, uma vez por render de página, para que TODA tela enxergue os mesmos
  // provedores que as chamadas de IA enxergam. Sem isto, o card do ZEUS lia o
  // ambiente cru e dizia "nenhum provedor configurado" logo depois de o
  // vendedor salvar uma chave — que é exatamente o contrário do que aconteceu.
  // (llmTexto também chama, para as rotas de API e os crons, que não passam
  // por este layout.) Ver lib/ai/chaves.ts.
  await carregarChavesIA().catch(() => {});
  const parametros = await lerParametros().catch(() => null);

  return (
    // --rodape-mercado: a altura do letreiro fixo. Vira variável CSS porque
    // mais de uma tela precisa dela — o conteúdo afasta o rodapé com um
    // padding, e o Atendimento (que se ancora em bottom-0 para ocupar a tela
    // inteira) sobe a sua base pela mesma medida. Sem isso o letreiro ficaria
    // por cima da caixa de mensagem do WhatsApp.
    <div className="flex min-h-screen flex-col md:flex-row" style={{ "--rodape-mercado": "30px" } as React.CSSProperties}>
      {/* Mesma textura da tela de abertura, agora no CRM inteiro: fica presa
          na viewport (não rola junto) e atrás de tudo. Sai na impressão para
          não sujar relatório em PDF. */}
      <CurvasDeNivel className="fixed inset-0 -z-10 h-full w-full text-white opacity-[0.07] print:hidden" />
      <Sidebar nome={parametros?.nomeCrm} sub={parametros?.nomeEmpresa} />
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8" style={{ paddingBottom: "calc(var(--rodape-mercado) + 1rem)" }}>{children}</main>
      <InstalarIOS />
      <AuthPersist modo="guardar" />
      <SplashBoot />
      {/* Letreiro do mercado: fixo no rodapé de TODAS as telas do CRM. */}
      <RodapeMercado />
      {/* Lembrete das visitas do dia: aparece em QUALQUER tela, porque a ideia
          é justamente aproveitar a entrada no CRM — o vendedor volta aqui para
          ver um preço, não para registrar visita. Ele se esconde sozinho fora
          de segunda a sexta, antes da primeira visita do dia e quando todas já
          foram sinalizadas (ver lib/visitas-do-dia.ts). */}
      <LembreteVisitasDoDia />
    </div>
  );
}
