// Trilha de Formação da Academia de Vendas — currículo por níveis escrito
// para o nicho: venda consultiva de máquinas pesadas New Holland Construction
// (retroescavadeiras, escavadeiras, pás-carregadeiras, motoniveladoras) e
// rolos Dynapac, no sul do Espírito Santo (construtoras, empreiteiras,
// prefeituras, pedreiras/mineração, produtores de café, locadoras).
//
// 10 módulos (níveis) × 6 aulas = 60 aulas. Cada aula: blocos de conteúdo
// (texto, listas, scripts, casos reais, tabelas, checklists, erros comuns,
// exercícios), uma missão prática no CRM e um quiz. Cada módulo tem
// objetivos, prova final e leituras recomendadas. O conteúdo de cada módulo
// fica em src/lib/trilha/m*.ts; o progresso em Configuracao
// (academia-actions.ts).

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
import type { Modulo, Aula } from "./trilha/tipos";

export type { Bloco, Pergunta, Aula, Modulo } from "./trilha/tipos";

export const TRILHA: Modulo[] = [M1, M2, M3, M4, M5, M6, M7, M8, M9, M10];

export const TODAS_AULAS: { modulo: Modulo; aula: Aula }[] = TRILHA.flatMap((m) => m.aulas.map((a) => ({ modulo: m, aula: a })));

export const TOTAL_MINUTOS = TODAS_AULAS.reduce((s, { aula }) => s + aula.minutos, 0);

// Nota mínima (0-100) para aprovação na prova final de um módulo.
export const NOTA_MINIMA_PROVA = 70;

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
