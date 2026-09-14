// Cadência automática de follow-up de 7 toques (Academia de Vendas, aula
// m4a6): um prospecto que não respondeu recebe 7 contatos em 30 dias,
// alternando canais e sempre com valor novo. O vendedor inicia a cadência no
// cadastro do cliente; o ZEUS cuida do calendário:
//   - toques de WhatsApp viram RASCUNHO pendente em /atendimento (a IA escreve
//     com o contexto do cliente; sem IA, usa o modelo do nicho). Nada é
//     enviado sem revisão — mesma regra do Cérebro.
//   - toques de ligação e visita viram alerta na Central de alertas.
// A cadência encerra sozinha quando o cliente responde (webhook do WhatsApp)
// ou depois do 7º toque; o vendedor também pode encerrar a qualquer momento.

import { db } from "@/lib/db";
import { iaHabilitada } from "@/lib/ai";
import { lerParametros } from "@/lib/parametros";
import { registrarAudit } from "@/lib/audit";
import { registrarZeusEvent } from "@/lib/zeus/eventos";
import { orcamentoIADisponivel, consumirOrcamentoIA } from "@/lib/zeus/estado";
import { montarContextoCliente, gerarMensagemToqueCadencia } from "@/lib/zeus/cerebro-resposta";
import { acharOuCriarConversa, inserirMensagem } from "@/lib/whatsapp-store";
import { garantirDemandaAutomatica } from "@/lib/demandas";

const DIA = 24 * 60 * 60 * 1000;

export type CanalToque = "whatsapp" | "ligacao" | "visita";
export type TipoCadencia = "construtora" | "pedreira" | "cafe" | "prefeitura" | "locadora" | "geral";

export type Toque = {
  numero: number;
  dia: number; // dias após o início
  canal: CanalToque;
  titulo: string;
  objetivo: string; // o que este toque precisa entregar (vai para a IA e para o alerta)
};

export const TOQUES: Toque[] = [
  { numero: 1, dia: 0, canal: "whatsapp", titulo: "Primeiro contato", objetivo: "Apresentar-se com origem do contato, motivo concreto e uma pergunta fechada (sim/não) que seja fácil de responder." },
  { numero: 2, dia: 2, canal: "whatsapp", titulo: "Foto ou vídeo de máquina no mesmo nicho", objetivo: "Oferecer uma foto/vídeo de máquina trabalhando numa aplicação parecida na região e perguntar se vale 10 minutos de conversa." },
  { numero: 3, dia: 5, canal: "ligacao", titulo: "Ligação para entender a aplicação", objetivo: "Ligar para entender a aplicação e não mandar coisa errada. Se não atender, mensagem de 2 linhas." },
  { numero: 4, dia: 9, canal: "whatsapp", titulo: "Notícia ou dado do setor", objetivo: "Trazer uma notícia ou dado do setor (campanha de financiamento, obra anunciada, preço do café) ligando a ele em uma frase, e oferecer uma simulação." },
  { numero: 5, dia: 14, canal: "visita", titulo: "Visita na obra ou lavoura", objetivo: "Passar na obra/lavoura 'porque estava na região' levando um material de valor: comparativo de custo por hora ou avaliação da usada." },
  { numero: 6, dia: 21, canal: "whatsapp", titulo: "Caso de cliente parecido", objetivo: "Contar um caso de cliente parecido com um número no final (economia, horas, custo por hora) e fechar com pergunta." },
  { numero: 7, dia: 30, canal: "whatsapp", titulo: "Encerramento educado", objetivo: "Encerrar com educação: vai parar de incomodar, se virar prioridade é só chamar, e pedir permissão para mandar uma novidade a cada 2 meses." },
];

