// Mensagem de erro que pode ir para a tela. Tela caída tem que DIZER o motivo
// (CLAUDE.md §8), mas o motivo do Prisma pode trazer o endereço do banco — e
// nele, a senha. Aqui sai o endereço e o ruído da ferramenta; fica o motivo.

export function limparErro(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg
    .replace(/postgres(ql)?:\/\/\S+/gi, "[endereço do banco]")
    .replace(/Invalid `[^`]+` invocation:?/gi, "")
    .replace(/Raw query failed\. Code: `?\w+`?\. Message: /gi, "")
    .replace(/\s+/g, " ").trim().slice(0, 300);
}
