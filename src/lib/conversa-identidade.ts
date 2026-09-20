import { nacionalDoTelefone } from "@/lib/telefone-valido";

// QUEM O CONTATO É NÃO MUDA PORQUE A CONVERSA FOI LIGADA A UMA NEGOCIAÇÃO.
//
//   "Eu vinculei a conversa do Wadson em uma negociação e ao invés das
//    informações ficarem juntas ele atualizou o nome do cliente e modificou o
//    que já estava lá. Retorne ao que estava antes e altere essa função: não é
//    pra modificar o nome ou cadastro do cliente quando eu vincular uma
//    conversa a uma negociação."
//
//   "BWB continua ainda no lugar do Wadson, quero que volte ao que era antes."
//
// O que acontecia: vincular grava o clienteId da negociação na conversa, e a
// lista do Atendimento dava a palavra final ao nome do CADASTRO. Então a
// conversa do Wadson passava a se chamar "Bwb Terraplanagem Ltda" — o cadastro
// dele não foi renomeado no banco (isso só acontece com a caixinha "atualizar
// também o cadastro", que este caminho nunca marca), mas na tela o efeito era o
// mesmo: o Wadson desaparecia.
//
// A PRIMEIRA TENTATIVA ERROU A MIRA. Eu deixei o cadastro continuar mandando no
// nome quando não desse para PROVAR que era outra pessoa — a prova era o
// telefone do cadastro ser diferente do número da conversa. Só que cadastro de
// empresa costuma entrar sem telefone, e sem telefone não há prova: a Bwb
// seguia por cima do Wadson. Regra que só funciona quando o dado está
// preenchido não é regra, é sorte.
//
// A REGRA AGORA É DIRETA: manda o nome do CONTATO. O cadastro ligado nunca toma
// esse lugar — aparece ao lado.
//
// E isso não desfaz o pedido antigo ("usar o nome da agenda do celular, não o
// apelido do perfil do WhatsApp"), porque o nome da agenda não vem do cadastro:
// a sincronização de contatos (lib/whatsapp-nomes.ts) grava o nome da agenda no
// PRÓPRIO contactName da conversa, preferindo-o ao nome de perfil. O nome certo
// já chega pelo caminho certo; o cadastro nunca precisou passar por cima.
//
// Sobra um caso para o cadastro: conversa sem nome nenhum. Aí emprestar o nome
// do cadastro é melhor do que mostrar um número cru na lista.

/**
 * Dois números são o mesmo telefone? Compara só a parte nacional.
 *
 * Não decide mais nome nenhum — quem usa é a marcação dos vínculos antigos em
 * lib/migrations.ts, para registrar quais conversas foram ligadas a outro
 * cadastro.
 */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = nacionalDoTelefone(a);
  const y = nacionalDoTelefone(b);
  if (!x || !y) return false;
  return x === y;
}

export type NomeConversa = {
  isGroup: boolean;
  groupName: string | null;
  /** O nome do contato: o da sua agenda quando a sincronização já o trouxe. */
  contactName: string | null;
  externalPhone: string;
  /** Nome do cadastro ligado à conversa (null quando não há vínculo). */
  clienteNome: string | null;
};

/**
 * O nome que aparece na lista e no cabeçalho da conversa.
 *
 * Ordem: o nome recém-digitado na tela → o nome do contato → o cadastro ligado,
 * só como último recurso antes do número cru. Grupo é outro assunto: vale o
 * nome do grupo.
 */
export function nomeDaConversa(c: NomeConversa, nomeLocal?: string | null): string {
  if (c.isGroup) return c.groupName || c.contactName || c.externalPhone;
  return nomeLocal || c.contactName || c.clienteNome || c.externalPhone;
}

/**
 * O cadastro ligado pode emprestar o nome a esta conversa?
 *
 * Só quando a conversa não tem nome próprio — e aí ele não está "por cima" de
 * ninguém, está preenchendo um vazio.
 */
export function cadastroPodeDarONome(c: NomeConversa): boolean {
  if (!c.clienteNome) return false;
  if (c.isGroup) return !c.groupName && !c.contactName;
  return !c.contactName;
}

/**
 * O cadastro ligado, quando ele NÃO é o nome exibido.
 *
 * É o "as informações ficam nos dois" que o vendedor pediu: ele precisa ver na
 * conversa do Wadson que ela responde pela negociação da Bwb — sem que uma
 * apague a outra.
 */
export function cadastroAoLado(c: NomeConversa): string | null {
  if (!c.clienteNome) return null;
  // Some quando seria repetição do que já está escrito: o cadastro que virou o
  // nome exibido, e também o cadastro de mesmo nome do contato (o caso comum,
  // em que a conversa e o cadastro são a mesma pessoa). Etiqueta repetindo o
  // título ao lado não informa nada.
  const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return igual(nomeDaConversa(c), c.clienteNome) ? null : c.clienteNome;
}
