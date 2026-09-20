// A CHAVE DO "RESOLVIDO" NA CENTRAL DE ALERTAS.
//
//   "estou clicando em resolvido no pós venda e o card some e depois volta
//    sozinho (…) corrija isso e qualquer outro campo que eu clique em
//    resolvido, não quero que nada volte."
//
// O "Resolvido" grava a chave do item em AlertaOculto, e a Central esconde
// todo item cuja chave esteja lá. Só que duas chaves carregavam DENTRO delas a
// situação do cliente, que muda:
//
//   posvenda:<cliente>:<marco>:<entrega técnica>:<frio>
//   semcontato:<cliente>:<carimbo do último contato>
//
// Bastava um desses pedaços mudar para a chave nova não bater com a guardada,
// e o card voltava sozinho — sem ninguém ter desfeito nada. Pior: no
// pós-venda com marco pendente, o PRÓPRIO "Resolvido" registra o marco como
// cumprido, o que muda a situação e portanto muda a chave. O clique se
// desfazia sozinho, por construção.
//
// A chave guardada passa a ser ESTÁVEL: identifica o assunto e o cliente, não
// o estado dele naquele segundo. Resolvido é resolvido.
//
// A CONSEQUÊNCIA, que é honesta dizer: o pós-venda resolvido não volta sozinho
// quando vence o marco seguinte. Era esse o efeito colateral que fazia parecer
// inteligência ("volta quando vencer o próximo") e na prática era o bug. Se o
// lembrete do próximo marco fizer falta, ele volta como regra escrita — por
// data de vencimento comparada ao ocultoEm — e não por chave que se desfaz.

/** O prefixo (assunto) e o resto de uma chave de item da Central. */
function partes(id: string): { prefixo: string; resto: string[] } {
  const [prefixo, ...resto] = id.split(":");
  return { prefixo, resto };
}

/**
 * A chave que vai para o banco quando o vendedor clica em "Resolvido".
 *
 * Só os dois grupos que embutiam situação são encurtados; os demais já usam o
 * id do registro (visita, demanda, alerta, licitação, negociação), que não
 * muda porque o cliente mudou de estado.
 */
export function chaveEstavel(id: string): string {
  const { prefixo, resto } = partes(id);
  if (prefixo === "posvenda" || prefixo === "semcontato") {
    // Fica "posvenda:<clienteId>" — o assunto e de quem é.
    return resto[0] ? `${prefixo}:${resto[0]}` : id;
  }
  return id;
}

/**
 * Este item está resolvido?
 *
 * Aceita TAMBÉM a chave longa: as resoluções que o vendedor já fez antes desta
 * correção estão gravadas no formato antigo, e ele não vai clicar tudo de novo.
 */
export function estaResolvido(id: string, chavesOcultas: Set<string>): boolean {
  return chavesOcultas.has(id) || chavesOcultas.has(chaveEstavel(id));
}
