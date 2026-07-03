// Ferramentas do Cérebro agêntico (FASE 3 do Projeto Zeus).
// Cada tool tem a definição (schema Anthropic) e um executor. As de LEITURA
// só consultam o banco; as de ESCRITA reusam as server actions existentes
// (mesma validação/revalidatePath) e sempre registram no AuditLog com
// origem "cerebro". As destrutivas (excluir) exigem confirmação explícita
// (`confirmar: true`) — sem isso, devolvem `requires_confirmation`.

import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { registrarAudit } from "@/lib/audit";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { acharOuCriarConversa, inserirMensagem } from "@/lib/whatsapp-store";
import * as actions from "@/lib/actions";

export type ToolResult = Record<string, unknown> | unknown[];

export type CerebroTool = {
  def: Anthropic.Tool;
  destrutiva?: boolean;
  executar: (input: Record<string, unknown>) => Promise<ToolResult>;
};

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function acharOuCriarMunicipio(nome: string) {
  const alvo = nome.trim();
  if (!alvo) return null;
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const todos = await db.municipio.findMany();
  let m = todos.find((x) => norm(x.nome) === norm(alvo)) ?? null;
  if (!m) m = await db.municipio.create({ data: { nome: alvo } });
  return m;
}

// ── Tools de leitura ──────────────────────────────────────────────────────

const buscarCliente: CerebroTool = {
  def: {
    name: "buscar_cliente",
    description: "Busca clientes pelo nome (aproximado) ou telefone. Devolve uma lista curta com id, nome, telefone, município e status — use detalhes_cliente com o id para a ficha completa.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome ou parte do nome do cliente" },
        telefone: { type: "string", description: "Telefone do cliente (com ou sem DDD/DDI)" },
      },
    },
  },
  async executar(input) {
    const nome = s(input.nome).trim();
    const telefone = s(input.telefone).trim();
    if (!nome && !telefone) return { erro: "Informe nome ou telefone." };

    const cliente = await db.cliente.findMany({
      where: {
        OR: [
          nome ? { nome: { contains: nome, mode: "insensitive" as const } } : undefined,
          telefone ? { telefone: { in: phoneLookupVariants(telefone) } } : undefined,
        ].filter(Boolean) as object[],
      },
      select: { id: true, nome: true, telefone: true, status: true, municipio: { select: { nome: true } } },
      take: 10,
    });
    return { resultados: cliente.map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone, status: c.status, municipio: c.municipio?.nome ?? null })) };
  },
};

const detalhesCliente: CerebroTool = {
  def: {
    name: "detalhes_cliente",
    description: "Ficha completa de um cliente: dados cadastrais, frota, negociações (todas), visitas, alertas abertos e últimas mensagens de WhatsApp. Use o id retornado por buscar_cliente.",
    input_schema: {
      type: "object",
      properties: { clienteId: { type: "string" } },
      required: ["clienteId"],
    },
  },
  async executar(input) {
    const clienteId = s(input.clienteId);
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      include: {
        municipio: true,
        frota: true,
        negociacoes: { orderBy: { criadoEm: "desc" }, take: 10 },
        visitas: { orderBy: { data: "desc" }, take: 10 },
        alertas: { where: { resolvido: false }, orderBy: { criadoEm: "desc" }, take: 10 },
      },
    });
    if (!cliente) return { erro: "Cliente não encontrado." };

    const conv = await db.whatsAppConversation.findFirst({
      where: { clienteId },
      select: { id: true, messages: { orderBy: { sentAt: "desc" }, take: 20, select: { direction: true, body: true, sentAt: true } } },
    });

    return {
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      status: cliente.status,
      municipio: cliente.municipio?.nome ?? null,
      perfilDISC: cliente.perfilDISC,
      perfilIA: cliente.perfilIA,
      resumoTexto: cliente.resumoTexto,
      ultimoContato: cliente.ultimoContato,
      aguardandoResposta: cliente.aguardandoResposta,
      frota: cliente.frota.map((f) => `${f.marca} ${f.modelo}`),
      negociacoes: cliente.negociacoes.map((neg) => ({
        id: neg.id, maquinaModelo: neg.maquinaModelo, valor: neg.valor, estagio: neg.estagio,
        status: neg.status, termometro: neg.termometro, concorrenteMencionado: neg.concorrenteMencionado,
        ultimoContato: neg.ultimoContato,
      })),
      visitas: cliente.visitas.map((v) => ({ data: v.data, observacao: v.observacao })),
      alertas: cliente.alertas.map((a) => a.mensagem),
      ultimasMensagens: (conv?.messages ?? []).reverse().map((m) => `${m.direction === "OUT" ? "Você" : "Cliente"}: ${m.body}`),
    };
  },
};

