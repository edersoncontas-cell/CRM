// NÚMEROS DO PILOTO — a contagem no banco. A régua (o que conta como resposta,
// como conversa de venda, como esfriando) mora em lib/piloto-regra.ts.
//
// Tudo por consulta do Prisma, sem SQL cru: quando o multiusuário entrar, o
// filtro por vendedor vale aqui sozinho, e o piloto mede cada um.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";
import { diaBrasilia } from "@/lib/envio-limites";
import { criarCategorizadorColunas, ehFunilAberto, chaveMotivoPerda } from "@/lib/pipeline";
import { telefonesApagadosPeloVendedor, foiApagadoPeloVendedor } from "@/lib/whatsapp-corte";
import { nomeDaConversa } from "@/lib/conversa-identidade";
import {
  esperasDaConversa, resumirRespostas, ehConversaDeVenda, negociacaoValeNoPeriodo, estaEsfriando,
  CHAVE_HISTORICO_ESFRIANDO, lerHistoricoEsfriando, anotarDia, primeiraAnotacaoDesde,
  type Espera, type ResumoRespostas,
} from "@/lib/piloto-regra";

const DIA = 86_400_000;
// Uma espera que começou antes do período precisa da mensagem de antes para
// ser reconhecida como "já estava esperando" — e não contar como nova.
const OLHAR_ANTES_DIAS = 30;
// Teto de mensagens lidas numa conta. Um vendedor troca algumas centenas por
// dia; 60 mil cobrem os 90 dias com folga. Passou disso, a tela avisa.
const TETO_MENSAGENS = 60_000;
const TETO_LISTA = 60;

export type ItemConversa = {
  id: string;
  nome: string;
  category: string | null;
  ultimaDoCliente: string; // ISO
  temCadastro: boolean;
};

export type ItemNegociacaoIA = {
  id: string;
  clienteId: string;
  cliente: string;
  maquina: string | null;
  valor: number | null;
  status: string; // aberta | ganha | perdida
  abertaEm: string; // ISO
};

export type NumerosPiloto = {
  dias: number;
  inicio: string;
  fim: string;
  respostas: ResumoRespostas;
  esperando: { conversaId: string; nome: string; desde: string }[];
  mensagensTruncadas: boolean;
  ia: {
    total: number;
    somaValor: number;
    semValor: number;
    abertas: number;
    ganhas: number;
    perdidas: number;
    apagadas: number;
    lista: ItemNegociacaoIA[];
  };
  conversas: {
    venda: number;
    comNegociacao: number;
    semCadastro: number;
    semNegociacao: ItemConversa[];
    foraDaConta: {
      total: number;
      outro: number;
      semClassificacao: number;
      /** Tiradas da conta à mão ("Não é venda"). Tirar conversa sobe a porcentagem — a diretoria tem de ver quantas. */
      marcadasAMao: number;
      lista: ItemConversa[];
    };
  };
  criterios: {
    perdidas: number;
    perdidasSemMotivo: number;
    esfriandoHoje: number;
    esfriandoInicio: { dia: string; n: number } | null;
    anotadoDesde: string | null;
  };
};

// Negociação órfã (aberta numa coluna que foi renomeada ou apagada) não
// aparece no funil: ele não teria nem como achar o card. Não conta como
// esfriando nem como "conversa registrada" — a mesma regra do Como você vende.
async function categorizadorDoFunil() {
  return criarCategorizadorColunas(await db.colunaFunil.findMany({ select: { titulo: true, papel: true, probabilidade: true } }));
}

/** Conta quantas negociações estão esfriando AGORA (aberta, no funil, 10+ dias sem contato). */
export async function contarEsfriando(agora: Date = new Date()): Promise<number> {
  const [categorizar, abertas] = await Promise.all([
    categorizadorDoFunil(),
    db.negociacao.findMany({ where: { status: "aberta" }, select: { estagio: true, status: true, ultimoContato: true, atualizadoEm: true } }),
  ]);
  return abertas.filter((n) => ehFunilAberto(categorizar(n.estagio)) && estaEsfriando(n, agora)).length;
}

/**
 * Anota a contagem de hoje, uma vez por dia. É o "antes" do critério 2, que
 * não dá para reconstruir depois. Barato: uma leitura por chamada, e a conta
 * e a escrita só quando o dia ainda não foi anotado.
 */
export async function anotarEsfriandoDoDia(agora: Date = new Date(), contagem?: number): Promise<Record<string, number>> {
  const historico = lerHistoricoEsfriando(await getConfig(CHAVE_HISTORICO_ESFRIANDO));
  const hoje = diaBrasilia(agora);
  if (historico[hoje] !== undefined) return historico;
  const novo = anotarDia(historico, hoje, contagem ?? (await contarEsfriando(agora)));
  await setConfig(CHAVE_HISTORICO_ESFRIANDO, JSON.stringify(novo));
  return novo;
}

