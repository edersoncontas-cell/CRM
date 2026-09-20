// Registro de eventos do ZEUS (ZeusEvent) — feed do painel /zeus.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type TipoZeusEvent = "health" | "fix" | "alerta" | "acao" | "erro";
export type SeveridadeZeusEvent = "baixa" | "media" | "alta" | "critica";

// UM evento aberto por tipo+título (nunca um por ocorrência): o mesmo erro
// repetindo (ex.: rate limit de um provedor de IA) soma em "ocorrencias" em
// vez de criar uma linha nova a cada vez. O índice único parcial
// ZeusEvent(tipo,titulo) WHERE resolvido=false (ver migrations.ts) é quem
// garante isso de verdade contra chamadas concorrentes — ver mesmo padrão em
// atualizarAlertaOrientador (lib/zeus/orientador.ts).
export async function registrarZeusEvent(opts: {
  tipo: TipoZeusEvent;
  titulo: string;
  severidade?: SeveridadeZeusEvent;
  detalhe?: Record<string, unknown> | string;
}): Promise<void> {
  const severidade = opts.severidade ?? "media";
  const detalhe = typeof opts.detalhe === "string" ? opts.detalhe : opts.detalhe ? JSON.stringify(opts.detalhe) : null;
  try {
    const existente = await db.zeusEvent.findFirst({ where: { tipo: opts.tipo, titulo: opts.titulo, resolvido: false } });
    if (existente) {
      await db.zeusEvent.update({
        where: { id: existente.id },
        data: { ocorrencias: { increment: 1 }, criadoEm: new Date(), severidade, detalhe },
      });
      return;
    }
    try {
      await db.zeusEvent.create({ data: { tipo: opts.tipo, titulo: opts.titulo, severidade, detalhe } });
      // PRIMEIRA vez desta falha: abre o chamado de autoconserto. Só aqui, e
      // nunca no ramo de incremento acima — o mesmo erro pipocando mil vezes é
      // UMA falha, e abrir mil chamados seria pior do que não abrir nenhum.
      if (opts.tipo === "erro") await dispararAutofix(opts.titulo, severidade, opts.detalhe);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        await db.zeusEvent.updateMany({
          where: { tipo: opts.tipo, titulo: opts.titulo, resolvido: false },
          data: { ocorrencias: { increment: 1 }, criadoEm: new Date(), severidade, detalhe },
        });
      } else {
        throw e;
      }
    }
  } catch {
    // um evento nunca pode derrubar o fluxo principal
  }
}

// Captura de erros de runtime (item 5 da Fase 4): usado nos catches de rotas
// críticas e no global-error.tsx. Nunca lança — reportar um erro não pode
// gerar outro erro.
export async function zeusReport(err: unknown, contexto: string): Promise<void> {
  const mensagem = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack?.slice(0, 2000) : undefined;
  await registrarZeusEvent({
    tipo: "erro",
    severidade: "alta",
    titulo: `Erro em ${contexto}: ${mensagem.slice(0, 150)}`,
    detalhe: { contexto, mensagem, stack },
  });
}

/**
 * Chama o autoconserto sem segurar o fluxo que estourou o erro.
 *
 * Deliberadamente sem await no chamador: abrir issue no GitHub é rede, e o
 * caminho que chega aqui costuma ser um webhook de WhatsApp. Ninguém pode
 * perder uma mensagem de cliente porque o GitHub demorou a responder.
 */
async function dispararAutofix(titulo: string, severidade: string, detalhe: unknown): Promise<void> {
  try {
    const { autofixHabilitado, abrirChamadoDeFalha } = await import("@/lib/zeus/autofix");
    if (!autofixHabilitado()) return;
    const d = (typeof detalhe === "object" && detalhe ? detalhe : {}) as Record<string, unknown>;
    const texto = (v: unknown) => (typeof v === "string" ? v : null);
    void abrirChamadoDeFalha({
      titulo, severidade,
      contexto: texto(d.contexto),
      mensagem: texto(d.mensagem),
      stack: texto(d.stack),
      ocorrencias: 1,
    }).then((r) => { if (!r.aberto && r.motivo) console.warn("[autofix] não abriu:", r.motivo); });
  } catch (e) {
    console.error("[autofix] disparo:", e);
  }
}
