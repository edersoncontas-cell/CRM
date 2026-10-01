"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { limparContatosIndesejados, liberarLapide, clientesComHistorico, type ResultadoLimpeza } from "@/lib/contatos-bloqueados";
import { podeApagarNaLimpeza } from "@/lib/limpeza-protecao";
import { listarFiltroContatos, adicionarPalavraFiltro, removerPalavraFiltro, definirFiltroContatos, type ListaFiltro } from "@/lib/filtro-contatos";
import { interpretarComandoFiltro, type MudancaFiltro } from "@/lib/filtro-contatos-ia";
import { motivoBloqueioComListas, palavraCurtaDemais } from "@/lib/utils";
import { registrarAudit } from "@/lib/audit";

export type ListasFiltro = ListaFiltro;

const PAGINAS = ["/clientes", "/atendimento", "/orientador", "/dashboard", "/configuracoes", "/financeiro"];

export async function limparContatosIndesejadosAction(): Promise<ResultadoLimpeza> {
  const r = await limparContatosIndesejados();
  await registrarAudit({
    acao: "cliente_atualizado", origem: "usuario",
    descricao: `Limpeza de contatos que não são clientes: ${r.clientes} cliente(s), ${r.conversas} conversa(s) e ${r.mensagens} mensagem(ns) apagados; ${r.bloqueados} telefone(s) bloqueado(s)${r.totalPoupados ? `; ${r.totalPoupados} poupado(s) por ter negociação, visita ou compra` : ""}.`,
  }).catch(() => {});
  for (const p of PAGINAS) revalidatePath(p);
  return r;
}

/**
 * Libera um contato excluído: tira a lápide e ele volta a poder entrar.
 *
 * A exclusão é definitiva de propósito — é o que o vendedor pediu. Mas
 * definitiva não pode querer dizer sem volta: excluir o cadastro errado é
 * um clique, e sem esta saída o contato ficaria barrado para sempre sem
 * nenhum lugar onde desfazer.
 */
export async function liberarLapideAction(id: string): Promise<{ ok: boolean }> {
  const r = await liberarLapide(id);
  if (r.ok) {
    await registrarAudit({ acao: "cliente_atualizado", origem: "usuario", descricao: `Contato "${r.nome ?? "(sem nome)"}" liberado: volta a entrar pela sincronização do Google.` }).catch(() => {});
    for (const p of PAGINAS) revalidatePath(p);
  }
  return { ok: r.ok };
}

export async function adicionarPalavraFiltroAction(valor: string): Promise<ListasFiltro> {
  // O card já recusa com aviso; aqui é a defesa: palavra curta demais o filtro
  // ignora, e na lista ela ficaria parecendo que filtra.
  if (palavraCurtaDemais(valor)) return listarFiltroContatos();
  const listas = await adicionarPalavraFiltro(valor);
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: `Filtro de contatos: "${valor.trim().toLowerCase()}" adicionado.` }).catch(() => {});
  revalidatePath("/configuracoes");
  return listas;
}

export async function removerPalavraFiltroAction(valor: string): Promise<ListasFiltro> {
  const listas = await removerPalavraFiltro(valor);
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: `Filtro de contatos: "${valor.trim().toLowerCase()}" removido.` }).catch(() => {});
  revalidatePath("/configuracoes");
  return listas;
}

// Quantos clientes/conversas que já estão no CRM cairiam com estas regras
// novas — para o assistente avisar ANTES de a limpeza (horária ou o botão)
// apagar de verdade. Nunca apaga nada aqui.
async function previaImpacto(novas: MudancaFiltro[]): Promise<{ clientes: number; conversas: number }> {
  if (!novas.length) return { clientes: 0, conversas: 0 };
  const palavras = novas.map((m) => m.valor);
  const bate = (nome: string | null) => !!nome && motivoBloqueioComListas(nome, [], palavras) !== null;
  const [clientes, conversas, comHistorico] = await Promise.all([
    db.cliente.findMany({ select: { id: true, nome: true } }),
    db.whatsAppConversation.findMany({ where: { isGroup: false }, select: { contactName: true, clienteId: true } }),
    clientesComHistorico(),
  ]);
  // Mesma regra da limpeza: quem tem negociação/visita/compra não cai por termo.
  const caem = clientes.filter((c) => bate(c.nome) && podeApagarNaLimpeza({ temHistorico: comHistorico.has(c.id), motivo: motivoBloqueioComListas(c.nome, [], palavras) }));
  return {
    clientes: caem.length,
    conversas: conversas.filter((c) => bate(c.contactName) && !(c.clienteId && comHistorico.has(c.clienteId))).length,
  };
}

export type RespostaAssistenteFiltro = {
  resposta: string;
  adicionados: MudancaFiltro[];
  removidos: MudancaFiltro[];
  impacto: { clientes: number; conversas: number };
  listas: ListasFiltro;
};

// O "assistente de configuração": entende o pedido, aplica na hora (adicionar/
// remover) e devolve o que mudou + o que isso vai apagar na próxima limpeza.
export async function assistenteFiltroAction(comando: string): Promise<RespostaAssistenteFiltro> {
  const texto = comando.trim().slice(0, 500);
  const atual = await listarFiltroContatos();
  if (!texto) return { resposta: "", adicionados: [], removidos: [], impacto: { clientes: 0, conversas: 0 }, listas: atual };

  const plano = await interpretarComandoFiltro(texto, atual);
  let listas = atual;
  if (plano.adicionar.length || plano.remover.length) {
    const palavras = new Set(atual.palavras);
    for (const m of plano.remover) palavras.delete(m.valor);
    for (const m of plano.adicionar) palavras.add(m.valor);
    listas = await definirFiltroContatos([...palavras]);
    await registrarAudit({
      acao: "perfil_atualizado", origem: "usuario",
      descricao: `Assistente do filtro de contatos ("${texto}"): +${plano.adicionar.map((m) => m.valor).join(", ") || "—"} / −${plano.remover.map((m) => m.valor).join(", ") || "—"}.`,
    }).catch(() => {});
    revalidatePath("/configuracoes");
  }
  const impacto = await previaImpacto(plano.adicionar).catch(() => ({ clientes: 0, conversas: 0 }));
  return { resposta: plano.resposta, adicionados: plano.adicionar, removidos: plano.remover, impacto, listas };
}
