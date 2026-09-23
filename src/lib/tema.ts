// TEMA DO CRM: claro ou escuro.
//
// "da opção do crm ser em tema claro e em escuro, mantém esse como escuro que
// é esse de agora."
//
// O escuro é exatamente o CRM de hoje — nada muda para quem não mexer. O claro
// acende a CASCA (fundo da página, menu lateral, topo do celular) e o
// Dashboard; os cards já eram claros em quase toda tela, e é por isso que este
// trabalho é do tamanho que é.
//
// A escolha vai num COOKIE, não no localStorage: o servidor precisa saber o
// tema na hora de montar o HTML. Com localStorage a página nasceria escura e
// clarearia depois que o JavaScript rodasse — aquele branco que pisca na cara
// de quem abre o app no sol.

export type ModoTema = "claro" | "escuro";

export const COOKIE_TEMA = "crm_tema";
export const TEMA_PADRAO: ModoTema = "escuro";

/** Um ano: a escolha de tema não tem por que expirar antes disso. */
export const MAX_IDADE_TEMA = 60 * 60 * 24 * 365;

/** Lê o valor cru do cookie. Qualquer coisa fora do esperado cai no padrão. */
export function modoValido(valor: string | undefined | null): ModoTema {
  return valor === "claro" ? "claro" : TEMA_PADRAO;
}

export function outroModo(m: ModoTema): ModoTema {
  return m === "claro" ? "escuro" : "claro";
}

/**
 * Cor da barra de status do celular. É o que o iOS pinta em volta do app
 * instalado na tela inicial — deixar a cor escura no tema claro daria uma
 * tarja preta no topo que não combina com nada.
 */
export function corDaBarra(m: ModoTema): string {
  return m === "claro" ? "#eef1f6" : "#09090b";
}
