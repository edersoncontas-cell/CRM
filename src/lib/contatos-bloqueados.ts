// Contatos que não são clientes (contabilidade, bancos, financeiras, hotéis,
// restaurantes… — ver TERMOS/PALAVRAS_BLOQUEIO em lib/utils.ts):
//   - limparContatosIndesejados(): apaga do CRM tudo que bater com a regra —
//     cliente (com negociações, visitas, alertas, frota, análises), conversas
//     do WhatsApp (com as mensagens) e a auditoria ligada — e guarda o
//     telefone em ContatoBloqueado para nunca mais entrar. Roda na manutenção,
//     a cada hora (cron do Google Contatos) e pelo botão em Configurações.
//   - telefoneBloqueado()/bloquearContato(): usados na chegada de mensagens.

import { db } from "@/lib/db";
import { listarFiltroContatos } from "@/lib/filtro-contatos";
import { motivoBloqueioComListas, MOTIVO_EXCLUIDO_MANUAL } from "@/lib/utils";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { chaveNome, lapidesVazias, type Lapides } from "@/lib/google-contatos-util";
import { podeApagarNaLimpeza, decisaoDoVendedor } from "@/lib/limpeza-protecao";

export type ResultadoLimpeza = {
  clientes: number; conversas: number; mensagens: number; bloqueados: number;
  // Bateram com a lista, mas têm negociação, visita, pós-venda ou compra:
  // ficaram (lib/limpeza-protecao.ts). Até 50 nomes, para a tela mostrar.
  poupados: { nome: string; motivo: string }[];
  totalPoupados: number;
};

/** Clientes com vida comercial no CRM — a limpeza automática não os apaga. */
export async function clientesComHistorico(): Promise<Set<string>> {
  const [negs, visitas, posVenda, compraram] = await Promise.all([
    db.negociacao.findMany({ select: { clienteId: true }, distinct: ["clienteId"] }),
    db.visita.findMany({ select: { clienteId: true }, distinct: ["clienteId"] }),
    db.posVendaContato.findMany({ select: { clienteId: true }, distinct: ["clienteId"] }),
    db.cliente.findMany({ where: { jaComprou: true }, select: { id: true } }),
  ]);
  return new Set([...negs, ...visitas, ...posVenda].map((x) => x.clienteId).concat(compraram.map((c) => c.id)));
}

const digitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");

export async function telefoneBloqueado(telefone: string): Promise<boolean> {
  const variantes = phoneLookupVariants(telefone);
  if (!variantes.length) return false;
  const b = await db.contatoBloqueado.findFirst({ where: { telefone: { in: variantes } }, select: { id: true } });
  return !!b;
}

export async function bloquearContato(telefone: string, nome: string | null, motivo: string | null): Promise<void> {
  await gravarLapide({ telefone, nome, motivo });
}

// Clientes que voltaram pelo "Desfazer" de uma limpeza por lista de bloqueio:
// a limpeza automática (que roda de hora em hora) não os apaga de novo por
// termo — senão o desfazer duraria até a rodada seguinte.
export const CHAVE_EXCECOES_LIMPEZA = "limpeza.bloqueio.excecoes";
export async function lerExcecoesLimpeza(): Promise<Set<string>> {
  try {
    const c = await db.configuracao.findUnique({ where: { chave: CHAVE_EXCECOES_LIMPEZA } });
    return new Set(c?.valor ? (JSON.parse(c.valor) as string[]) : []);
  } catch {
    return new Set();
  }
}
export async function adicionarExcecoesLimpeza(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const atuais = await lerExcecoesLimpeza();
  for (const id of ids) atuais.add(id);
  const valor = JSON.stringify([...atuais].slice(-2000));
  await db.configuracao.upsert({ where: { chave: CHAVE_EXCECOES_LIMPEZA }, update: { valor }, create: { chave: CHAVE_EXCECOES_LIMPEZA, valor } });
}

/**
 * Grava a lápide do contato: o registro de que ele NÃO pode voltar.
 *
 * Três chaves, e cada uma fecha um caminho de volta — o telefone, o id no
 * Google e o nome normalizado. Grava todas as que existirem: o contato sem
 * número só tem o nome (e talvez o id), e é justamente ele que a lista
 * antiga, só de telefone, não conseguia segurar.
 *
 * Procura por qualquer uma das chaves antes de criar, porque as três são
 * únicas no banco: criar sem olhar quebraria com violação de unicidade
 * quando o mesmo contato já tivesse sido barrado por outro caminho.
 */
