// Trilha de Formação da Academia de Vendas — currículo por níveis escrito
// para o nicho: venda consultiva de máquinas pesadas New Holland Construction
// (retroescavadeiras, escavadeiras, pás-carregadeiras, motoniveladoras) e
// rolos Dynapac, no sul do Espírito Santo (construtoras, empreiteiras,
// prefeituras, pedreiras/mineração, produtores de café, locadoras).
//
// 10 módulos (níveis) × 6 aulas = 60 aulas. Cada aula: blocos de conteúdo
// (frameworks nomeados, contas feitas, diálogos anotados, casos, tabelas,
// checklists, erros, exercícios), uma missão prática no CRM e um quiz de 5
// perguntas de cenário. Cada módulo tem objetivos, prova final e leituras.
// Por cima: revisão espaçada das perguntas já vistas e a certificação final.
// O conteúdo fica em src/lib/trilha/m*.ts; o progresso em Configuracao
// (academia-actions.ts). Tudo aqui é puro (sem banco) e testável.

import { M1 } from "./trilha/m1";
import { M2 } from "./trilha/m2";
import { M3 } from "./trilha/m3";
import { M4 } from "./trilha/m4";
import { M5 } from "./trilha/m5";
import { M6 } from "./trilha/m6";
import { M7 } from "./trilha/m7";
import { M8 } from "./trilha/m8";
import { M9 } from "./trilha/m9";
import { M10 } from "./trilha/m10";
import type { Modulo, Aula, Pergunta } from "./trilha/tipos";

export type { Bloco, Pergunta, Aula, Modulo } from "./trilha/tipos";

export const TRILHA: Modulo[] = [M1, M2, M3, M4, M5, M6, M7, M8, M9, M10];

export const TODAS_AULAS: { modulo: Modulo; aula: Aula }[] = TRILHA.flatMap((m) => m.aulas.map((a) => ({ modulo: m, aula: a })));

export const TOTAL_MINUTOS = TODAS_AULAS.reduce((s, { aula }) => s + aula.minutos, 0);

// Nota mínima (0-100) para aprovação na prova final de um módulo.
export const NOTA_MINIMA_PROVA = 70;
// Nota mínima da certificação final (mais dura: é o diploma da trilha).
export const NOTA_MINIMA_CERTIFICACAO = 80;

export function proximaAula(concluidas: Set<string>): { modulo: Modulo; aula: Aula } | null {
  return TODAS_AULAS.find(({ aula }) => !concluidas.has(aula.id)) ?? null;
}

export function progressoModulo(m: Modulo, concluidas: Set<string>): number {
  if (!m.aulas.length) return 0;
  return Math.round((m.aulas.filter((a) => concluidas.has(a.id)).length / m.aulas.length) * 100);
}

export function moduloCertificado(m: Modulo, concluidas: Set<string>, provas: Record<string, number>): boolean {
  return progressoModulo(m, concluidas) === 100 && (provas[m.id] ?? 0) >= NOTA_MINIMA_PROVA;
}

// Nível do vendedor = maior nível com todas as aulas concluídas (+ 1 se estiver
// avançando). Vai de 1 a 10.
export function nivelDoVendedor(concluidas: Set<string>): { nivel: number; titulo: string } {
  let nivel = 0;
  for (const m of TRILHA) {
    if (m.aulas.every((a) => concluidas.has(a.id))) nivel = m.nivel;
    else break;
  }
  const TITULOS = ["Iniciante", "Aprendiz", "Vendedor", "Consultor", "Consultor Sênior", "Negociador", "Especialista", "Fechador", "Estrategista", "Mestre em Vendas", "Mestre em Vendas"];
  return { nivel: Math.min(10, nivel + 1), titulo: TITULOS[Math.min(10, nivel)] };
}

// ─────────────────────────────────────────────────────────────────────────
// Embaralhar opções: a ordem na tela muda a cada abertura da aula (semente
// diferente), então decorar "é sempre a segunda" não funciona.
// ─────────────────────────────────────────────────────────────────────────
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function embaralharOpcoes(q: Pergunta, semente: number): { opcoes: string[]; correta: number; ordem: number[] } {
  const ordem = q.opcoes.map((_, i) => i);
  let x = (hash(q.pergunta) ^ semente) || 1;
  for (let i = ordem.length - 1; i > 0; i--) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    const j = x % (i + 1);
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  return { opcoes: ordem.map((i) => q.opcoes[i]), correta: ordem.indexOf(q.correta), ordem };
}

// ─────────────────────────────────────────────────────────────────────────
// Revisão espaçada: as perguntas das aulas concluídas voltam em intervalos
// crescentes (1, 3, 7, 14, 30 dias) enquanto o vendedor acerta; errou, volta
// no dia seguinte. É o que transforma leitura em memória de longo prazo.
// ─────────────────────────────────────────────────────────────────────────
export type EstadoRevisao = Record<string, { acertos: number; erros: number; sequencia: number; proxima: string }>;
export const INTERVALOS_REVISAO_DIAS = [1, 3, 7, 14, 30];

