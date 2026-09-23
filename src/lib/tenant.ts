// QUEM ESTÁ USANDO O CRM AGORA — e o isolamento que sai disso.
//
// O multiusuário tem um risco que domina todos os outros: um vendedor ver a
// carteira do outro. O CRM tem 494 consultas de leitura em 119 arquivos.
// Pôr "where: { vendedorId }" à mão em cada uma seria garantir o vazamento:
// basta UMA esquecida, e ela não dá erro — só mostra o cliente errado.
//
// Por isso o filtro não é escrito na consulta: ele é injetado no cliente do
// banco (ver lib/db.ts), a partir do usuário guardado aqui. Consulta nova,
// escrita por mim daqui a três meses sem lembrar desta regra, já nasce
// isolada. É a regra 3 do CLAUDE.md aplicada ao lugar onde ela mais importa:
// o padrão tem que ser a coisa MENOS danosa.
//
// AsyncLocalStorage é o que amarra o usuário à requisição. Variável de módulo
// não serviria: o servidor atende várias pessoas ao mesmo tempo e uma
// sobrescreveria a outra — dois vendedores online, e um veria a carteira do
// outro por pura corrida.

import { AsyncLocalStorage } from "node:async_hooks";

export type Papel = "vendedor" | "gerente";

export type UsuarioAtual = {
  id: string;
  nome: string;
  papel: Papel;
};

const contexto = new AsyncLocalStorage<UsuarioAtual | null>();

/**
 * Roda o trecho com este usuário no contexto.
 *
 * É ASSÍNCRONA e dá await no trecho DE DENTRO do contexto, de propósito. A
 * promessa do Prisma é PREGUIÇOSA: `db.cliente.count()` não consulta nada até
 * alguém dar await. Se a versão síncrona devolvesse essa promessa, o await
 * aconteceria FORA daqui, o contexto já teria fechado e o filtro por vendedor
 * sumiria — sem erro nenhum, só a carteira do outro na tela.
 *
 * Foi exatamente o que a prova contra o banco mostrou: findMany filtrado e
 * count trazendo 1.300. Com o await aqui dentro, o uso perigoso deixa de
 * existir.
 */
export async function comUsuario<T>(u: UsuarioAtual | null, fn: () => T | Promise<T>): Promise<T> {
  return contexto.run(u, async () => await fn());
}

export function usuarioAtual(): UsuarioAtual | null {
  return contexto.getStore() ?? null;
}

/**
 * O dono que o filtro deve aplicar, ou null quando não há filtro.
 *
 * null em dois casos MUITO diferentes, e é de propósito:
 *   · gerente — enxerga tudo por decisão;
 *   · fora de requisição (cron, migração, seed) — o trabalho de sistema
 *     precisa varrer a base inteira.
 *
 * O que NUNCA acontece é um vendedor logado enxergar sem filtro.
 */
export function donoDoFiltro(): string | null {
  const u = usuarioAtual();
  if (!u) return null;
  if (u.papel === "gerente") return null;
  return u.id;
}

/**
 * Trecho que precisa varrer a base toda mesmo com vendedor logado — cron,
 * manutenção, contagem global. Explícito de propósito: quem escreve isto está
 * dizendo "eu sei o que estou fazendo", e o grep acha todos os lugares.
 */
export async function semFiltro<T>(fn: () => T | Promise<T>): Promise<T> {
  return contexto.run(null, async () => await fn());
}
