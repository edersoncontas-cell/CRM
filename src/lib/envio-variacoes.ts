// ATÉ 3 TEXTOS QUE SE REVEZAM NUM ENVIO EM MASSA.
//
// Mensagem idêntica para muita gente é a assinatura de disparo que o WhatsApp
// reconhece — e foi disparo que bloqueou o número. Com versões diferentes do
// mesmo recado, a lista não sai toda com o mesmo texto.
//
// As versões moram no MESMO campo de texto do envio (EnvioProgramado.texto),
// separadas por uma marca que ninguém digita. De propósito: coluna nova no
// banco foi o que derrubou o CRM em 23/09, e um envio de uma versão só
// continua sendo exatamente o texto de antes — nada muda para quem não usar.
//
// Cada cliente recebe SEMPRE a mesma versão (sorteada pelo id dele, não pela
// posição na lista): o envio grande sai em ondas, e quem recebe na segunda
// onda não pode ganhar texto diferente do combinado, nem a limpeza de falhas
// deixar de achar a mensagem dele.

import { comRodapeDeSaida } from "@/lib/envio-limites";
import { personalizarTexto } from "@/lib/abordagem-cidade-regra";

export const MAX_VARIACOES = 3;
export const MARCA_VARIACAO = "⟪variação⟫";
const SEPARADOR = `\n\n${MARCA_VARIACAO}\n\n`;
const QUEBRA = /\s*⟪variação⟫\s*/;

const normal = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

/** Junta as versões num texto só. Vazias e repetidas saem; no máximo 3. */
export function juntarVariacoes(textos: readonly string[]): string {
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const t of textos) {
    const limpo = (t ?? "").replace(QUEBRA, " ").trim();
    if (!limpo || vistos.has(normal(limpo))) continue;
    vistos.add(normal(limpo));
    unicos.push(limpo);
    if (unicos.length === MAX_VARIACOES) break;
  }
  return unicos.join(SEPARADOR);
}

/** As versões de um envio. Texto sem a marca é uma versão só (o de sempre). */
export function textosDoEnvio(texto: string): string[] {
  const partes = (texto ?? "").split(QUEBRA).map((t) => t.trim()).filter(Boolean);
  return partes.length ? partes : [(texto ?? "").trim()];
}

// FNV-1a de 32 bits: barato, estável entre servidor e navegador.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Qual versão este cliente recebe (e em que posição ela está). */
export function versaoDoCliente(texto: string, clienteId: string): { texto: string; numero: number; total: number } {
  const v = textosDoEnvio(texto);
  if (v.length <= 1) return { texto: v[0] ?? "", numero: 1, total: 1 };
  const i = hash(clienteId) % v.length;
  return { texto: v[i], numero: i + 1, total: v.length };
}

/**
 * O texto que ESTE cliente recebe: a versão dele, com o rodapé de saída (uma
 * vez, em cada versão) e o primeiro nome no lugar de {nome}. Envio só com
 * anexo leva só o rodapé de legenda — a saída vale para ele também.
 */
export function textoParaCliente(texto: string, cliente: { id: string; nome: string }): string {
  const versao = versaoDoCliente(texto, cliente.id).texto;
  return personalizarTexto(comRodapeDeSaida(versao), cliente.nome);
}

/** Para listas e auditoria: a primeira versão, e quantas há. */
export function resumoDoEnvio(texto: string): { principal: string; versoes: number } {
  const v = textosDoEnvio(texto);
  return { principal: v[0] ?? "", versoes: v.length };
}
