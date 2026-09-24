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
import { conferirBanco } from "@/lib/saude-banco";
import { BancoForaDoAr } from "@/components/BancoForaDoAr";
import { garantirBancoDoZero } from "@/lib/banco-do-zero";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // ORDEM IMPORTA, e é esta:
  //  1. O banco está de pé? (uma consulta). Não está → a tela diz o motivo e
  //     nada abaixo roda — não adianta migrar um banco que não responde.
  //  2. O banco está VAZIO? Cria a estrutura inteira (lib/banco-do-zero.ts).
  //     É o que permite apontar o CRM para um banco novo e ele se recompor.
  //  3. Migrações pendentes. Custa 1 SELECT (memoizado) quando está tudo em
  //     dia. Antes só algumas páginas checavam, e uma coluna nova derrubava as
  //     demais (o WhatsApp quebrou assim) até alguém abrir uma das "certas".
  const saude = await conferirBanco();
  let recemCriado = false;
  if (saude.ok) {
    const zero = await garantirBancoDoZero().catch((e) => { console.error("[banco do zero] falhou:", e); return null; });
    recemCriado = zero?.situacao === "criado";
    await garantirManutencaoSeNecessario().catch(() => {});
  }
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
      {/* As curvas de nível do fundo: brancas no escuro, grafite no claro —
          fixas em branco elas sumiriam sobre o fundo claro. */}
      <CurvasDeNivel className="fixed inset-0 -z-10 h-full w-full text-[var(--curvas-cor)] opacity-[var(--curvas-opacidade)] print:hidden" />
      <Sidebar nome={parametros?.nomeCrm} sub={parametros?.nomeEmpresa} />
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6 md:p-8" style={{ paddingBottom: "calc(var(--rodape-mercado) + 1rem)" }}>
        {!saude.ok ? (
          <BancoForaDoAr saude={saude} />
        ) : recemCriado ? (
          // A estrutura acabou de ser criada NESTA requisição. A página (que
          // o Next renderiza em paralelo com o layout) consultou tabelas que
          // ainda não existiam e caiu — mostrá-la seria mostrar erro num banco
          // que já está certo. Em vez disso: aviso e recarga em 2 s.
          <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 text-center">
            <meta httpEquiv="refresh" content="2" />
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            <h1 className="text-lg font-bold text-[var(--sobre-fundo-titulo)]">Banco novo preparado</h1>
            <p className="text-sm text-[var(--sobre-fundo-mudo)]">
              A estrutura do CRM foi criada agora neste banco. Recarregando em instantes…
            </p>
          </div>
        ) : (
          children
        )}
      </main>
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