export const TIPOS_CADENCIA: { id: TipoCadencia; label: string; descricao: string }[] = [
  { id: "construtora", label: "Construtora / empreiteiro", descricao: "Obra, terraplenagem, loteamento. Fala de prazo, produtividade e custo por hora." },
  { id: "pedreira", label: "Pedreira / mineração", descricao: "Carregamento e britagem. Fala de tonelada por hora e disponibilidade." },
  { id: "cafe", label: "Cafeicultor / agro", descricao: "Lavoura, estrada de fazenda, silo. Fala de safra, terreiro e financiamento rural." },
  { id: "prefeitura", label: "Prefeitura / órgão público", descricao: "Licitação, patrulha mecanizada, convênio. Fala de prazo de entrega e assistência." },
  { id: "locadora", label: "Locadora", descricao: "Frota alugada. Fala de disponibilidade, custo de manutenção e revenda." },
  { id: "geral", label: "Geral", descricao: "Quando ainda não sabe o nicho do cliente." },
];

// Modelos de texto usados quando a IA está desligada ou sem orçamento. {nome}
// vira o primeiro nome do cliente e {vendedor} o nome do vendedor.
const MODELOS: Record<TipoCadencia, Partial<Record<number, string>>> = {
  geral: {
    1: "{nome}, aqui é {vendedor}, da {empresa}. Vi que você trabalha na região e queria entender se está precisando de máquina este ano. Posso te mandar uma condição rápida?",
    2: "{nome}, essa semana tive uma máquina trabalhando numa aplicação parecida com a sua aqui na região. Posso te mandar o vídeo? Vale 10 minutos de conversa na quinta?",
    4: "{nome}, saiu campanha de financiamento com taxa reduzida este mês. Quer que eu simule com a sua usada na entrada?",
    6: "{nome}, um cliente da região com trabalho parecido com o seu trocou a máquina no ano passado e reduziu o custo por hora em cerca de 20%. Quer que eu monte a mesma conta para o seu caso?",
    7: "{nome}, não quero ser inconveniente. Vou parar por aqui. Se em algum momento a máquina virar prioridade, me chama que eu resolvo rápido. Posso te mandar uma novidade a cada 2 meses?",
  },
  construtora: {
    1: "{nome}, aqui é {vendedor}, da {empresa}. Soube da obra de vocês na região e queria entender se a frota está dando conta do prazo. Posso te mandar uma condição de retro ou pá carregadeira?",
    2: "{nome}, essa é uma máquina nossa carregando numa obra de terraplenagem aqui perto. A aplicação é parecida com a de vocês. Vale 10 minutos na quinta?",
    6: "{nome}, uma construtora da região que alugava máquina trocou por uma própria e zerou o aluguel: o financiamento ficou menor que a diária. Quer que eu monte essa conta para a sua obra?",
  },
  pedreira: {
    1: "{nome}, aqui é {vendedor}, da {empresa}. Trabalho com pás carregadeiras e escavadeiras para pedreira aqui na região. Vocês estão com máquina parada ou pensando em renovar este ano?",
    2: "{nome}, essa é uma pá carregadeira nossa alimentando britador numa pedreira aqui do sul do estado. Posso te mandar o vídeo e a produção por hora?",
    6: "{nome}, uma pedreira da região trocou a carregadeira e ganhou disponibilidade: parou de perder turno com manutenção. Quer que eu faça a conta de custo por tonelada para vocês?",
  },
  cafe: {
    1: "{nome}, aqui é {vendedor}, da {empresa}. Atendo produtores de café aqui na região com retro e mini carregadeira para lavoura, estrada e terreiro. Tem alguma máquina em vista para esta safra?",
    2: "{nome}, essa é uma máquina nossa arrumando estrada de fazenda de café aqui perto. Posso te mandar o vídeo? Vale uma conversa rápida?",
    4: "{nome}, abriu linha de crédito rural com taxa boa para máquina este mês. Quer que eu simule para a sua fazenda?",
    6: "{nome}, um produtor da região comprou a máquina e parou de depender de terceiro na colheita: pagou a parcela só com o que economizou de frete e diária. Quer que eu monte essa conta para vocês?",
  },
  prefeitura: {
    1: "{nome}, aqui é {vendedor}, da {empresa}. Atendo prefeituras da região com retro, motoniveladora e pá carregadeira, com prazo de entrega e assistência local. Vocês têm previsão de compra ou convênio este ano?",
    2: "{nome}, essa é uma máquina nossa entregue para uma prefeitura vizinha na patrulha mecanizada. Posso te mandar as fotos e a especificação técnica?",
    4: "{nome}, saiu edital de convênio para máquinas agrícolas e rodoviárias. Quer que eu mande o descritivo técnico que atende ao edital?",
    6: "{nome}, uma prefeitura vizinha recebeu a máquina em 30 dias e a assistência é feita aqui na região, sem parar a patrulha. Posso te mandar a proposta com as especificações?",
  },
  locadora: {
    1: "{nome}, aqui é {vendedor}, da {empresa}. Trabalho com máquinas para locadora aqui na região, com foco em disponibilidade e revenda. Vocês estão renovando frota este ano?",
    2: "{nome}, essa é uma máquina nossa em locação numa obra aqui perto, com custo de manutenção bem baixo. Posso te mandar os números de disponibilidade?",
    6: "{nome}, uma locadora da região trocou parte da frota e aumentou a disponibilidade: menos máquina parada, mais diária faturada. Quer que eu monte a conta para a frota de vocês?",
  },
};

