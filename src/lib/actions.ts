"use server";
import Anthropic from "@anthropic-ai/sdk";

import { revalidatePath } from "next/cache";
import { db } from "./db";
import { analisarConversaIA, aprenderTomIA, buscarProspectosIA, gerarFichaTecnicaIA, gerarBattlecardIA, gerarAnaliseCategoriaIA, resumirConversaIA } from "./ai";
import { garantirColunasDemanda, CORES_COLUNA } from "./demandas";
import type { AcaoPlano } from "./assistente";
import { vincularMunicipio, acharClientePorTelefone } from "./integrations/inbox";
import { ESTAGIO_INICIAL, ESTAGIOS_PRE_VISITA, COL_PERDIDO, ESTAGIOS } from "./pipeline";
import * as googleCalendar from "./integrations/googleCalendar";
import * as zapi from "./integrations/zapi";
import { registrarAudit } from "./audit";
import { deveDescartarContato, mesAnoAtualBrasilia } from "./utils";
import { CHAVES, setConfig } from "./config";

// ---------- Clientes ----------
export async function criarCliente(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome || deveDescartarContato(nome)) return;
  await db.cliente.create({
    data: {
      nome,
      telefone: String(formData.get("telefone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      endereco: String(formData.get("endereco") ?? "") || null,
      municipioId: String(formData.get("municipioId") ?? "") || null,
      origem: String(formData.get("origem") ?? "manual") || null,
      jaComprou: formData.get("jaComprou") === "on",
      visitado: formData.get("visitado") === "on",
      interesseFuturo: formData.get("interesseFuturo") === "on",
      interesseFuturoData: parseDataBR(String(formData.get("interesseFuturoData") ?? "")),
      interesseFuturoNota: String(formData.get("interesseFuturoNota") ?? "") || null,
    },
  });
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
}

// Converte o campo date (YYYY-MM-DD) em Date ao meio-dia de Brasília (ou null).
function parseDataBR(raw: string): Date | null {
  const d = raw.trim();
  return d ? new Date(`${d}T12:00:00-03:00`) : null;
}

export async function atualizarCliente(id: string, formData: FormData) {
  const status = String(formData.get("status") ?? "potencial") || "potencial";
  const tel = String(formData.get("telefone") ?? "").replace(/^(\+55|55)(?=\d{10,11}$)/, "");
  await db.cliente.update({
    where: { id },
    data: {
      nome: String(formData.get("nome") ?? "").trim(),
      telefone: tel || null,
      email: String(formData.get("email") ?? "") || null,
      municipioId: String(formData.get("municipioId") ?? "") || null,
      status,
      jaComprou: status === "cliente",
      interesseFuturo: formData.get("interesseFuturo") === "on",
      interesseFuturoData: parseDataBR(String(formData.get("interesseFuturoData") ?? "")),
      interesseFuturoNota: String(formData.get("interesseFuturoNota") ?? "") || null,
    },
  });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
}

// Sincroniza a frota de máquinas do cliente (substitui a lista inteira).
export async function gerenciarFrotaCliente(
  clienteId: string,
  frota: { marca: string; modelo: string }[]
): Promise<void> {
  "use server";
  try {
    await db.$executeRawUnsafe(`DELETE FROM "ClienteMaquina" WHERE "clienteId" = $1`, clienteId);
    for (const f of frota) {
      if (!f.modelo || f.modelo === "__outro__") continue;
      const id = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await db.$executeRawUnsafe(
        `INSERT INTO "ClienteMaquina" ("id","clienteId","marca","modelo","criadoEm") VALUES ($1,$2,$3,$4,NOW())`,
        id, clienteId, f.marca, f.modelo
      );
    }
  } catch (e) {
    console.error("[frota] erro:", e);
  }
  revalidatePath(`/clientes/${clienteId}`);
}

// Atualiza o Resumo do Cliente (campos de negociação + texto da IA).
export async function atualizarResumoCliente(
  clienteId: string,
  dados: {
    resumoMaquinas?: string;
    resumoValor?: number | null;
    resumoEntrada?: number | null;
    resumoCondicao?: string;
    resumoTexto?: string;
    proximaVisita?: string | null;
    proximaVisitaNota?: string;
  }
): Promise<void> {
  "use server";
  try {
    await db.$executeRawUnsafe(`
      UPDATE "Cliente" SET
        "resumoMaquinas"  = $2,
        "resumoValor"     = $3,
        "resumoEntrada"   = $4,
        "resumoCondicao"  = $5,
        "resumoTexto"     = $6,
        "proximaVisita"   = $7,
        "proximaVisitaNota" = $8,
        "atualizadoEm"    = NOW()
      WHERE id = $1
    `,
      clienteId,
      dados.resumoMaquinas ?? null,
      dados.resumoValor ?? null,
      dados.resumoEntrada ?? null,
      dados.resumoCondicao ?? null,
      dados.resumoTexto ?? null,
      dados.proximaVisita ? new Date(dados.proximaVisita) : null,
      dados.proximaVisitaNota ?? null,
    );
  } catch (e) {
    console.error("[resumo] erro:", e);
  }
  revalidatePath(`/clientes/${clienteId}`);
}

export async function excluirCliente(id: string): Promise<{ ok: boolean }> {
  await db.cliente.delete({ where: { id } });
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  return { ok: true };
}

// ---------- Visitas ----------
// Registra uma visita ao cliente (data + observação) e marca como visitado.
export async function adicionarVisita(clienteId: string, formData: FormData) {
  const dataRaw = String(formData.get("data") ?? "");
  if (!dataRaw) return;
  // Campo type="date" → formato YYYY-MM-DD. Fixa meio-dia em Brasília para evitar
  // virar o dia anterior por diferença de fuso ao salvar no banco.
  const data = new Date(`${dataRaw}T12:00:00-03:00`);
  await db.visita.create({
    data: {
      clienteId,
      data,
      observacao: String(formData.get("observacao") ?? "") || null,
    },
  });
  await db.cliente.update({ where: { id: clienteId }, data: { visitado: true } });
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
}

export async function removerVisita(id: string, clienteId: string) {
  await db.visita.delete({ where: { id } });
  revalidatePath(`/clientes/${clienteId}`);
}

// Marca que respondi ao cliente sem enviar nada pelo WhatsApp (apenas baixa o alerta).
export async function marcarRespondido(clienteId: string) {
  await db.cliente.update({
    where: { id: clienteId },
    data: { aguardandoResposta: false, ultimoContato: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  revalidatePath("/clientes");
}

// ---------- Modo fim de semana (resposta automática da IA) ----------
// Quando ATIVO, a IA responde os clientes por mim (no meu estilo) assim que eles
// mandam mensagem. Quando desativo, a IA volta a só sugerir rascunhos.
// Por segurança, o envio automático SÓ acontece com esta opção explicitamente ligada.
export async function definirModoFimDeSemana(
  ativo: boolean
): Promise<{ ok: boolean }> {
  await setConfig(CHAVES.modoFimDeSemana, ativo ? "on" : "off");
  // Ao ligar, a IA aprende meu jeito de falar a partir do meu histórico real.
  if (ativo) {
    await aprenderMeuEstilo();
  }
  await registrarAudit({
    acao: "modo_fim_de_semana",
    origem: "usuario",
    descricao: ativo
      ? "Modo fim de semana ATIVADO — IA responderá automaticamente."
      : "Modo fim de semana DESATIVADO — IA volta a só sugerir.",
  });
  revalidatePath("/inbox");
  return { ok: true };
}

// Aprende o estilo de fala do Ederson a partir das mensagens que ele já enviou
// e salva no banco para a IA imitar nas respostas.
export async function aprenderMeuEstilo(): Promise<{ ok: boolean }> {
  const minhas = await db.conversa.findMany({
    where: { remetente: "vendedor", tipo: "texto" },
    orderBy: { criadoEm: "desc" },
    take: 40,
    select: { conteudo: true },
  });
  if (minhas.length === 0) return { ok: false };

  const guia = await aprenderTomIA(minhas.map((m) => m.conteudo));
  const existente = await db.estiloDeFala.findFirst();
  if (existente) {
    await db.estiloDeFala.update({ where: { id: existente.id }, data: { guia } });
  } else {
    await db.estiloDeFala.create({ data: { guia } });
  }
  return { ok: true };
}

// ---------- WhatsApp: responder direto do CRM ----------
// Envia a resposta pela Z-API e registra a conversa como minha (vendedor).
export async function enviarResposta(
  clienteId: string,
  texto: string
): Promise<{ ok: boolean; erro?: string }> {
  const conteudo = texto.trim();
  if (!conteudo) return { ok: false, erro: "Mensagem vazia." };

  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente?.telefone) return { ok: false, erro: "Cliente sem telefone cadastrado." };

  const envio = await zapi.enviarMensagem(cliente.telefone, conteudo);
  if (!envio.ok) {
    return {
      ok: false,
      erro: envio.modo === "stub"
        ? "WhatsApp (Z-API) não está conectado. Configure em /conexao."
        : `Z-API retornou erro ${envio.status}${envio.mensagemErro ? ": " + envio.mensagemErro : " — verifique a conexão em /conexao."}`,
    };
  }

  await db.conversa.create({
    data: {
      conteudo,
      clienteId,
      canal: "whatsapp",
      tipo: "texto",
      remetente: "vendedor",
    },
  });
  await db.cliente.update({
    where: { id: clienteId },
    data: { aguardandoResposta: false, ultimoContato: new Date() },
  });
  await registrarAudit({
    acao: "mensagem_enviada",
    origem: "usuario",
    descricao: `Mensagem enviada via WhatsApp para ${cliente.nome}`,
    entidade: "Cliente",
    entidadeId: clienteId,
    clienteId,
    extra: { chars: conteudo.length, modo: envio.modo },
  });

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

// Normaliza telefone para 11 dígitos (remove 55 do início se tiver 13 dígitos).
function normalizarTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // 5528999798168 → 28999798168 (13 dígitos BR com código de país)
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  // 55289998168 → 28999798168 (12 dígitos BR com código)
  if (digits.length === 12 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

// Importa clientes de um CSV colado (nome,telefone,municipio). Dedup por telefone.
export async function importarClientesCsv(
  formData: FormData
): Promise<{ importados: number; ignorados: number; erros: number }> {
  const csv = String(formData.get("csv") ?? "");
  const linhas = csv.split(/\r?\n/).filter((l) => l.trim());
  const municipios = await db.municipio.findMany();
  const normStr = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  let importados = 0;
  let ignorados = 0;
  let erros = 0;

  for (const linha of linhas) {
    // Suporta vírgula ou ponto-e-vírgula, campos com espaço, linha com só 1 ou 2 campos
    const partes = linha.split(/[,;]/).map((c) => c?.trim() ?? "");
    const nomeRaw = partes[0] ?? "";
    const telRaw = partes[1] ?? "";
    const muniRaw = partes[2] ?? "";

    if (!nomeRaw) continue;
    if (/^nome$/i.test(nomeRaw)) continue; // pula cabeçalho
    if (deveDescartarContato(nomeRaw)) { ignorados++; continue; }

    const telefone = telRaw ? normalizarTelefone(telRaw) : null;

    try {
      // Dedup prioritariamente por telefone normalizado; só por nome se não tiver tel.
      const condicoes: object[] = [];
      if (telefone) {
        condicoes.push({ telefone });
        // Também verifica sem o 55 prefixado (caso DB tenha formato diferente)
        if (!telefone.startsWith("55") && telefone.length >= 10) {
          condicoes.push({ telefone: `55${telefone}` });
        }
      } else {
        condicoes.push({ nome: nomeRaw });
      }
      const existe = await db.cliente.findFirst({ where: { OR: condicoes } });
      if (existe) { ignorados++; continue; }

      const muni = muniRaw
        ? municipios.find((m) => normStr(m.nome) === normStr(muniRaw))
        : undefined;

      await db.cliente.create({
        data: { nome: nomeRaw, telefone, municipioId: muni?.id ?? null, origem: "importacao" },
      });
      importados++;
    } catch {
      erros++;
    }
  }

  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { importados, ignorados, erros };
}

// ---------- Negociações ----------
export async function criarNegociacao(formData: FormData) {
  const clienteId = String(formData.get("clienteId") ?? "");
  if (!clienteId) return;
  const valorRaw = String(formData.get("valor") ?? "").replace(/\D/g, "");
  await db.negociacao.create({
    data: {
      clienteId,
      maquinaModelo: String(formData.get("maquinaModelo") ?? "") || null,
      valor: valorRaw ? Number(valorRaw) : null,
      condicaoPagamento: String(formData.get("condicaoPagamento") ?? "") || null,
      estagio: ESTAGIO_INICIAL,
      ultimoContato: new Date(),
    },
  });
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/pipeline");
}

// Cria um card direto no pipeline (estilo Trello): aceita cliente existente
// ou um nome novo, em qualquer coluna.
export async function criarNegociacaoCard(formData: FormData) {
  let clienteId = String(formData.get("clienteId") ?? "") || null;
  const nomeNovo = String(formData.get("nomeNovo") ?? "").trim();
  if (!clienteId && nomeNovo) {
    if (deveDescartarContato(nomeNovo)) return;
    const novo = await db.cliente.create({ data: { nome: nomeNovo, origem: "pipeline" } });
    clienteId = novo.id;
  }
  if (!clienteId) return;

  const valorRaw = String(formData.get("valor") ?? "").replace(/\D/g, "");
  const estagio = String(formData.get("estagio") ?? "") || ESTAGIO_INICIAL;
  await db.negociacao.create({
    data: {
      clienteId,
      maquinaModelo: String(formData.get("maquinaModelo") ?? "") || null,
      valor: valorRaw ? Number(valorRaw) : null,
      estagio,
      ultimoContato: new Date(),
    },
  });
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
}

// Edita os campos de um card do pipeline.
export async function editarNegociacao(id: string, formData: FormData) {
  const valorRaw = String(formData.get("valor") ?? "").replace(/\D/g, "");
  const dataVisitaRaw = String(formData.get("dataVisita") ?? "");
  // O input datetime-local vem sem fuso; interpretamos como horário de Brasília (-03:00).
  const dataVisita = dataVisitaRaw ? new Date(`${dataVisitaRaw}:00-03:00`) : null;
  await db.negociacao.update({
    where: { id },
    data: {
      maquinaModelo: String(formData.get("maquinaModelo") ?? "") || null,
      valor: valorRaw ? Number(valorRaw) : null,
      condicaoPagamento: String(formData.get("condicaoPagamento") ?? "") || null,
      proximaAcao: String(formData.get("proximaAcao") ?? "") || null,
      dataVisita,
      estagio: String(formData.get("estagio") ?? "") || undefined,
      ultimoContato: new Date(),
    },
  });
  revalidatePath("/pipeline");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

export async function moverNegociacao(id: string, estagio: string) {
  const isPerdido = estagio.toLowerCase().includes("perdid");
  const isFaturado = estagio.toLowerCase().includes("faturad");
  const isConfirmado = estagio === "proposta_aprovada" || estagio.toLowerCase().includes("confirm") || estagio.toLowerCase().includes("ganho") || estagio.toLowerCase().includes("vendid");
  
  if (isPerdido) {
    await db.negociacao.update({
      where: { id },
      data: { status: "perdida", estagio, ultimoContato: new Date() },
    });
  } else if (isFaturado) {
    // FATURADO: marca como ganha, registra faturadoEm, atualiza cliente
    const neg = await db.negociacao.update({
      where: { id },
      data: { status: "ganha", estagio, faturadoEm: new Date(), ultimoContato: new Date() },
      include: { cliente: true },
    });
    await db.cliente.update({ where: { id: neg.clienteId }, data: { jaComprou: true } });
    await registrarAudit({
      acao: "negociacao_criada" as any,
      origem: "usuario",
      descricao: `Negociação FATURADA! ${neg.maquinaModelo ?? "Máquina"} para ${neg.cliente.nome}`,
      entidade: "Negociacao",
      entidadeId: id,
      clienteId: neg.clienteId,
      extra: { maquina: neg.maquinaModelo ?? null, valor: neg.valor ?? null, cliente: (neg.cliente as any)?.nome, tipoPagamento: (neg as any).tipoPagamento ?? null } as any,
    });
    revalidatePath("/dashboard");
    revalidatePath("/financeiro");
  } else if (isConfirmado) {
    const neg = await db.negociacao.update({
      where: { id },
      data: { status: "ganha", estagio, ultimoContato: new Date() },
      include: { cliente: true },
    });
    await db.cliente.update({ where: { id: neg.clienteId }, data: { jaComprou: true } });
    await registrarAudit({
      acao: "negociacao_ganha",
      origem: "usuario",
      descricao: `Venda confirmada! ${neg.maquinaModelo ?? "Máquina"} para ${neg.cliente.nome}`,
      entidade: "Negociacao",
      entidadeId: id,
      clienteId: neg.clienteId,
      extra: { maquina: neg.maquinaModelo ?? null, valor: neg.valor ?? null, cliente: (neg.cliente as any)?.nome } as any,
    });
    revalidatePath("/dashboard");
    revalidatePath("/financeiro");
  } else {
    await db.negociacao.update({
      where: { id },
      data: { status: "aberta", estagio, ultimoContato: new Date() },
    });
  }
  revalidatePath("/negociacoes");
  revalidatePath("/pipeline");
  revalidatePath("/vendas-perdidas");
}

export async function excluirNegociacao(id: string) {
  await db.negociacao.delete({ where: { id } });
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/vendas-perdidas");
}

export async function marcarPerdida(id: string, motivo: string) {
  const neg = await db.negociacao.update({
    where: { id },
    data: { status: "perdida", motivoPerda: motivo, estagio: COL_PERDIDO.id },
    include: { cliente: true },
  });
  await registrarAudit({
    acao: "negociacao_perdida",
    origem: "usuario",
    descricao: `Negociação marcada como perdida. Motivo: ${motivo || "não informado"}`,
    entidade: "Negociacao",
    entidadeId: id,
    clienteId: neg.clienteId,
    extra: { motivo, maquina: neg.maquinaModelo ?? null, valor: neg.valor ?? null, cliente: neg.cliente.nome },
  });
  revalidatePath("/pipeline");
  revalidatePath("/vendas-perdidas");
  revalidatePath("/financeiro");
}

export async function marcarGanha(id: string) {
  const neg = await db.negociacao.update({
    where: { id },
    data: { status: "ganha", estagio: "proposta_aprovada" },
    include: { cliente: true },
  });
  await db.cliente.update({ where: { id: neg.clienteId }, data: { jaComprou: true } });
  await registrarAudit({
    acao: "negociacao_ganha",
    origem: "usuario",
    descricao: `Venda fechada! ${neg.maquinaModelo ?? "Máquina"} para ${neg.cliente.nome}`,
    entidade: "Negociacao",
    entidadeId: id,
    clienteId: neg.clienteId,
    extra: { maquina: neg.maquinaModelo ?? null, valor: neg.valor ?? null, cliente: neg.cliente.nome },
  });
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
}

// Acha um cliente por telefone/nome ou cria um novo. Usado na análise de
// conversas para alimentar automaticamente o cadastro de clientes.
async function acharOuCriarCliente(
  nome: string | null,
  telefone: string | null,
  origem: string
): Promise<string | null> {
  const tel = telefone ? telefone.replace(/\D/g, "") : null;
  if (!nome && !tel) return null;
  if (nome && deveDescartarContato(nome)) return null;

  const existente = await db.cliente.findFirst({
    where: {
      OR: [
        tel ? { telefone: tel } : undefined,
        nome ? { nome: { equals: nome, mode: "insensitive" } } : undefined,
      ].filter(Boolean) as object[],
    },
  });
  if (existente) {
    // completa telefone se faltava
    if (tel && !existente.telefone) {
      await db.cliente.update({ where: { id: existente.id }, data: { telefone: tel } });
    }
    return existente.id;
  }

  const novo = await db.cliente.create({
    data: { nome: nome ?? "Novo contato", telefone: tel, origem },
  });
  return novo.id;
}

// ---------- Modelos em Foco ----------
export async function toggleMaquinaComercializada(id: string, valor: boolean) {
  "use server";
  await db.maquina.update({ where: { id }, data: { maisComercializado: valor } });
  revalidatePath("/maquinas");
}

// ---------- Ranking de vendas ----------
export async function setVolumeVendas(id: string, valor: number) {
  "use server";
  const v = Number.isFinite(valor) && valor > 0 ? Math.round(valor) : 0;
  await db.maquina.update({ where: { id }, data: { volumeVendas: v } });
  revalidatePath("/maquinas");
}

// ---------- Fichas Técnicas ----------
export async function salvarFichaTecnica(
  id: string,
  dados: {
    especificacoes?: string;
    descricao?: string;
    pontosFortes?: string;
    diferenciais?: string;
    valorInicial?: number | null;
    consumoLitrosHora?: number | null;
    argumentos?: string;
  }
) {
  "use server";
  await db.maquina.update({
    where: { id },
    data: {
      especificacoes: dados.especificacoes ?? null,
      descricao: dados.descricao ?? null,
      pontosFortes: dados.pontosFortes ?? null,
      diferenciais: dados.diferenciais ?? null,
      valorInicial: dados.valorInicial ?? null,
      consumoLitrosHora: dados.consumoLitrosHora ?? null,
      argumentos: dados.argumentos ?? null,
    },
  });
  revalidatePath("/maquinas/fichas");
  revalidatePath("/comparativo");
}

// Preenche a ficha técnica automaticamente com a IA (a partir do conhecimento
// público dos fabricantes). Não sobrescreve cegamente: retorna os dados para o
// usuário revisar e salvar.
export async function preencherFichaTecnicaIA(id: string): Promise<{
  ok: boolean;
  especificacoes?: string;
  descricao?: string;
  pontosFortes?: string;
  diferenciais?: string;
  erro?: string;
}> {
  "use server";
  const maq = await db.maquina.findUnique({
    where: { id },
    select: { marca: true, modelo: true, categoria: true, proprio: true },
  });
  if (!maq) return { ok: false, erro: "Máquina não encontrada" };

  const ficha = await gerarFichaTecnicaIA(maq);
  if (!ficha.especificacoes && !ficha.descricao) {
    return { ok: false, erro: "IA não habilitada ou sem dados. Configure GROQ_API_KEY ou ANTHROPIC_API_KEY." };
  }
  return { ok: true, ...ficha };
}

// Extrai a ficha técnica de um arquivo anexado (PDF/imagem do catálogo) via IA.
// O arquivo NÃO é guardado — só o conteúdo extraído é devolvido para revisão.
export async function extrairFichaDeArquivo(maquinaId: string, formData: FormData): Promise<{
  ok: boolean;
  especificacoes?: string;
  descricao?: string;
  pontosFortes?: string;
  diferenciais?: string;
  consumoLitrosHora?: number | null;
  valorInicial?: number | null;
  erro?: string;
}> {
  "use server";
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Nenhum arquivo enviado." };
  }
  const nome = arquivo.name.toLowerCase();
  const ehPdf = arquivo.type === "application/pdf" || nome.endsWith(".pdf");
  const ehImagem = arquivo.type.startsWith("image/");
  const ehTexto = arquivo.type.startsWith("text/") || /\.(txt|html?|md|csv)$/.test(nome);
  // Limite: PDF até 32MB (limite da Anthropic), imagem até 8MB, texto até 2MB.
  const limite = ehPdf ? 32 * 1024 * 1024 : ehImagem ? 8 * 1024 * 1024 : 2 * 1024 * 1024;
  if (arquivo.size > limite) {
    return { ok: false, erro: `Arquivo muito grande (máx. ${ehPdf ? "32MB" : ehImagem ? "8MB" : "2MB"}).` };
  }

  const maq = await db.maquina.findUnique({
    where: { id: maquinaId },
    select: { marca: true, modelo: true, categoria: true, proprio: true },
  });
  if (!maq) return { ok: false, erro: "Máquina não encontrada." };

  const { extrairFichaDeArquivoIA } = await import("@/lib/ai");

  // Texto/HTML: extrai o texto puro e manda como texto (funciona com Groq também).
  if (ehTexto && !ehPdf && !ehImagem) {
    let texto = await arquivo.text();
    if (/\.html?$/.test(nome) || arquivo.type.includes("html")) {
      texto = texto.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, " ");
    }
    return extrairFichaDeArquivoIA(maq, { texto: texto.slice(0, 60000) });
  }

  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
  return extrairFichaDeArquivoIA(maq, { base64, mediaType: ehPdf ? "application/pdf" : arquivo.type });
}

// Análise de categoria (Super Trunfo): minhas máquinas vs concorrentes.
export async function gerarAnaliseCategoriaIAAction(
  categoria: string
): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  "use server";
  const maquinas = await db.maquina.findMany({
    where: { categoria },
    select: { marca: true, modelo: true, proprio: true, especificacoes: true },
  });
  const minhas = maquinas.filter((m) => m.proprio);
  const concorrentes = maquinas.filter((m) => !m.proprio);
  if (minhas.length === 0) return { ok: false, erro: "Sem máquinas próprias nesta categoria." };

  const { CATEGORIAS } = await import("./comparativo");
  const texto = await gerarAnaliseCategoriaIA(CATEGORIAS[categoria] ?? categoria, minhas, concorrentes);
  if (!texto.trim()) {
    return { ok: false, erro: "IA não habilitada. Configure GROQ_API_KEY ou ANTHROPIC_API_KEY." };
  }
  return { ok: true, texto };
}

// Preenche em lote as fichas técnicas ainda vazias com a IA. Retorna quantas
// foram preenchidas. Roda só nas máquinas sem `especificacoes`.
export async function preencherFichasVaziasIA(
  apenasProprias: boolean
): Promise<{ ok: boolean; preenchidas: number; erro?: string }> {
  "use server";
  const vazias = await db.maquina.findMany({
    where: { especificacoes: null, ...(apenasProprias ? { proprio: true } : {}) },
    select: { id: true, marca: true, modelo: true, categoria: true, proprio: true },
  });
  if (vazias.length === 0) return { ok: true, preenchidas: 0 };

  let preenchidas = 0;
  for (const m of vazias) {
    const ficha = await gerarFichaTecnicaIA(m);
    if (ficha.especificacoes) {
      await db.maquina.update({
        where: { id: m.id },
        data: {
          especificacoes: ficha.especificacoes,
          ...(ficha.descricao ? { descricao: ficha.descricao } : {}),
          ...(m.proprio && ficha.pontosFortes ? { pontosFortes: ficha.pontosFortes } : {}),
          ...(m.proprio && ficha.diferenciais ? { diferenciais: ficha.diferenciais } : {}),
        },
      });
      preenchidas++;
    }
  }
  revalidatePath("/super-trunfo");
  revalidatePath("/maquinas/fichas");
  return { ok: true, preenchidas };
}

// Gera os argumentos de venda (battlecards) comparando minha máquina com os
// concorrentes da mesma faixa, usando as fichas técnicas. Chamado sob demanda.
export async function gerarBattlecardsComparativoIA(
  minhaId: string,
  concorrentesIds: string[]
): Promise<{ ok: boolean; cards?: { id: string; texto: string }[]; erro?: string }> {
  "use server";
  const minha = await db.maquina.findUnique({
    where: { id: minhaId },
    select: { marca: true, modelo: true, categoria: true, especificacoes: true, pontosFortes: true },
  });
  if (!minha) return { ok: false, erro: "Máquina não encontrada" };

  const concs = await db.maquina.findMany({
    where: { id: { in: concorrentesIds } },
    select: { id: true, marca: true, modelo: true, especificacoes: true },
  });

  try {
    const cards = await Promise.all(
      concs.map(async (c) => ({ id: c.id, texto: await gerarBattlecardIA(minha, c) }))
    );
    const validos = cards.filter((c) => c.texto.trim());
    if (validos.length === 0) {
      return { ok: false, erro: "IA não habilitada. Configure GROQ_API_KEY ou ANTHROPIC_API_KEY." };
    }
    return { ok: true, cards: validos };
  } catch (e) {
    console.error("Erro nos battlecards:", e);
    return { ok: false, erro: "Erro ao gerar argumentos" };
  }
}

// ---------- Conversas + IA ----------
export async function analisarConversaAction(formData: FormData) {
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!conteudo) return;
  let clienteId = String(formData.get("clienteId") ?? "") || null;

  const [estilo, modelosDestaque] = await Promise.all([
    db.estiloDeFala.findFirst(),
    db.maquina.findMany({
      where: { maisComercializado: true, proprio: true },
      select: { marca: true, modelo: true, categoria: true },
      orderBy: [{ volumeVendas: "desc" }, { modelo: "asc" }],
    }),
  ]);
  const extracao = await analisarConversaIA(conteudo, {
    estiloDeFala: estilo?.guia,
    modelosDestaque,
  });

  // Sem cliente vinculado: cria/encontra a partir do que a IA identificou.
  if (!clienteId && (extracao.nomeCliente || extracao.telefoneCliente)) {
    clienteId = await acharOuCriarCliente(
      extracao.nomeCliente,
      extracao.telefoneCliente,
      "conversa"
    );
  }

  const conversa = await db.conversa.create({
    data: {
      conteudo,
      clienteId,
      canal: "manual",
      tipo: "texto",
      remetente: "cliente",
      analisadaEm: new Date(),
    },
  });

  // Liga/atualiza negociação do cliente quando houver
  let negociacaoId: string | null = null;
  if (clienteId) {
    const negExistente = await db.negociacao.findFirst({
      where: { clienteId, status: "aberta" },
      orderBy: { criadoEm: "desc" },
    });
    const dados = {
      maquinaModelo: extracao.maquina ?? negExistente?.maquinaModelo ?? null,
      valor: extracao.valor ?? negExistente?.valor ?? null,
      condicaoPagamento: extracao.condicaoPagamento ?? negExistente?.condicaoPagamento ?? null,
      concorrenteMencionado: extracao.concorrente ?? negExistente?.concorrenteMencionado ?? null,
      dataVisita: extracao.dataVisita ?? negExistente?.dataVisita ?? null,
      ultimoContato: new Date(),
      termometro:
        extracao.sentimento === "positivo" ? 80 : extracao.sentimento === "negativo" ? 30 : 55,
    };
    if (negExistente) {
      // Visita marcada promove o card para "Visitas pendentes".
      const estagio =
        extracao.dataVisita && ESTAGIOS_PRE_VISITA.includes(negExistente.estagio)
          ? "visita_pendente"
          : negExistente.estagio;
      await db.negociacao.update({ where: { id: negExistente.id }, data: { ...dados, estagio } });
      negociacaoId = negExistente.id;
    } else if (extracao.ehProspectReal) {
      const nova = await db.negociacao.create({
        data: {
          clienteId,
          estagio: extracao.dataVisita ? "visita_pendente" : ESTAGIO_INICIAL,
          ...dados,
        },
      });
      negociacaoId = nova.id;
    }

    // Visita detectada -> tenta criar na agenda (stub se não conectado)
    if (extracao.dataVisita) {
      const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
      await googleCalendar.criarEvento({
        titulo: `Visita — ${cliente?.nome ?? "cliente"}`,
        inicio: extracao.dataVisita,
        descricao: `Visita detectada pela IA. ${extracao.maquina ? "Máquina: " + extracao.maquina : ""}`,
      });
    }
  }

  await db.analiseIA.create({
    data: {
      conversaId: conversa.id,
      negociacaoId,
      resumo: extracao.resumo,
      perfil: extracao.perfil,
      maquina: extracao.maquina,
      valor: extracao.valor,
      condicaoPagamento: extracao.condicaoPagamento,
      concorrente: extracao.concorrente,
      dataVisita: extracao.dataVisita,
      sentimento: extracao.sentimento,
      ehProspectReal: extracao.ehProspectReal,
      rascunhoResposta: extracao.rascunhoResposta,
      fonte: extracao.fonte,
    },
  });

  // Guarda o perfil, o último contato e marca que aguarda meu retorno.
  if (clienteId) {
    const c = await db.cliente.findUnique({ where: { id: clienteId } });
    await db.cliente.update({
      where: { id: clienteId },
      data: {
        ...(extracao.perfil && !c?.perfilIA ? { perfilIA: extracao.perfil } : {}),
        ultimoContato: new Date(),
        aguardandoResposta: true,
      },
    });
    await vincularMunicipio(clienteId, extracao.municipio);
    await registrarAudit({
      acao: "conversa_analisada",
      origem: "ia",
      descricao: `Conversa analisada. Sentimento: ${extracao.sentimento ?? "neutro"}. ${extracao.maquina ? "Máquina: " + extracao.maquina + "." : ""} ${extracao.valor ? "Valor: R$ " + extracao.valor.toLocaleString("pt-BR") + "." : ""}`,
      entidade: "Conversa",
      entidadeId: conversa.id,
      clienteId,
      extra: {
        sentimento: extracao.sentimento,
        maquina: extracao.maquina,
        valor: extracao.valor,
        prospect: extracao.ehProspectReal,
        fonte: extracao.fonte,
      },
    });
    if (extracao.dataVisita) {
      await registrarAudit({
        acao: "visita_detectada",
        origem: "ia",
        descricao: `Visita detectada automaticamente para ${extracao.dataVisita.toLocaleDateString("pt-BR")}`,
        entidade: "Negociacao",
        entidadeId: negociacaoId ?? undefined,
        clienteId,
        extra: { dataVisita: extracao.dataVisita.toISOString(), maquina: extracao.maquina },
      });
    }
  }

  revalidatePath("/conversas");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  if (clienteId) revalidatePath(`/clientes/${clienteId}`);
}

// ---------- Sugestões de vínculo ----------
export async function resolverSugestao(id: string, acao: "confirmar" | "rejeitar") {
  const sug = await db.sugestaoVinculo.findUnique({ where: { id } });
  if (!sug) return;
  if (acao === "confirmar" && sug.clienteId && sug.nomeDetectado) {
    await db.cliente.update({
      where: { id: sug.clienteId },
      data: { telefone: sug.telefone },
    });
  } else if (acao === "confirmar" && !sug.clienteId) {
    // cria novo cliente a partir da sugestão (ignora pousadas/hotéis)
    const nomeS = sug.nomeDetectado ?? "Novo contato";
    if (!deveDescartarContato(nomeS)) {
      await db.cliente.create({
        data: { nome: nomeS, telefone: sug.telefone, origem: "whatsapp" },
      });
    }
  }
  await db.sugestaoVinculo.update({
    where: { id },
    data: { status: acao === "confirmar" ? "confirmado" : "rejeitado" },
  });
  revalidatePath("/sugestoes");
  revalidatePath("/clientes");
}

// ---------- Alertas ----------
export async function resolverAlerta(id: string) {
  await db.alerta.update({ where: { id }, data: { resolvido: true } });
  revalidatePath("/dashboard");
}

// ---------- Conexão WhatsApp (Z-API) ----------
export async function reiniciarZapi(): Promise<{ ok: boolean }> {
  const ok = await zapi.reiniciar();
  revalidatePath("/conexao");
  return { ok };
}

export async function desconectarZapi(): Promise<{ ok: boolean }> {
  const ok = await zapi.desconectar();
  revalidatePath("/conexao");
  return { ok };
}

// ---------- Kanban de tarefas ----------
export async function moverTarefa(id: string, coluna: string) {
  await db.tarefaKanban.update({ where: { id }, data: { coluna } });
  revalidatePath("/pipeline");
}

export async function gerarEstrategiaAction(formData: FormData): Promise<{
  ok: boolean;
  estrategia?: { id: string; titulo: string; conteudo: string };
  erro?: string;
}> {
  "use server";
  const tema = (formData.get("tema") as string | null)?.trim();
  const perfil = (formData.get("perfil") as string | null) || null;
  const contexto = (formData.get("contexto") as string | null) || null;
  if (!tema) return { ok: false, erro: "Informe um tema." };

  const { gerarEstrategiaVendaIA } = await import("@/lib/ai");
  const resultado = await gerarEstrategiaVendaIA({ tema, perfil, contexto });

  const salvo = await db.estrategiaVenda.create({
    data: {
      titulo: resultado.titulo,
      conteudo: resultado.conteudo,
      categoria: "ideia",
      perfilAlvo: perfil || null,
      fonte: "ia",
    },
  });
  revalidatePath("/academia");
  return { ok: true, estrategia: { id: salvo.id, titulo: salvo.titulo, conteudo: salvo.conteudo } };
}

export async function toggleFavoritoEstrategia(id: string, favorito: boolean) {
  "use server";
  await db.estrategiaVenda.update({ where: { id }, data: { favorito } });
  revalidatePath("/academia");
}

export async function excluirEstrategia(id: string) {
  "use server";
  await db.estrategiaVenda.delete({ where: { id } });
  revalidatePath("/academia");
}

// ---------- Prospecção IA ----------
const CATEGORIAS_PROSPECT = [
  "locacao",
  "terraplanagem",
  "engenharia",
  "asfalto",
  "mineracao",
  "construcao",
];

export async function buscarProspectosIAAction(
  municipioId: string
): Promise<{ ok: boolean; inseridos: number; erro?: string }> {
  "use server";
  try {
    const municipio = await db.municipio.findUnique({ where: { id: municipioId } });
    if (!municipio) return { ok: false, inseridos: 0, erro: "Município não encontrado" };

    const prospectos = await buscarProspectosIA(municipio.nome, CATEGORIAS_PROSPECT);
    if (prospectos.length === 0) return { ok: true, inseridos: 0 };

    let inseridos = 0;
    for (const p of prospectos) {
      // Não duplica se já existe pelo nome no mesmo município
      const existe = await db.cliente.findFirst({
        where: { nome: { equals: p.nome, mode: "insensitive" }, municipioId },
      });
      if (existe) continue;

      await db.cliente.create({
        data: {
          nome: p.nome,
          municipioId,
          origem: "prospect_ia",
          observacoes: `${p.tipo.toUpperCase()} — ${p.descricao}`,
        },
      });
      inseridos++;
    }

    revalidatePath("/roteiro");
    revalidatePath("/clientes");
    return { ok: true, inseridos };
  } catch (e) {
    console.error("Erro ao buscar prospectos:", e);
    return { ok: false, inseridos: 0, erro: "Erro ao buscar prospectos" };
  }
}

export async function excluirProspecto(clienteId: string): Promise<{ ok: boolean }> {
  "use server";
  await db.cliente.delete({ where: { id: clienteId, origem: "prospect_ia" } });
  revalidatePath("/roteiro");
  revalidatePath("/clientes");
  return { ok: true };
}

// ---------- Demandas (cards estilo Trello) ----------

// Cria uma tarefa (card livre) em uma coluna de demandas.
export async function criarTarefa(formData: FormData) {
  "use server";
  const titulo = String(formData.get("titulo") ?? "").trim();
  const coluna = String(formData.get("coluna") ?? "demandas") || "demandas";
  if (!titulo) return;
  const descricao = String(formData.get("descricao") ?? "").trim() || null;
  const checklist = String(formData.get("checklist") ?? "").trim() || null;
  const cidade = String(formData.get("cidade") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const ultima = await db.tarefaKanban.findFirst({
    where: { coluna },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });
  await db.tarefaKanban.create({
    data: { titulo, descricao, coluna, checklist, ordem: (ultima?.ordem ?? 0) + 1, cidade: cidade || null, dueDate: dueDate ? new Date(dueDate) : null },
  });
  revalidatePath("/pipeline");
}

// Edita título, descrição e checklist de uma tarefa.
export async function editarTarefa(id: string, formData: FormData) {
  "use server";
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return;
  await db.tarefaKanban.update({
    where: { id },
    data: {
      titulo,
      descricao: String(formData.get("descricao") ?? "").trim() || null,
      checklist: String(formData.get("checklist") ?? "").trim() || null,
      cidade: String(formData.get("cidade") ?? "").trim() || null,
      dueDate: String(formData.get("dueDate") ?? "").trim() ? new Date(String(formData.get("dueDate"))) : null,
    },
  });
  revalidatePath("/pipeline");
}

export async function excluirTarefa(id: string) {
  "use server";
  await db.tarefaKanban.delete({ where: { id } });
  revalidatePath("/pipeline");
}

// ---------- Colunas de demandas ----------

export async function criarColunaDemanda(titulo: string) {
  "use server";
  const nome = titulo.trim();
  if (!nome) return { ok: false };
  await garantirColunasDemanda();
  const total = await db.colunaDemanda.count();
  const cor = CORES_COLUNA[total % CORES_COLUNA.length];
  await db.colunaDemanda.create({ data: { titulo: nome, cor, ordem: total } });
  revalidatePath("/pipeline");
  return { ok: true };
}

// Exclui uma coluna personalizada. As fixas não podem ser removidas. Os cards
// da coluna voltam para "Demandas" para não se perderem.
export async function excluirColunaDemanda(id: string) {
  "use server";
  const col = await db.colunaDemanda.findUnique({ where: { id } });
  if (!col || col.fixa) return { ok: false, erro: "Coluna fixa não pode ser excluída." };
  await db.tarefaKanban.updateMany({ where: { coluna: id }, data: { coluna: "demandas" } });
  await db.colunaDemanda.delete({ where: { id } });
  revalidatePath("/pipeline");
  return { ok: true };
}

// Renomeia uma coluna de demanda (o id permanece o mesmo).
export async function renomearColunaDemanda(id: string, titulo: string) {
  "use server";
  const nome = titulo.trim();
  if (!nome) return { ok: false };
  await db.colunaDemanda.update({ where: { id }, data: { titulo: nome } });
  revalidatePath("/pipeline");
  return { ok: true };
}

// Reordena as colunas de demanda conforme a lista de ids recebida.
export async function reordenarColunasDemanda(ids: string[]) {
  "use server";
  await Promise.all(
    ids.map((id, i) => db.colunaDemanda.update({ where: { id }, data: { ordem: i } }))
  );
  revalidatePath("/pipeline");
  return { ok: true };
}

// ---------- Resumos de conversa (página /resumos) ----------

// Gera um resumo completo do cliente via IA, baseado nas conversas de WhatsApp,
// negociações e visitas registradas. Salva o resultado em resumoTexto no banco.
export async function gerarResumoClienteIA(clienteId: string): Promise<{ ok: boolean; resumo?: string; erro?: string }> {
  "use server";

  const [cliente, conversas, negociacoes, visitas] = await Promise.all([
    db.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true, nome: true, telefone: true, status: true,
        municipio: { select: { nome: true } },
        resumoTexto: true, perfilIA: true,
        interesseFuturo: true, interesseFuturoNota: true,
      },
    }),
    db.whatsAppConversation.findMany({
      where: { clienteId },
      select: {
        id: true,
        contactName: true,
        lastMessageAt: true,
        mensagens: {
          orderBy: { sentAt: "asc" },
          take: 80,
          select: { direction: true, body: true, sentAt: true },
        },
      } as any,
      take: 3,
    } as any),
    db.negociacao.findMany({
      where: { clienteId },
      orderBy: { criadoEm: "desc" },
      take: 5,
      select: {
        maquinaModelo: true, valor: true, condicaoPagamento: true,
        concorrenteMencionado: true, estagio: true, status: true,
        motivoPerda: true, ultimoContato: true,
      },
    }),
    db.visita.findMany({
      where: { clienteId },
      orderBy: { data: "desc" },
      take: 5,
      select: { data: true, observacao: true },
    }),
  ]);

  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  // Monta o histórico de mensagens do WhatsApp
  const mensagensWA: string[] = [];
  for (const conv of (conversas as any[])) {
    const msgs = (conv.mensagens ?? []) as { direction: string; body: string; sentAt: Date }[];
    for (const m of msgs) {
      const hora = new Date(m.sentAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const autor = m.direction === "OUT" ? "Ederson" : cliente.nome;
      mensagensWA.push(`[${hora}] ${autor}: ${m.body}`);
    }
  }

  const temHistoricoWA = mensagensWA.length > 0;
  const temNegociacoes = negociacoes.length > 0;
  const temVisitas = visitas.length > 0;

  if (!temHistoricoWA && !temNegociacoes && !temVisitas) {
    return { ok: false, erro: "Sem histórico suficiente para gerar resumo. Importe conversas do WhatsApp primeiro." };
  }

  const prompt = `Você é o Cérebro de vendas do Ederson, vendedor New Holland e Dynapac no sul do Espírito Santo.

Analise TODOS os dados abaixo do cliente e gere um resumo executivo completo e útil para o Ederson.

# CLIENTE: ${cliente.nome}
- Telefone: ${cliente.telefone ?? "não cadastrado"}
- Município: ${(cliente as any).municipio?.nome ?? "não cadastrado"}
- Status: ${cliente.status ?? "potencial"}
${cliente.interesseFuturo ? `- ⏳ Interesse futuro: ${cliente.interesseFuturoNota ?? "sim"}` : ""}
${(cliente as any).perfilIA ? `- Perfil IA anterior: ${(cliente as any).perfilIA}` : ""}

${temNegociacoes ? `# NEGOCIAÇÕES:
${negociacoes.map((n) => {
  const diasStr = n.ultimoContato ? `${Math.floor((Date.now() - new Date(n.ultimoContato).getTime()) / 86400000)}d sem contato` : "";
  return `- ${n.maquinaModelo ?? "?"}: R$ ${n.valor?.toLocaleString("pt-BR") ?? "?"} | ${n.estagio} | ${n.status} | ${n.condicaoPagamento ?? ""} | ${n.concorrenteMencionado ? `vs ${n.concorrenteMencionado}` : ""} ${diasStr} ${n.motivoPerda ? `| Perda: ${n.motivoPerda}` : ""}`;
}).join("\n")}
` : ""}

${temVisitas ? `# VISITAS:
${visitas.map((v) => `- ${new Date(v.data).toLocaleDateString("pt-BR")}: ${v.observacao ?? "sem observação"}`).join("\n")}
` : ""}

${temHistoricoWA ? `# CONVERSA NO WHATSAPP (${mensagensWA.length} mensagens):
${mensagensWA.join("\n")}
` : "# Sem histórico de WhatsApp disponível"}

---
Gere um resumo executivo em português brasileiro com:
1. **Situação atual** do cliente (interesse, temperatura, momento de compra)
2. **O que ele quer** (máquina, valor, condição)
3. **Principais objeções ou pendências** se houver
4. **Próximo passo recomendado** para Ederson
5. Se houver dados da conversa, extraia insights estratégicos

Seja direto, prático. Use no máximo 400 palavras. Use markdown com negrito nos pontos chave.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const resumo = (res.content[0] as any).text ?? "";
    if (!resumo) return { ok: false, erro: "IA não retornou resumo." };

    // Salva automaticamente no cadastro do cliente
    await db.cliente.update({
      where: { id: clienteId },
      data: { resumoTexto: resumo } as any,
    });

    return { ok: true, resumo };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

export async function gerarResumoConversa(clienteId: string): Promise<{ ok: boolean; resumo?: string; erro?: string }> {
  "use server";
  return gerarResumoClienteIA(clienteId);
}

// Cria um card a partir do resumo: se a coluna for do funil de negociação,
// cria uma Negociacao; se for uma coluna de demandas, cria uma TarefaKanban.
export async function criarCardDeResumo(formData: FormData): Promise<{ ok: boolean; tipo?: string }> {
  "use server";
  const clienteId = String(formData.get("clienteId") ?? "");
  const coluna = String(formData.get("coluna") ?? "");
  const texto = String(formData.get("texto") ?? "").trim();
  if (!clienteId || !coluna) return { ok: false };

  const colunasFunil = ESTAGIOS.map((e) => e.id);
  if (colunasFunil.includes(coluna)) {
    await db.negociacao.create({
      data: {
        clienteId,
        estagio: coluna,
        proximaAcao: texto || null,
        ultimoContato: new Date(),
      },
    });
    revalidatePath("/pipeline");
    return { ok: true, tipo: "negociacao" };
  }

  // Coluna de demandas → tarefa Trello, com o nome do cliente no título.
  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
  const ultima = await db.tarefaKanban.findFirst({
    where: { coluna },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });
  await db.tarefaKanban.create({
    data: {
      titulo: cliente?.nome ?? "Demanda",
      descricao: texto || null,
      coluna,
      clienteId,
      ordem: (ultima?.ordem ?? 0) + 1,
    },
  });
  revalidatePath("/pipeline");
  return { ok: true, tipo: "tarefa" };
}

// Envia para a agenda a partir do resumo: cria uma visita na data informada.
export async function agendarDeResumo(
  clienteId: string,
  dataRaw: string,
  observacao: string
): Promise<{ ok: boolean; erro?: string }> {
  "use server";
  if (!clienteId || !dataRaw) return { ok: false, erro: "Informe a data." };
  // Campo type="date" (YYYY-MM-DD) → meio-dia em Brasília para não virar o dia.
  const data = new Date(`${dataRaw}T12:00:00-03:00`);
  await db.visita.create({
    data: { clienteId, data, observacao: observacao.trim() || "Agendada pelo resumo da conversa" },
  });
  revalidatePath("/agenda");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

// ---------- Assistente IA (comando por voz/texto, com confirmação) ----------

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

async function acharClientePorNomeAprox(nome: string) {
  const n = nome.trim();
  if (!n) return null;

  // 1. Exato (case insensitive)
  const exato = await db.cliente.findFirst({ where: { nome: { equals: n, mode: "insensitive" } } });
  if (exato) return exato;

  // 2. Contém o nome inteiro
  const contains = await db.cliente.findFirst({ where: { nome: { contains: n, mode: "insensitive" } } });
  if (contains) return contains;

  // 3. Busca fuzzy por palavras normalizadas (tolera erros de grafia como Cezar/Cesar)
  const palavrasBusca = norm(n).split(/\s+/).filter((w) => w.length >= 3);
  if (!palavrasBusca.length) return null;

  const todos = await db.cliente.findMany({ select: { id: true, nome: true } });

  // 3a. Todas as palavras da busca aparecem no nome (ordem irrelevante)
  const todoMatch = todos.find((c) => {
    const nNorm = norm(c.nome);
    return palavrasBusca.every((p) => nNorm.includes(p));
  });
  if (todoMatch) return db.cliente.findUnique({ where: { id: todoMatch.id } });

  // 3b. Primeira palavra + maioria das outras (para nomes com typo)
  const primeira = palavrasBusca[0];
  const parciais = todos.filter((c) => {
    const nNorm = norm(c.nome);
    if (!nNorm.includes(primeira)) return false;
    const acertos = palavrasBusca.filter((p) => nNorm.includes(p)).length;
    return acertos >= Math.ceil(palavrasBusca.length * 0.6);
  });
  if (parciais.length === 1) return db.cliente.findUnique({ where: { id: parciais[0].id } });

  return null;
}

async function acharOuCriarMunicipioAssist(nome: string) {
  const alvo = nome.trim();
  if (!alvo) return null;
  const todos = await db.municipio.findMany();
  let m = todos.find((x) => norm(x.nome) === norm(alvo)) ?? null;
  if (!m) m = await db.municipio.create({ data: { nome: alvo } });
  return m;
}

function resolverEstagioAssist(v?: string): string | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase().trim();
  const porId = ESTAGIOS.find((e) => e.id === s);
  if (porId) return porId.id;
  const porTitulo = ESTAGIOS.find((e) => e.titulo.toLowerCase() === s);
  return porTitulo?.id;
}

function dataBR(s?: string): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
}

// Interpreta um comando em linguagem natural e devolve um PLANO de ações
// resolvidas (com nomes reais) para o usuário confirmar antes de executar.
export async function interpretarComando(
  texto: string
): Promise<{ ok: boolean; resposta?: string; plano?: AcaoPlano[]; erro?: string }> {
  "use server";
  const t = texto.trim();
  if (!t) return { ok: false, erro: "Diga um comando." };

  const { interpretarComandoIA } = await import("@/lib/ai");
  const { resposta, acoes } = await interpretarComandoIA(t);
  if (!acoes.length) {
    return { ok: true, resposta: resposta || "Não entendi o comando. Pode reformular?", plano: [] };
  }

  await garantirColunasDemanda();
  const plano: AcaoPlano[] = [];

  for (const a of acoes) {
    const tipo = String((a as { tipo?: string }).tipo ?? "");
    const g = (k: string) => (a as Record<string, unknown>)[k];
    const str = (k: string) => (g(k) != null ? String(g(k)).trim() : "");

    if (tipo === "criar_cliente") {
      const nome = str("nome");
      if (!nome) { plano.push({ tipo: "criar_cliente", descricao: "Criar cliente", dados: {}, erro: "Nome não informado." }); continue; }
      plano.push({
        tipo: "criar_cliente",
        descricao: `Criar cliente "${nome}"${str("municipio") ? ` em ${str("municipio")}` : ""}${str("telefone") ? ` · ${str("telefone")}` : ""}${g("interesseFuturo") ? " · interesse futuro" : ""}`,
        dados: {
          nome, telefone: str("telefone") || null, municipio: str("municipio") || null,
          observacoes: str("observacoes") || null,
          interesseFuturo: !!g("interesseFuturo"),
          interesseFuturoData: str("interesseFuturoData") || null,
          interesseFuturoNota: str("interesseFuturoNota") || null,
        },
      });
    } else if (tipo === "editar_cliente") {
      const c = await acharClientePorNomeAprox(str("cliente"));
      if (!c) { plano.push({ tipo: "editar_cliente", descricao: `Editar "${str("cliente")}"`, dados: {}, erro: `Cliente "${str("cliente")}" não encontrado.` }); continue; }
      const partes: string[] = [];
      if (str("telefone")) partes.push(`telefone ${str("telefone")}`);
      if (str("municipio")) partes.push(`município ${str("municipio")}`);
      if (str("observacoes")) partes.push("observações");
      if (g("jaComprou") != null) partes.push(g("jaComprou") ? "já comprou" : "não comprou");
      if (g("visitado") != null) partes.push(g("visitado") ? "visitado" : "não visitado");
      if (g("interesseFuturo") != null) partes.push(g("interesseFuturo") ? "interesse futuro" : "sem interesse futuro");
      if (str("interesseFuturoNota")) partes.push(`aguardando: ${str("interesseFuturoNota")}`);
      plano.push({
        tipo: "editar_cliente",
        descricao: `Editar ${c.nome}: ${partes.join(", ") || "sem mudanças"}`,
        dados: {
          clienteId: c.id,
          telefone: g("telefone") != null ? str("telefone") : undefined,
          municipio: str("municipio") || undefined,
          observacoes: g("observacoes") != null ? str("observacoes") : undefined,
          jaComprou: g("jaComprou") != null ? !!g("jaComprou") : undefined,
          visitado: g("visitado") != null ? !!g("visitado") : undefined,
          interesseFuturo: g("interesseFuturo") != null ? !!g("interesseFuturo") : undefined,
          interesseFuturoData: g("interesseFuturoData") != null ? str("interesseFuturoData") : undefined,
          interesseFuturoNota: g("interesseFuturoNota") != null ? str("interesseFuturoNota") : undefined,
        },
      });
    } else if (tipo === "editar_resumo") {
      const c = await acharClientePorNomeAprox(str("cliente"));
      if (!c) { plano.push({ tipo: "editar_resumo", descricao: `Resumo de "${str("cliente")}"`, dados: {}, erro: `Cliente "${str("cliente")}" não encontrado.` }); continue; }
      const partes: string[] = [];
      if (str("resumoMaquinas")) partes.push(`máquina ${str("resumoMaquinas")}`);
      if (g("resumoValor")) partes.push(`valor R$ ${Number(g("resumoValor")).toLocaleString("pt-BR")}`);
      if (str("resumoCondicao")) partes.push(str("resumoCondicao"));
      if (str("resumoTexto")) partes.push("histórico/resumo");
      if (str("proximaVisita")) partes.push(`próxima visita ${dataBR(str("proximaVisita"))}`);
      plano.push({
        tipo: "editar_resumo",
        descricao: `Atualizar resumo de ${c.nome}: ${partes.join(", ") || "sem mudanças"}`,
        dados: {
          clienteId: c.id,
          resumoMaquinas: str("resumoMaquinas") || undefined,
          resumoTexto: str("resumoTexto") || undefined,
          resumoValor: g("resumoValor") != null ? Number(g("resumoValor")) : undefined,
          resumoCondicao: str("resumoCondicao") || undefined,
          proximaVisita: str("proximaVisita") || undefined,
          proximaVisitaNota: str("proximaVisitaNota") || undefined,
        },
      });
    } else if (tipo === "criar_card") {
      const c = await acharClientePorNomeAprox(str("cliente"));
      if (!c) { plano.push({ tipo: "criar_card", descricao: `Card para "${str("cliente")}"`, dados: {}, erro: `Cliente "${str("cliente")}" não encontrado.` }); continue; }
      const estagio = resolverEstagioAssist(str("estagio"));
      const rotuloEstagio = ESTAGIOS.find((e) => e.id === estagio)?.titulo ?? "Primeiro contato";
      const valor = typeof g("valor") === "number" ? (g("valor") as number) : null;
      plano.push({
        tipo: "criar_card",
        descricao: `Criar card de negociação para ${c.nome} em "${rotuloEstagio}"${str("maquina") ? ` · ${str("maquina")}` : ""}${valor ? ` · R$ ${valor.toLocaleString("pt-BR")}` : ""}`,
        dados: { clienteId: c.id, estagio, maquina: str("maquina") || null, valor },
      });
    } else if (tipo === "criar_tarefa") {
      const titulo = str("titulo");
      if (!titulo) { plano.push({ tipo: "criar_tarefa", descricao: "Criar demanda", dados: {}, erro: "Título não informado." }); continue; }
      let colId = "demandas", colTit = "Demandas";
      if (str("coluna")) {
        const col = await db.colunaDemanda.findFirst({ where: { titulo: { contains: str("coluna"), mode: "insensitive" } } });
        if (col) { colId = col.id; colTit = col.titulo; }
      }
      plano.push({
        tipo: "criar_tarefa",
        descricao: `Criar demanda "${titulo}" em "${colTit}"`,
        dados: { titulo, descricao: str("descricao") || null, colunaId: colId },
      });
    } else if (tipo === "agendar_visita") {
      const c = await acharClientePorNomeAprox(str("cliente"));
      if (!c) { plano.push({ tipo: "agendar_visita", descricao: `Agendar visita "${str("cliente")}"`, dados: {}, erro: `Cliente "${str("cliente")}" não encontrado.` }); continue; }
      const data = str("data");
      if (!data) { plano.push({ tipo: "agendar_visita", descricao: `Agendar visita ${c.nome}`, dados: {}, erro: "Data não informada." }); continue; }
      plano.push({
        tipo: "agendar_visita",
        descricao: `Agendar visita ${c.nome} em ${dataBR(data)}${str("observacao") ? ` · ${str("observacao")}` : ""}`,
        dados: { clienteId: c.id, data, observacao: str("observacao") || null },
      });
    }
  }

  return { ok: true, resposta, plano };
}

// Executa o plano confirmado pelo usuário. Cada ação usa os dados já resolvidos.
export async function executarPlano(
  plano: AcaoPlano[]
): Promise<{ ok: boolean; feitos: number; mensagem: string }> {
  "use server";
  let feitos = 0;
  for (const a of plano) {
    if (a.erro) continue;
    const d = a.dados as Record<string, unknown>;
    const s = (k: string) => (d[k] != null ? String(d[k]) : "");
    try {
      if (a.tipo === "criar_cliente") {
        const muni = s("municipio") ? await acharOuCriarMunicipioAssist(s("municipio")) : null;
        await db.cliente.create({
          data: {
            nome: s("nome"), telefone: s("telefone") || null, municipioId: muni?.id ?? null,
            observacoes: s("observacoes") || null, origem: "assistente",
            interesseFuturo: !!d.interesseFuturo,
            interesseFuturoData: parseDataBR(s("interesseFuturoData")),
            interesseFuturoNota: s("interesseFuturoNota") || null,
          },
        });
      } else if (a.tipo === "editar_cliente") {
        const data: Record<string, unknown> = {};
        if (d.telefone !== undefined) data.telefone = s("telefone") || null;
        if (d.observacoes !== undefined) data.observacoes = s("observacoes") || null;
        if (d.jaComprou !== undefined) data.jaComprou = !!d.jaComprou;
        if (d.visitado !== undefined) data.visitado = !!d.visitado;
        if (d.interesseFuturo !== undefined) data.interesseFuturo = !!d.interesseFuturo;
        if (d.interesseFuturoData !== undefined) data.interesseFuturoData = parseDataBR(s("interesseFuturoData"));
        if (d.interesseFuturoNota !== undefined) data.interesseFuturoNota = s("interesseFuturoNota") || null;
        if (s("municipio")) { const m = await acharOuCriarMunicipioAssist(s("municipio")); if (m) data.municipioId = m.id; }
        await db.cliente.update({ where: { id: s("clienteId") }, data });
      } else if (a.tipo === "editar_resumo") {
        const data: Record<string, unknown> = {};
        if (d.resumoMaquinas !== undefined) data.resumoMaquinas = s("resumoMaquinas") || null;
        if (d.resumoTexto !== undefined) data.resumoTexto = s("resumoTexto") || null;
        if (d.resumoValor !== undefined) data.resumoValor = d.resumoValor != null ? Number(d.resumoValor) : null;
        if (d.resumoCondicao !== undefined) data.resumoCondicao = s("resumoCondicao") || null;
        if (d.proximaVisita !== undefined) data.proximaVisita = parseDataBR(s("proximaVisita"));
        if (d.proximaVisitaNota !== undefined) data.proximaVisitaNota = s("proximaVisitaNota") || null;
        await db.cliente.update({ where: { id: s("clienteId") }, data });
      } else if (a.tipo === "criar_card") {
        await db.negociacao.create({
          data: {
            clienteId: s("clienteId"), estagio: s("estagio") || ESTAGIO_INICIAL,
            maquinaModelo: s("maquina") || null,
            valor: typeof d.valor === "number" ? (d.valor as number) : null,
            ultimoContato: new Date(),
          },
        });
      } else if (a.tipo === "criar_tarefa") {
        const ultima = await db.tarefaKanban.findFirst({ where: { coluna: s("colunaId") }, orderBy: { ordem: "desc" }, select: { ordem: true } });
        await db.tarefaKanban.create({
          data: { titulo: s("titulo"), descricao: s("descricao") || null, coluna: s("colunaId") || "demandas", ordem: (ultima?.ordem ?? 0) + 1 },
        });
      } else if (a.tipo === "agendar_visita") {
        await db.visita.create({
          data: { clienteId: s("clienteId"), data: parseDataBR(s("data")) ?? new Date(), observacao: s("observacao") || "Agendada pelo assistente" },
        });
      }
      feitos++;
    } catch (e) {
      console.error("Falha ao executar ação do assistente:", a.tipo, e);
    }
  }

  revalidatePath("/clientes");
  revalidatePath("/pipeline");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");

  return { ok: feitos > 0, feitos, mensagem: feitos > 0 ? `${feitos} ação(ões) executada(s).` : "Nada foi executado." };
}

// ---------- Máquinas usadas (estoque de seminovos) ----------

function numOuNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/\D/g, "");
  return s ? Number(s) : null;
}

export async function criarMaquinaUsada(formData: FormData) {
  "use server";
  const marca = String(formData.get("marca") ?? "").trim();
  const modelo = String(formData.get("modelo") ?? "").trim();
  if (!marca || !modelo) return { ok: false };
  await db.maquinaUsada.create({
    data: {
      marca,
      modelo,
      categoria: String(formData.get("categoria") ?? "outro") || "outro",
      ano: numOuNull(formData.get("ano")),
      horimetro: numOuNull(formData.get("horimetro")),
      preco: numOuNull(formData.get("preco")),
      estado: String(formData.get("estado") ?? "boa") || "boa",
      localizacao: String(formData.get("localizacao") ?? "").trim() || null,
      descricao: String(formData.get("descricao") ?? "").trim() || null,
      fotoUrl: String(formData.get("fotoUrl") ?? "").trim() || null,
      status: String(formData.get("status") ?? "disponivel") || "disponivel",
    },
  });
  revalidatePath("/usadas");
  return { ok: true };
}

export async function editarMaquinaUsada(id: string, formData: FormData) {
  "use server";
  const marca = String(formData.get("marca") ?? "").trim();
  const modelo = String(formData.get("modelo") ?? "").trim();
  if (!marca || !modelo) return { ok: false };
  await db.maquinaUsada.update({
    where: { id },
    data: {
      marca,
      modelo,
      categoria: String(formData.get("categoria") ?? "outro") || "outro",
      ano: numOuNull(formData.get("ano")),
      horimetro: numOuNull(formData.get("horimetro")),
      preco: numOuNull(formData.get("preco")),
      estado: String(formData.get("estado") ?? "boa") || "boa",
      localizacao: String(formData.get("localizacao") ?? "").trim() || null,
      descricao: String(formData.get("descricao") ?? "").trim() || null,
      fotoUrl: String(formData.get("fotoUrl") ?? "").trim() || null,
      status: String(formData.get("status") ?? "disponivel") || "disponivel",
    },
  });
  revalidatePath("/usadas");
  return { ok: true };
}

export async function definirStatusUsada(id: string, status: string) {
  "use server";
  const valido = ["disponivel", "reservada", "vendida"].includes(status) ? status : "disponivel";
  await db.maquinaUsada.update({ where: { id }, data: { status: valido } });
  revalidatePath("/usadas");
  return { ok: true };
}

export async function excluirMaquinaUsada(id: string) {
  "use server";
  await db.maquinaUsada.delete({ where: { id } });
  revalidatePath("/usadas");
  return { ok: true };
}

// Remove os contatos automáticos duplicados ("Contato <número>").
// - Com 14+ dígitos = identificador interno do WhatsApp (lid), NÃO é telefone →
//   lixo certo, remove sempre (mesmo com negociação, que também é falsa).
// - Com até 13 dígitos (telefone normal) → só remove se não tiver negociação,
//   para não apagar um prospect real cadastrado automaticamente.
export async function limparContatosAutomaticos(): Promise<{ ok: boolean; removidos: number }> {
  "use server";
  const candidatos = await db.cliente.findMany({
    where: { nome: { startsWith: "Contato " } },
    select: { id: true, nome: true, _count: { select: { negociacoes: true } } },
  });
  const ids = candidatos
    .filter((c) => {
      const m = c.nome.match(/^Contato (\d+)$/);
      if (!m) return false;
      if (m[1].length >= 14) return true; // lid do WhatsApp = lixo
      return c._count.negociacoes === 0;  // telefone normal: só sem negociação
    })
    .map((c) => c.id);
  if (ids.length) await db.cliente.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/inbox");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true, removidos: ids.length };
}

// ---------- Importar histórico recente do WhatsApp (Z-API) ----------
// Puxa as conversas/mensagens recentes que já existem no número e preenche o CRM,
// para a conversa não começar "vazia". Idempotente: re-rodar não duplica (zapiId).
export async function importarHistoricoZapi(): Promise<{ ok: boolean; conversas: number; clientes: number; erro?: string }> {
  "use server";
  if (!zapi.isEnabled()) return { ok: false, conversas: 0, clientes: 0, erro: "Z-API não está conectada." };

  const chats = await zapi.listarChats();
  if (!chats.length) return { ok: false, conversas: 0, clientes: 0, erro: "A Z-API não retornou conversas (verifique a conexão)." };

  const recente = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 dias
  let novasConversas = 0;
  let novosClientes = 0;

  for (const chat of chats.slice(0, 20)) {
    const msgs = await zapi.mensagensDoChat(chat.phone, 20);
    if (!msgs.length) continue;

    let cliente = await acharClientePorTelefone(chat.phone);
    if (!cliente) {
      const nome = (chat.name || msgs.find((m) => !m.fromMe)?.senderName || `Contato ${chat.phone}`).trim();
      if (deveDescartarContato(nome)) continue;
      cliente = await db.cliente.create({ data: { nome, telefone: chat.phone, origem: "whatsapp" } });
      novosClientes++;
    }

    const ordenadas = [...msgs].sort((a, b) => a.momentMs - b.momentMs);
    // Deduplica manualmente: descarta as que já existem (mesmo zapiId).
    const ids = ordenadas.map((m) => m.messageId);
    const existentes = new Set(
      (await db.conversa.findMany({ where: { zapiId: { in: ids } }, select: { zapiId: true } }))
        .map((c) => c.zapiId)
    );
    const novas = ordenadas.filter((m) => !existentes.has(m.messageId));
    if (novas.length) {
      await db.conversa.createMany({
        data: novas.map((m) => ({
          conteudo: m.texto,
          clienteId: cliente!.id,
          canal: "whatsapp",
          tipo: m.tipo === "audio" ? "audio" : "texto",
          remetente: m.fromMe ? "vendedor" : "cliente",
          zapiId: m.messageId,
          criadoEm: new Date(m.momentMs),
        })),
      });
      novasConversas += novas.length;
    }

    const ultima = ordenadas[ordenadas.length - 1];
    await db.cliente.update({
      where: { id: cliente.id },
      data: {
        ultimoContato: new Date(ultima.momentMs),
        // só marca "aguardando" se a última for do cliente E recente
        aguardandoResposta: !ultima.fromMe && ultima.momentMs >= recente,
      },
    });
  }

  revalidatePath("/inbox");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true, conversas: novasConversas, clientes: novosClientes };
}



// ── CRUD ColunaFunil (colunas dinâmicas do funil de negociações) ──────────

export async function garantirColunasFunil() {
  "use server";
  const count = await db.colunaFunil.count();
  if (count === 0) {
    // Cria as colunas padrão com base nos estágios fixos do pipeline
    const defaults = [
      { titulo: "Primeiro contato",    cor: "border-t-sky-400",    ordem: 1, fixa: true },
      { titulo: "Visitas pendentes",   cor: "border-t-agro-400",   ordem: 2, fixa: true },
      { titulo: "Visita realizada",    cor: "border-t-emerald-400",ordem: 3, fixa: false },
      { titulo: "Proposta no BCNH",    cor: "border-t-violet-400", ordem: 4, fixa: false },
      { titulo: "Vendas Confirmadas",  cor: "border-t-green-500",  ordem: 5, fixa: false },
      { titulo: "Venda perdida",       cor: "border-t-red-400",    ordem: 6, fixa: true },
      { titulo: "FATURADO",            cor: "border-t-yellow-500",  ordem: 7, fixa: true },
    ];
    await db.colunaFunil.createMany({ data: defaults });
  }
  // Migra negociações com estagio (ID antigo) para o título da coluna correspondente
  const mapaLegado: Record<string, string> = {
    primeiro_contato:  "Primeiro contato",
    visita_pendente:   "Visitas pendentes",
    visita_realizada:  "Visita realizada",
    proposta_bcnh:     "Proposta no BCNH",
    proposta_aprovada: "Vendas Confirmadas",
    perdido:           "Venda perdida",
    novo:              "Primeiro contato",
    contato:           "Primeiro contato",
    demandas:          "Primeiro contato",
    proposta:          "Proposta no BCNH",
    negociacao:        "Proposta no BCNH",
    fechamento:        "Vendas Confirmadas",
  };
  for (const [idAntigo, tituloNovo] of Object.entries(mapaLegado)) {
    await db.negociacao.updateMany({
      where: { estagio: idAntigo },
      data: { estagio: tituloNovo },
    }).catch(() => {});
  }
}

export async function criarColunaFunil(titulo: string) {
  "use server";
  const max = await db.colunaFunil.aggregate({ _max: { ordem: true } });
  await db.colunaFunil.create({
    data: { titulo: titulo.trim() || "Nova coluna", ordem: (max._max.ordem ?? 0) + 1 },
  });
  revalidatePath("/negociacoes");
}

export async function excluirColunaFunil(id: string) {
  "use server";
  const col = await db.colunaFunil.findUnique({ where: { id } });
  if (!col || col.fixa) return; // protege colunas fixas
  // Move negociações desta coluna para "primeiro_contato"
  await db.negociacao.updateMany({
    where: { estagio: col.titulo },
    data: { estagio: "primeiro_contato" },
  });
  await db.colunaFunil.delete({ where: { id } });
  revalidatePath("/negociacoes");
}

export async function renomearColunaFunil(id: string, novoTitulo: string) {
  "use server";
  const col = await db.colunaFunil.findUnique({ where: { id } });
  if (!col) return;
  const titulo = novoTitulo.trim();
  if (!titulo) return;
  // Atualiza o estagio nas negociações que usam o título antigo como chave
  await db.negociacao.updateMany({
    where: { estagio: col.titulo },
    data: { estagio: titulo },
  });
  await db.colunaFunil.update({ where: { id }, data: { titulo } });
  revalidatePath("/negociacoes");
}

export async function reordenarColunasFunil(ids: string[]) {
  "use server";
  await Promise.all(ids.map((id, i) => db.colunaFunil.update({ where: { id }, data: { ordem: i + 1 } })));
  revalidatePath("/negociacoes");
}


// ---------- Nova Negociação (popup completo) ----------
// Cria uma negociação completa com marca, máquina, valor formatado, tipo de pagamento
// e todos os campos condicionais (financiamento, consórcio, CRD PME, à vista).
export async function criarNegociacaoCompleta(formData: FormData) {
  "use server";
  let clienteId = String(formData.get("clienteId") ?? "") || null;
  const nomeNovo = String(formData.get("nomeNovo") ?? "").trim();
  if (!clienteId && nomeNovo) {
    if (deveDescartarContato(nomeNovo)) return { ok: false, erro: "Nome inválido" };
    const novo = await db.cliente.create({ data: { nome: nomeNovo, origem: "negociacao" } });
    clienteId = novo.id;
  }
  if (!clienteId) return { ok: false, erro: "Cliente obrigatório" };

  // Valor: remove tudo que não for dígito ou vírgula/ponto, depois converte
  const valorRaw = String(formData.get("valor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const valor = valorRaw ? parseFloat(valorRaw) : null;

  const tipoPagamento = String(formData.get("tipoPagamento") ?? "") || null;
  const estagio = String(formData.get("estagio") ?? "") || "Primeiro contato";
  const negociacaoAntiga = formData.get("negociacaoAntiga") === "true";
  const mesAnoReferencia = negociacaoAntiga ? String(formData.get("mesAnoReferencia") ?? "") || null : null;

  // Entrada
  const entradaValorRaw = String(formData.get("entradaValor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const entradaValor = entradaValorRaw ? parseFloat(entradaValorRaw) : null;
  const entradaPercentualRaw = String(formData.get("entradaPercentual") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const entradaPercentual = entradaPercentualRaw ? parseFloat(entradaPercentualRaw) : null;

  // À vista
  const dataPagamentoRaw = String(formData.get("dataPagamentoAvista") ?? "");
  const pagamentoNaEntrega = formData.get("pagamentoNaEntrega") === "true";

  // CRD PME
  const crdQtdRaw = String(formData.get("crdSaldoParcelasQtd") ?? "");
  const crdParcelaRaw = String(formData.get("crdParcelaValor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");

  await db.negociacao.create({
    data: {
      clienteId,
      marca: String(formData.get("marca") ?? "") || null,
      maquinaModelo: String(formData.get("maquinaModelo") ?? "") || null,
      valor,
      tipoPagamento,
      condicaoPagamento: tipoPagamento,
      bancoFinanciamento: String(formData.get("bancoFinanciamento") ?? "") || null,
      entradaValor,
      entradaPercentual,
      dataPagamentoAvista: dataPagamentoRaw && !pagamentoNaEntrega ? new Date(dataPagamentoRaw + "T12:00:00-03:00") : null,
      pagamentoNaEntrega,
      consorcioTipo: String(formData.get("consorcioTipo") ?? "") || null,
      consorcioCotas: formData.get("consorcioCotas") ? parseInt(String(formData.get("consorcioCotas"))) : null,
      consorcioCredito: formData.get("consorcioCredito") ? parseFloat(String(formData.get("consorcioCredito") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".")) : null,
      crdSaldoParcelasQtd: crdQtdRaw ? parseInt(crdQtdRaw) : null,
      crdParcelaValor: crdParcelaRaw ? parseFloat(crdParcelaRaw) : null,
      concorrenteMencionado: String(formData.get("concorrente") ?? "") || null,
      proximaAcao: String(formData.get("proximaAcao") ?? "") || null,
      dataVisita: String(formData.get("dataVisita") ?? "") ? new Date(String(formData.get("dataVisita")) + ":00-03:00") : null,
      estagio,
      negociacaoAntiga,
      mesAnoReferencia,
      ultimoContato: new Date(),
      // Se estagio é FATURADO, marca como ganha imediatamente
      status: estagio.toLowerCase().includes("faturad") ? "ganha" : "aberta",
      faturadoEm: estagio.toLowerCase().includes("faturad") ? new Date() : null,
    } as any,
  });

  if (estagio.toLowerCase().includes("faturad")) {
    await db.cliente.update({ where: { id: clienteId }, data: { jaComprou: true } });
    revalidatePath("/financeiro");
    revalidatePath("/dashboard");
  }

  revalidatePath("/negociacoes");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ── Pagamento de comissão ────────────────────────────────────────────────
// Marca/desmarca a comissão de UMA negociação como paga, com o mês de referência.
export async function definirComissaoPaga(id: string, paga: boolean, mesPagamento?: string | null) {
  "use server";
  await db.negociacao.update({
    where: { id },
    data: paga
      ? { comissaoPaga: true, comissaoPagaMes: mesPagamento || mesAnoAtualBrasilia(), comissaoPagaEm: new Date() }
      : { comissaoPaga: false, comissaoPagaMes: null, comissaoPagaEm: null },
  });
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/faturadas");
  revalidatePath("/financeiro/comissoes");
  return { ok: true };
}

// Confirma o pagamento de VÁRIAS comissões de uma vez (usado no pop-up do
// 5º dia útil do mês, no setor Financeiro).
export async function marcarComissoesPagas(ids: string[], mesPagamento: string) {
  "use server";
  if (!ids.length) return { ok: false };
  await db.negociacao.updateMany({
    where: { id: { in: ids } },
    data: { comissaoPaga: true, comissaoPagaMes: mesPagamento, comissaoPagaEm: new Date() },
  });
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/faturadas");
  revalidatePath("/financeiro/comissoes");
  return { ok: true };
}

// Calcula comissão de uma negociação (0.5% por padrão)
// Para CRD PME, a comissão só é paga quando 75% do valor for pago
export async function calcularComissao(valor: number | null, taxa = 0.005): Promise<number> {
  if (!valor) return 0;
  return valor * taxa;
}

// Calcula data prevista de pagamento da comissão CRD PME
// Baseado em faturadoEm + parcelas (30 dias cada) até atingir 75% do valor
export async function calcularPrevisaoComissaoCrdPme(
  faturadoEm: Date,
  valor: number,
  entradaValor: number,
  nParcelas: number,
  valorParcela: number
): Promise<Date> {
  // 75% do valor total precisa ser pago
  const alvo75 = valor * 0.75;
  let pago = entradaValor;
  let meses = 0;
  while (pago < alvo75 && meses < nParcelas) {
    pago += valorParcela;
    meses++;
  }
  const previsao = new Date(faturadoEm);
  previsao.setMonth(previsao.getMonth() + meses);
  return previsao;
}