export async function calcularNumerosPiloto(dias: number, agora: Date = new Date()): Promise<NumerosPiloto> {
  const fim = agora;
  const inicio = new Date(agora.getTime() - dias * DIA);

  // ── Conversas com mensagem do cliente no período ──
  const convs = await db.whatsAppConversation.findMany({
    where: {
      isGroup: false,
      messages: { some: { direction: "IN", isDraft: false, sentAt: { gte: inicio, lte: fim } } },
    },
    select: { id: true, externalPhone: true, contactName: true, category: true, categoryConfirmed: true, clienteId: true, encerrada: true },
  });

  const clienteIds = Array.from(new Set(convs.map((c) => c.clienteId).filter((id): id is string => !!id)));
  const [clientes, negociacoes, apagados, categorizar] = await Promise.all([
    clienteIds.length ? db.cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nome: true } }) : [],
    clienteIds.length
      ? db.negociacao.findMany({
          where: { clienteId: { in: clienteIds } },
          select: { clienteId: true, status: true, estagio: true, criadoEm: true, atualizadoEm: true, negociacaoAntiga: true },
        })
      : [],
    telefonesApagadosPeloVendedor().catch(() => new Set<string>()),
    categorizadorDoFunil(),
  ]);
  const visivel = (n: (typeof negociacoes)[number]) => n.status !== "aberta" || ehFunilAberto(categorizar(n.estagio));
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));
  const negsDoCliente = new Map<string, typeof negociacoes>();
  for (const n of negociacoes) {
    const lista = negsDoCliente.get(n.clienteId) ?? [];
    lista.push(n);
    negsDoCliente.set(n.clienteId, lista);
  }
  const temAberta = (clienteId: string | null) => !!clienteId && (negsDoCliente.get(clienteId) ?? []).some((n) => n.status === "aberta" && visivel(n));

  // Conversa que ele APAGOU à mão não era negócio — não volta para a conta só
  // porque o contato mandou "bom dia" depois. Exceção: negociação aberta
  // (a mesma regra do relatório de conversas).
  const validas = convs.filter((c) => !foiApagadoPeloVendedor(c.externalPhone, apagados) || temAberta(c.clienteId));
  const venda = validas.filter((c) => ehConversaDeVenda(c.category));
  const fora = validas.filter((c) => !ehConversaDeVenda(c.category));

  const nome = (c: (typeof convs)[number]) =>
    nomeDaConversa({
      isGroup: false, groupName: null, contactName: c.contactName, externalPhone: c.externalPhone,
      clienteNome: c.clienteId ? nomeCliente.get(c.clienteId) ?? null : null,
    });

  // ── Mensagens das conversas de venda ──
  const vendaIds = venda.map((c) => c.id);
  const [mensagens, primeiras, ultimasDoCliente] = await Promise.all([
    vendaIds.length
      ? db.whatsAppMessage.findMany({
          where: { conversationId: { in: vendaIds }, isDraft: false, sentAt: { gte: new Date(inicio.getTime() - OLHAR_ANTES_DIAS * DIA) } },
          select: {
            conversationId: true, direction: true, sentAt: true, operatorDisplayName: true, sendStatus: true,
            body: true, mediaType: true, retryCount: true, lastRetryAt: true,
          },
          orderBy: { sentAt: "asc" },
          take: TETO_MENSAGENS,
        })
      : Promise.resolve([]),
    vendaIds.length
      ? db.whatsAppMessage.groupBy({ by: ["conversationId"], where: { conversationId: { in: vendaIds }, isDraft: false }, _min: { sentAt: true } })
      : Promise.resolve([]),
    validas.length
      ? db.whatsAppMessage.groupBy({
          by: ["conversationId"],
          where: { conversationId: { in: validas.map((c) => c.id) }, direction: "IN", isDraft: false, sentAt: { gte: inicio, lte: fim } },
          _max: { sentAt: true },
        })
      : Promise.resolve([]),
  ]);

  const inicioDaConversa = new Map(primeiras.map((p) => [p.conversationId, p._min.sentAt]));
  const ultimaIn = new Map(ultimasDoCliente.map((u) => [u.conversationId, u._max.sentAt]));
  const porConversa = new Map<string, typeof mensagens>();
  for (const m of mensagens) {
    const lista = porConversa.get(m.conversationId) ?? [];
    lista.push(m);
    porConversa.set(m.conversationId, lista);
  }

  const todasEsperas: Espera[] = [];
  const esperando: NumerosPiloto["esperando"] = [];
  for (const c of venda) {
    const esperas = esperasDaConversa(porConversa.get(c.id) ?? [], {
      inicioDaConversa: inicioDaConversa.get(c.id) ?? null,
      encerrada: c.encerrada,
    });
    todasEsperas.push(...esperas);
    const ultima = esperas[esperas.length - 1];
    if (ultima && !ultima.respondida && !ultima.dispensada && ultima.chegou >= inicio) {
      esperando.push({ conversaId: c.id, nome: nome(c), desde: ultima.chegou.toISOString() });
    }
  }
  esperando.sort((a, b) => b.desde.localeCompare(a.desde));

  // ── Conversas de venda × negociação ──
  const semNegociacao: ItemConversa[] = [];
  let comNegociacao = 0;
  let semCadastro = 0;
  const item = (c: (typeof convs)[number]): ItemConversa => ({
    id: c.id,
    nome: nome(c),
    category: c.category,
    ultimaDoCliente: (ultimaIn.get(c.id) ?? fim).toISOString(),
    temCadastro: !!c.clienteId,
  });
  for (const c of venda) {
    const negs = c.clienteId ? negsDoCliente.get(c.clienteId) ?? [] : [];
    if (negs.some((n) => visivel(n) && negociacaoValeNoPeriodo(n, inicio, fim))) comNegociacao++;
    else {
      if (!c.clienteId) semCadastro++;
      semNegociacao.push(item(c));
    }
  }
  const maisRecente = (a: ItemConversa, b: ItemConversa) => b.ultimaDoCliente.localeCompare(a.ultimaDoCliente);
  semNegociacao.sort(maisRecente);
  const listaFora = fora.map(item).sort(maisRecente);

  // ── Negociações que a IA abriu sozinha ──
  // O registro é a auditoria do pipeline do ZEUS (lib/zeus/pipeline.ts): a
  // negociação em si não guarda quem a criou. O Cérebro também cria, mas a
  // pedido dele — isso não é "a IA abriu sozinha" e não entra.
  const registros = await db.auditLog.findMany({
    where: { acao: "negociacao_criada", origem: "zeus", criadoEm: { gte: inicio, lte: fim } },
    select: { entidadeId: true, criadoEm: true },
    orderBy: { criadoEm: "desc" },
  });
  const idsIA = Array.from(new Set(registros.map((r) => r.entidadeId).filter((id): id is string => !!id)));
  const negsIA = idsIA.length
    ? await db.negociacao.findMany({
        where: { id: { in: idsIA } },
        select: { id: true, clienteId: true, maquinaModelo: true, valor: true, status: true, cliente: { select: { nome: true } } },
      })
    : [];
  const negIAPorId = new Map(negsIA.map((n) => [n.id, n]));
  const abertaEm = new Map<string, Date>();
  for (const r of registros) if (r.entidadeId && !abertaEm.has(r.entidadeId)) abertaEm.set(r.entidadeId, r.criadoEm);
  const listaIA: ItemNegociacaoIA[] = idsIA
    .map((id) => negIAPorId.get(id))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => ({
      id: n.id, clienteId: n.clienteId, cliente: n.cliente.nome, maquina: n.maquinaModelo,
      valor: n.valor != null && n.valor > 0 ? n.valor : null, status: n.status,
      abertaEm: (abertaEm.get(n.id) ?? fim).toISOString(),
    }));

  // ── Critérios 1 e 2 ──
  const [perdidas, esfriandoHoje] = await Promise.all([
    db.negociacao.findMany({ where: { status: "perdida", atualizadoEm: { gte: inicio, lte: fim } }, select: { motivoPerda: true } }),
    contarEsfriando(agora),
  ]);
  // Anotar é o que dá o "antes" daqui a 60 dias; se a escrita falhar, a conta
  // de hoje continua valendo na tela — só não fica guardada.
  const historico = await anotarEsfriandoDoDia(agora, esfriandoHoje).catch(() => ({}) as Record<string, number>);
  const diasAnotados = Object.keys(historico).sort();
  const hoje = diaBrasilia(agora);
  const anotacaoInicio = primeiraAnotacaoDesde(historico, diaBrasilia(inicio));

  return {
    dias,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    respostas: resumirRespostas(todasEsperas, inicio, fim, agora),
    esperando: esperando.slice(0, TETO_LISTA),
    mensagensTruncadas: mensagens.length >= TETO_MENSAGENS,
    ia: {
      total: idsIA.length,
      somaValor: listaIA.reduce((s, n) => s + (n.valor ?? 0), 0),
      semValor: listaIA.filter((n) => n.valor == null).length,
      abertas: listaIA.filter((n) => n.status === "aberta").length,
      ganhas: listaIA.filter((n) => n.status === "ganha").length,
      perdidas: listaIA.filter((n) => n.status === "perdida").length,
      apagadas: idsIA.length - listaIA.length,
      lista: listaIA.slice(0, TETO_LISTA),
    },
    conversas: {
      venda: venda.length,
      comNegociacao,
      semCadastro,
      semNegociacao: semNegociacao.slice(0, TETO_LISTA),
      foraDaConta: {
        total: fora.length,
        outro: fora.filter((c) => c.category).length,
        semClassificacao: fora.filter((c) => !c.category).length,
        marcadasAMao: fora.filter((c) => c.categoryConfirmed && c.category).length,
        lista: listaFora.slice(0, TETO_LISTA),
      },
    },
    criterios: {
      perdidas: perdidas.length,
      perdidasSemMotivo: perdidas.filter((n) => chaveMotivoPerda(n.motivoPerda) === "nao_informado").length,
      esfriandoHoje,
      // A anotação de hoje não é "antes": comparar hoje com hoje não diz nada.
      esfriandoInicio: anotacaoInicio && anotacaoInicio.dia !== hoje ? anotacaoInicio : null,
      anotadoDesde: diasAnotados[0] ?? null,
    },
  };
}