export function toque(numero: number): Toque | null {
  return TOQUES.find((t) => t.numero === numero) ?? null;
}

export function rotuloTipo(tipo: string): string {
  return TIPOS_CADENCIA.find((t) => t.id === tipo)?.label ?? "Geral";
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export async function textoModelo(tipo: TipoCadencia, numero: number, nomeCliente: string): Promise<string> {
  const p = await lerParametros();
  const base = MODELOS[tipo]?.[numero] ?? MODELOS.geral[numero] ?? "";
  return base
    .replace(/\{nome\}/g, primeiroNome(nomeCliente))
    .replace(/\{vendedor\}/g, p.nomeVendedor)
    .replace(/\{empresa\}/g, p.nomeEmpresa);
}

function dataDoToque(inicio: Date, numero: number): Date {
  const t = toque(numero);
  return new Date(inicio.getTime() + (t?.dia ?? 0) * DIA);
}

// ── Início / encerramento ───────────────────────────────────────────────────
export async function iniciarCadencia(clienteId: string, tipo: TipoCadencia): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nome: true, telefone: true } });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };
  if (!cliente.telefone) return { ok: false, erro: "Cadastre o telefone do cliente antes de iniciar a cadência." };
  const ativa = await db.cadencia.findFirst({ where: { clienteId, ativa: true }, select: { id: true } });
  if (ativa) return { ok: false, erro: "Este cliente já tem uma cadência ativa." };

  const agora = new Date();
  const c = await db.cadencia.create({
    data: { clienteId, tipo, toqueAtual: 0, proximoToqueEm: agora, ativa: true, iniciadaEm: agora },
  });
  await registrarAudit({
    acao: "tarefa_criada", origem: "usuario",
    descricao: `Cadência de 7 toques iniciada para ${cliente.nome} (${rotuloTipo(tipo)}).`,
    entidade: "Cliente", entidadeId: clienteId, clienteId,
  }).catch(() => {});
  return { ok: true, id: c.id };
}

export async function encerrarCadencia(id: string, motivo: "manual" | "respondeu" | "concluida" | "sem_telefone"): Promise<void> {
  await db.cadencia.updateMany({ where: { id, ativa: true }, data: { ativa: false, encerradaEm: new Date(), motivoEncerramento: motivo } });
}

// Chamado pelo webhook quando chega mensagem do cliente: quem respondeu sai
// da cadência (o Orientador de Vendas assume dali em diante).
export async function pausarCadenciasDoCliente(clienteId: string, motivo: "respondeu" = "respondeu"): Promise<number> {
  const r = await db.cadencia.updateMany({
    where: { clienteId, ativa: true },
    data: { ativa: false, encerradaEm: new Date(), motivoEncerramento: motivo },
  });
  if (r.count > 0) {
    const nome = (await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } }))?.nome ?? "cliente";
    await registrarZeusEvent({ tipo: "acao", severidade: "baixa", titulo: `Cadência encerrada: ${nome} respondeu`, detalhe: { clienteId } }).catch(() => {});
    // O alerta de ligação/visita da cadência perde o sentido depois da resposta.
    await db.alerta.updateMany({ where: { clienteId, tipo: "cadencia", resolvido: false }, data: { resolvido: true } }).catch(() => {});
  }
  return r.count;
}

