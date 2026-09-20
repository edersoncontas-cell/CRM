import { nacionalDoTelefone } from "@/lib/telefone-valido";

// QUEM O CONTATO É NÃO MUDA PORQUE A CONVERSA FOI LIGADA A UMA NEGOCIAÇÃO.
//
//   "Eu vinculei a conversa do Wadson em uma negociação e ao invés das
//    informações ficarem juntas ele atualizou o nome do cliente e modificou o
//    que já estava lá. Retorne ao que estava antes e altere essa função: não é
//    pra modificar o nome ou cadastro do cliente quando eu vincular uma
//    conversa a uma negociação."
//
// O que acontecia: vincular grava o clienteId da negociação na conversa, e a
// lista do Atendimento dava a palavra final ao nome do CADASTRO. Então a
// conversa do Wadson passava a se chamar "Bwb Terraplanagem Ltda" — o cadastro
// dele não foi renomeado no banco (isso só acontece com a caixinha "atualizar
// também o cadastro", que este caminho nunca marca), mas na tela o efeito era o
// mesmo: o Wadson desaparecia.
//
// Só que a regra que dá a palavra ao cadastro existe por um pedido anterior, e
// continua certa: o nome que vale é o da SUA agenda (Google Contatos →
// Clientes), não o apelido que o contato escolheu no perfil do WhatsApp. As
// duas coisas convivem se a pergunta for a certa:
//
//   o cadastro ligado é ESTA MESMA PESSOA, ou é OUTRO cadastro?
//
// Mesma pessoa (o telefone do cadastro é o número da conversa, ou o vínculo
// nasceu do próprio número): manda o nome do cadastro, como antes.
// Cadastro diferente (uma empresa, um sócio, a proposta que está em outro
// nome): a conversa continua sendo de quem conversa, e o cadastro ligado vira
// informação ao lado — não substituto.

/** Dois números são o mesmo telefone? Compara só a parte nacional. */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = nacionalDoTelefone(a);
  const y = nacionalDoTelefone(b);
  if (!x || !y) return false;
  return x === y;
}

export type VinculoConversa = {
  /** O número da conversa no WhatsApp. */
  externalPhone: string;
  /** Nome do cadastro ligado à conversa (null quando não há vínculo). */
  clienteNome: string | null;
  /** Telefone do cadastro ligado, como está no CRM. */
  clienteTelefone: string | null;
  /** O vendedor ligou esta conversa à mão (pelo pop-up "Vincular")? */
  vinculoManual: boolean;
};

/**
 * O nome do cadastro pode substituir o nome do contato nesta conversa?
 *
 * Duas travas, e basta uma para NÃO substituir:
 *
 *  1. vínculo feito à mão. É o pedido, literal: vincular não mexe no nome.
 *     Mesmo que por acaso seja a mesma pessoa, quem ligou foi o vendedor, e
 *     ele não pediu para renomear nada.
 *  2. telefone do cadastro diferente do número da conversa. Aqui a prova é
 *     objetiva: são duas pessoas. Serve para consertar os vínculos que já
 *     existem, feitos antes desta regra, sem precisar adivinhar quais foram
 *     manuais.
 *
 * Cadastro SEM telefone não conta como prova de nada: muito cadastro de
 * empresa entra só com o nome, e a limpeza dos identificadores do WhatsApp
 * zerou o telefone de outros. Nesse caso decide a trava 1.
 */
export function cadastroPodeDarONome(v: VinculoConversa): boolean {
  if (!v.clienteNome) return false;
  if (v.vinculoManual) return false;
  if (v.clienteTelefone && !mesmoTelefone(v.clienteTelefone, v.externalPhone)) return false;
  return true;
}

/**
 * O nome que aparece na lista e no cabeçalho da conversa.
 *
 * Ordem: cadastro (quando pode dar o nome) → nome vindo do WhatsApp → número.
 * Grupo é outro assunto: vale o nome do grupo.
 */
export function nomeDaConversa(
  c: {
    isGroup: boolean;
    groupName: string | null;
    contactName: string | null;
    externalPhone: string;
    clienteNome: string | null;
    clienteTelefone: string | null;
    vinculoManual: boolean;
  },
  nomeLocal?: string | null,
): string {
  if (c.isGroup) return c.groupName || c.contactName || c.externalPhone;
  const doCadastro = cadastroPodeDarONome(c) ? c.clienteNome : null;
  return doCadastro || nomeLocal || c.contactName || c.externalPhone;
}

/**
 * O cadastro ligado, quando ele é OUTRO e por isso não aparece como nome.
 *
 * É o "as informações ficam nos dois" que o vendedor pediu: ele precisa ver na
 * conversa do Wadson que ela responde pela negociação da Bwb — sem que uma
 * apague a outra.
 */
export function cadastroAoLado(c: {
  isGroup: boolean;
  clienteNome: string | null;
  clienteTelefone: string | null;
  externalPhone: string;
  vinculoManual: boolean;
}): string | null {
  if (!c.clienteNome) return null;
  // Em grupo o nome exibido é sempre o do grupo, então o cadastro ligado nunca
  // está no título — aparece ao lado.
  if (c.isGroup) return c.clienteNome;
  if (cadastroPodeDarONome({ ...c, clienteNome: c.clienteNome })) return null;
  return c.clienteNome;
}
