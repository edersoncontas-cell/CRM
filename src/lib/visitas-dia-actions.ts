"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limitesDoDia } from "@/lib/visitas-do-dia";
import { colunaDestinoDoRelato, pareceOrdemDeMover } from "@/lib/relato-comandos";
import { papelDaColuna } from "@/lib/pipeline";
import { analisarConversaIA } from "@/lib/ai";
import { alimentarNegociacao, registrarVisitaAgenda } from "@/lib/zeus/pipeline";
import { registrarAudit } from "@/lib/audit";

// O QUE ACONTECE QUANDO O VENDEDOR RESPONDE O LEMBRETE DAS VISITAS DO DIA.
//
// A regra de quando o lembrete aparece e de quem é a vez mora em
// lib/visitas-do-dia.ts, que é puro e testado. Aqui fica o que toca o banco.
//
// O caminho de "visita feita" reaproveita o motor que já existia no Modo Campo
// por voz (analisarConversaIA → alimentarNegociacao → registrarVisitaAgenda):
// era um bom motor no lugar errado, dentro da ficha do cliente, onde o vendedor
// não passa quando está na rua. Agora ele roda onde a visita de fato termina.

const PAGINAS = ["/visitas", "/dashboard", "/alertas", "/negociacoes", "/pipeline"];

function revalidarTudo(clienteId?: string | null) {
  for (const p of PAGINAS) revalidatePath(p);
  if (clienteId) revalidatePath(`/clientes/${clienteId}`);
}

export type VisitaDoDiaSerial = {
  id: string;
  clienteId: string;
  clienteNome: string;
  /** ISO — o componente reconstrói o Date. */
  data: string;
  status: string;
  cidade: string | null;
  observacao: string | null;
};

/**
 * As visitas de HOJE, para o lembrete decidir o que mostrar.
 *
 * Devolve TODAS (inclusive as já sinalizadas), porque a regra precisa saber
 * quantas eram no total e qual foi a primeira do dia — não só as que faltam.
 */
export async function visitasDeHojeAction(): Promise<VisitaDoDiaSerial[]> {
  try {
    const { inicio, fim } = limitesDoDia();
    const visitas = await db.visita.findMany({
      where: { data: { gte: inicio, lte: fim } },
      orderBy: { data: "asc" },
      select: {
        id: true, data: true, status: true, cidade: true, observacao: true,
        clienteId: true, cliente: { select: { nome: true } },
      },
    });
    return visitas.map((v) => ({
      id: v.id,
      clienteId: v.clienteId,
      clienteNome: v.cliente.nome,
      data: v.data.toISOString(),
      status: v.status,
      cidade: v.cidade,
      observacao: v.observacao,
    }));
  } catch (e) {
    console.error("[visitas-do-dia] não deu para ler as visitas de hoje:", e);
    return [];
  }
}

/**
 * "Visita feita?" — sim ou não, com o relato do vendedor.
 *
 * O relato NÃO é só texto guardado: é lido pela IA e vira ação, como o pedido
 * descreve ("o campo de preenchimento precisa ter este papel de atualizar e
 * comando para criar"). Uma coisa de cada vez, e cada uma isolada: se a IA
 * falhar, a visita continua registrada — o que não pode acontecer é o vendedor
 * marcar a visita e ela não ficar marcada porque a IA estava fora do ar.
 */