// ── Execução (ZEUS tick) ────────────────────────────────────────────────────
export type ResumoCadencias = { rascunhos: number; alertas: number; encerradas: number };

export async function processarCadenciasVencidas(limite = 20): Promise<ResumoCadencias> {
  const resumo: ResumoCadencias = { rascunhos: 0, alertas: 0, encerradas: 0 };
  const vencidas = await db.cadencia.findMany({
    where: { ativa: true, proximoToqueEm: { lte: new Date() } },
    orderBy: { proximoToqueEm: "asc" },
    take: limite,
    include: { cliente: { select: { id: true, nome: true, telefone: true } } },
  });

  for (const c of vencidas) {
    const numero = c.toqueAtual + 1;
    const t = toque(numero);
    if (!t) { await encerrarCadencia(c.id, "concluida"); resumo.encerradas++; continue; }
    if (!c.cliente.telefone) { await encerrarCadencia(c.id, "sem_telefone"); resumo.encerradas++; continue; }

    try {
      if (t.canal === "whatsapp") {
        await prepararRascunhoToque(c.id, c.cliente, c.tipo as TipoCadencia, t);
        resumo.rascunhos++;
      } else {
        await criarAlertaToque(c.cliente, t, numero);
        resumo.alertas++;
      }
    } catch (e) {
      console.error("[cadencias] toque", numero, "de", c.cliente.nome, e);
      // Falha transitória (IA fora, etc.): tenta de novo no próximo tick sem
      // avançar o contador — mas empurra 30 min para não martelar.
      await db.cadencia.update({ where: { id: c.id }, data: { proximoToqueEm: new Date(Date.now() + 30 * 60 * 1000) } });
      continue;
    }

    const ultimo = numero >= TOQUES.length;
    await db.cadencia.update({
      where: { id: c.id },
      data: ultimo
        ? { toqueAtual: numero, ativa: false, encerradaEm: new Date(), motivoEncerramento: "concluida", proximoToqueEm: new Date() }
        : { toqueAtual: numero, proximoToqueEm: dataDoToque(c.iniciadaEm, numero + 1) },
    });
    if (ultimo) resumo.encerradas++;
  }
  return resumo;
}

async function prepararRascunhoToque(cadenciaId: string, cliente: { id: string; nome: string; telefone: string | null }, tipo: TipoCadencia, t: Toque) {
  const { conv } = await acharOuCriarConversa({ phone: cliente.telefone!, lid: null, isGroup: false, contactName: cliente.nome });
  if (!conv.clienteId) await db.whatsAppConversation.update({ where: { id: conv.id }, data: { clienteId: cliente.id } }).catch(() => {});

  // Já existe rascunho pendente nesta conversa? Não empilha: o vendedor ainda
  // não revisou o anterior.
  const pendente = await db.whatsAppMessage.findFirst({ where: { conversationId: conv.id, isDraft: true, draftStatus: "PENDING" }, select: { id: true } });
  if (pendente) throw new Error("rascunho anterior ainda pendente");

  let texto = "";
  if (iaHabilitada() && (await orcamentoIADisponivel())) {
    const [estilo, contexto] = await Promise.all([
      db.estiloDeFala.findFirst(),
      montarContextoCliente({ id: conv.id, contactName: conv.contactName, clienteId: cliente.id, externalPhone: conv.externalPhone }),
    ]);
    const modelo = await textoModelo(tipo, t.numero, cliente.nome);
    texto = await gerarMensagemToqueCadencia({ contextoCliente: contexto, estilo: estilo?.guia ?? null, toque: t, nicho: rotuloTipo(tipo), modelo });
    await consumirOrcamentoIA();
  }
  if (!texto) texto = await textoModelo(tipo, t.numero, cliente.nome);
  if (!texto) throw new Error("sem texto para o toque");

  await inserirMensagem(conv.id, {
    direction: "OUT", body: texto, origin: "CRM", operatorDisplayName: `Cadência · toque ${t.numero}/7`,
    isDraft: true, draftStatus: "PENDING",
  });
  await registrarZeusEvent({
    tipo: "acao", severidade: "baixa",
    titulo: `Cadência: toque ${t.numero}/7 preparado para ${cliente.nome}`,
    detalhe: { cadenciaId, clienteId: cliente.id, canal: t.canal, titulo: t.titulo },
  });
  await registrarAudit({
    acao: "mensagem_enviada", origem: "zeus",
    descricao: `ZEUS preparou o toque ${t.numero}/7 da cadência (${t.titulo}) para ${cliente.nome} — aguardando revisão em /atendimento.`,
    entidade: "Cliente", entidadeId: cliente.id, clienteId: cliente.id,
  }).catch(() => {});
}

