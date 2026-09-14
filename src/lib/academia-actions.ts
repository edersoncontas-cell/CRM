"use server";

// Server actions da Trilha de Formação da Academia: progresso (aulas
// concluídas e notas dos quizzes, em Configuracao) e treino com IA.

import { revalidatePath } from "next/cache";
import { getConfig, setConfig } from "@/lib/config";
import { gerarCenarioTreinoIA, avaliarRespostaTreinoIA, type CenarioTreino, type AvaliacaoTreino } from "@/lib/ai/treino";
import { TRILHA } from "@/lib/academia-trilha";

const CHAVE = "academia.progresso";

export type ProgressoAcademia = {
  concluidas: string[];
  notas: Record<string, number>; // aulaId -> acertos no quiz (0-100)
  treinos: number;               // cenários avaliados
  melhorNota: number;            // melhor nota de treino (0-10)
  atualizadoEm: string | null;
};

const VAZIO: ProgressoAcademia = { concluidas: [], notas: {}, treinos: 0, melhorNota: 0, atualizadoEm: null };

export async function lerProgressoAcademia(): Promise<ProgressoAcademia> {
  try {
    const raw = await getConfig(CHAVE);
    if (!raw) return VAZIO;
    const p = JSON.parse(raw) as Partial<ProgressoAcademia>;
    return {
      concluidas: Array.isArray(p.concluidas) ? p.concluidas.filter((x) => typeof x === "string") : [],
      notas: p.notas && typeof p.notas === "object" ? p.notas : {},
      treinos: Number(p.treinos) || 0,
      melhorNota: Number(p.melhorNota) || 0,
      atualizadoEm: p.atualizadoEm ?? null,
    };
  } catch {
    return VAZIO;
  }
}

async function gravar(p: ProgressoAcademia): Promise<void> {
  await setConfig(CHAVE, JSON.stringify({ ...p, atualizadoEm: new Date().toISOString() }));
  revalidatePath("/academia");
}

export async function concluirAulaAcademia(aulaId: string, notaQuiz?: number): Promise<ProgressoAcademia> {
  const p = await lerProgressoAcademia();
  if (!p.concluidas.includes(aulaId)) p.concluidas.push(aulaId);
  if (typeof notaQuiz === "number") p.notas[aulaId] = Math.max(0, Math.min(100, Math.round(notaQuiz)));
  await gravar(p);
  return p;
}

export async function reabrirAulaAcademia(aulaId: string): Promise<ProgressoAcademia> {
  const p = await lerProgressoAcademia();
  p.concluidas = p.concluidas.filter((id) => id !== aulaId);
  await gravar(p);
  return p;
}

export async function gerarCenarioTreinoAction(moduloId: string): Promise<{ ok: boolean; cenario?: CenarioTreino; erro?: string }> {
  const m = TRILHA.find((x) => x.id === moduloId);
  if (!m) return { ok: false, erro: "Módulo não encontrado." };
  const cenario = await gerarCenarioTreinoIA(m.titulo, m.nivel, m.descricao);
  if (!cenario) return { ok: false, erro: "IA indisponível no momento — confira as chaves de IA em Configurações." };
  return { ok: true, cenario };
}

export async function avaliarTreinoAction(moduloId: string, cenario: CenarioTreino, resposta: string): Promise<{ ok: boolean; avaliacao?: AvaliacaoTreino; erro?: string }> {
  const m = TRILHA.find((x) => x.id === moduloId);
  if (!m) return { ok: false, erro: "Módulo não encontrado." };
  if (!resposta.trim()) return { ok: false, erro: "Escreva a sua resposta ao cliente." };
  const avaliacao = await avaliarRespostaTreinoIA({ tema: m.titulo, cenario, resposta: resposta.trim() });
  if (!avaliacao) return { ok: false, erro: "IA indisponível no momento — confira as chaves de IA em Configurações." };
  const p = await lerProgressoAcademia();
  p.treinos += 1;
  p.melhorNota = Math.max(p.melhorNota, avaliacao.nota);
  await gravar(p);
  return { ok: true, avaliacao };
}
