"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { mesclarClientes } from "@/lib/actions";
import { escolherQueFica, motivoDeQuemFica, pareceMesmaPessoa, type ContatoParaUnir } from "@/lib/unir-contatos-regra";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";

// UNIR CONTATO — a opção do ⋮ de cada cadastro.
//
//   "tem 3 leonardos zambom são o mesmo contato, se eu clicar nos 3
//    pontinhos e depois em unir contato, todos os outros contatos irão abrir
//    uma caixinha de seleção, ao selecionar um ou mais, e depois clicar em
//    confirmar, os contatos selecionados serão 1 só"
//
// A fusão em si (mover negociações, visitas, conversas, frota, auditoria e
// redirecionar os links antigos) já existia em mesclarClientes — o que
// faltava era esta porta, no lugar onde o vendedor vê o problema.

export type ContatoUnivel = {
  id: string;
  nome: string;
  telefone: string | null;
  municipio: string | null;
  doGoogle: boolean;
  /** Quantidade de coisas ligadas (negociações, visitas, conversas…). */
  vinculos: number;
  /** true quando o CRM acha que é a mesma pessoa (nome ou telefone batem). */
  sugerido: boolean;
};

const SELECAO = {
  id: true, nome: true, telefone: true, googleContatoId: true, googleSincronizadoEm: true, criadoEm: true,
  municipio: { select: { nome: true } },
  // Sem "conversas": no schema, WhatsAppConversation guarda clienteId mas
  // NÃO declara a relação de volta em Cliente — pedir esse _count faz o
  // Prisma recusar a consulta inteira, e a caixa de seleção nascia vazia
  // com "não deu para carregar".
  _count: { select: { negociacoes: true, visitas: true, frota: true, tarefas: true, alertas: true } },
} as const;

/**
 * Os outros cadastros que podem ser unidos a este.
 *
 * Os SUGERIDOS vêm primeiro: mesmo telefone, ou nome parecido (ver
 * pareceMesmaPessoa). Com uma busca digitada, procura em toda a base — às
 * vezes o duplicado está escrito de um jeito que nenhuma regra adivinha.
 * O CRM nunca une sozinho: ele sugere, o vendedor marca.
 */
export async function contatosParaUnir(clienteId: string, busca = ""): Promise<{ base: ContatoUnivel | null; opcoes: ContatoUnivel[] }> {
  const base = await db.cliente.findUnique({ where: { id: clienteId }, select: SELECAO });
  if (!base) return { base: null, opcoes: [] };

  const termo = busca.trim();
  const variantes = base.telefone ? phoneLookupVariants(base.telefone) : [];
  const candidatos = await db.cliente.findMany({
    where: {
      id: { not: clienteId },
      ...(termo
        ? { OR: [{ nome: { contains: termo, mode: "insensitive" } }, { telefone: { contains: termo.replace(/\D/g, "") || termo } }] }
        : {}),
    },
    select: SELECAO,
    orderBy: { nome: "asc" },
    take: termo ? 60 : 600,
  });

  const paraTela = (c: typeof base, sugerido: boolean): ContatoUnivel => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    municipio: c.municipio?.nome ?? null,
    doGoogle: !!c.googleContatoId,
    vinculos: c._count.negociacoes + c._count.visitas + c._count.frota + c._count.tarefas + c._count.alertas,
    sugerido,
  });

  const comSugestao = candidatos.map((c) => {
    const mesmoTelefone = !!c.telefone && variantes.some((v) => phoneLookupVariants(c.telefone!).includes(v));
    return paraTela(c, mesmoTelefone || pareceMesmaPessoa(base.nome, c.nome));
  });

  // Sugeridos primeiro; sem busca, mostra só eles (a lista inteira do CRM
  // não ajuda ninguém a achar duplicado).
  const sugeridos = comSugestao.filter((c) => c.sugerido);
  const opcoes = termo ? [...sugeridos, ...comSugestao.filter((c) => !c.sugerido)] : sugeridos;
  return { base: paraTela(base, false), opcoes: opcoes.slice(0, 60) };
}

/** Qual cadastro sobrevive à união (para a tela avisar ANTES de confirmar). */
export async function previaDaUniao(ids: string[]): Promise<{ ficaId: string | null; ficaNome: string; motivo: string }> {
  const cs = await db.cliente.findMany({
    where: { id: { in: ids } },
    select: { id: true, nome: true, telefone: true, googleContatoId: true, googleSincronizadoEm: true, criadoEm: true },
  });
  const fica = escolherQueFica(cs as ContatoParaUnir[]);
  if (!fica) return { ficaId: null, ficaNome: "", motivo: "" };
  return { ficaId: fica.id, ficaNome: fica.nome, motivo: motivoDeQuemFica(fica, cs as ContatoParaUnir[]) };
}

/**
 * Une os cadastros num só. O vencedor NÃO é escolhido pelo vendedor: é sempre
 * o do Google, pela regra de escolherQueFica — "o que vai ficar é sempre o
 * contato do google". Deixar essa escolha na mão de quem clica abriria a
 * porta para o erro que a regra existe para evitar.
 */
export async function unirContatos(ids: string[]): Promise<{ ok: boolean; erro?: string; ficaId?: string; ficaNome?: string; unidos?: number }> {
  const unicos = Array.from(new Set(ids)).filter(Boolean);
  if (unicos.length < 2) return { ok: false, erro: "Selecione ao menos um outro contato para unir." };

  const cs = await db.cliente.findMany({
    where: { id: { in: unicos } },
    select: { id: true, nome: true, telefone: true, googleContatoId: true, googleSincronizadoEm: true, criadoEm: true },
  });
  if (cs.length !== unicos.length) return { ok: false, erro: "Algum contato não foi encontrado." };

  const fica = escolherQueFica(cs as ContatoParaUnir[]);
  if (!fica) return { ok: false, erro: "Não deu para decidir qual cadastro fica." };

  const r = await mesclarClientes(fica.id, unicos.filter((id) => id !== fica.id));
  if (!r.ok) return { ok: false, erro: r.erro };

  for (const p of ["/clientes", "/atendimento", "/negociacoes", "/orientador", "/dashboard", "/visitas"]) revalidatePath(p);
  return { ok: true, ficaId: fica.id, ficaNome: fica.nome, unidos: unicos.length };
}