async function criarAlertaToque(cliente: { id: string; nome: string }, t: Toque, numero: number) {
  const mensagem = `Toque ${numero}/7 da cadência: ${t.titulo}. ${t.objetivo}`;
  // Também vira uma demanda para hoje (a lista única do vendedor).
  await garantirDemandaAutomatica({
    chave: `cadencia:${cliente.id}:${numero}`,
    titulo: `${t.canal === "ligacao" ? "Ligar para" : "Visitar"} ${cliente.nome} (toque ${numero}/7)`,
    descricao: t.objetivo, clienteId: cliente.id, dueDate: new Date(), prioridade: "alta", origem: "cadencia",
  }).catch(() => {});
  const existente = await db.alerta.findFirst({ where: { clienteId: cliente.id, tipo: "cadencia", resolvido: false } });
  if (existente) await db.alerta.update({ where: { id: existente.id }, data: { mensagem, severidade: "media", diasDesde: t.dia } });
  else await db.alerta.create({ data: { clienteId: cliente.id, tipo: "cadencia", mensagem, severidade: "media", diasDesde: t.dia } });
  await registrarZeusEvent({
    tipo: "acao", severidade: "baixa",
    titulo: `Cadência: toque ${numero}/7 (${t.canal === "ligacao" ? "ligação" : "visita"}) para ${cliente.nome}`,
    detalhe: { clienteId: cliente.id, canal: t.canal },
  });
}

// ── Leitura para a tela ─────────────────────────────────────────────────────
export type CadenciaResumo = {
  id: string;
  tipo: string;
  tipoLabel: string;
  toqueAtual: number;
  totalToques: number;
  proximo: { numero: number; titulo: string; canal: CanalToque; quando: string } | null;
  iniciadaEm: string;
  ativa: boolean;
  encerradaEm: string | null;
  motivoEncerramento: string | null;
};

export async function cadenciaDoCliente(clienteId: string): Promise<CadenciaResumo | null> {
  const c = await db.cadencia.findFirst({ where: { clienteId }, orderBy: { iniciadaEm: "desc" } });
  if (!c) return null;
  const prox = c.ativa ? toque(c.toqueAtual + 1) : null;
  return {
    id: c.id,
    tipo: c.tipo,
    tipoLabel: rotuloTipo(c.tipo),
    toqueAtual: c.toqueAtual,
    totalToques: TOQUES.length,
    proximo: prox ? { numero: prox.numero, titulo: prox.titulo, canal: prox.canal, quando: c.proximoToqueEm.toISOString() } : null,
    iniciadaEm: c.iniciadaEm.toISOString(),
    ativa: c.ativa,
    encerradaEm: c.encerradaEm?.toISOString() ?? null,
    motivoEncerramento: c.motivoEncerramento,
  };
}

export async function listarCadenciasAtivas(): Promise<{ id: string; clienteId: string; clienteNome: string; tipoLabel: string; toqueAtual: number; proximoToqueEm: Date; proximoTitulo: string; proximoCanal: CanalToque }[]> {
  const ativas = await db.cadencia.findMany({
    where: { ativa: true },
    orderBy: { proximoToqueEm: "asc" },
    take: 100,
    include: { cliente: { select: { nome: true } } },
  });
  return ativas.map((c) => {
    const prox = toque(c.toqueAtual + 1) ?? TOQUES[TOQUES.length - 1];
    return { id: c.id, clienteId: c.clienteId, clienteNome: c.cliente.nome, tipoLabel: rotuloTipo(c.tipo), toqueAtual: c.toqueAtual, proximoToqueEm: c.proximoToqueEm, proximoTitulo: prox.titulo, proximoCanal: prox.canal };
  });
}
