import { db } from "@/lib/db";
import { enviarMensagemClientesAction } from "@/lib/mensagem-clientes-actions";
import { registrarAudit } from "@/lib/audit";

// O DESPACHANTE das mensagens programadas.
//
// Fica separado da rota do cron e das server actions de propósito: a rota é só
// a porta, e "use server" não pode exportar nada que não seja função async —
// aqui dá para ter constantes e tipos.
//
// Duas decisões de segurança que valem o comentário:
//
//   1. O envio é marcado como "enviando" ANTES de começar. Se o cron for
//      chamado duas vezes (o agendador externo repetir, ou uma execução
//      demorar mais que o intervalo), a segunda não acha mais o registro como
//      pendente e não manda a mesma mensagem duas vezes para o cliente.
//   2. Um envio por rodada, e em lotes pequenos com pausa. A função da Vercel
//      tem 60s; estourar no meio deixaria metade da lista avisada e a outra
//      metade não, sem registro de onde parou.

const TAMANHO_LOTE = 5;
const PAUSA_ENTRE_LOTES_MS = 700;
const PRAZO_MS = 45_000;

export type ResultadoDespacho = {
  processados: number;
  enviados: number;
  falhas: number;
  pendentes: number;
};

export async function despacharEnviosProgramados(agora: Date = new Date()): Promise<ResultadoDespacho> {
  const saida: ResultadoDespacho = { processados: 0, enviados: 0, falhas: 0, pendentes: 0 };
  try {
    const devidos = await db.envioProgramado.findMany({
      where: { status: "pendente", quando: { lte: agora } },
      orderBy: { quando: "asc" },
      take: 5,
    });
    saida.pendentes = devidos.length;
    if (!devidos.length) return saida;

    const limite = Date.now() + PRAZO_MS;
    for (const envio of devidos) {
      if (Date.now() > limite) break;

      // Trava otimista: só quem conseguir virar "enviando" manda. O count === 0
      // significa que outra execução já pegou este envio.
      const travou = await db.envioProgramado.updateMany({
        where: { id: envio.id, status: "pendente" },
        data: { status: "enviando" },
      });
      if (!travou.count) continue;

      let enviados = 0;
      let falhas = 0;
      let erro: string | null = null;
      try {
        for (let i = 0; i < envio.clienteIds.length; i += TAMANHO_LOTE) {
          if (Date.now() > limite) {
            erro = `Tempo esgotado no cliente ${i} de ${envio.clienteIds.length}. O restante não foi enviado.`;
            break;
          }
          const lote = envio.clienteIds.slice(i, i + TAMANHO_LOTE);
          const r = await enviarMensagemClientesAction(lote, envio.texto, envio.midiaId);
          enviados += r.enviados.length;
          falhas += r.falhas.length;
          if (i + TAMANHO_LOTE < envio.clienteIds.length) {
            await new Promise((ok) => setTimeout(ok, PAUSA_ENTRE_LOTES_MS));
          }
        }
      } catch (e) {
        erro = e instanceof Error ? e.message : String(e);
      }

      await db.envioProgramado.update({
        where: { id: envio.id },
        data: {
          // "enviado" mesmo com falhas: a rodada aconteceu. Quem falhou está
          // contado, e repetir tudo mandaria de novo para quem já recebeu.
          status: erro && enviados === 0 ? "erro" : "enviado",
          processadoEm: new Date(),
          enviados, falhas, erro,
        },
      }).catch((e) => console.error("[envio-programado] fechar:", e));

      await registrarAudit({
        acao: "mensagem_enviada", origem: "sistema",
        descricao: `Envio programado disparado: ${enviados} enviada(s), ${falhas} falha(s) de ${envio.clienteIds.length} cliente(s).`,
      }).catch(() => {});

      saida.processados += 1;
      saida.enviados += enviados;
      saida.falhas += falhas;
    }
  } catch (e) {
    console.error("[envio-programado] despacho:", e);
  }
  return saida;
}
