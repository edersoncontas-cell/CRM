"use server";

// Server actions da Trilha de Formação da Academia: progresso (aulas
// concluídas, notas dos quizzes e das provas finais, revisão espaçada,
// certificação — em Configuracao) e treino com IA.

import { revalidatePath } from "next/cache";
import { getConfig, setConfig } from "@/lib/config";
import { gerarCenarioTreinoIA, avaliarRespostaTreinoIA, type CenarioTreino, type AvaliacaoTreino, type RodadaTreino } from "@/lib/ai/treino";
import { TRILHA, atualizarRevisao, type EstadoRevisao } from "@/lib/academia-trilha";

const CHAVE = "academia.progresso";

export type ProgressoAcademia = {
  concluidas: string[];
  notas: Record<string, number>;  // aulaId -> acertos no quiz (0-100)
  provas: Record<string, number>; // moduloId -> melhor nota na prova final (0-100)
  treinos: number;                // cenários avaliados
  melhorNota: number;             // melhor nota de treino (0-10)
  revisao: EstadoRevisao;         // perguntaId -> histórico da revisão espaçada
  revisoesFeitas: number;         // sessões de revisão concluídas
  certificacao: number | null;    // melhor nota na certificação final (0-100)
  atualizadoEm: string | null;
};

const VAZIO: ProgressoAcademia = { concluidas: [], notas: {}, provas: {}, treinos: 0, melhorNota: 0, revisao: {}, revisoesFeitas: 0, certificacao: null, atualizadoEm: null };

function mapaNumerico(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function estadoRevisao(v: unknown): EstadoRevisao {
  if (!v || typeof v !== "object") return {};
  const out: EstadoRevisao = {};
  for (const [k, e] of Object.entries(v as Record<string, unknown>)) {
    const r = e as Record<string, unknown>;
    if (!r || typeof r !== "object" || typeof r.proxima !== "string") continue;
    out[k] = { acertos: Number(r.acertos) || 0, erros: Number(r.erros) || 0, sequencia: Number(r.sequencia) || 0, proxima: r.proxima };
  }
  return out;
}

export async function lerProgressoAcademia(): Promise<ProgressoAcademia> {
  try {
    const raw = await getConfig(CHAVE);
    if (!raw) return VAZIO;
    const p = JSON.parse(raw) as Partial<ProgressoAcademia>;
    return {
      concluidas: Array.isArray(p.concluidas) ? p.concluidas.filter((x) => typeof x === "string") : [],
      notas: mapaNumerico(p.notas),
      provas: mapaNumerico(p.provas),
      treinos: Number(p.treinos) || 0,
      melhorNota: Number(p.melhorNota) || 0,
      revisao: estadoRevisao(p.revisao),
      revisoesFeitas: Number(p.revisoesFeitas) || 0,
      certificacao: typeof p.certificacao === "number" ? p.certificacao : null,
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

// Registra a nota da prova final do módulo (guarda a melhor).
export async function registrarProvaAcademia(moduloId: string, nota: number): Promise<ProgressoAcademia> {
  const p = await lerProgressoAcademia();
  if (!TRILHA.some((m) => m.id === moduloId)) return p;
  const n = Math.max(0, Math.min(100, Math.round(nota)));
  p.provas[moduloId] = Math.max(p.provas[moduloId] ?? 0, n);
  await gravar(p);
  return p;
}

// Sessão de revisão espaçada: cada pergunta respondida atualiza o próprio
// intervalo (acertou → mais longe; errou → amanhã).
export async function registrarRevisaoAcademia(resultados: { id: string; acertou: boolean }[]): Promise<ProgressoAcademia> {
  const p = await lerProgressoAcademia();
  const hoje = new Date();
  for (const r of resultados) {
    if (typeof r.id !== "string" || !r.id.includes("#")) continue;
    p.revisao = atualizarRevisao(p.revisao, r.id, r.acertou === true, hoje);
  }
  if (resultados.length) p.revisoesFeitas += 1;
  await gravar(p);
  return p;
}

export async function registrarCertificacaoAcademia(nota: number): Promise<ProgressoAcademia> {
  const p = await lerProgressoAcademia();
  const n = Math.max(0, Math.min(100, Math.round(nota)));
  p.certificacao = Math.max(p.certificacao ?? 0, n);
  await gravar(p);
  return p;
}

export async function gerarCenarioTreinoAction(moduloId: string, dificuldade: 1 | 2 | 3 = 2): Promise<{ ok: boolean; cenario?: CenarioTreino; erro?: string }> {
  const m = TRILHA.find((x) => x.id === moduloId);
  if (!m) return { ok: false, erro: "Módulo não encontrado." };
  const cenario = await gerarCenarioTreinoIA({ tema: m.titulo, nivel: m.nivel, foco: m.descricao, objetivos: m.objetivos, dificuldade });
  if (!cenario) return { ok: false, erro: "IA indisponível no momento — confira as chaves de IA em Configurações." };
  return { ok: true, cenario };
}

// Avalia uma rodada. Na 1ª rodada a IA devolve a réplica do cliente (a
// conversa continua); na 2ª, a nota final. Só a nota final conta no progresso.
export async function avaliarTreinoAction(moduloId: string, cenario: CenarioTreino, rodadas: RodadaTreino[], resposta: string): Promise<{ ok: boolean; avaliacao?: AvaliacaoTreino; erro?: string }> {
  const m = TRILHA.find((x) => x.id === moduloId);
  if (!m) return { ok: false, erro: "Módulo não encontrado." };
  if (!resposta.trim()) return { ok: false, erro: "Escreva a sua resposta ao cliente." };
  const avaliacao = await avaliarRespostaTreinoIA({ tema: m.titulo, objetivos: m.objetivos, cenario, rodadas, resposta: resposta.trim() });
  if (!avaliacao) return { ok: false, erro: "IA indisponível no momento — confira as chaves de IA em Configurações." };
  if (avaliacao.final) {
    const p = await lerProgressoAcademia();
    p.treinos += 1;
    p.melhorNota = Math.max(p.melhorNota, avaliacao.nota);
    await gravar(p);
  }
  return { ok: true, avaliacao };
}
