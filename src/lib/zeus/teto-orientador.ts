// TETO DIÁRIO DA ANÁLISE FEITA A CADA MENSAGEM (Orientador).
//
// A análise automática roda a cada mensagem que chega — e não tinha limite.
// No gratuito, isso esgota a cota do dia (e leva junto tudo o que usa IA no
// CRM); no pago, vira fatura sem teto. Agora cada análise reserva uma vaga do
// dia; acabou, a conversa fica agendada e é lida no dia seguinte, e o ZEUS
// avisa. O botão "Reanalisar" (pedido do vendedor) não passa por aqui.
//
// A vaga é reservada de forma atômica no banco (um UPDATE condicional), para
// duas mensagens chegando juntas não passarem as duas do limite.
//
// Na dúvida, não gasta: valor estranho na variável vira o padrão, nunca
// "sem limite"; banco que não responde à contagem nega a vaga.

import { db } from "@/lib/db";

export const TETO_PADRAO = 250;
export const PREFIXO_CONTADOR = "orientador.analises."; // + AAAA-MM-DD (Brasília)

export function tetoDiario(valor: string | undefined = process.env.ORIENTADOR_TETO_DIARIO): number {
  const n = Number(valor);
  return valor && Number.isFinite(n) && n >= 1 ? Math.floor(n) : TETO_PADRAO;
}

export function chaveDoDia(agora: Date = new Date()): string {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return PREFIXO_CONTADOR + dia;
}

/** Reserva uma análise do dia. ok=false: o teto de hoje já foi. */
export async function reservarAnaliseOrientador(agora: Date = new Date()): Promise<{ ok: boolean; teto: number }> {
  const teto = tetoDiario();
  try {
    const r = await db.$queryRawUnsafe<{ valor: string }[]>(
      `INSERT INTO "Configuracao" (chave, valor) VALUES ($1, '1')
       ON CONFLICT (chave) DO UPDATE SET valor = (CAST("Configuracao".valor AS INTEGER) + 1)::text
         WHERE CAST("Configuracao".valor AS INTEGER) < $2
       RETURNING valor`,
      chaveDoDia(agora), teto,
    );
    return { ok: r.length > 0, teto };
  } catch {
    return { ok: false, teto };
  }
}

/** Quantas análises já foram hoje — para a tela mostrar. */
export async function analisesDeHoje(agora: Date = new Date()): Promise<{ usadas: number; teto: number }> {
  const c = await db.configuracao.findUnique({ where: { chave: chaveDoDia(agora) } }).catch(() => null);
  return { usadas: Number(c?.valor ?? 0) || 0, teto: tetoDiario() };
}
