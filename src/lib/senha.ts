// Guardar senha de usuário.
//
// Vem do multiusuário: até aqui existia UMA senha, em variável de ambiente.
// Com uma senha por pessoa, elas passam a morar no banco — e senha no banco
// nunca vai em texto puro. Se o banco vazar, as senhas não podem vazar junto.
//
// PBKDF2 com Web Crypto: funciona no Node e no Edge (o middleware do Next roda
// em Edge), sem dependência nova. Sal por senha, para duas pessoas com a mesma
// senha não terem o mesmo hash — e para tabela pronta de hash não servir.

const ITERACOES = 120_000;
const TAMANHO_SAL = 16;
const TAMANHO_CHAVE = 32;

function hex(b: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function deHex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derivar(senha: string, sal: Uint8Array): Promise<string> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal as unknown as BufferSource, iterations: ITERACOES, hash: "SHA-256" },
    base,
    TAMANHO_CHAVE * 8,
  );
  return hex(bits);
}

/** Formato guardado: pbkdf2$iterações$sal$chave — tudo que a conferência precisa. */
export async function hashSenha(senha: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(TAMANHO_SAL));
  return `pbkdf2$${ITERACOES}$${hex(sal)}$${await derivar(senha, sal)}`;
}

/**
 * Confere a senha. Nunca levanta: senha errada e hash estragado dão o MESMO
 * "false" — erro diferente para cada caso conta ao atacante onde ele está.
 */
export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  try {
    const [algo, iter, sal, chave] = (guardado ?? "").split("$");
    if (algo !== "pbkdf2" || !iter || !sal || !chave) return false;
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: deHex(sal) as unknown as BufferSource, iterations: Number(iter), hash: "SHA-256" },
      base,
      (chave.length / 2) * 8,
    );
    return iguaisEmTempoConstante(hex(bits), chave);
  } catch {
    return false;
  }
}

/**
 * Comparação de tempo constante. Comparar com === vaza informação pelo TEMPO:
 * quanto mais caracteres do começo batem, mais demora a diferir — e com isso
 * dá para descobrir o hash caractere a caractere.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}
