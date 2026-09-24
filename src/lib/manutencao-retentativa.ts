// QUANDO TENTAR A MANUTENÇÃO DE NOVO — depois de ela falhar.
//
// O que aconteceu: uma etapa da manutenção falhava, o CRM apagava a marca de
// "já fiz" e, na tela seguinte, rodava a manutenção INTEIRA de novo. E de
// novo. Durante horas, a cada tela aberta: oito tabelas reescritas, limpeza
// de contatos, funil, municípios... Foi isso que esgotou a cota do banco e
// deixou o CRM uma semana fora do ar.
//
// Tentar de novo continua certo — migração que não passou precisa de segunda
// chance. Tentar de novo A CADA TELA é o que não pode. Aqui o intervalo cresce
// a cada falha: 5 min, 30 min, 2 h, e depois uma vez por dia. E a falha fica
// gravada na própria marca, para a tela poder mostrar.
//
// Módulo puro: sem banco, sem relógio de verdade — para o teste provar o
// calendário sem esperar 2 horas.

const ESPERAS_MS = [
  5 * 60_000,        // 1ª falha: 5 minutos
  30 * 60_000,       // 2ª: meia hora
  2 * 60 * 60_000,   // 3ª: 2 horas
  24 * 60 * 60_000,  // 4ª em diante: 1 vez por dia
];

export type Marca =
  | { estado: "ok" }
  | { estado: "nunca" }
  | { estado: "falhou"; vezes: number; em: number; erro: string };

/** Lê o valor gravado na chave de manutenção. Qualquer coisa estranha vira "nunca". */
export function lerMarca(valor: string | null | undefined): Marca {
  if (!valor) return { estado: "nunca" };
  if (valor === "ok") return { estado: "ok" };
  const m = /^falhou:(\d+):(\d+):(.*)$/s.exec(valor);
  if (!m) return { estado: "nunca" };
  const vezes = Number(m[1]);
  const em = Number(m[2]);
  if (!Number.isFinite(vezes) || !Number.isFinite(em)) return { estado: "nunca" };
  return { estado: "falhou", vezes, em, erro: m[3] };
}

/** Grava a falha na marca: vezes, quando, e um resumo curto do erro. */
export function marcaDeFalha(vezesAnteriores: number, agora: number, erro: string): string {
  const resumo = erro.replace(/\s+/g, " ").trim().slice(0, 300);
  return `falhou:${vezesAnteriores + 1}:${agora}:${resumo}`;
}

/** Quanto esperar depois da n-ésima falha. */
export function esperaAposFalhas(vezes: number): number {
  return ESPERAS_MS[Math.min(Math.max(vezes, 1), ESPERAS_MS.length) - 1];
}

/**
 * Deve rodar a manutenção AGORA?
 *   · "ok"     → não, já está em dia
 *   · "nunca"  → sim
 *   · "falhou" → só se o intervalo daquela falha já passou
 */
export function deveRodar(marca: Marca, agora: number): boolean {
  if (marca.estado === "ok") return false;
  if (marca.estado === "nunca") return true;
  return agora - marca.em >= esperaAposFalhas(marca.vezes);
}
