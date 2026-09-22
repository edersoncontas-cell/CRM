import { db } from "@/lib/db";
import { enviarMensagemClientesAction } from "@/lib/mensagem-clientes-actions";
import { registrarAudit } from "@/lib/audit";
import { PRAZO_RODADA_MS, fecharRodada } from "@/lib/envio-programado";
import { porQueNaoEnviar, explicarBloqueio, pausaHumanaMs } from "@/lib/envio-limites";
import { lerLimitesEnvio, enviadasHoje } from "@/lib/envio-guarda";

// O DESPACHANTE das mensagens programadas.
//
// Fica separado da rota do cron e das server actions de propósito: a rota é só
// a porta, e "use server" não pode exportar nada que não seja função async —
// aqui dá para ter constantes e tipos.
//
// Três decisões de segurança que valem o comentário:
//
//   1. O envio é marcado como "enviando" ANTES de começar. Se o cron for
//      chamado duas vezes (o agendador externo repetir, ou uma execução
//      demorar mais que o intervalo), a segunda não acha mais o registro como
//      pendente e não manda a mesma mensagem duas vezes para o cliente.
//   2. Um envio por rodada, e em lotes pequenos com pausa. A função da Vercel
//      tem 60s; estourar no meio deixaria metade da lista avisada e a outra
//      metade não, sem registro de onde parou.
//   3. A LISTA GRANDE SAI EM ONDAS. Não cabe mandar 2 mil em 45 segundos: a
//      rodada manda o que dá, grava em enviadosAte onde parou e devolve o
//      envio para "pendente". A rodada seguinte (15 min depois) continua dali,
//      até acabar a lista. Antes disto o envio era fechado como "enviado" no
//      meio do caminho, com o resto nunca mandado e a tela dizendo que tinha
//      saído para todo mundo — era mentira, e ninguém tinha como perceber.
//
// A trava presa: se uma rodada morrer no meio (a função da Vercel ser cortada),
// o registro fica em "enviando" para sempre e a lista nunca termina. Por isso
// "enviando" parado há mais de TRAVA_PRESA_MS volta a ser pego — e volta do
// cursor gravado, sem remandar para quem já recebeu.
const TRAVA_PRESA_MS = 10 * 60_000;

// Uma mensagem por vez. Antes eram 5 a cada 0,7s — foi parte do que restringiu
// o número do vendedor por 24h. Ninguém digita cinco mensagens em sete
// décimos de segundo.
const POR_VEZ = 1;

export type ResultadoDespacho = {
  processados: number;
  enviados: number;
  falhas: number;
  pendentes: number;
  /** Envios que ficaram pela metade e continuam na próxima rodada. */
  continuam: number;
  /** Contatos pulados por saída da lista, contato frio ou falta de telefone. */
  pulados: number;
  /** Por que a rodada não mandou nada (janela, fim de semana, teto do dia). */
  bloqueio?: string;
};

