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
