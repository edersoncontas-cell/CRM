// O status do cadastro do cliente, no vocabulário do formulário "Editar
// cliente": ✓ Cliente · Potencial cliente · Não é cliente.
//
// Fica num módulo próprio, sem nenhuma dependência, porque a mesma pergunta é
// feita nos dois lados: no servidor (para o Orientador decidir se analisa ou
// só resume) e no componente do painel (para decidir o que desenhar). Um
// módulo puro atravessa a fronteira sem arrastar banco nem IA para o bundle do
// navegador.

export const STATUS_CLIENTE = "cliente";
export const STATUS_POTENCIAL = "potencial";
/** Contato que o vendedor marcou como NÃO sendo cliente. */
export const STATUS_NAO_CLIENTE = "nao_cliente";

/**
 * Este contato é dos que só levam resumo?
 *
 * "Para os contatos que eu selecionar que não é cliente, o orientador deixará
 * apenas um resumo do contexto de toda conversa."
 *
 * Só o "nao_cliente" escolhido na mão entra. "potencial" (o padrão de quem
 * acabou de chegar) NÃO entra — senão o Orientador emudeceria justamente no
 * lead novo, que é onde ele mais serve.
 */
export function soResumo(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === STATUS_NAO_CLIENTE;
}