const listarNegociacoes: CerebroTool = {
  def: {
    name: "listar_negociacoes",
    description: "Lista negociações do funil, com filtro opcional por estágio e/ou status.",
    input_schema: {
      type: "object",
      properties: {
        estagio: { type: "string", description: "Ex: primeiro_contato, visita_pendente, visita_realizada, proposta_bcnh, proposta_aprovada" },
        status: { type: "string", enum: ["aberta", "ganha", "perdida"] },
      },
    },
  },
  async executar(input) {
    const estagio = s(input.estagio).trim();
    const status = s(input.status).trim();
    const negs = await db.negociacao.findMany({
      where: { ...(estagio ? { estagio } : {}), ...(status ? { status } : {}) },
      include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
      orderBy: { ultimoContato: "desc" },
      take: 40,
    });
    return {
      resultados: negs.map((neg) => ({
        id: neg.id, cliente: neg.cliente.nome, municipio: neg.cliente.municipio?.nome ?? null,
        maquinaModelo: neg.maquinaModelo, valor: neg.valor, estagio: neg.estagio, status: neg.status,
        termometro: neg.termometro, ultimoContato: neg.ultimoContato,
      })),
    };
  },
};

const agenda: CerebroTool = {
  def: {
    name: "agenda",
    description: "Visitas agendadas num período.",
    input_schema: {
      type: "object",
      properties: { periodo: { type: "string", enum: ["hoje", "semana", "mes", "todas"] } },
      required: ["periodo"],
    },
  },
  async executar(input) {
    const periodo = s(input.periodo) || "semana";
    const agora = new Date();
    const inicio = new Date(agora); inicio.setHours(0, 0, 0, 0);
    let fim: Date | undefined;
    if (periodo === "hoje") { fim = new Date(inicio); fim.setDate(fim.getDate() + 1); }
    else if (periodo === "semana") { fim = new Date(inicio); fim.setDate(fim.getDate() + 7); }
    else if (periodo === "mes") { fim = new Date(inicio); fim.setDate(fim.getDate() + 30); }

    const visitas = await db.visita.findMany({
      where: { data: { gte: inicio, ...(fim ? { lte: fim } : {}) } },
      include: { cliente: { select: { nome: true, telefone: true, municipio: { select: { nome: true } } } } },
      orderBy: { data: "asc" },
      take: 40,
    });
    return {
      resultados: visitas.map((v) => ({
        cliente: v.cliente.nome, telefone: v.cliente.telefone, municipio: v.cliente.municipio?.nome ?? null,
        data: v.data, observacao: v.observacao,
      })),
    };
  },
};

const buscarMaquina: CerebroTool = {
  def: {
    name: "buscar_maquina",
    description: "Busca uma ou mais máquinas (próprias ou concorrentes) pelo modelo, com ficha técnica.",
    input_schema: {
      type: "object",
      properties: { modelo: { type: "string" } },
      required: ["modelo"],
    },
  },
  async executar(input) {
    const modelo = s(input.modelo).trim();
    if (!modelo) return { erro: "Informe o modelo." };
    const maquinas = await db.maquina.findMany({
      where: { modelo: { contains: modelo, mode: "insensitive" } },
      take: 10,
    });
    return {
      resultados: maquinas.map((m) => ({
        marca: m.marca, modelo: m.modelo, categoria: m.categoria, proprio: m.proprio,
        valorInicial: m.valorInicial, especificacoes: m.especificacoes, pontosFortes: m.pontosFortes,
        diferenciais: m.diferenciais, descricao: m.descricao,
      })),
    };
  },
};

