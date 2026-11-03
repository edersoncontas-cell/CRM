// A palavra que libera o envio. Pura, sem banco: a tela ("use client") e a
// action ("use server", que não exporta constante) usam a mesma.

export const PALAVRA_LIBERAR = "LIBERAR";

/** Só a palavra exata (sem diferença de maiúscula/espaço) libera. */
export function confirmouLiberar(texto: string | null | undefined): boolean {
  return typeof texto === "string" && texto.trim().toUpperCase() === PALAVRA_LIBERAR;
}