export async function despacharEnviosProgramados(agora: Date = new Date()): Promise<ResultadoDespacho> {
  const saida: ResultadoDespacho = { processados: 0, enviados: 0, falhas: 0, pendentes: 0, continuam: 0, pulados: 0 };
  try {
    const travaVencida = new Date(agora.getTime() - TRAVA_PRESA_MS);
    const devidos = await db.envioProgramado.findMany({
      // Um OR só: dois OR no mesmo objeto se apagam no Prisma (o último vence),
      // e o filtro perdido some sem erro nenhum.
      where: {
        quando: { lte: agora },
        OR: [
          { status: "pendente" },
          { status: "enviando", processadoEm: { lt: travaVencida } },
        ],
      },
      orderBy: { quando: "asc" },
      take: 5,
    });
    saida.pendentes = devidos.length;
    if (!devidos.length) return saida;

    // As travas de envio, lidas uma vez por rodada.
    const lim = await lerLimitesEnvio();
    let jaHoje = await enviadasHoje(agora);
    const bloqueio = porQueNaoEnviar(agora, jaHoje, lim);
    if (bloqueio) {
      // Não é erro: é a trava funcionando. O envio continua pendente e a
      // rodada seguinte tenta de novo — dentro da janela, e amanhã se o teto
      // do dia já tiver estourado.
      saida.bloqueio = explicarBloqueio(bloqueio, lim);
      saida.continuam = devidos.length;
      return saida;
    }

    const limite = Date.now() + PRAZO_RODADA_MS;
    for (const envio of devidos) {
      if (Date.now() > limite) break;

      // Trava otimista: só quem conseguir virar "enviando" manda. O count === 0
      // significa que outra execução já pegou este envio. A condição repete o
      // estado em que ele foi lido para a retomada de trava presa não roubar um
      // envio que outra rodada acabou de reassumir.
      const travou = await db.envioProgramado.updateMany({
        where: envio.status === "pendente"
          ? { id: envio.id, status: "pendente" }
          : { id: envio.id, status: "enviando", processadoEm: { lt: travaVencida } },
        data: { status: "enviando", processadoEm: new Date() },
      });
      if (!travou.count) continue;

      const total = envio.clienteIds.length;
      // Os contadores continuam de onde a rodada anterior deixou: são o total
      // do ENVIO, não o da rodada.
      let cursor = Math.min(Math.max(envio.enviadosAte, 0), total);
      let enviados = envio.enviados;
      let falhas = envio.falhas;
      // O que saiu NESTA rodada, só para o relatório do cron: somar o
      // acumulado do envio a cada rodada contaria o mesmo cliente de novo.
      let enviadosRodada = 0;
      let falhasRodada = 0;
      let pulados = 0;
      let erroFatal: string | null = null;

      // O rodapé com a saída da lista é colado pela action, uma vez só.
      const texto = envio.texto;

      try {
        while (cursor < total) {
          if (Date.now() > limite) break;
          // O teto do dia é conferido a CADA mensagem, não uma vez por rodada:
          // a resposta automática e o vendedor também estão mandando enquanto
          // isto roda, e o WhatsApp conta o número, não o motivo.
          if (porQueNaoEnviar(new Date(), jaHoje, lim)) break;

          const lote = envio.clienteIds.slice(cursor, cursor + POR_VEZ);
          // A peneira e o rodapé moram dentro da action — ela é o funil por
          // onde passa TODO envio em massa do CRM, e trava que só existe em um
          // dos caminhos não é trava. Aqui só se lê o que ela reporta.
          //
          // Peneirar de novo agora, e não só na hora de montar a lista, é o
          // ponto: o envio pode ter sido programado dias antes, e nesse
          // meio-tempo alguém respondeu SAIR.
          const r = await enviarMensagemClientesAction(lote, texto, envio.midiaId);
          // Trava batida no meio da rodada (o teto do dia estourou com a
          // resposta automática mandando junto): para SEM andar o cursor, para
          // a próxima rodada retomar exatamente daqui.
          if (r.bloqueio) { saida.bloqueio = r.bloqueio; break; }
          enviados += r.enviados.length;
          falhas += r.falhas.length;
          enviadosRodada += r.enviados.length;
          falhasRodada += r.falhas.length;
          jaHoje += r.enviados.length;
          pulados += (r.pulados?.frios ?? 0) + (r.pulados?.pediramSaida ?? 0) + (r.pulados?.semTelefone ?? 0);
          // O cursor anda pelo lote inteiro, inclusive quem falhou ou foi
          // pulado: quem não recebeu por número errado não recebe na próxima
          // rodada também, e repetir mandaria de novo para quem já recebeu.
          cursor += lote.length;
          if (cursor < total && r.enviados.length) {
            await new Promise((ok) => setTimeout(ok, pausaHumanaMs(lim)));
          }
        }
      } catch (e) {
        erroFatal = e instanceof Error ? e.message : String(e);
      }

      const f = fecharRodada(cursor, total, enviados, erroFatal);

      await db.envioProgramado.update({
        where: { id: envio.id },
        data: {
          status: f.status,
          enviadosAte: cursor,
          // processadoEm marca a última rodada: é dela que a trava presa mede.
          processadoEm: new Date(),
          enviados, falhas, erro: f.erro,
        },
      }).catch((e) => console.error("[envio-programado] fechar:", e));

      // Auditoria só quando o envio TERMINA. Uma linha por onda encheria o
      // histórico de "saiu mais um pedaço" e esconderia o resto.
      if (f.concluido) {
        await registrarAudit({
          acao: "mensagem_enviada", origem: "sistema",
          descricao: `Envio programado concluído: ${enviados} enviada(s), ${falhas} falha(s) de ${total} cliente(s).`,
        }).catch(() => {});
      } else {
        saida.continuam += 1;
      }

      saida.processados += 1;
      saida.enviados += enviadosRodada;
      saida.falhas += falhasRodada;
      saida.pulados += pulados;
    }
  } catch (e) {
    console.error("[envio-programado] despacho:", e);
  }
  return saida;
}