const estoqueUsadas: CerebroTool = {
  def: {
    name: "estoque_usadas",
    description: "Estoque de máquinas usadas/seminovas disponíveis para venda.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["disponivel", "reservada", "vendida"] } },
    },
  },
  async executar(input) {
    const status = s(input.status).trim() || "disponivel";
    const maquinas = await db.maquinaUsada.findMany({ where: { status }, take: 30, orderBy: { criadoEm: "desc" } });
    return {
      resultados: maquinas.map((m) => ({
        marca: m.marca, modelo: m.modelo, categoria: m.categoria, ano: m.ano, horimetro: m.horimetro,
        preco: m.preco, estado: m.estado, localizacao: m.localizacao, status: m.status,
      })),
    };
  },
};

const metricasFunil: CerebroTool = {
  def: {
    name: "metricas_funil",
    description: "Métricas agregadas do funil de vendas: quantidade e valor por estágio das negociações abertas.",
    input_schema: { type: "object", properties: {} },
  },
  async executar() {
    const abertas = await db.negociacao.groupBy({
      by: ["estagio"],
      where: { status: "aberta" },
      _count: true,
      _sum: { valor: true },
    });
    const [ganhas, perdidas] = await Promise.all([
      db.negociacao.count({ where: { status: "ganha" } }),
      db.negociacao.count({ where: { status: "perdida" } }),
    ]);
    return {
      porEstagio: abertas.map((a) => ({ estagio: a.estagio, quantidade: a._count, valorTotal: a._sum.valor ?? 0 })),
      totalGanhas: ganhas,
      totalPerdidas: perdidas,
    };
  },
};

const conversasAguardando: CerebroTool = {
  def: {
    name: "conversas_aguardando",
    description: "Clientes que mandaram mensagem no WhatsApp e ainda aguardam retorno do vendedor.",
    input_schema: { type: "object", properties: {} },
  },
  async executar() {
    const clientes = await db.cliente.findMany({
      where: { aguardandoResposta: true },
      select: { id: true, nome: true, telefone: true, ultimoContato: true, municipio: { select: { nome: true } } },
      orderBy: { ultimoContato: "asc" },
      take: 30,
    });
    return {
      resultados: clientes.map((c) => ({
        id: c.id, nome: c.nome, telefone: c.telefone, municipio: c.municipio?.nome ?? null, ultimoContato: c.ultimoContato,
      })),
    };
  },
};

// ── Tools de escrita ───────────────────────────────────────────────────────

const criarCliente: CerebroTool = {
  def: {
    name: "criar_cliente",
    description: "Cadastra um novo cliente no CRM.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        telefone: { type: "string" },
        municipio: { type: "string" },
        observacoes: { type: "string" },
      },
      required: ["nome"],
    },
  },
  async executar(input) {
    const municipio = s(input.municipio).trim();
    const muni = municipio ? await acharOuCriarMunicipio(municipio) : null;
    const fd = new FormData();
    fd.set("nome", s(input.nome));
    fd.set("telefone", s(input.telefone));
    fd.set("municipioId", muni?.id ?? "");
    fd.set("observacoes", s(input.observacoes));
    fd.set("origem", "cerebro");
    const r = await actions.criarCliente(fd);
    if (r.ok) {
      await registrarAudit({
        acao: "cliente_criado", origem: "cerebro",
        descricao: `Cérebro cadastrou o cliente "${s(input.nome)}".`,
        entidade: "Cliente",
      });
    }
    return r;
  },
};