export async function gravarLapide(dados: {
  telefone?: string | null;
  nome?: string | null;
  googleContatoId?: string | null;
  motivo?: string | null;
}): Promise<string | null> {
  // Devolve o id da lápide quando ELA FOI CRIADA agora (null se já existia):
  // é o que o recibo da limpeza precisa para desfazer só o que ela fez.
  const t = digitos(dados.telefone) || null;
  const chave = dados.nome ? chaveNome(dados.nome) : null;
  const gid = dados.googleContatoId?.trim() || null;
  // Sem nenhuma chave não há lápide possível — e uma linha em branco só
  // sujaria a lista que o vendedor vê em Configurações.
  if (!t && !chave && !gid) return null;

  const ou = [
    ...(t ? [{ telefone: { in: phoneLookupVariants(t) } }] : []),
    ...(chave ? [{ chaveNome: chave }] : []),
    ...(gid ? [{ googleContatoId: gid }] : []),
  ];
  const existente = await db.contatoBloqueado.findFirst({ where: { OR: ou }, select: { id: true } });

  const campos = {
    nome: dados.nome ?? undefined,
    motivo: dados.motivo ?? undefined,
    // As chaves só são preenchidas, nunca apagadas: uma lápide que já sabe o
    // telefone não pode perdê-lo porque desta vez veio só o nome.
    ...(t ? { telefone: t } : {}),
    ...(chave ? { chaveNome: chave } : {}),
    ...(gid ? { googleContatoId: gid } : {}),
  };

  try {
    if (existente) {
      await db.contatoBloqueado.update({ where: { id: existente.id }, data: campos });
      return null;
    }
    const nova = await db.contatoBloqueado.create({ data: { nome: dados.nome ?? null, motivo: dados.motivo ?? null, telefone: t, chaveNome: chave, googleContatoId: gid } });
    return nova.id;
  } catch (e) {
    // Corrida entre duas rodadas gravando o mesmo contato: a segunda perde a
    // unicidade e não tem o que fazer — a lápide já existe, que é o que
    // importa.
    console.error("[contatos-bloqueados] gravarLapide:", e);
    return null;
  }
}

/**
 * Exclui um cadastro do CRM E grava a lápide, numa coisa só.
 *
 * É a diferença entre "apagar" e "excluir para sempre": apagar só tira da
 * tela, e a sincronização seguinte traz de volta. Devolve o nome para a tela
 * poder dizer o que saiu.
 */
export async function excluirClienteDefinitivo(clienteId: string, motivo = MOTIVO_EXCLUIDO_MANUAL): Promise<{ ok: boolean; nome?: string }> {
  const c = await db.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true, telefone: true, googleContatoId: true } });
  if (!c) return { ok: false };
  await gravarLapide({ telefone: c.telefone, nome: c.nome, googleContatoId: c.googleContatoId, motivo });
  // A conversa do WhatsApp vai junto: deixar a conversa órfã faria o contato
  // reaparecer na lista de Atendimento como se nada tivesse acontecido.
  if (c.telefone) await apagarContatoPorTelefone(c.telefone);
  await db.auditLog.deleteMany({ where: { clienteId } });
  await db.tarefaKanban.deleteMany({ where: { clienteId } });
  await db.alertaOculto.deleteMany({ where: { clienteId } });
  await db.cliente.delete({ where: { id: clienteId } }).catch(() => {});
  return { ok: true, nome: c.nome };
}

// Desfaz o bloqueio de um telefone — só quando o motivo bate com o informado
// (ex.: o vendedor tirou o asterisco do nome na agenda do celular). Devolve
// true se havia mesmo um bloqueio daquele motivo.
export async function desbloquearContato(telefone: string, motivo: string): Promise<boolean> {
  const variantes = phoneLookupVariants(telefone);
  if (!variantes.length) return false;
  const r = await db.contatoBloqueado.deleteMany({ where: { telefone: { in: variantes }, motivo } });
  return r.count > 0;
}

// Apaga só o que está ligado a UM telefone (usado na chegada de mensagem de
// contato bloqueado — barato, sem varrer o banco inteiro).
export async function apagarContatoPorTelefone(telefone: string): Promise<void> {
  const variantes = phoneLookupVariants(telefone);
  if (!variantes.length) return;
  const clientes = await db.cliente.findMany({ where: { telefone: { in: variantes } }, select: { id: true } });
  const ids = clientes.map((c) => c.id);
  const conversas = await db.whatsAppConversation.findMany({ where: { OR: [{ externalPhone: { in: variantes } }, ...(ids.length ? [{ clienteId: { in: ids } }] : [])] }, select: { id: true } });
  if (conversas.length) await db.whatsAppConversation.deleteMany({ where: { id: { in: conversas.map((c) => c.id) } } });
  if (ids.length) {
    await db.auditLog.deleteMany({ where: { clienteId: { in: ids } } });
    await db.tarefaKanban.deleteMany({ where: { clienteId: { in: ids } } });
    await db.alertaOculto.deleteMany({ where: { clienteId: { in: ids } } });
    await db.cliente.deleteMany({ where: { id: { in: ids } } });
  }
}

