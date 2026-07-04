// Registro de eventos do ZEUS (ZeusEvent) — feed do painel /zeus.

import { db } from "@/lib/db";

export type TipoZeusEvent = "health" | "fix" | "alerta" | "acao" | "erro";
export type SeveridadeZeusEvent = "baixa" | "media" | "alta" | "critica";

export async function registrarZeusEvent(opts: {
  tipo: TipoZeusEvent;
  titulo: string;
  severidade?: SeveridadeZeusEvent;
  detalhe?: Record<string, unknown> | string;
}): Promise<void> {
  try {
    await db.zeusEvent.create({
      data: {
        tipo: opts.tipo,
        titulo: opts.titulo,
        severidade: opts.severidade ?? "media",
        detalhe: typeof opts.detalhe === "string" ? opts.detalhe : opts.detalhe ? JSON.stringify(opts.detalhe) : null,
      },
    });
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