const atualizarCliente: CerebroTool = {
  def: {
    name: "atualizar_cliente",
    description: "Atualiza dados cadastrais de um cliente já existente (use detalhes_cliente/buscar_cliente para achar o id).",
    input_schema: {
      type: "object",
      properties: {
        clienteId: { type: "string" },
        nome: { type: "string" },
        telefone: { type: "string" },
        municipio: { type: "string" },
        status: { type: "string", enum: ["potencial", "cliente"] },
      },
      required: ["clienteId"],
    },
  },
  async executar(input) {
    const clienteId = s(input.clienteId);
    const atual = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true, telefone: true, email: true, municipioId: true, status: true } });
    if (!atual) return { erro: "Cliente não encontrado." };
    const municipio = s(input.municipio).trim();
    const muni = municipio ? await acharOuCriarMunicipio(municipio) : null;
    const fd = new FormData();
    fd.set("nome", s(input.nome) || atual.nome);
    fd.set("email", atual.email ?? "");
    fd.set("telefone", s(input.telefone) || atual.telefone || "");
    fd.set("municipioId", muni?.id ?? atual.municipioId ?? "");
    fd.set("status", s(input.status) || atual.status);
    const r = await actions.atualizarCliente(clienteId, fd);
    if (r.ok) {
      await registrarAudit({
        acao: "cliente_atualizado", origem: "cerebro",
        descricao: `Cérebro atualizou o cadastro de ${atual.nome}.`,
        entidade: "Cliente", entidadeId: clienteId, clienteId,
      });
    }
    return r;
  },
};

const atualizarResumoCliente: CerebroTool = {
  def: {
    name: "atualizar_resumo_cliente",
    description: "Atualiza o resumo de negociação de um cliente (máquina de interesse, valor, condição, texto livre, próxima visita).",
    input_schema: {
      type: "object",
      properties: {
        clienteId: { type: "string" },
        resumoMaquinas: { type: "string" },
        resumoValor: { type: "number" },
        resumoCondicao: { type: "string" },
        resumoTexto: { type: "string" },
        proximaVisita: { type: "string", description: "YYYY-MM-DD" },
        proximaVisitaNota: { type: "string" },
      },
      required: ["clienteId"],
    },
  },
  async executar(input) {
    const clienteId = s(input.clienteId);
    await actions.atualizarResumoCliente(clienteId, {
      resumoMaquinas: s(input.resumoMaquinas) || undefined,
      resumoValor: n(input.resumoValor),
      resumoCondicao: s(input.resumoCondicao) || undefined,
      resumoTexto: s(input.resumoTexto) || undefined,
      proximaVisita: s(input.proximaVisita) || null,
      proximaVisitaNota: s(input.proximaVisitaNota) || undefined,
    });
    await registrarAudit({
      acao: "cliente_atualizado", origem: "cerebro",
      descricao: `Cérebro atualizou o resumo do cliente.`,
      entidade: "Cliente", entidadeId: clienteId, clienteId,
    });
    return { ok: true };
  },
};

const criarNegociacao: CerebroTool = {
  def: {
    name: "criar_negociacao",
    description: "Abre uma negociação (card no funil) para um cliente.",
    input_schema: {
      type: "object",
      properties: {
        clienteId: { type: "string" },
        maquinaModelo: { type: "string" },
        valor: { type: "number" },
        condicaoPagamento: { type: "string" },
      },
      required: ["clienteId"],
    },
  },
  async executar(input) {
    const clienteId = s(input.clienteId);
    const fd = new FormData();
    fd.set("clienteId", clienteId);
    fd.set("maquinaModelo", s(input.maquinaModelo));
    fd.set("valor", s(n(input.valor) ?? ""));
    fd.set("condicaoPagamento", s(input.condicaoPagamento));
    await actions.criarNegociacao(fd);
    await registrarAudit({
      acao: "negociacao_criada", origem: "cerebro",
      descricao: `Cérebro abriu uma negociação.`,
      entidade: "Cliente", entidadeId: clienteId, clienteId,
      extra: { maquina: s(input.maquinaModelo) || null, valor: n(input.valor) },
    });
    return { ok: true };
  },
};

