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
