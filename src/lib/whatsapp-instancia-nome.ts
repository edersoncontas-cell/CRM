// QUAL INSTÂNCIA DA EVOLUTION É A DO CRM — regras puras (sem banco).
//
// O nome vem da variável EVOLUTION_INSTANCE ("crm"). Quando a instância trava
// num jeito que a Evolution não deixa nem sair nem apagar (o "zumbi" do print
// de 01/10: diz "open", o socket está fechado, logout → "Connection Closed",
// apagar → 400, reiniciar não cura), o único caminho pela API é criar OUTRA
// instância, com outro nome. O CRM faz isso sozinho e guarda no banco qual é a
// ativa ("crm-2", "crm-3"…), sem ele precisar mexer na Vercel.
//
// A escolha vale só enquanto a variável for a mesma de quando ela foi feita:
// se ele trocar EVOLUTION_INSTANCE na Vercel, manda a variável.

export const CHAVE_INSTANCIA_ATIVA = "whatsapp.instancia.ativa";

/** Nome que a Evolution aceita e que cabe num caminho de URL sem surpresa. */
export function nomeInstanciaValido(nome: unknown): nome is string {
  return typeof nome === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(nome);
}

export type InstanciaGuardada = { base: string; nome: string; desde?: string; anterior?: string };

/** Lê o que está guardado no banco; qualquer coisa estranha = nada guardado (vale a variável). */
export function lerInstanciaGuardada(valor: string | null | undefined): InstanciaGuardada | null {
  if (!valor) return null;
  try {
    const o = JSON.parse(valor) as Partial<InstanciaGuardada>;
    if (!nomeInstanciaValido(o.base) || !nomeInstanciaValido(o.nome)) return null;
    return { base: o.base, nome: o.nome, desde: typeof o.desde === "string" ? o.desde : undefined, anterior: nomeInstanciaValido(o.anterior) ? o.anterior : undefined };
  } catch {
    return null;
  }
}

/** A instância que vale: a guardada, se foi feita a partir da MESMA variável; senão, a variável. */
export function instanciaQueVale(base: string, guardada: InstanciaGuardada | null): string {
  if (guardada && guardada.base === base) return guardada.nome;
  return base;
}

/**
 * Volta do banco provisório: os dois bancos podem ter trocado de instância.
 * Vale a troca MAIS NOVA (a anterior é de uma instância que já travou).
 * Devolve o valor a gravar no principal, ou null quando o dele continua valendo.
 */
export function instanciaQueVemNaVolta(principal: string | null | undefined, provisorio: string | null | undefined): string | null {
  const p = lerInstanciaGuardada(principal);
  const v = lerInstanciaGuardada(provisorio);
  if (!v) return null;
  if (!p) return provisorio ?? null;
  const t = (g: InstanciaGuardada) => { const n = Date.parse(g.desde ?? ""); return Number.isFinite(n) ? n : 0; };
  return t(v) > t(p) ? provisorio ?? null : null;
}

/** crm → crm-2 → crm-3 … (a partir da que vale agora). */
export function proximoNomeInstancia(base: string, atual: string): string {
  const m = atual.match(/^(.*)-(\d+)$/);
  if (atual.startsWith(`${base}-`) && m && m[1] === base) return `${base}-${Number(m[2]) + 1}`;
  return `${base}-2`;
}