const moverNegociacao: CerebroTool = {
  def: {
    name: "mover_negociacao",
    description: "Move uma negociação para outro estágio do funil (ex: visita_pendente, visita_realizada, proposta_bcnh, proposta_aprovada).",
    input_schema: {
      type: "object",
      properties: { negociacaoId: { type: "string" }, estagio: { type: "string" } },
      required: ["negociacaoId", "estagio"],
    },
  },
  async executar(input) {
    const negociacaoId = s(input.negociacaoId);
    const neg = await db.negociacao.findUnique({ where: { id: negociacaoId }, select: { clienteId: true } });
    if (!neg) return { erro: "Negociação não encontrada." };
    await actions.moverNegociacao(negociacaoId, s(input.estagio));
    await registrarAudit({
      acao: "negociacao_atualizada", origem: "cerebro",
      descricao: `Cérebro moveu a negociação para "${s(input.estagio)}".`,
      entidade: "Negociacao", entidadeId: negociacaoId, clienteId: neg.clienteId,
    });
    return { ok: true };
  },
};

const marcarGanha: CerebroTool = {
  def: {
    name: "marcar_ganha",
    description: "Marca uma negociação como venda fechada/ganha.",
    input_schema: { type: "object", properties: { negociacaoId: { type: "string" } }, required: ["negociacaoId"] },
  },
  async executar(input) {
    const negociacaoId = s(input.negociacaoId);
    const neg = await db.negociacao.findUnique({ where: { id: negociacaoId }, select: { clienteId: true } });
    if (!neg) return { erro: "Negociação não encontrada." };
    await actions.marcarGanha(negociacaoId);
    await registrarAudit({
      acao: "negociacao_ganha", origem: "cerebro",
      descricao: `Cérebro marcou a negociação como ganha.`,
      entidade: "Negociacao", entidadeId: negociacaoId, clienteId: neg.clienteId,
    });
    return { ok: true };
  },
};

const marcarPerdida: CerebroTool = {
  def: {
    name: "marcar_perdida",
    description: "Marca uma negociação como perdida, com o motivo.",
    input_schema: {
      type: "object",
      properties: { negociacaoId: { type: "string" }, motivo: { type: "string" } },
      required: ["negociacaoId", "motivo"],
    },
  },
  async executar(input) {
    const negociacaoId = s(input.negociacaoId);
    const neg = await db.negociacao.findUnique({ where: { id: negociacaoId }, select: { clienteId: true } });
    if (!neg) return { erro: "Negociação não encontrada." };
    await actions.marcarPerdida(negociacaoId, s(input.motivo));
    await registrarAudit({
      acao: "negociacao_perdida", origem: "cerebro",
      descricao: `Cérebro marcou a negociação como perdida: ${s(input.motivo)}.`,
      entidade: "Negociacao", entidadeId: negociacaoId, clienteId: neg.clienteId,
    });
    return { ok: true };
  },
};

const criarTarefa: CerebroTool = {
  def: {
    name: "criar_tarefa",
    description: "Cria uma tarefa/demanda no quadro Trello interno.",
    input_schema: {
      type: "object",
      properties: { titulo: { type: "string" }, descricao: { type: "string" }, coluna: { type: "string" } },
      required: ["titulo"],
    },
  },
  async executar(input) {
    const fd = new FormData();
    fd.set("titulo", s(input.titulo));
    fd.set("descricao", s(input.descricao));
    fd.set("coluna", s(input.coluna) || "demandas");
    await actions.criarTarefa(fd);
    await registrarAudit({
      acao: "tarefa_criada",
      origem: "cerebro",
      descricao: `Cérebro criou a tarefa "${s(input.titulo)}".`,
      entidade: "TarefaKanban",
    });
    return { ok: true };
  },
};