export async function listarTelefonesBloqueados(): Promise<Set<string>> {
  return (await listarLapides()).telefones;
}

/**
 * As lápides, prontas para a sincronização consultar: telefones (em todas as
 * variantes), nomes normalizados e ids do Google. Uma leitura só, porque a
 * sincronização precisa disto uma vez por rodada e compara contra centenas
 * de contatos.
 */
export async function listarLapides(): Promise<Lapides> {
  const rows = await db.contatoBloqueado.findMany({ select: { telefone: true, chaveNome: true, googleContatoId: true } });
  const l = lapidesVazias();
  for (const r of rows) {
    if (r.telefone) for (const v of phoneLookupVariants(r.telefone)) l.telefones.add(v);
    if (r.chaveNome) l.nomes.add(r.chaveNome);
    if (r.googleContatoId) l.googleIds.add(r.googleContatoId);
  }
  return l;
}

// Apaga do CRM todo cliente/conversa cujo nome bate com a regra de bloqueio
// (ou cujo telefone já está bloqueado). Idempotente; nunca lança.
export async function limparContatosIndesejados(): Promise<ResultadoLimpeza> {
  const r: ResultadoLimpeza = { clientes: 0, conversas: 0, mensagens: 0, bloqueados: 0, poupados: [], totalPoupados: 0 };
  try {
    const [clientes, conversas, bloqueadosAntes, listas, comHistorico, lapidesManuais, excecoes] = await Promise.all([
      db.cliente.findMany({ select: { id: true, nome: true, telefone: true } }),
      db.whatsAppConversation.findMany({ where: { isGroup: false }, select: { id: true, contactName: true, externalPhone: true, clienteId: true } }),
      listarTelefonesBloqueados(),
      listarFiltroContatos(),
      clientesComHistorico(),
      db.contatoBloqueado.findMany({ where: { telefone: { not: null } }, select: { telefone: true, motivo: true } }),
      lerExcecoesLimpeza(),
    ]);
    // Quem voltou pelo "Desfazer" conta como protegido, igual a quem tem histórico.
    const protegido = (id: string) => comHistorico.has(id) || excecoes.has(id);
    const lapidesCriadas: string[] = [];
    // Telefones barrados por decisão DELE (excluiu à mão, ou asterisco): esses
    // saem mesmo com histórico. Os barrados por termo da lista, não.
    const telefonesDecididos = new Set<string>();
    for (const l of lapidesManuais) if (l.telefone && decisaoDoVendedor(l.motivo)) for (const v of phoneLookupVariants(l.telefone)) telefonesDecididos.add(v);
    const poupados = new Set<string>();
    const poupar = (c: { id: string; nome: string }, motivoTexto: string) => {
      if (poupados.has(c.id)) return;
      poupados.add(c.id);
      r.totalPoupados++;
      if (r.poupados.length < 50) r.poupados.push({ nome: c.nome, motivo: motivoTexto });
    };
    // Listas carregadas UMA vez e aplicadas com a função pura — a varredura
    // percorre todos os clientes/conversas, não dá para consultar por item.
    const motivo = (nome: string) => motivoBloqueioComListas(nome, [], listas.palavras);

    const telefonesAlvo = new Set<string>(bloqueadosAntes);
    // O MESMO buraco do telefone aparecia aqui: sem número, o contato era
    // apagado e NÃO entrava na lista — então a sincronização seguinte o
    // recriava, e a limpeza o apagava de novo, para sempre. Agora a lápide
    // aceita o nome sozinho, e contato de empresa sem número também fica
    // barrado de verdade.
    const nomesAlvo = new Set<string>();
    const marcar = async (telefone: string | null, nome: string | null) => {
      const t = digitos(telefone);
      const chave = nome ? chaveNome(nome) : null;
      if (t && telefonesAlvo.has(t)) return;
      if (!t && (!chave || nomesAlvo.has(chave))) return;
      if (t) for (const v of phoneLookupVariants(t)) telefonesAlvo.add(v);
      if (chave) nomesAlvo.add(chave);
      const nova = await gravarLapide({ telefone: t || null, nome, motivo: nome ? motivo(nome) : null });
      if (nova) lapidesCriadas.push(nova);
      r.bloqueados++;
    };

    // 1) Clientes com nome bloqueado → telefone vai para a lista. Quem tem
    //    negociação, visita, pós-venda ou compra FICA (limpeza-protecao.ts),
    //    e não ganha lápide: a lista acertou o nome, mas não a pessoa.
    const clientesAlvo = clientes.filter((c) => {
      const m = motivo(c.nome);
      if (m === null) return false;
      if (podeApagarNaLimpeza({ temHistorico: protegido(c.id), motivo: m })) return true;
      poupar(c, excecoes.has(c.id) ? `nome bate com "${m}" — você desfez a limpeza dele` : `nome bate com "${m}"`);
      return false;
    });
    for (const c of clientesAlvo) await marcar(c.telefone, c.nome);
    // 2) Conversas com nome bloqueado → idem (menos as de cliente poupado).
    const conversasNome = conversas.filter((c) => c.contactName && motivo(c.contactName) !== null && !(c.clienteId && poupados.has(c.clienteId)));
    for (const c of conversasNome) await marcar(c.externalPhone, c.contactName);

    // 3) Tudo que tem telefone bloqueado também cai (mesmo com nome genérico)
    //    — menos quem tem histórico e foi barrado por termo, não por decisão dele.
    const idsClientes = new Set(clientesAlvo.map((c) => c.id));
    for (const c of clientes) {
      if (idsClientes.has(c.id) || !c.telefone) continue;
      const variantes = phoneLookupVariants(c.telefone);
      if (!variantes.some((v) => telefonesAlvo.has(v))) continue;
      const decidido = variantes.some((v) => telefonesDecididos.has(v));
      if (!protegido(c.id) || decidido) idsClientes.add(c.id);
      else poupar(c, "telefone na lista de bloqueio");
    }
    const idsConversas = new Set(conversasNome.map((c) => c.id));
    for (const c of conversas) {
      if (c.clienteId && poupados.has(c.clienteId)) continue;
      if (phoneLookupVariants(c.externalPhone).some((v) => telefonesAlvo.has(v))) idsConversas.add(c.id);
      if (c.clienteId && idsClientes.has(c.clienteId)) idsConversas.add(c.id);
    }

    // O recibo, ANTES de apagar: é dele que sai o "Desfazer" (Configurações →
    // limpezas, lib/clientes-lixo.ts). Cadastros, conversas, mensagens e as
    // lápides que esta rodada criou.
    const recibo = idsClientes.size || idsConversas.size
      ? {
          apagados: await db.cliente.findMany({ where: { id: { in: [...idsClientes] } } }),
          alterados: [] as never[],
          conversas: await db.whatsAppConversation.findMany({ where: { id: { in: [...idsConversas] } } }),
          mensagens: await db.whatsAppMessage.findMany({ where: { conversationId: { in: [...idsConversas] } } }),
          lapides: lapidesCriadas,
        }
      : null;

    if (idsConversas.size) {
      const ids = [...idsConversas];
      r.mensagens = (await db.whatsAppMessage.deleteMany({ where: { conversationId: { in: ids } } })).count;
      r.conversas = (await db.whatsAppConversation.deleteMany({ where: { id: { in: ids } } })).count;
    }
    if (idsClientes.size) {
      const ids = [...idsClientes];
      await db.auditLog.deleteMany({ where: { clienteId: { in: ids } } });
      await db.tarefaKanban.deleteMany({ where: { clienteId: { in: ids } } });
      await db.alertaOculto.deleteMany({ where: { clienteId: { in: ids } } });
      // Negociações, visitas, alertas, frota, análises e pós-venda caem em cascata.
      r.clientes = (await db.cliente.deleteMany({ where: { id: { in: ids } } })).count;
    }
    if (recibo && (r.clientes || r.conversas)) {
      await db.limpezaClientes.create({
        data: {
          origem: "bloqueio",
          resumo: `Lista de bloqueio: ${r.clientes} cadastro(s), ${r.conversas} conversa(s) e ${r.mensagens} mensagem(ns) apagados`,
          dados: JSON.stringify(recibo),
        },
      }).catch((e) => console.error("[contatos-bloqueados] recibo:", e));
    }
  } catch (e) {
    console.error("[contatos-bloqueados] limpeza:", e);
  }
  return r;
}

export async function resumoBloqueio(): Promise<{ total: number; recentes: { id: string; nome: string | null; telefone: string | null; motivo: string | null; criadoEm: Date }[] }> {
  const [total, recentes] = await Promise.all([
    db.contatoBloqueado.count(),
    db.contatoBloqueado.findMany({ orderBy: { criadoEm: "desc" }, take: 8, select: { id: true, nome: true, telefone: true, motivo: true, criadoEm: true } }),
  ]);
  return { total, recentes };
}

/**
 * Tira a lápide: o contato volta a poder entrar no CRM.
 *
 * É a saída para o engano — excluir o cadastro errado, ou mudar de ideia. Sem
 * isto a exclusão seria uma porta de mão única, e a regra "nunca mais volta"
 * viraria uma armadilha em vez de uma comodidade.
 */
export async function liberarLapide(id: string): Promise<{ ok: boolean; nome?: string | null }> {
  const r = await db.contatoBloqueado.findUnique({ where: { id }, select: { nome: true } });
  if (!r) return { ok: false };
  await db.contatoBloqueado.delete({ where: { id } });
  return { ok: true, nome: r.nome };
}
