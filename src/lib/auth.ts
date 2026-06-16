// Login pessoal opcional. Se APP_PASSWORD estiver vazio, o app não pede senha.
// Cookie assinado de forma simples com Web Crypto (funciona em Node e Edge).

export const COOKIE_NAME = "crm_auth";

export function authAtivo() {
  return !!process.env.APP_PASSWORD;
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function tokenEsperado(): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? "dev-secret";
  return sha256(`${process.env.APP_PASSWORD}::${secret}`);
}

export async function senhaCorreta(senha: string): Promise<boolean> {
  return senha === process.env.APP_PASSWORD;
}