export async function registrarVisitaDoDiaAction(
  visitaId: string,
  feita: boolean,
  relato: string,
): Promise<{ ok: boolean; erro?: string; resumo?: string; negociacao?: string; colunaMovida?: string; proximaVisita?: string }> {
  const texto = (relato ?? "").trim();
  const visita = await db.visita.findUnique({
    where: { id: visitaId },
    select: { id: true, clienteId: true, observacao: true, cliente: { select: { nome: true } } },
  });
  if (!visita) return { ok: false, erro: "Visita não encontrada." };

  // 1) O registro da visita. É o que o vendedor veio fazer — vem primeiro e
  //    não depende de mais nada.
  const observacao = texto
    ? [visita.observacao, `[${feita ? "realizada" : "não realizada"}] ${texto}`].filter(Boolean).join("\n")
    : visita.observacao;
  await db.visita.update({
    where: { id: visitaId },
    data: {
      status: feita ? "realizada" : "nao_realizada",
      realizadaEm: feita ? new Date() : null,
      observacao,
    },
  });
  if (feita) {
    await db.cliente.update({
      where: { id: visita.clienteId },
      data: { visitado: true, ultimoContato: new Date() },
    }).catch(() => {});
  }

  const saida: { resumo?: string; negociacao?: string; colunaMovida?: string; proximaVisita?: string } = {};

  // 2) O relato vira comando. Só quando há relato — visita marcada sem texto
  //    não precisa de IA nenhuma, e chamar à toa gastaria cota.
  if (texto) {
    // 2a) Mover de coluna no funil: regra escrita, não IA. Mover card é ação
    //     com consequência visível, e tem de acontecer quando ele mandou e NÃO
    //     acontecer quando ele só narrou. Ver lib/relato-comandos.ts.
    try {
      const colunas = await db.colunaFunil.findMany({ orderBy: { ordem: "asc" }, select: { titulo: true, papel: true } });
      const destino = colunaDestinoDoRelato(texto, colunas.map((c) => c.titulo));
      if (destino) {
        const aberta = await db.negociacao.findFirst({
          where: { clienteId: visita.clienteId, status: "aberta" },
          orderBy: { atualizadoEm: "desc" },
          select: { id: true },
        });
        if (aberta) {
          await db.negociacao.update({ where: { id: aberta.id }, data: { estagio: destino, atualizadoEm: new Date() } });
          saida.colunaMovida = destino;
        }
      } else if (pareceOrdemDeMover(texto)) {
        // Ele mandou mover para uma coluna que não existe. Calar seria pior:
        // ele acharia que moveu.
        saida.colunaMovida = `__nao_achei__:${colunas.filter((c) => papelDaColuna(c) !== "perdida").map((c) => c.titulo).join(", ")}`;
      }
    } catch (e) {
      console.error("[visitas-do-dia] mover de coluna:", e);
    }

    // 2b) A leitura da IA: resumo, máquina, valor, pagamento, próxima visita.
    try {
      const extracao = await analisarConversaIA(texto);
      saida.resumo = extracao.resumo || undefined;

      const neg = await alimentarNegociacao(visita.clienteId, extracao).catch((e) => {
        console.error("[visitas-do-dia] alimentar negociação:", e);
        return null;
      });
      if (neg) saida.negociacao = neg.criada ? "criada" : "atualizada";

      // "seja para agendar outra visita": data futura citada no relato vira
      // visita nova na agenda.
      if (extracao.dataVisita && extracao.dataVisita.getTime() > Date.now()) {
        await registrarVisitaAgenda(visita.clienteId, extracao.dataVisita).catch((e) => {
          console.error("[visitas-do-dia] agendar próxima visita:", e);
        });
        saida.proximaVisita = extracao.dataVisita.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
      }

      // O resumo do cliente ganha a linha desta visita.
      const linha = `[${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}] (visita ${feita ? "realizada" : "não realizada"}) ${extracao.resumo || texto}`;
      const cliente = await db.cliente.findUnique({ where: { id: visita.clienteId }, select: { resumoTexto: true } });
      await db.cliente.update({
        where: { id: visita.clienteId },
        data: { resumoTexto: [cliente?.resumoTexto, linha].filter(Boolean).join("\n").split("\n").slice(-12).join("\n") },
      }).catch(() => {});
    } catch (e) {
      // A IA fora do ar não pode desfazer o registro da visita, que já
      // aconteceu lá em cima. O relato fica na observação de qualquer jeito.
      console.error("[visitas-do-dia] leitura do relato pela IA:", e);
    }
  }

  await registrarAudit({
    acao: "visita_detectada", origem: "usuario",
    descricao: `Visita de ${visita.cliente.nome} marcada como ${feita ? "realizada" : "não realizada"} pelo lembrete do dia.`,
    entidade: "Visita", entidadeId: visitaId, clienteId: visita.clienteId,
  }).catch(() => {});

  revalidarTudo(visita.clienteId);
  return { ok: true, ...saida };
}
