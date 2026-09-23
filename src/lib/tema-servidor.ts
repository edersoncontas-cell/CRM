import { cookies } from "next/headers";
import { COOKIE_TEMA, modoValido, type ModoTema } from "@/lib/tema";
import { temaDash, type TemaDash } from "@/lib/dash-tema";

// O tema do lado do servidor.
//
// Separado de lib/tema.ts porque aquele é puro (tem teste) e este toca em
// cookies() — que só existe em componente de servidor. Assim o módulo da regra
// continua rodando no teste sem precisar de Next nenhum.

export function modoAtual(): ModoTema {
  return modoValido(cookies().get(COOKIE_TEMA)?.value);
}

/**
 * A paleta do Dashboard já resolvida. Componente de SERVIDOR chama direto —
 * é síncrono e o Next deduplica a leitura do cookie no mesmo request.
 *
 * Componente de cliente não pode: ele usa o contexto (TemaDashProvider), que
 * recebe esta mesma paleta da página.
 */
export function temaDashAtual(): TemaDash {
  return temaDash(modoAtual());
}