const adicionarVisita: CerebroTool = {
  def: {
    name: "adicionar_visita",
    description: "Agenda/registra uma visita na agenda de um cliente.",
    input_schema: {
      type: "object",
      properties: {
        clienteId: { type: "string" },
        data: { type: "string", description: "YYYY-MM-DD" },
        observacao: { type: "string" },
      },
      required: ["clienteId", "data"],
    },
  },
  async executar(input) {
    const clienteId = s(input.clienteId);
    const fd = new FormData();
    fd.set("data", s(input.data));
    fd.set("observacao", s(input.observacao));
    await actions.adicionarVisita(clienteId, fd);
    await registrarAudit({
      acao: "visita_detectada", origem: "cerebro",
      descricao: `Cérebro agendou visita para ${s(input.data)}.`,
      entidade: "Cliente", entidadeId: clienteId, clienteId,
    });
    return { ok: true };
  },
};

const enviarResposta: CerebroTool = {
  def: {
    name: "enviar_resposta",
    description: "Prepara uma mensagem de WhatsApp para um cliente. NÃO envia direto — cria um RASCUNHO na fila de /atendimento para o vendedor revisar e enviar (mesmo padrão do Cérebro no WhatsApp).",
    input_schema: {
      type: "object",
      properties: { clienteId: { type: "string" }, texto: { type: "string" } },
      required: ["clienteId", "texto"],
    },
  },
  async executar(input) {
    const clienteId = s(input.clienteId);
    const texto = s(input.texto).trim();
    if (!texto) return { erro: "Mensagem vazia." };
    const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true, telefone: true } });
    if (!cliente?.telefone) return { erro: "Cliente sem telefone cadastrado." };

    const { conv } = await acharOuCriarConversa({ phone: cliente.telefone, lid: null, isGroup: false, contactName: cliente.nome });
    await inserirMensagem(conv.id, {
      direction: "OUT", body: texto, origin: "CRM", operatorDisplayName: "Cérebro (rascunho)",
      isDraft: true, draftStatus: "PENDING",
    });
    await registrarAudit({
      acao: "mensagem_enviada", origem: "cerebro",
      descricao: `Cérebro preparou um rascunho de mensagem para ${cliente.nome} (aguardando revisão em /atendimento).`,
      entidade: "Cliente", entidadeId: clienteId, clienteId,
    });
    return { ok: true, mensagem: "Rascunho criado em /atendimento — aguardando revisão e envio pelo vendedor." };
  },
};

const excluirCliente: CerebroTool = {
  def: {
    name: "excluir_cliente",
    description: "EXCLUI PERMANENTEMENTE um cliente e tudo ligado a ele (negociações, visitas). Ação destrutiva e irreversível — SEMPRE pergunte e confirme com o vendedor antes de chamar com confirmar:true.",
    input_schema: {
      type: "object",
      properties: { clienteId: { type: "string" }, confirmar: { type: "boolean" } },
      required: ["clienteId"],
    },
  },
  destrutiva: true,
  async executar(input) {
    const clienteId = s(input.clienteId);
    const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
    if (!cliente) return { erro: "Cliente não encontrado." };
    if (input.confirmar !== true) {
      return {
        requires_confirmation: true,
        mensagem: `Isso vai excluir PERMANENTEMENTE o cliente "${cliente.nome}" e todas as negociações/visitas ligadas a ele. Peça confirmação explícita ao vendedor antes de chamar esta ferramenta de novo com confirmar:true.`,
      };
    }
    await actions.excluirCliente(clienteId);
    await registrarAudit({
      acao: "cliente_atualizado", origem: "cerebro",
      descricao: `Cérebro excluiu o cliente "${cliente.nome}" (confirmado pelo vendedor no chat).`,
      entidade: "Cliente",
    });
    return { ok: true };
  },
};

