// Login pessoal opcional. Se APP_PASSWORD estiver vazio, o app não pede senha.
// Cookie assinado de forma simples com Web Crypto (funciona em Node e Edge).

export const COOKIE_NAME = "crm_auth";

// Opções do cookie de sessão. `secure` em produção (HTTPS) é essencial para o
// cookie persistir de forma confiável no Safari/PWA do iPhone. Validade de 1 ano
// e renovada a cada visita (no middleware) → você fica logado mesmo fechando o app.
export function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 ano
  };
}

export function authAtivo() {
  return !!process.env.APP_PASSWORD;
}

// Produção sem APP_PASSWORD configurado: o CRM inteiro ficaria público. O
// middleware usa isto para bloquear com página de aviso em vez de abrir tudo.
export function producaoSemSenha() {
  return process.env.NODE_ENV === "production" && !process.env.APP_PASSWORD;
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function tokenEsperado(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // Em dev, um segredo fixo é aceitável. Em produção, sem AUTH_SECRET o
    // cookie de sessão ficaria previsível — falha fechado (erro) em vez de
    // aceitar um valor padrão conhecido.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET não configurado em produção.");
    }
    return sha256(`${process.env.APP_PASSWORD}::dev-secret`);
  }
  return sha256(`${process.env.APP_PASSWORD}::${secret}`);
}

export async function senhaCorreta(senha: string): Promise<boolean> {
  return senha === process.env.APP_PASSWORD;
}
