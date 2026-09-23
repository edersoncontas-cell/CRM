// Achar, no meio das mensagens que FALHARAM, as que saíram de um disparo.
//
// O problema: campanha e mensagem individual são gravadas exatamente iguais no
// banco (direction OUT, origin CRM, operador "Você"). Não existe campo que
// diga "esta foi do disparo".
//
// A primeira tentativa foi agrupar por semelhança do texto — e o teste
// derrubou: a campanha é PERSONALIZADA ({nome} vira o primeiro nome), e numa
// mensagem curta o nome cai dentro de qualquer pedaço que se compare, criando
// um grupo por cliente.
//
// A solução não é adivinhar melhor: é usar o que o CRM JÁ SABE. O texto
// original de cada disparo está guardado em EnvioProgramado.texto, com o
// {nome} ainda no lugar. Dele sai o TRECHO INVARIANTE — o pedaço que não muda
// de cliente para cliente — e é por ele que as mensagens são encontradas.
//
// O que não bater com disparo nenhum NÃO é apagado: aparece na tela como
// "outras mensagens com erro", para ele ver e decidir. Apagar mensagem é sem
// volta; palpite meu não vale.

/**
 * O menor trecho que ainda identifica um disparo com segurança. Abaixo disso o
 * pedaço é genérico demais ("responda SAIR.") e pegaria mensagem de outro
 * disparo junto.
 */
export const MINIMO_TRECHO = 25;

/**
 * O pedaço do texto do disparo que é igual em TODAS as mensagens dele.
 *
 * Devolve null quando o texto não tem pedaço fixo grande o bastante — nesse
 * caso o CRM não oferece o apagar automático, porque não conseguiria separar
 * esse disparo de outro parecido.
 */
export function trechoInvariante(textoDoDisparo: string): string | null {
  const t = (textoDoDisparo ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  // O texto é quebrado nos lugares onde entra algo do cliente. Hoje só {nome},
  // mas a lista fica aqui para uma variável nova não passar despercebida.
  // A pontuação da borda sai junto: quebrar "Oi {nome}, chegou..." deixa o
  // pedaço começando em vírgula, o que não ajuda a casar nada e ainda fica
  // esquisito quando o trecho aparece na tela.
  const pedacos = t
    .split(/\{nome\}/gi)
    .map((p) => p.replace(/^[\s,;:.!?-]+/, "").replace(/[\s,;:-]+$/, "").trim())
    .filter(Boolean);
  if (!pedacos.length) return null;
  const maior = pedacos.reduce((a, b) => (b.length > a.length ? b : a));
  return maior.length >= MINIMO_TRECHO ? maior : null;
}

/** A mensagem gravada saiu deste disparo? */
export function ehDoDisparo(corpoDaMensagem: string, trecho: string): boolean {
  const c = (corpoDaMensagem ?? "").replace(/\s+/g, " ").trim();
  return c.includes(trecho);
}

export type DisparoComFalhas = {
  envioId: string;
  texto: string;
  trecho: string;
  quando: string;      // ISO — quando o disparo foi programado
  status: string;      // do EnvioProgramado
  falhadas: number;    // mensagens com erro que casam com este disparo
  clientes: number;
};