const excluirNegociacao: CerebroTool = {
  def: {
    name: "excluir_negociacao",
    description: "EXCLUI PERMANENTEMENTE uma negociação. Ação destrutiva e irreversível — SEMPRE pergunte e confirme com o vendedor antes de chamar com confirmar:true.",
    input_schema: {
      type: "object",
      properties: { negociacaoId: { type: "string" }, confirmar: { type: "boolean" } },
      required: ["negociacaoId"],
    },
  },
  destrutiva: true,
  async executar(input) {
    const negociacaoId = s(input.negociacaoId);
    const neg = await db.negociacao.findUnique({ where: { id: negociacaoId }, include: { cliente: { select: { nome: true } } } });
    if (!neg) return { erro: "Negociação não encontrada." };
    if (input.confirmar !== true) {
      return {
        requires_confirmation: true,
        mensagem: `Isso vai excluir PERMANENTEMENTE a negociação de ${neg.cliente.nome} (${neg.maquinaModelo ?? "sem máquina"}). Peça confirmação explícita ao vendedor antes de chamar esta ferramenta de novo com confirmar:true.`,
      };
    }
    await actions.excluirNegociacao(negociacaoId);
    await registrarAudit({
      acao: "negociacao_atualizada", origem: "cerebro",
      descricao: `Cérebro excluiu a negociação de ${neg.cliente.nome} (confirmado pelo vendedor no chat).`,
      entidade: "Negociacao", clienteId: neg.clienteId,
    });
    return { ok: true };
  },
};

export const CEREBRO_TOOLS: CerebroTool[] = [
  buscarCliente, detalhesCliente, listarNegociacoes, agenda, buscarMaquina, estoqueUsadas, metricasFunil, conversasAguardando,
  criarCliente, atualizarCliente, atualizarResumoCliente, criarNegociacao, moverNegociacao, marcarGanha, marcarPerdida,
  criarTarefa, adicionarVisita, enviarResposta, excluirCliente, excluirNegociacao,
];

export const TOOL_DEFS: Anthropic.Tool[] = CEREBRO_TOOLS.map((t) => t.def);
const TOOL_BY_NAME = new Map(CEREBRO_TOOLS.map((t) => [t.def.name, t]));

// Rótulo amigável para o front mostrar "🔧 Consultando cliente…" em tempo real.
export function rotuloFerramenta(nome: string, input: Record<string, unknown>): string {
  const rotulos: Record<string, string> = {
    buscar_cliente: `Buscando cliente${input.nome ? ` "${s(input.nome)}"` : ""}…`,
    detalhes_cliente: "Consultando ficha do cliente…",
    listar_negociacoes: "Consultando negociações…",
    agenda: "Consultando agenda…",
    buscar_maquina: `Consultando ficha técnica${input.modelo ? ` de ${s(input.modelo)}` : ""}…`,
    estoque_usadas: "Consultando estoque de usadas…",
    metricas_funil: "Calculando métricas do funil…",
    conversas_aguardando: "Consultando conversas aguardando resposta…",
    criar_cliente: `Cadastrando cliente "${s(input.nome)}"…`,
    atualizar_cliente: "Atualizando cadastro do cliente…",
    atualizar_resumo_cliente: "Atualizando resumo do cliente…",
    criar_negociacao: "Abrindo negociação…",
    mover_negociacao: `Movendo negociação para "${s(input.estagio)}"…`,
    marcar_ganha: "Marcando negociação como ganha…",
    marcar_perdida: "Marcando negociação como perdida…",
    criar_tarefa: `Criando tarefa "${s(input.titulo)}"…`,
    adicionar_visita: "Agendando visita…",
    enviar_resposta: "Preparando rascunho de mensagem…",
    excluir_cliente: "Excluindo cliente…",
    excluir_negociacao: "Excluindo negociação…",
  };
  return rotulos[nome] ?? `Executando ${nome}…`;
}

export async function executarFerramenta(nome: string, input: Record<string, unknown>): Promise<ToolResult> {
  const tool = TOOL_BY_NAME.get(nome);
  if (!tool) return { erro: `Ferramenta desconhecida: ${nome}` };
  try {
    return await tool.executar(input);
  } catch (e) {
    console.error(`[cerebro-tools] erro em ${nome}:`, e);
    return { erro: `Falha ao executar ${nome}: ${String(e).slice(0, 200)}` };
  }
}
