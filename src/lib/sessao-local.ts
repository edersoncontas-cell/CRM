// A sessão guardada no aparelho (localStorage), num lugar só.
//
// O PWA do iPhone às vezes descarta o cookie ao fechar o app. O token fica
// guardado aqui e repõe o cookie sem digitar a senha. Três lugares precisam
// disso: a tela de login (EntradaAutomatica), o reforço dentro do app
// (AuthPersist) e o modo sem sinal, que ao voltar a internet pode encontrar
// o cookie vencido e não conseguir subir o que ele fez.

// O script inline de app/login/page.tsx (que apaga a tela antes do React
// carregar) lê este mesmo nome escrito à mão — trocou aqui, troca lá.
export const CHAVE_TOKEN = "crm_token";

export function lerToken(): string | null {
  try { return localStorage.getItem(CHAVE_TOKEN); } catch { return null; }
}

export function guardarToken(token: string): void {
  try { localStorage.setItem(CHAVE_TOKEN, token); } catch { /* armazenamento bloqueado */ }
}

export function esquecerToken(): void {
  try { localStorage.removeItem(CHAVE_TOKEN); } catch { /* idem */ }
}

/**
 * Repõe o cookie a partir do token guardado.
 *  "ok"        → cookie de volta.
 *  "recusado"  → o token não vale mais (a senha mudou): é esquecido.
 *  "sem_token" → nada guardado neste aparelho.
 *  "rede"      → não deu para perguntar (sem sinal, servidor fora). O token
 *                FICA: apagá-lo por uma queda de rede obrigaria a digitar a
 *                senha na rua.
 */
export async function restaurarSessao(): Promise<"ok" | "recusado" | "sem_token" | "rede"> {
  const token = lerToken();
  if (!token) return "sem_token";
  try {
    const r = await fetch("/api/auth/restaurar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (r.ok) return "ok";
    if (r.status === 401) { esquecerToken(); return "recusado"; }
    return "rede";
  } catch {
    return "rede";
  }
}
