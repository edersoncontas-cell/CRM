// Colunas de "demandas" (estilo Trello), separadas do funil de negociação.
// Garante as duas colunas fixas e oferece helpers de cor para colunas novas.

import { db } from "@/lib/db";

export type ItemChecklist = { t: string; d: boolean };

// Paleta de cores para colunas personalizadas (borda superior Tailwind).
export const CORES_COLUNA = [
  "border-t-slate-400",
  "border-t-sky-400",
  "border-t-violet-400",
  "border-t-amber-400",
  "border-t-rose-400",
  "border-t-teal-400",
  "border-t-indigo-400",
  "border-t-orange-400",
];

const COLUNA_DEMANDAS = "demandas";
const COLUNA_CONCLUIDA = "demandas_concluida";

let colunasGarantidas = false;

// Cria as colunas fixas "Demandas" e "Demandas Concluída" se ainda não existirem.
// Idempotente — usa upsert por id fixo para não duplicar.
export async function garantirColunasDemanda(): Promise<void> {
  if (colunasGarantidas) return;
  await db.colunaDemanda.upsert({
    where: { id: COLUNA_DEMANDAS },
    update: {},
    create: { id: COLUNA_DEMANDAS, titulo: "Demandas", cor: "border-t-slate-400", ordem: 0, fixa: true },
  });
  await db.colunaDemanda.upsert({
    where: { id: COLUNA_CONCLUIDA },
    update: {},
    create: { id: COLUNA_CONCLUIDA, titulo: "Demandas Concluída", cor: "border-t-green-500", ordem: 1, fixa: true },
  });
  colunasGarantidas = true;
}

// Lê o checklist serializado em JSON de uma tarefa, com fallback seguro.
export function lerChecklist(raw: string | null | undefined): ItemChecklist[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((i) => i && typeof i.t === "string")
      .map((i) => ({ t: String(i.t), d: !!i.d }));
  } catch {
    return [];
  }
}
