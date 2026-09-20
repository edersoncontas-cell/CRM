// Eventos da agenda: compromissos que não são visita a cliente (feira,
// convenção, treinamento, viagem). Podem durar vários dias e acontecer fora
// do Espírito Santo, por isso guardam UF própria.

import { db } from "@/lib/db";

export type EventoAgenda = {
  id: string;
  titulo: string;
  inicioIso: string;
  fimIso: string;
  diaInteiro: boolean;
  horaInicio: string | null;
  horaFim: string | null;
  uf: string | null;
  cidade: string | null;
  observacao: string | null;
};

const BR = "America/Sao_Paulo";

export function diaIso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BR, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function hora(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { timeZone: BR, hour: "2-digit", minute: "2-digit" });
}

/**
 * O dia do mês (1–31) em que a data cai NO FUSO DE BRASÍLIA.
 *
 * Existe porque `date.getDate()` devolve o dia no fuso do SERVIDOR, e o
 * servidor da Vercel roda em UTC. Um evento que termina em 25/09 às 23:59 de
 * Brasília é 26/09 às 02:59 em UTC — então `getDate()` responde 26.
 *
 * Foi exatamente esse o defeito reportado: a feira de 22 a 25 aparecia no
 * calendário certinha (ele já usava o fuso certo) e no Dashboard ia até
 * sábado 26. Mesma agenda, dois resultados, porque havia duas contas
 * diferentes para "que dia é este". Agora só existe esta.
 *
 * Vale para visita também, não só para evento: uma visita marcada às 21h cai
 * no dia seguinte em UTC e apareceria no dia errado pelo mesmo motivo.
 */
export function diaDoMesBrasilia(d: Date): number {
  return Number(diaIso(d).slice(8, 10));
}

/** O mês (1–12) em que a data cai no fuso de Brasília. */
export function mesBrasilia(d: Date): number {
  return Number(diaIso(d).slice(5, 7));
}

// Todos os dias que o evento ocupa, de início a fim (inclusive) — é isso que
// pinta a faixa no calendário.
export function diasDoEvento(inicioIso: string, fimIso: string): string[] {
  const dias: string[] = [];
  const fim = new Date(`${fimIso}T12:00:00-03:00`);
  for (let d = new Date(`${inicioIso}T12:00:00-03:00`); d <= fim; d.setDate(d.getDate() + 1)) {
    dias.push(diaIso(d));
    if (dias.length > 366) break;
  }
  return dias;
}

export async function listarEventos(deIso: string, ateIso: string): Promise<EventoAgenda[]> {
  const de = new Date(`${deIso}T00:00:00-03:00`);
  const ate = new Date(`${ateIso}T23:59:59-03:00`);
  // Pega o que encosta na janela: começa antes e termina dentro, ou vice-versa.
  const linhas = await db.evento.findMany({
    where: { inicio: { lte: ate }, fim: { gte: de } },
    orderBy: { inicio: "asc" },
  });
  return linhas.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    inicioIso: diaIso(e.inicio),
    fimIso: diaIso(e.fim),
    diaInteiro: e.diaInteiro,
    horaInicio: e.diaInteiro ? null : hora(e.inicio),
    horaFim: e.diaInteiro ? null : hora(e.fim),
    uf: e.uf,
    cidade: e.cidade,
    observacao: e.observacao,
  }));
}