export function idPergunta(aulaId: string, indice: number): string {
  return `${aulaId}#${indice}`;
}

export function perguntaPorId(id: string): { aula: Aula; modulo: Modulo; pergunta: Pergunta } | null {
  const [aulaId, idx] = id.split("#");
  const par = TODAS_AULAS.find(({ aula }) => aula.id === aulaId);
  const pergunta = par?.aula.quiz[Number(idx)];
  return par && pergunta ? { aula: par.aula, modulo: par.modulo, pergunta } : null;
}

export function proximaRevisao(sequenciaDeAcertos: number, hoje: Date): string {
  const dias = INTERVALOS_REVISAO_DIAS[Math.min(sequenciaDeAcertos, INTERVALOS_REVISAO_DIAS.length) - 1] ?? 1;
  return new Date(hoje.getTime() + dias * 86_400_000).toISOString();
}

export function atualizarRevisao(estado: EstadoRevisao, id: string, acertou: boolean, hoje: Date): EstadoRevisao {
  const atual = estado[id] ?? { acertos: 0, erros: 0, sequencia: 0, proxima: hoje.toISOString() };
  const sequencia = acertou ? atual.sequencia + 1 : 0;
  return {
    ...estado,
    [id]: {
      acertos: atual.acertos + (acertou ? 1 : 0),
      erros: atual.erros + (acertou ? 0 : 1),
      sequencia,
      proxima: acertou ? proximaRevisao(sequencia, hoje) : new Date(hoje.getTime() + 86_400_000).toISOString(),
    },
  };
}

// Monta a sessão de revisão do dia: primeiro o que venceu (mais erros na
// frente), depois perguntas nunca revisadas, até `n`. Só de aulas concluídas.
export function selecionarRevisao(concluidas: Set<string>, estado: EstadoRevisao, hoje: Date, n = 10): string[] {
  const candidatas: string[] = [];
  for (const { aula } of TODAS_AULAS) {
    if (!concluidas.has(aula.id)) continue;
    aula.quiz.forEach((_, i) => candidatas.push(idPergunta(aula.id, i)));
  }
  const agora = hoje.getTime();
  const vencidas = candidatas.filter((id) => estado[id] && new Date(estado[id].proxima).getTime() <= agora)
    .sort((a, b) => (estado[b].erros - estado[b].acertos) - (estado[a].erros - estado[a].acertos));
  const novas = candidatas.filter((id) => !estado[id]);
  // Novas em ordem espalhada (uma de cada aula por vez), para a sessão não
  // ficar presa numa aula só.
  const porAula = new Map<string, string[]>();
  for (const id of novas) { const k = id.split("#")[0]; porAula.set(k, [...(porAula.get(k) ?? []), id]); }
  const espalhadas: string[] = [];
  let sobrou = true;
  while (sobrou) {
    sobrou = false;
    for (const lista of porAula.values()) { const id = lista.shift(); if (id) { espalhadas.push(id); sobrou = true; } }
  }
  return [...vencidas, ...espalhadas].slice(0, n);
}

export function resumoRevisao(concluidas: Set<string>, estado: EstadoRevisao, hoje: Date): { vencidas: number; novas: number; dominadas: number } {
  let vencidas = 0, novas = 0, dominadas = 0;
  const agora = hoje.getTime();
  for (const { aula } of TODAS_AULAS) {
    if (!concluidas.has(aula.id)) continue;
    aula.quiz.forEach((_, i) => {
      const e = estado[idPergunta(aula.id, i)];
      if (!e) novas++;
      else if (new Date(e.proxima).getTime() <= agora) vencidas++;
      else if (e.sequencia >= 3) dominadas++;
    });
  }
  return { vencidas, novas, dominadas };
}

// ─────────────────────────────────────────────────────────────────────────
// Certificação final: 40 perguntas (4 de cada módulo, tiradas das provas),
// sorteadas por semente — cada tentativa é uma prova diferente. Liberada só
// com os 10 módulos certificados.
// ─────────────────────────────────────────────────────────────────────────
export const PERGUNTAS_CERTIFICACAO = 40;

export function certificacaoLiberada(concluidas: Set<string>, provas: Record<string, number>): boolean {
  return TRILHA.every((m) => moduloCertificado(m, concluidas, provas));
}

export function montarCertificacao(semente: number): { modulo: Modulo; pergunta: Pergunta }[] {
  const porModulo = Math.floor(PERGUNTAS_CERTIFICACAO / TRILHA.length);
  const saida: { modulo: Modulo; pergunta: Pergunta }[] = [];
  let x = (semente >>> 0) || 7;
  const rand = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
  for (const m of TRILHA) {
    const idx = m.prova.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = rand() % (i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for (const i of idx.slice(0, porModulo)) saida.push({ modulo: m, pergunta: m.prova[i] });
  }
  return saida;
}
