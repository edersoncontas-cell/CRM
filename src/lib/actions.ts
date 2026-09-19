"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "./db";
import { analisarConversaIA, aprenderTomIA, buscarProspectosIA, gerarFichaTecnicaIA, gerarAplicacoesMaquinaIA, gerarIdeiasPosVendaIA, gerarBattlecardIA, gerarResumoDiferenciaisIA, gerarComparativoCompletoIA, resumirConversaIA, sugerirAbordagemIA, sugerirProximaAcaoIA, llmTexto } from "./ai";
import { PERIODOS_ORIENTADOR, corteDoPeriodo, type PeriodoOrientador } from "./orientador-periodos";
import { vincularMunicipio, alimentarNegociacao, registrarVisitaAgenda } from "./zeus/pipeline";
import { montarContextoCliente } from "./zeus/cerebro-resposta";
import { ESTAGIO_INICIAL, ESTAGIOS_PRE_VISITA, COL_PERDIDO, ESTAGIOS, papelDaColuna, PAPEIS_COLUNA, type PapelColuna } from "./pipeline";
import { sincronizarVisitaComAgenda, removerEventoDaVisita } from "./integrations/google";
import { enviarClienteParaGoogle } from "./google-contatos";
import * as zapi from "./zapi";
import { acharOuCriarConversa, inserirMensagem } from "./whatsapp-store";
import { vigiarConexao, lerMemoriaVigia, type ResultadoVigia } from "@/lib/whatsapp-vigia";
import { descreverConexao } from "@/lib/whatsapp-vigia-regra";
import { registrarAudit } from "./audit";
import { mesAnoAtualBrasilia, inicioDoDiaBrasilia } from "./utils";
import { deveDescartarContato } from "@/lib/filtro-contatos";
import { CHAVES, setConfig } from "./config";
import { atualizarCotacaoCafe } from "./mercado";
import { z } from "zod";
import { parseArquivoCsv, parseArquivoExcel, parseArquivoPdf } from "@/lib/importar-contatos-arquivo";
import { lerParametros, descricaoVendedor } from "@/lib/parametros";

// Validação de maior risco (grava direto no banco a partir de FormData bruto).
const clienteInputSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório."),
  email: z.union([z.string().trim().email("E-mail inválido."), z.literal("")]),
});

// ---------- Clientes ----------
export async function criarCliente(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const parsed = clienteInputSchema.safeParse({
    nome: formData.get("nome") ?? "",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { nome, email } = parsed.data;
  if (await deveDescartarContato(nome)) return { ok: false, erro: "Nome não permitido." };

  const novo = await db.cliente.create({
    data: {
      nome,
      telefone: String(formData.get("telefone") ?? "") || null,
      email: email || null,
      endereco: String(formData.get("endereco") ?? "") || null,
      municipioId: String(formData.get("municipioId") ?? "") || null,
      origem: String(formData.get("origem") ?? "manual") || null,
      jaComprou: formData.get("jaComprou") === "on",
      visitado: formData.get("visitado") === "on",
      interesseFuturo: formData.get("interesseFuturo") === "on",
      interesseFuturoData: parseDataBR(String(formData.get("interesseFuturoData") ?? "")),
      interesseFuturoNota: String(formData.get("interesseFuturoNota") ?? "") || null,
      dataNascimento: parseDataBR(String(formData.get("dataNascimento") ?? "")),
      dataNascimentoOrigem: String(formData.get("dataNascimento") ?? "").trim() ? "manual" : null,
    },
  });
  // Google Contatos (quando o envio está ligado): o cliente novo vai para a agenda do celular.
  await enviarClienteParaGoogle(novo.id).catch((e) => console.error("[google] contato:", e));
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Cadastro rápido pelo nome, de dentro do campo "Cliente" (visita, calendário,
// negociação): quem não está na lista entra na hora e o cadastro completo pode
// ser feito depois. Se já existir alguém com o mesmo nome (sem acento/maiúscula),
// reaproveita em vez de duplicar.
export async function criarClienteRapidoAction(nomeBruto: string): Promise<{ ok: boolean; id?: string; nome?: string; erro?: string }> {
  const nome = String(nomeBruto ?? "").replace(/\s+/g, " ").trim();
  if (nome.length < 2) return { ok: false, erro: "Digite o nome do cliente." };
  if (nome.length > 120) return { ok: false, erro: "Nome muito longo." };
  if (await deveDescartarContato(nome)) return { ok: false, erro: "Nome não permitido." };
  const existente = await db.cliente.findFirst({ where: { nome: { equals: nome, mode: "insensitive" } }, select: { id: true, nome: true } });
  if (existente) return { ok: true, id: existente.id, nome: existente.nome };
  const novo = await db.cliente.create({ data: { nome, origem: "manual" }, select: { id: true, nome: true } });
  await enviarClienteParaGoogle(novo.id).catch((e) => console.error("[google] contato:", e));
  revalidatePath("/clientes");
  revalidatePath("/visitas");
  revalidatePath("/negociacoes");
  return { ok: true, id: novo.id, nome: novo.nome };
}

// Converte o campo date (YYYY-MM-DD) em Date ao meio-dia de Brasília (ou null).
function parseDataBR(raw: string): Date | null {
  const d = raw.trim();
  return d ? new Date(`${d}T12:00:00-03:00`) : null;
}

export async function atualizarCliente(id: string, formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const parsed = clienteInputSchema.safeParse({
    nome: formData.get("nome") ?? "",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { nome, email } = parsed.data;

  const status = String(formData.get("status") ?? "potencial") || "potencial";
  const tel = String(formData.get("telefone") ?? "").replace(/^(\+55|55)(?=\d{10,11}$)/, "");
  // Aniversário: só mexe se o formulário trouxe o campo. Mudou → "manual";
  // igual ao que já estava → mantém a origem (pode ter vindo de um documento).
  const nascimento: { dataNascimento?: Date | null; dataNascimentoOrigem?: string | null } = {};
  if (formData.has("dataNascimento")) {
    const novo = parseDataBR(String(formData.get("dataNascimento") ?? ""));
    const atual = await db.cliente.findUnique({ where: { id }, select: { dataNascimento: true } });
    const mesmoDia = !!novo && !!atual?.dataNascimento && novo.toISOString().slice(0, 10) === atual.dataNascimento.toISOString().slice(0, 10);
    if (!mesmoDia) {
      nascimento.dataNascimento = novo;
      nascimento.dataNascimentoOrigem = novo ? "manual" : null;
    }
  }
  await db.cliente.update({
    where: { id },
    data: {
      nome,
      telefone: tel || null,
      email: email || null,
      municipioId: String(formData.get("municipioId") ?? "") || null,
      status,
      jaComprou: status === "cliente",
      interesseFuturo: formData.get("interesseFuturo") === "on",
      interesseFuturoData: parseDataBR(String(formData.get("interesseFuturoData") ?? "")),
      interesseFuturoNota: String(formData.get("interesseFuturoNota") ?? "") || null,
      ...nascimento,
    },
  });
  await enviarClienteParaGoogle(id).catch((e) => console.error("[google] contato:", e));
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Sincroniza a frota de máquinas do cliente (substitui a lista inteira).
export async function gerenciarFrotaCliente(
  clienteId: string,
  frota: { marca: string; modelo: string }[]
): Promise<void> {
  try {
    // Transação: se alguma inserção falhar no meio do loop, o DELETE inicial
    // é desfeito junto — a frota nunca fica parcialmente apagada.
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`DELETE FROM "ClienteMaquina" WHERE "clienteId" = $1`, clienteId);
      for (const f of frota) {
        if (!f.modelo || f.modelo === "__outro__") continue;
        const id = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await tx.$executeRawUnsafe(
          `INSERT INTO "ClienteMaquina" ("id","clienteId","marca","modelo","criadoEm") VALUES ($1,$2,$3,$4,NOW())`,
          id, clienteId, f.marca, f.modelo
        );
      }
    });
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
  revalidatePath("/atendimento");
  return { ok: true };
}

// Mescla um ou mais clientes duplicados dentro de um "principal": move todo o
// histórico ligado (negociações, visitas, conversas, tarefas, alertas, frota,
// auditoria, indicações) para o principal, preenche campos vazios do
// principal com dados dos duplicados, e então exclui os duplicados. Nunca é
// automático — o ZEUS só detecta e alerta (ver zeus/tick.ts), a fusão em si
// exige escolha manual de qual cliente é o principal.
export async function mesclarClientes(
  principalId: string,
  duplicataIds: string[]
): Promise<{ ok: boolean; erro?: string }> {
  const idsUnicos = Array.from(new Set(duplicataIds)).filter((id) => id !== principalId);
  if (!idsUnicos.length) return { ok: false, erro: "Selecione ao menos um cliente duplicado diferente do principal." };

  const [principal, duplicatas] = await Promise.all([
    db.cliente.findUnique({ where: { id: principalId } }),
    db.cliente.findMany({ where: { id: { in: idsUnicos } } }),
  ]);
  if (!principal) return { ok: false, erro: "Cliente principal não encontrado." };
  if (duplicatas.length !== idsUnicos.length) return { ok: false, erro: "Algum cliente duplicado não foi encontrado." };

  await db.$transaction([
    db.clienteMaquina.updateMany({ where: { clienteId: { in: idsUnicos } }, data: { clienteId: principalId } }),
    db.visita.updateMany({ where: { clienteId: { in: idsUnicos } }, data: { clienteId: principalId } }),
    db.negociacao.updateMany({ where: { clienteId: { in: idsUnicos } }, data: { clienteId: principalId } }),
    db.tarefaKanban.updateMany({ where: { clienteId: { in: idsUnicos } }, data: { clienteId: principalId } }),
    db.alerta.updateMany({ where: { clienteId: { in: idsUnicos } }, data: { clienteId: principalId } }),
    db.auditLog.updateMany({ where: { clienteId: { in: idsUnicos } }, data: { clienteId: principalId } }),
    db.whatsAppConversation.updateMany({ where: { clienteId: { in: idsUnicos } }, data: { clienteId: principalId } }),
    db.cliente.updateMany({ where: { indicadoPorId: { in: idsUnicos } }, data: { indicadoPorId: principalId } }),
  ]);

  // Preenche campos vazios do principal com o que os duplicados tiverem —
  // nunca sobrescreve um valor que o principal já possui.
  const patch: Record<string, unknown> = {};
  for (const dup of duplicatas) {
    if (!principal.telefone && dup.telefone && !patch.telefone) patch.telefone = dup.telefone;
    if (!principal.email && dup.email && !patch.email) patch.email = dup.email;
    if (!principal.endereco && dup.endereco && !patch.endereco) patch.endereco = dup.endereco;
    if (!principal.municipioId && dup.municipioId && !patch.municipioId) patch.municipioId = dup.municipioId;
    if (!principal.observacoes && dup.observacoes && !patch.observacoes) patch.observacoes = dup.observacoes;
    if (!principal.fotoUrl && dup.fotoUrl && !patch.fotoUrl) patch.fotoUrl = dup.fotoUrl;
    if (!principal.perfilIA && dup.perfilIA && !patch.perfilIA) patch.perfilIA = dup.perfilIA;
    if (!principal.perfilDISC && dup.perfilDISC && !patch.perfilDISC) patch.perfilDISC = dup.perfilDISC;
    if (!principal.resumoTexto && dup.resumoTexto && !patch.resumoTexto) patch.resumoTexto = dup.resumoTexto;
    const ultimoContatoAtual = (patch.ultimoContato as Date | undefined) ?? principal.ultimoContato;
    if (dup.ultimoContato && (!ultimoContatoAtual || dup.ultimoContato > ultimoContatoAtual)) {
      patch.ultimoContato = dup.ultimoContato;
    }
  }
  if (Object.keys(patch).length) {
    await db.cliente.update({ where: { id: principalId }, data: patch });
  }

  await db.cliente.deleteMany({ where: { id: { in: idsUnicos } } });

  await registrarAudit({
    acao: "cliente_atualizado",
    origem: "usuario",
    descricao: `Mesclou ${duplicatas.length} cliente(s) duplicado(s) (${duplicatas.map((d) => d.nome).join(", ")}) em "${principal.nome}".`,
    entidade: "Cliente",
    entidadeId: principalId,
    clienteId: principalId,
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${principalId}`);
  revalidatePath("/dashboard");
  revalidatePath("/zeus");
  return { ok: true };
}

// Busca dados de exibição de clientes por id (usado no modal de mesclagem, a
// partir da lista {id,nome} guardada no detalhe do alerta do ZEUS).
export async function buscarClientesPorIds(
  ids: string[]
): Promise<{ id: string; nome: string; telefone: string | null; municipio: string | null; criadoEm: string }[]> {
  const clientes = await db.cliente.findMany({
    where: { id: { in: ids } },
    include: { municipio: { select: { nome: true } } },
  });
  return clientes.map((c) => ({
    id: c.id, nome: c.nome, telefone: c.telefone, municipio: c.municipio?.nome ?? null, criadoEm: c.criadoEm.toISOString(),
  }));
}

// ---------- Visitas ----------
// Registra uma visita ao cliente (data + observação) e marca como visitado.
export async function adicionarVisita(clienteId: string, formData: FormData) {
  const dataRaw = String(formData.get("data") ?? "");
  if (!dataRaw) return;
  // Campo "data" no formato YYYY-MM-DD + "horario" opcional HH:mm (seletor
  // estilo iOS). Sem horário, mantém meio-dia em Brasília (evita virar o dia
  // anterior por diferença de fuso ao salvar no banco).
  const horarioRaw = String(formData.get("horario") ?? "").trim();
  const horario = /^\d{2}:\d{2}$/.test(horarioRaw) ? horarioRaw : "12:00";
  const data = new Date(`${dataRaw}T${horario}:00-03:00`);
  // Cidade da visita: a informada no formulário; senão, o município do cadastro.
  let cidade = String(formData.get("cidade") ?? "").trim() || null;
  if (!cidade) {
    const cli = await db.cliente.findUnique({ where: { id: clienteId }, select: { municipio: { select: { nome: true } } } });
    cidade = cli?.municipio?.nome ?? null;
  }
  const visita = await db.visita.create({
    data: {
      clienteId,
      data,
      cidade,
      observacao: String(formData.get("observacao") ?? "") || null,
    },
  });
  await sincronizarVisitaComAgenda(visita.id).catch((e) => console.error("[google] visita:", e));
  await db.cliente.update({ where: { id: clienteId }, data: { visitado: true } });
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/visitas");
  revalidatePath("/dashboard");
}

// ✓ / ✗ da visita. A meta de visitas conta só as "realizada".
export async function marcarVisitaAction(id: string, status: "realizada" | "nao_realizada" | "agendada"): Promise<{ ok: boolean }> {
  const v = await db.visita.findUnique({ where: { id }, select: { clienteId: true } });
  if (!v) return { ok: false };
  await db.visita.update({ where: { id }, data: { status, realizadaEm: status === "realizada" ? new Date() : null } });
  if (status === "realizada") await db.cliente.update({ where: { id: v.clienteId }, data: { visitado: true, ultimoContato: new Date() } }).catch(() => {});
  revalidatePath("/visitas"); revalidatePath("/dashboard"); revalidatePath("/alertas"); revalidatePath(`/clientes/${v.clienteId}`);
  return { ok: true };
}

// ✗ com reagendamento: marca a original como não realizada e cria a nova na
// data escolhida (mesmo cliente, cidade e observação), ligada à original.
export async function reagendarVisitaAction(id: string, dataISO: string, horario: string): Promise<{ ok: boolean; erro?: string; novaId?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) return { ok: false, erro: "Data inválida." };
  const hora = /^\d{2}:\d{2}$/.test(horario) ? horario : "09:00";
  const original = await db.visita.findUnique({ where: { id } });
  if (!original) return { ok: false, erro: "Visita não encontrada." };
  const nova = await db.visita.create({
    data: {
      clienteId: original.clienteId, data: new Date(`${dataISO}T${hora}:00-03:00`), cidade: original.cidade, observacao: original.observacao,
      status: "agendada", reagendadaDeId: original.id,
    },
  });
  await db.visita.update({ where: { id }, data: { status: "nao_realizada", realizadaEm: null } });
  await sincronizarVisitaComAgenda(nova.id).catch((e) => console.error("[google] visita:", e));
  revalidatePath("/visitas"); revalidatePath("/dashboard"); revalidatePath("/alertas"); revalidatePath(`/clientes/${original.clienteId}`);
  return { ok: true, novaId: nova.id };
}

// Arrastar a visita para outro dia da semana: troca só a data, mantendo o
// horário, a cidade e a observação. Vale apenas para visita ainda agendada —
// realizada/não realizada é histórico e não se move (quando o vendedor quer
// remarcar uma que não aconteceu, o caminho é o ✗ → reagendar, que preserva
// o registro antigo).
export async function moverVisitaParaDiaAction(id: string, diaISO: string): Promise<{ ok: boolean; erro?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(diaISO)) return { ok: false, erro: "Data inválida." };
  const visita = await db.visita.findUnique({ where: { id } });
  if (!visita) return { ok: false, erro: "Visita não encontrada." };
  if (visita.status !== "agendada") return { ok: false, erro: "Só dá para mover visita que ainda está agendada." };

  const hora = visita.data.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const nova = new Date(`${diaISO}T${hora}:00-03:00`);
  if (nova.getTime() === visita.data.getTime()) return { ok: true };

  await db.visita.update({ where: { id }, data: { data: nova } });
  await sincronizarVisitaComAgenda(id).catch((e) => console.error("[google] mover visita:", e));
  revalidatePath("/visitas"); revalidatePath("/dashboard"); revalidatePath("/alertas"); revalidatePath(`/clientes/${visita.clienteId}`);
  return { ok: true };
}

export async function removerVisita(id: string, clienteId: string) {
  await removerEventoDaVisita(id);
  await db.visita.delete({ where: { id } });
  revalidatePath("/alertas");
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/visitas");
  revalidatePath("/dashboard");
}

// Marca que respondi ao cliente sem enviar nada pelo WhatsApp (apenas baixa o alerta).
export async function marcarRespondido(clienteId: string) {
  await db.cliente.update({
    where: { id: clienteId },
    data: { aguardandoResposta: false, ultimoContato: new Date() },
  });
  revalidatePath("/dashboard");
  revalidatePath("/atendimento");
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
  revalidatePath("/atendimento");
  return { ok: true };
}

// ---------- Cotação do café (letreiro do Dashboard) ----------
// Sem API gratuita confiável para arábica/conilon — valor informado manualmente
// aqui, uma vez por dia. O dólar é buscado ao vivo (ver lib/mercado.ts).
export async function atualizarCotacaoCafeAction(formData: FormData): Promise<{ ok: boolean }> {
  const arabicaRaw = String(formData.get("arabica") ?? "").replace(",", ".");
  const conilonRaw = String(formData.get("conilon") ?? "").replace(",", ".");
  const arabica = arabicaRaw ? parseFloat(arabicaRaw) : null;
  const conilon = conilonRaw ? parseFloat(conilonRaw) : null;
  await atualizarCotacaoCafe(
    arabica != null && Number.isFinite(arabica) ? arabica : null,
    conilon != null && Number.isFinite(conilon) ? conilon : null,
  );
  revalidatePath("/dashboard");
  revalidatePath("/configuracoes");
  return { ok: true };
}

// Aprende o estilo de fala do Ederson a partir das mensagens que ele já enviou
// e salva no banco para a IA imitar nas respostas.
// CRÍTICO: excluir TODAS as mensagens geradas por IA (Cérebro, Orientador de
// Vendas, e os antigos gravados como "Agnes") — sem isso a IA aprende o estilo
// com as próprias respostas dela, um ciclo vicioso que amplifica os vícios de
// fraseado (ex: toda resposta começando com a mesma saudação).
const OPERADORES_IA = ["Cérebro", "Orientador de Vendas", "Agnes"];

export async function aprenderMeuEstilo(): Promise<{ ok: boolean }> {
  const minhas = await db.whatsAppMessage.findMany({
    where: {
      direction: "OUT",
      isDraft: false,
      OR: [
        { operatorDisplayName: null },
        { operatorDisplayName: { notIn: OPERADORES_IA } },
      ],
    },
    orderBy: { sentAt: "desc" },
    take: 40,
    select: { body: true },
  });
  if (minhas.length === 0) return { ok: false };

  const guia = await aprenderTomIA(minhas.map((m) => m.body));
  const existente = await db.estiloDeFala.findFirst();
  if (existente) {
    await db.estiloDeFala.update({ where: { id: existente.id }, data: { guia } });
  } else {
    await db.estiloDeFala.create({ data: { guia } });
  }
  return { ok: true };
}

// ---------- WhatsApp: responder direto do CRM ----------
// Envia a resposta pela Z-API e registra na MESMA conversa de /atendimento
// (WhatsAppConversation/WhatsAppMessage) — assim a resposta do cliente
// continua a thread normalmente, em vez de cair num sistema paralelo morto.
export async function enviarResposta(
  clienteId: string,
  texto: string
): Promise<{ ok: boolean; erro?: string }> {
  const conteudo = texto.trim();
  if (!conteudo) return { ok: false, erro: "Mensagem vazia." };

  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente?.telefone) return { ok: false, erro: "Cliente sem telefone cadastrado." };
  if (!zapi.isEnabled()) return { ok: false, erro: "WhatsApp não está conectado. Configure em /conexao." };

  const { conv } = await acharOuCriarConversa({
    phone: cliente.telefone, lid: null, isGroup: false, contactName: cliente.nome,
  });

  try {
    const zapiMessageId = await zapi.sendText(conv.externalPhone, conteudo);
    await inserirMensagem(conv.id, {
      direction: "OUT", body: conteudo, origin: "CRM", operatorDisplayName: "Você",
      zapiMessageId, sendStatus: "SENT",
    });
  } catch (e) {
    const unconfirmed = e instanceof zapi.EnvioNaoConfirmadoError;
    await inserirMensagem(conv.id, {
      direction: "OUT", body: conteudo, origin: "CRM", operatorDisplayName: "Você",
      sendStatus: unconfirmed ? "UNCONFIRMED" : "FAILED",
    });
    if (!unconfirmed) {
      return { ok: false, erro: `O WhatsApp recusou o envio: ${String(e).slice(0, 200)} — verifique a conexão em /conexao.` };
    }
  }

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
    extra: { chars: conteudo.length },
  });

  revalidatePath("/atendimento");
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
    if (await deveDescartarContato(nomeRaw)) { ignorados++; continue; }

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

// Importa clientes a partir de uma lista já estruturada (usado pelo Cérebro ao
// ler um arquivo anexado — CSV/vCard exportado do Google Contacts, WhatsApp
// etc.). Mesma regra de dedup do importarClientesCsv.
export async function importarContatosEstruturados(
  contatos: { nome: string; telefone?: string; municipio?: string }[],
  origem: string = "cerebro_importacao"
): Promise<{ importados: number; ignorados: number; erros: number }> {
  const municipios = await db.municipio.findMany();
  const normStr = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  let importados = 0;
  let ignorados = 0;
  let erros = 0;

  for (const c of contatos) {
    const nomeRaw = c.nome?.trim() ?? "";
    if (!nomeRaw || (await deveDescartarContato(nomeRaw))) { ignorados++; continue; }

    const telefone = c.telefone ? normalizarTelefone(c.telefone) : null;

    try {
      const condicoes: object[] = [];
      if (telefone) {
        condicoes.push({ telefone });
        if (!telefone.startsWith("55") && telefone.length >= 10) {
          condicoes.push({ telefone: `55${telefone}` });
        }
      } else {
        condicoes.push({ nome: nomeRaw });
      }
      const existe = await db.cliente.findFirst({ where: { OR: condicoes } });
      if (existe) { ignorados++; continue; }

      const muniRaw = c.municipio?.trim() ?? "";
      const muni = muniRaw ? municipios.find((m) => normStr(m.nome) === normStr(muniRaw)) : undefined;

      await db.cliente.create({
        data: { nome: nomeRaw, telefone, municipioId: muni?.id ?? null, origem },
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

// Importa clientes a partir de um arquivo (Excel .xlsx/.xls, CSV ou PDF) —
// tolerante a exports de Google Contacts em qualquer idioma, Outlook ou
// listas genéricas (ver src/lib/importar-contatos-arquivo.ts para a lógica
// de detecção de colunas). Pula quem já existe (mesma regra de dedup por
// telefone/nome do importarContatosEstruturados).
export async function importarClientesArquivo(
  formData: FormData
): Promise<{ importados: number; ignorados: number; erros: number; erro?: string }> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { importados: 0, ignorados: 0, erros: 0, erro: "Nenhum arquivo enviado." };
  }

  const nomeArquivo = arquivo.name.toLowerCase();
  const buf = Buffer.from(await arquivo.arrayBuffer());

  let resultado;
  if (nomeArquivo.endsWith(".pdf")) {
    resultado = await parseArquivoPdf(buf);
  } else if (nomeArquivo.endsWith(".csv")) {
    resultado = parseArquivoCsv(buf);
  } else if (nomeArquivo.endsWith(".xlsx") || nomeArquivo.endsWith(".xls")) {
    resultado = await parseArquivoExcel(buf);
  } else {
    return {
      importados: 0, ignorados: 0, erros: 0,
      erro: "Formato não reconhecido. Envie um arquivo .xlsx, .xls, .csv ou .pdf.",
    };
  }

  if (resultado.erro) {
    return { importados: 0, ignorados: 0, erros: 0, erro: resultado.erro };
  }

  return importarContatosEstruturados(resultado.contatos, "importacao_arquivo");
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
    if (await deveDescartarContato(nomeNovo)) return;
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
  const neg = await db.negociacao.update({
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

  // Interesse futuro: mês/ano para retomar contato (reaproveita os mesmos
  // campos já usados no cadastro do cliente e no widget do dashboard).
  const interesseFuturoMes = String(formData.get("interesseFuturoMes") ?? "");
  if (interesseFuturoMes) {
    const [ano, mes] = interesseFuturoMes.split("-").map(Number);
    if (ano && mes) {
      await db.cliente.update({
        where: { id: neg.clienteId },
        data: {
          interesseFuturo: true,
          interesseFuturoData: new Date(ano, mes - 1, 1),
          interesseFuturoNota: neg.maquinaModelo ? `Retomar negociação — ${neg.maquinaModelo}` : "Retomar negociação",
        },
      });
    }
  }

  revalidatePath("/pipeline");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
}

// Coluna do funil pelo título (exato ou sem diferenciar maiúsculas), ou por
// id legado (primeiro_contato, proposta_bcnh...). Retorna null se não existir.
export async function resolverColunaFunil(estagio: string): Promise<{ titulo: string; papel: PapelColuna } | null> {
  const colunas = await db.colunaFunil.findMany({ select: { titulo: true, papel: true, ordem: true }, orderBy: { ordem: "asc" } });
  const legado: Record<string, string> = {
    primeiro_contato: "Primeiro contato", visita_pendente: "Visitas pendentes", visita_realizada: "Visita realizada",
    proposta_bcnh: "Proposta no BCNH", proposta_aprovada: "Vendas Confirmadas", perdido: "Venda perdida",
    novo: "Primeiro contato", contato: "Primeiro contato", proposta: "Proposta no BCNH", negociacao: "Proposta no BCNH", fechamento: "Vendas Confirmadas",
  };
  const alvo = (legado[estagio] ?? estagio).trim().toLowerCase();
  const col = colunas.find((c) => c.titulo === estagio) ?? colunas.find((c) => c.titulo.toLowerCase() === alvo);
  if (col) return { titulo: col.titulo, papel: papelDaColuna(col) };
  return null;
}

async function colunaComPapel(papel: PapelColuna): Promise<string | null> {
  const colunas = await db.colunaFunil.findMany({ select: { titulo: true, papel: true }, orderBy: { ordem: "asc" } });
  return colunas.find((c) => papelDaColuna(c) === papel)?.titulo ?? null;
}

export async function moverNegociacao(id: string, estagio: string, motivoPerda?: string) {
  // O que acontece com a negociação depende do PAPEL da coluna, não do nome.
  const col = await resolverColunaFunil(estagio);
  const tituloFinal = col?.titulo ?? estagio;
  const papel: PapelColuna = col?.papel ?? "em_negociacao";

  if (papel === "perdida") {
    await db.negociacao.update({
      where: { id },
      data: { status: "perdida", estagio: tituloFinal, ultimoContato: new Date(), ...(motivoPerda ? { motivoPerda } : {}) },
    });
  } else if (papel === "faturado") {
    // FATURADO: marca como ganha, registra faturadoEm, atualiza cliente
    const neg = await db.negociacao.update({
      where: { id },
      data: { status: "ganha", estagio: tituloFinal, faturadoEm: new Date(), ultimoContato: new Date() },
      include: { cliente: true },
    });
    await db.cliente.update({ where: { id: neg.clienteId }, data: { jaComprou: true } });
    await registrarAudit({
      acao: "negociacao_ganha",
      origem: "usuario",
      descricao: `Negociação FATURADA! ${neg.maquinaModelo ?? "Máquina"} para ${neg.cliente.nome}`,
      entidade: "Negociacao",
      entidadeId: id,
      clienteId: neg.clienteId,
      extra: { maquina: neg.maquinaModelo ?? null, valor: neg.valor ?? null, cliente: neg.cliente.nome, tipoPagamento: neg.tipoPagamento ?? null },
    });
    await usadaDaTrocaParaEstoque(id).catch((e) => console.error("[usada-troca] estoque:", e));
    revalidatePath("/dashboard");
    revalidatePath("/financeiro");
  } else if (papel === "confirmada") {
    const neg = await db.negociacao.update({
      where: { id },
      data: { status: "ganha", estagio: tituloFinal, ultimoContato: new Date() },
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
      extra: { maquina: neg.maquinaModelo ?? null, valor: neg.valor ?? null, cliente: neg.cliente.nome },
    });
    revalidatePath("/dashboard");
    revalidatePath("/financeiro");
  } else {
    await db.negociacao.update({
      where: { id },
      data: { status: "aberta", estagio: tituloFinal, ultimoContato: new Date(), faturadoEm: null },
    });
  }
  revalidatePath("/negociacoes");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
}

export async function excluirNegociacao(id: string) {
  await db.negociacao.delete({ where: { id } });
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
}

export async function marcarPerdida(id: string, motivo: string) {
  const colPerdida = await colunaComPapel("perdida");
  const neg = await db.negociacao.update({
    where: { id },
    data: { status: "perdida", motivoPerda: motivo, estagio: colPerdida ?? COL_PERDIDO.titulo },
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
  revalidatePath("/negociacoes");
  revalidatePath("/financeiro");
}

export async function marcarGanha(id: string) {
  // Normaliza para o título REAL da coluna FATURADO (pode ter sido renomeada
  // pelo usuário) — sem isso, a negociação vira "ganha" com um estagio legado
  // que não bate com nenhuma coluna do funil (some do funil, mas continua
  // aparecendo no Financeiro, que lista todo status "ganha").
  const colFaturado = await colunaComPapel("faturado");
  const neg = await db.negociacao.update({
    where: { id },
    data: { status: "ganha", estagio: colFaturado ?? "FATURADO", faturadoEm: new Date() },
    include: { cliente: true },
  });
  await usadaDaTrocaParaEstoque(id).catch((e) => console.error("[usada-troca] estoque:", e));
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
  if (nome && (await deveDescartarContato(nome))) return null;

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
  await db.maquina.update({ where: { id }, data: { maisComercializado: valor } });
  revalidatePath("/maquinas");
}

// ---------- Ranking de vendas ----------
export async function setVolumeVendas(id: string, valor: number) {
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

// ---------- Setor de Aplicações & Nichos ----------

// Lista as máquinas próprias (New Holland/Dynapac) com o texto de aplicações
// já gerado — alimenta a página /aplicacoes.
export async function listarAplicacoesMaquinas() {
  const maquinas = await db.maquina.findMany({
    where: { proprio: true },
    select: { id: true, marca: true, modelo: true, categoria: true, aplicacoes: true },
    orderBy: [{ marca: "asc" }, { categoria: "asc" }, { modelo: "asc" }],
  });
  return maquinas;
}

// Gera o texto de aplicações/nichos de uma máquina via IA (revisável antes de salvar).
export async function preencherAplicacoesMaquinaIA(id: string): Promise<{ ok: boolean; aplicacoes?: string; erro?: string }> {
  const maq = await db.maquina.findUnique({
    where: { id },
    select: { marca: true, modelo: true, categoria: true, descricao: true, especificacoes: true, pontosFortes: true, diferenciais: true },
  });
  if (!maq) return { ok: false, erro: "Máquina não encontrada" };

  const aplicacoes = await gerarAplicacoesMaquinaIA(maq);
  if (!aplicacoes) {
    return { ok: false, erro: "IA não habilitada. Configure OPENAI_API_KEY, ANTHROPIC_API_KEY ou GROQ_API_KEY." };
  }
  return { ok: true, aplicacoes };
}

export async function salvarAplicacoesMaquina(id: string, aplicacoes: string) {
  await db.maquina.update({ where: { id }, data: { aplicacoes: aplicacoes || null } });
  revalidatePath("/aplicacoes");
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
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Nenhum arquivo enviado." };
  }
  const nome = arquivo.name.toLowerCase();
  const ehPdf = arquivo.type === "application/pdf" || nome.endsWith(".pdf");
  const ehImagem = arquivo.type.startsWith("image/");
  const ehTexto = arquivo.type.startsWith("text/") || /\.(txt|html?|md|csv)$/.test(nome);
  // Limite prático: a Vercel corta requests em ~4.5MB independente do que o
  // Next configura — 4MB dá margem de segurança para PDF/imagem. Texto é
  // sempre pequeno, mas mantemos 2MB de teto por segurança.
  const limite = ehTexto ? 2 * 1024 * 1024 : 4 * 1024 * 1024;
  if (arquivo.size > limite) {
    const tamanhoMb = (arquivo.size / (1024 * 1024)).toFixed(1);
    const limiteMb = limite / (1024 * 1024);
    return { ok: false, erro: `Arquivo de ${tamanhoMb}MB — o limite é ${limiteMb}MB. Comprima o PDF ou envie por partes.` };
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

// Preenche em lote as fichas técnicas ainda vazias com a IA. Retorna quantas
// foram preenchidas. Roda só nas máquinas sem `especificacoes`.
export async function preencherFichasVaziasIA(
  apenasProprias: boolean
): Promise<{ ok: boolean; preenchidas: number; erro?: string }> {
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
  revalidatePath("/maquinas/fichas");
  return { ok: true, preenchidas };
}

// Gera os argumentos de venda (battlecards) comparando minha máquina com os
// concorrentes da mesma faixa, usando as fichas técnicas. Chamado sob demanda.
export async function gerarBattlecardsComparativoIA(
  minhaId: string,
  concorrentesIds: string[]
): Promise<{ ok: boolean; cards?: { id: string; texto: string }[]; erro?: string }> {
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

// ---------- Comparativo 2.0 — Notas de conhecimento do vendedor ----------
export async function criarNotaMaquina(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const maquinaId = String(formData.get("maquinaId") ?? "");
  const concorrenteId = String(formData.get("concorrenteId") ?? "") || null;
  const texto = String(formData.get("texto") ?? "").trim();
  if (!maquinaId || !texto) return { ok: false, erro: "Máquina e texto são obrigatórios." };
  await db.notaMaquina.create({ data: { maquinaId, concorrenteId, texto } });
  revalidatePath("/comparativo");
  return { ok: true };
}

export async function editarNotaMaquina(id: string, texto: string): Promise<{ ok: boolean }> {
  const t = texto.trim();
  if (!t) return { ok: false };
  await db.notaMaquina.update({ where: { id }, data: { texto: t } }).catch(() => {});
  revalidatePath("/comparativo");
  return { ok: true };
}

export async function excluirNotaMaquina(id: string): Promise<{ ok: boolean }> {
  await db.notaMaquina.delete({ where: { id } }).catch(() => {});
  revalidatePath("/comparativo");
  return { ok: true };
}

// Resumo de diferenciais COM benefício prático — alimentado pelas fichas
// técnicas + notas do vendedor da(s) máquina(s) envolvidas. Nunca inventa specs.
export async function gerarResumoDiferenciaisAction(
  minhaId: string,
  concorrentesIds: string[]
): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  const minha = await db.maquina.findUnique({
    where: { id: minhaId },
    select: { marca: true, modelo: true, especificacoes: true, pontosFortes: true, diferenciais: true, argumentos: true },
  });
  if (!minha) return { ok: false, erro: "Máquina não encontrada" };

  const [concs, notas] = await Promise.all([
    db.maquina.findMany({ where: { id: { in: concorrentesIds } }, select: { id: true, marca: true, modelo: true, especificacoes: true } }),
    db.notaMaquina.findMany({
      where: { maquinaId: minhaId, OR: [{ concorrenteId: null }, { concorrenteId: { in: concorrentesIds } }] },
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  const texto = await gerarResumoDiferenciaisIA(minha, concs, notas.map((n) => n.texto));
  if (!texto.trim()) return { ok: false, erro: "IA não habilitada. Configure GROQ_API_KEY ou ANTHROPIC_API_KEY." };
  return { ok: true, texto };
}

// Comparativo profissional completo multi-concorrente — evolução do
// "Gerar argumentos com IA" (battlecards), aceita múltiplos concorrentes.
export async function gerarComparativoCompletoAction(
  minhaId: string,
  concorrentesIds: string[]
): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  const minha = await db.maquina.findUnique({
    where: { id: minhaId },
    select: { marca: true, modelo: true, especificacoes: true, pontosFortes: true, diferenciais: true, argumentos: true, imagemUrl: true },
  });
  if (!minha) return { ok: false, erro: "Máquina não encontrada" };
  if (concorrentesIds.length === 0) return { ok: false, erro: "Selecione ao menos um concorrente." };

  const [concs, notas] = await Promise.all([
    db.maquina.findMany({ where: { id: { in: concorrentesIds } }, select: { id: true, marca: true, modelo: true, especificacoes: true } }),
    db.notaMaquina.findMany({
      where: { maquinaId: minhaId, OR: [{ concorrenteId: null }, { concorrenteId: { in: concorrentesIds } }] },
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  const texto = await gerarComparativoCompletoIA(minha, concs, notas.map((n) => n.texto));
  if (!texto.trim()) return { ok: false, erro: "IA não habilitada. Configure GROQ_API_KEY ou ANTHROPIC_API_KEY." };
  return { ok: true, texto };
}

// ---------- Alertas ----------
export async function resolverAlerta(id: string) {
  await db.alerta.update({ where: { id }, data: { resolvido: true } });
  revalidatePath("/dashboard");
  revalidatePath("/alertas");
}

export async function resolverVariosAlertasAction(ids: string[]): Promise<{ ok: boolean }> {
  if (!ids.length) return { ok: true };
  await db.alerta.updateMany({ where: { id: { in: ids } }, data: { resolvido: true } });
  revalidatePath("/dashboard");
  revalidatePath("/alertas");
  return { ok: true };
}

// ---------- Conexão WhatsApp (Z-API) ----------
export async function reiniciarZapi(): Promise<{ ok: boolean }> {
  const ok = await zapi.reiniciar();
  revalidatePath("/conexao");
  return { ok };
}

export async function configurarWebhookEvolutionAction(): Promise<{ ok: boolean; erro?: string; url?: string }> {
  // O endereço que está no navegador do vendedor é o endereço público real
  // do CRM — vale mais que NEXTAUTH_URL (que já apontou para um 404).
  const origem = zapi.origemPublicaDaRequisicao(headers());
  if (origem) await zapi.confirmarUrlPublica(origem).catch(() => {});
  const url = await zapi.urlWebhookCrm();
  if (!url) return { ok: false, erro: "Defina NEXTAUTH_URL na Vercel (URL pública do CRM) para apontar o webhook." };
  const r = await zapi.configurarWebhookEvolution(url);
  if (r.ok) await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: `Webhook da Evolution API apontado para ${url}.` }).catch(() => {});
  revalidatePath("/conexao");
  return { ...r, url };
}

// Cria a instância na Evolution (nome de EVOLUTION_INSTANCE) já com o webhook
// apontando para este CRM. Usado pelo botão "Criar instância" em /conexao.
export async function criarInstanciaEvolutionAction(): Promise<{ ok: boolean; erro?: string; qr?: string | null }> {
  const origem = zapi.origemPublicaDaRequisicao(headers());
  if (origem) await zapi.confirmarUrlPublica(origem).catch(() => {});
  const url = await zapi.urlWebhookCrm();
  const r = await zapi.criarInstanciaEvolution(url);
  if (r.ok) {
    // Garante o webhook mesmo quando a instância já existia ou a versão ignorou o campo no create.
    if (url) await zapi.configurarWebhookEvolution(url).catch(() => ({ ok: false }));
    await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: "Instância da Evolution API criada pelo CRM." }).catch(() => {});
  }
  revalidatePath("/conexao");
  return r;
}

// Desconectar é a ÚNICA coisa no CRM que derruba o pareamento do WhatsApp, e
// só acontece com confirmação explícita do vendedor (a tela pede o texto
// "DESCONECTAR"). Fica registrado em auditoria para nunca haver dúvida sobre
// quem derrubou a conexão — nada automático chega aqui.
export async function desconectarZapi(confirmacao?: string): Promise<{ ok: boolean; erro?: string }> {
  if (confirmacao !== "DESCONECTAR") {
    return { ok: false, erro: "Desconexão não confirmada — nada foi alterado." };
  }
  const ok = await zapi.desconectar();
  await registrarAudit({
    acao: "perfil_atualizado", origem: "usuario",
    descricao: ok ? "WhatsApp desconectado manualmente na tela de Conexão." : "Tentativa de desconectar o WhatsApp falhou.",
  }).catch(() => {});
  revalidatePath("/conexao");
  return { ok };
}

// "Verificar e religar agora": o mesmo vigia que roda de 5 em 5 minutos.
export async function vigiarConexaoAction(): Promise<ResultadoVigia> {
  const r = await vigiarConexao({ forcar: true });
  revalidatePath("/conexao");
  return r;
}

export async function lerConexaoVigiadaAction(): Promise<{ descricao: string; reconexoes: number; ultimaQueda: string | null; conectadaDesde: string | null }> {
  const m = await lerMemoriaVigia();
  return {
    descricao: descreverConexao(m, new Date()),
    reconexoes: m.reconexoesAutomaticas,
    ultimaQueda: m.ultimaQueda,
    conectadaDesde: m.conectadaDesde,
  };
}

// ---------- Kanban de tarefas ----------

export async function gerarEstrategiaAction(formData: FormData): Promise<{
  ok: boolean;
  estrategia?: { id: string; titulo: string; conteudo: string };
  erro?: string;
}> {
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
  await db.estrategiaVenda.update({ where: { id }, data: { favorito } });
  revalidatePath("/academia");
}

export async function excluirEstrategia(id: string) {
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
          observacoes: `⚠️ Sugestão da IA — empresa NÃO confirmada, verifique se existe antes de contatar.\n${p.tipo.toUpperCase()} — ${p.descricao}`,
        },
      });
      inseridos++;
    }

    revalidatePath("/clientes");
    return { ok: true, inseridos };
  } catch (e) {
    console.error("Erro ao buscar prospectos:", e);
    return { ok: false, inseridos: 0, erro: "Erro ao buscar prospectos" };
  }
}

export async function excluirProspecto(clienteId: string): Promise<{ ok: boolean }> {
  await db.cliente.delete({ where: { id: clienteId, origem: "prospect_ia" } });
  revalidatePath("/clientes");
  return { ok: true };
}

// ---------- Demandas (lista única) ----------

export async function criarDemandaAction(dados: {
  titulo: string; descricao?: string; clienteId?: string | null; cidade?: string; dueDate?: string; prioridade?: string; checklist?: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const titulo = (dados.titulo ?? "").trim();
  if (!titulo) return { ok: false, erro: "Escreva o que precisa ser feito." };
  const prioridade = ["alta", "normal", "baixa"].includes(dados.prioridade ?? "") ? dados.prioridade! : "normal";
  await db.tarefaKanban.create({
    data: {
      titulo: titulo.slice(0, 160), descricao: (dados.descricao ?? "").trim() || null, clienteId: dados.clienteId || null,
      cidade: (dados.cidade ?? "").trim() || null, dueDate: dados.dueDate ? new Date(dados.dueDate) : null, prioridade, origem: "manual",
      checklist: (dados.checklist ?? "").trim() || null, coluna: "demandas",
    },
  });
  revalidatePath("/pipeline"); revalidatePath("/alertas"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function editarDemandaAction(id: string, dados: {
  titulo: string; descricao?: string; clienteId?: string | null; cidade?: string; dueDate?: string; prioridade?: string; checklist?: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const titulo = (dados.titulo ?? "").trim();
  if (!titulo) return { ok: false, erro: "Escreva o que precisa ser feito." };
  const prioridade = ["alta", "normal", "baixa"].includes(dados.prioridade ?? "") ? dados.prioridade! : "normal";
  await db.tarefaKanban.update({
    where: { id },
    data: {
      titulo: titulo.slice(0, 160), descricao: (dados.descricao ?? "").trim() || null, clienteId: dados.clienteId || null,
      cidade: (dados.cidade ?? "").trim() || null, dueDate: dados.dueDate ? new Date(dados.dueDate) : null, prioridade,
      checklist: (dados.checklist ?? "").trim() || null,
    },
  });
  revalidatePath("/pipeline"); revalidatePath("/alertas");
  return { ok: true };
}

// Ordem manual (arrastar na lista): grava a posição de cada demanda do grupo.
export async function reordenarDemandasAction(ids: string[]): Promise<{ ok: boolean }> {
  const limpos = ids.filter((id) => typeof id === "string" && id).slice(0, 200);
  if (!limpos.length) return { ok: false };
  await db.$transaction(limpos.map((id, i) => db.tarefaKanban.update({ where: { id }, data: { ordem: i + 1 } })));
  revalidatePath("/pipeline");
  return { ok: true };
}

// Central de alertas: "Resolvido" em qualquer item. Some da relação e só
// volta quando o cliente mandar mensagem nova (ver central-alertas.ts).
export async function ocultarItemCentralAction(chave: string, clienteId?: string | null): Promise<{ ok: boolean }> {
  if (!chave || chave.length > 200) return { ok: false };
  if (chave.startsWith("aguardando:") || chave.startsWith("atacar:")) {
    // "Aguardando resposta" já tem seu próprio critério de resolvido
    // (aguardandoResposta=false) e de reabrir (mensagem nova do cliente liga
    // aguardandoResposta=true sozinha, no pipeline do ZEUS) — não precisa do
    // AlertaOculto aqui, que só cresceria pra sempre à toa.
    const id = chave.split(":")[1];
    if (id) await db.cliente.updateMany({ where: { id }, data: { aguardandoResposta: false } }).catch(() => {});
    revalidatePath("/alertas"); revalidatePath("/dashboard");
    return { ok: true };
  }
  if (chave.startsWith("zeus:")) {
    // Resolve o evento de verdade (não só oculta): senão, quando o MESMO
    // erro acontece de novo, registrarZeusEvent só incrementa a mesma linha
    // (já resolvida por AlertaOculto) e ela nunca voltaria a aparecer.
    const id = chave.split(":")[1];
    if (id) await db.zeusEvent.update({ where: { id }, data: { resolvido: true } }).catch(() => {});
    revalidatePath("/alertas"); revalidatePath("/zeus");
    return { ok: true };
  }
  await db.alertaOculto.upsert({
    where: { chave },
    create: { chave, clienteId: clienteId ?? null },
    update: { clienteId: clienteId ?? null, ocultoEm: new Date() },
  });
  revalidatePath("/alertas"); revalidatePath("/dashboard");
  return { ok: true };
}

// "Resolver todos os visíveis" de um grupo inteiro de uma vez (ex.: os 50+
// "aguardando resposta" atrasados) — em lote, sem 1 round-trip por item.
export async function ocultarVariosItensCentralAction(
  itens: { chave: string; clienteId?: string | null }[]
): Promise<{ ok: boolean; total: number }> {
  const validos = itens.filter((i) => i.chave && i.chave.length <= 200);
  if (!validos.length) return { ok: true, total: 0 };

  // "aguardando"/"atacar" resolvem só limpando aguardandoResposta (não
  // precisam do AlertaOculto — ver comentário em ocultarItemCentralAction).
  const idsAguardando = validos
    .filter((i) => i.chave.startsWith("aguardando:") || i.chave.startsWith("atacar:"))
    .map((i) => i.chave.split(":")[1])
    .filter((id): id is string => !!id);
  if (idsAguardando.length) {
    await db.cliente.updateMany({ where: { id: { in: idsAguardando } }, data: { aguardandoResposta: false } }).catch(() => {});
  }

  // "zeus:" resolve o evento de verdade (ver comentário em ocultarItemCentralAction).
  const idsZeus = validos
    .filter((i) => i.chave.startsWith("zeus:"))
    .map((i) => i.chave.split(":")[1])
    .filter((id): id is string => !!id);
  if (idsZeus.length) {
    await db.zeusEvent.updateMany({ where: { id: { in: idsZeus } }, data: { resolvido: true } }).catch(() => {});
  }

  const demais = validos.filter((i) => !i.chave.startsWith("aguardando:") && !i.chave.startsWith("atacar:") && !i.chave.startsWith("zeus:"));
  if (demais.length) {
    await db.alertaOculto.createMany({
      data: demais.map((i) => ({ chave: i.chave, clienteId: i.clienteId ?? null })),
      skipDuplicates: true,
    }).catch(() => {});
    await db.alertaOculto.updateMany({
      where: { chave: { in: demais.map((i) => i.chave) } },
      data: { ocultoEm: new Date() },
    }).catch(() => {});
  }

  revalidatePath("/alertas"); revalidatePath("/dashboard");
  return { ok: true, total: validos.length };
}

export async function alternarDemandaAction(id: string, concluida: boolean): Promise<{ ok: boolean }> {
  await db.tarefaKanban.update({ where: { id }, data: concluida ? { coluna: "demandas_concluida", concluidaEm: new Date() } : { coluna: "demandas", concluidaEm: null } });
  revalidatePath("/pipeline"); revalidatePath("/alertas"); revalidatePath("/dashboard");
  return { ok: true };
}

// Compatibilidade (Cérebro e Next Best Action): cria uma demanda a partir de
// FormData ou de uma ação sugerida.
export async function criarTarefa(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return;
  await db.tarefaKanban.create({
    data: {
      titulo: titulo.slice(0, 160), descricao: String(formData.get("descricao") ?? "").trim() || null, coluna: "demandas",
      cidade: String(formData.get("cidade") ?? "").trim() || null,
      dueDate: String(formData.get("dueDate") ?? "").trim() ? new Date(String(formData.get("dueDate"))) : null,
      origem: String(formData.get("origem") ?? "cerebro") || "cerebro",
    },
  });
  revalidatePath("/pipeline");
}

export async function excluirTarefa(id: string) {
  await db.tarefaKanban.delete({ where: { id } });
  revalidatePath("/pipeline"); revalidatePath("/alertas");
}

// ---------- Resumos de conversa (página /resumos) ----------

// Gera um resumo completo do cliente via IA, baseado nas conversas de WhatsApp,
// negociações e visitas registradas. Salva o resultado em resumoTexto no banco.
export async function gerarResumoClienteIA(clienteId: string): Promise<{ ok: boolean; resumo?: string; erro?: string }> {
  const p = await lerParametros();

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
        messages: {
          orderBy: { sentAt: "asc" },
          take: 80,
          select: { direction: true, body: true, sentAt: true },
        },
      },
      take: 3,
    }),
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
  for (const conv of conversas) {
    const msgs = conv.messages ?? [];
    for (const m of msgs) {
      const hora = new Date(m.sentAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      const autor = m.direction === "OUT" ? p.nomeVendedor : cliente.nome;
      mensagensWA.push(`[${hora}] ${autor}: ${m.body}`);
    }
  }

  const temHistoricoWA = mensagensWA.length > 0;
  const temNegociacoes = negociacoes.length > 0;
  const temVisitas = visitas.length > 0;

  if (!temHistoricoWA && !temNegociacoes && !temVisitas) {
    return { ok: false, erro: "Sem histórico suficiente para gerar resumo. Importe conversas do WhatsApp primeiro." };
  }

  const prompt = `Você é o Cérebro de vendas de ${descricaoVendedor(p)}.

Analise TODOS os dados abaixo do cliente e gere um resumo executivo completo e útil para ${p.nomeVendedor}.

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
4. **Próximo passo recomendado** para ${p.nomeVendedor}
5. Se houver dados da conversa, extraia insights estratégicos

Seja direto, prático. Use no máximo 400 palavras. Use markdown com negrito nos pontos chave.`;

  try {
    // Qualquer provedor via llmTexto (Gemini/Groq grátis, com fallback).
    const resumo = (await llmTexto(
      `Você é o assistente comercial do CRM de ${p.nomeVendedor}. Responda em português brasileiro, direto e prático.`,
      prompt,
      { maxTokens: 1024 }
    )).trim();
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

export async function sugerirAbordagemCliente(
  clienteId: string
): Promise<{ ok: boolean; perfil?: string | null; abordagem?: string; erro?: string }> {
  const p = await lerParametros();

  const conversas = await db.whatsAppConversation.findMany({
    where: { clienteId },
    select: {
      messages: {
        orderBy: { sentAt: "asc" },
        take: 80,
        select: { direction: true, body: true, senderName: true },
      },
    },
    take: 3,
  });

  const textos = conversas
    .map((c) => c.messages.map((m) => `${m.direction === "OUT" ? p.nomeVendedor : m.senderName ?? "Cliente"}: ${m.body}`).join("\n"))
    .filter(Boolean);

  if (!textos.length) {
    return { ok: false, erro: "Sem conversas de WhatsApp suficientes para sugerir um perfil." };
  }

  const { perfil, abordagem } = await sugerirAbordagemIA(textos);
  if (!abordagem) return { ok: false, erro: "Não foi possível analisar agora." };

  await db.cliente.update({ where: { id: clienteId }, data: { perfilDISC: perfil, abordagemIA: abordagem } });
  revalidatePath(`/clientes/${clienteId}`);

  return { ok: true, perfil, abordagem };
}

// Next Best Action (Fase 5, item 2): sugere a próxima ação concreta para o
// cliente a partir do mesmo contexto rico usado pelo Cérebro no WhatsApp, e
// salva na negociação aberta mais quente (campo Negociacao.proximaAcao, que
// já existe e já é exibido no funil).
export async function sugerirProximaAcaoCliente(
  clienteId: string
): Promise<{ ok: boolean; acao?: string; motivo?: string; erro?: string }> {
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    include: { negociacoes: { where: { status: "aberta" }, orderBy: { termometro: "desc" }, take: 1 } },
  });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  const conv = await db.whatsAppConversation.findFirst({
    where: { clienteId },
    select: { id: true, contactName: true, externalPhone: true },
  });
  const contexto = conv
    ? await montarContextoCliente({ id: conv.id, contactName: conv.contactName, clienteId, externalPhone: conv.externalPhone })
    : `Nome: ${cliente.nome}\nStatus CRM: ${cliente.status}${cliente.resumoTexto ? `\nResumo: ${cliente.resumoTexto}` : ""}`;

  const neg = cliente.negociacoes[0] ?? null;
  const diasSemContato = cliente.ultimoContato ? Math.floor((Date.now() - cliente.ultimoContato.getTime()) / 86_400_000) : null;

  const { acao, motivo } = await sugerirProximaAcaoIA(contexto, {
    nome: cliente.nome,
    aguardandoResposta: cliente.aguardandoResposta,
    diasSemContato,
    concorrenteMencionado: neg?.concorrenteMencionado ?? null,
    temVisitaAgendada: !!(neg?.dataVisita || cliente.proximaVisita),
    estagio: neg?.estagio ?? null,
  });

  if (neg) await db.negociacao.update({ where: { id: neg.id }, data: { proximaAcao: acao } });
  await registrarAudit({
    acao: "negociacao_atualizada", origem: "cerebro",
    descricao: `Cérebro sugeriu a próxima ação para ${cliente.nome}: ${acao}`,
    entidade: "Cliente", entidadeId: clienteId, clienteId,
  });

  revalidatePath(`/clientes/${clienteId}`);
  if (neg) revalidatePath("/pipeline");

  return { ok: true, acao, motivo };
}

// Cria uma tarefa/demanda a partir de uma sugestão de próxima ação (Next Best
// Action ou registro de visita por voz), já vinculada ao cliente.
export async function criarTarefaDeAcao(clienteId: string, acao: string): Promise<{ ok: boolean }> {
  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
  const ultima = await db.tarefaKanban.findFirst({ where: { coluna: "demandas" }, orderBy: { ordem: "desc" }, select: { ordem: true } });
  await db.tarefaKanban.create({
    data: {
      titulo: acao.slice(0, 160),
      descricao: cliente ? `Cliente: ${cliente.nome}` : null,
      coluna: "demandas",
      clienteId,
      origem: "orientador",
      prioridade: "alta",
      dueDate: new Date(Date.now() + 2 * 86400000),
      ordem: (ultima?.ordem ?? 0) + 1,
    },
  });
  await registrarAudit({
    acao: "tarefa_criada", origem: "usuario",
    descricao: `Tarefa criada a partir de uma sugestão de próxima ação: "${acao}".`,
    entidade: "TarefaKanban", clienteId,
  });
  revalidatePath("/pipeline");
  return { ok: true };
}

// Modo Campo por voz (Fase 5, item 5): o vendedor relata em voz alta o que
// aconteceu numa visita ("visitei o João, quer trocar a retro, orcei 480
// mil") e a IA (mesma extração usada no pipeline do WhatsApp,
// `analisarConversaIA`) atualiza o resumo do cliente, alimenta a negociação
// aberta e agenda um follow-up — sem exigir nenhum formulário.
export async function registrarVisitaPorVoz(
  clienteId: string,
  transcript: string
): Promise<{ ok: boolean; resumo?: string; followUp?: string | null; erro?: string }> {
  const texto = transcript.trim();
  if (!texto) return { ok: false, erro: "Nada para processar — fale ou digite o relato da visita." };

  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  const [estilo, modelosDestaque] = await Promise.all([
    db.estiloDeFala.findFirst(),
    db.maquina.findMany({
      where: { maisComercializado: true, proprio: true },
      select: { marca: true, modelo: true, categoria: true },
      orderBy: [{ volumeVendas: "desc" }, { modelo: "asc" }],
    }),
  ]);

  const extracao = await analisarConversaIA(texto, { estiloDeFala: estilo?.guia, modelosDestaque });

  // 1) Registra a visita que acabou de acontecer (data = agora).
  const visitaFeita = await db.visita.create({ data: { clienteId, data: new Date(), observacao: extracao.resumo || texto.slice(0, 200) } });
  await sincronizarVisitaComAgenda(visitaFeita.id).catch((e) => console.error("[google] visita:", e));

  // 2) Se uma próxima visita/data futura for citada no relato, agenda também.
  await registrarVisitaAgenda(clienteId, extracao.dataVisita);

  // 3) Alimenta a negociação aberta (ou cria uma nova, mesma regra do pipeline do WhatsApp).
  const negResult = await alimentarNegociacao(clienteId, extracao);

  // 4) Atualiza o resumo do cliente incrementalmente.
  const novaLinha = `[${new Date().toLocaleDateString("pt-BR")}] (visita em campo) ${extracao.resumo || texto}`;
  const resumoAtualizado = [cliente.resumoTexto, novaLinha].filter(Boolean).join("\n").split("\n").slice(-12).join("\n");
  await db.cliente.update({
    where: { id: clienteId },
    data: { resumoTexto: resumoAtualizado, visitado: true, ultimoContato: new Date() },
  });

  // 5) Agenda o follow-up: tarefa no quadro, com prazo na data da próxima visita
  //    detectada (se houver) ou em 3 dias por padrão.
  const followUpTitulo = `Follow-up: ${cliente.nome}`;
  const dueDate = extracao.dataVisita && extracao.dataVisita.getTime() > Date.now()
    ? extracao.dataVisita
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const ultima = await db.tarefaKanban.findFirst({ where: { coluna: "demandas" }, orderBy: { ordem: "desc" }, select: { ordem: true } });
  await db.tarefaKanban.create({
    data: {
      titulo: followUpTitulo,
      descricao: extracao.rascunhoResposta || `Retomar contato sobre ${extracao.maquina ?? "a negociação"}.`,
      coluna: "demandas",
      clienteId,
      dueDate,
      ordem: (ultima?.ordem ?? 0) + 1,
    },
  });

  await registrarAudit({
    acao: "visita_detectada", origem: "usuario",
    descricao: `Visita registrada por voz para ${cliente.nome}.`,
    entidade: "Cliente", entidadeId: clienteId, clienteId,
    extra: { transcript: texto, maquina: extracao.maquina, valor: extracao.valor, negociacaoId: negResult?.id ?? null },
  });

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/agenda");
  revalidatePath("/pipeline");

  return { ok: true, resumo: extracao.resumo || undefined, followUp: followUpTitulo };
}

// Cria um card a partir do resumo: se a coluna for do funil de negociação,
// cria uma Negociacao; se for uma coluna de demandas, cria uma TarefaKanban.
// ---------- Máquinas usadas (estoque de seminovos) ----------

function numOuNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").replace(/\D/g, "");
  return s ? Number(s) : null;
}

export async function criarMaquinaUsada(formData: FormData) {
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
  const valido = ["disponivel", "reservada", "vendida"].includes(status) ? status : "disponivel";
  await db.maquinaUsada.update({ where: { id }, data: { status: valido } });
  revalidatePath("/usadas");
  return { ok: true };
}

export async function excluirMaquinaUsada(id: string) {
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
  revalidatePath("/atendimento");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { ok: true, removidos: ids.length };
}

// ── CRUD ColunaFunil (colunas dinâmicas do funil de negociações) ──────────

export async function garantirColunasFunil() {
  const count = await db.colunaFunil.count();
  if (count === 0) {
    // Cria as colunas padrão com base nos estágios fixos do pipeline
    const defaults = [
      { titulo: "Primeiro contato",    cor: "border-t-sky-400",    ordem: 1, fixa: true,  papel: "em_negociacao", probabilidade: 20 },
      { titulo: "Visitas pendentes",   cor: "border-t-agro-400",   ordem: 2, fixa: true,  papel: "em_negociacao", probabilidade: 35 },
      { titulo: "Visita realizada",    cor: "border-t-emerald-400",ordem: 3, fixa: false, papel: "em_negociacao", probabilidade: 50 },
      { titulo: "Proposta no BCNH",    cor: "border-t-violet-400", ordem: 4, fixa: false, papel: "banco",         probabilidade: 70 },
      { titulo: "Vendas Confirmadas",  cor: "border-t-green-500",  ordem: 5, fixa: false, papel: "confirmada",    probabilidade: 90 },
      { titulo: "Venda perdida",       cor: "border-t-red-400",    ordem: 6, fixa: true,  papel: "perdida",       probabilidade: 0 },
      { titulo: "FATURADO",            cor: "border-t-yellow-500",  ordem: 7, fixa: true,  papel: "faturado",      probabilidade: 100 },
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
  const max = await db.colunaFunil.aggregate({ _max: { ordem: true } });
  await db.colunaFunil.create({
    data: { titulo: titulo.trim() || "Nova coluna", ordem: (max._max.ordem ?? 0) + 1 },
  });
  revalidatePath("/negociacoes");
}

export async function excluirColunaFunil(id: string) {
  const col = await db.colunaFunil.findUnique({ where: { id } });
  if (!col || col.fixa) return; // protege colunas fixas
  // Move negociações desta coluna para a primeira coluna "em negociação".
  const primeira = await db.colunaFunil.findFirst({ where: { NOT: { id } }, orderBy: { ordem: "asc" }, select: { titulo: true, papel: true } });
  await db.negociacao.updateMany({
    where: { estagio: col.titulo },
    data: { estagio: primeira?.titulo ?? "Primeiro contato" },
  });
  await db.colunaFunil.delete({ where: { id } });
  revalidatePath("/negociacoes");
}

// Papel e probabilidade da coluna (menu "⋮" da coluna no funil).
export async function definirPapelColunaFunil(id: string, papel: string, probabilidade: number): Promise<{ ok: boolean; erro?: string }> {
  const col = await db.colunaFunil.findUnique({ where: { id } });
  if (!col) return { ok: false, erro: "Coluna não encontrada." };
  if (!PAPEIS_COLUNA.some((p) => p.id === papel)) return { ok: false, erro: "Papel inválido." };
  const prob = Math.max(0, Math.min(100, Math.round(Number(probabilidade) || 0)));
  // Só pode haver UMA coluna "faturado" e UMA "perdida": são as que alimentam
  // Financeiro, Dashboard e pós-venda.
  if (papel === "faturado" || papel === "perdida") {
    const outra = await db.colunaFunil.findFirst({ where: { papel, NOT: { id } }, select: { titulo: true } });
    if (outra) return { ok: false, erro: `A coluna "${outra.titulo}" já tem esse papel. Troque o papel dela primeiro.` };
  }
  await db.colunaFunil.update({ where: { id }, data: { papel, probabilidade: prob } });
  revalidatePath("/negociacoes");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function renomearColunaFunil(id: string, novoTitulo: string) {
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
  await Promise.all(ids.map((id, i) => db.colunaFunil.update({ where: { id }, data: { ordem: i + 1 } })));
  revalidatePath("/negociacoes");
}


// ---------- Nova Negociação (popup completo) ----------
// Cria uma negociação completa com marca, máquina, valor formatado, tipo de pagamento
// e todos os campos condicionais (financiamento, consórcio, CRD PME, à vista).
// ── Usada na troca ─────────────────────────────────────────────────────────
function valorBrlOuNull(v: FormDataEntryValue | null): number | null {
  const raw = String(v ?? "").replace(/[^0-9,.]/g, "").replace(/\./g, "").replace(",", ".");
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}
function intOuNull(v: FormDataEntryValue | null): number | null {
  const raw = String(v ?? "").replace(/\D/g, "");
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

function lerUsadaDoForm(formData: FormData) {
  const usadaTroca = formData.get("usadaTroca") === "true";
  if (!usadaTroca) {
    return { usadaTroca: false, usadaMarca: null, usadaModelo: null, usadaAno: null, usadaHorimetro: null, usadaEstado: null, usadaValor: null, usadaObs: null };
  }
  const estado = String(formData.get("usadaEstado") ?? "");
  return {
    usadaTroca: true,
    usadaMarca: String(formData.get("usadaMarca") ?? "").trim() || null,
    usadaModelo: String(formData.get("usadaModelo") ?? "").trim() || null,
    usadaAno: intOuNull(formData.get("usadaAno")),
    usadaHorimetro: intOuNull(formData.get("usadaHorimetro")),
    usadaEstado: ["seminova", "boa", "regular"].includes(estado) ? estado : "boa",
    usadaValor: valorBrlOuNull(formData.get("usadaValor")),
    usadaObs: String(formData.get("usadaObs") ?? "").trim() || null,
  };
}

// Ao faturar uma negociação com usada na troca, a usada entra no estoque de
// Máquinas Usadas uma única vez (usadaEstoqueId evita duplicar).
export async function usadaDaTrocaParaEstoque(negociacaoId: string): Promise<{ criada: boolean }> {
  const neg = await db.negociacao.findUnique({
    where: { id: negociacaoId },
    include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
  });
  if (!neg || !neg.usadaTroca || neg.usadaEstoqueId || !neg.usadaModelo) return { criada: false };
  const usada = await db.maquinaUsada.create({
    data: {
      marca: neg.usadaMarca ?? "Outra",
      modelo: neg.usadaModelo,
      ano: neg.usadaAno,
      horimetro: neg.usadaHorimetro,
      preco: neg.usadaValor,
      estado: neg.usadaEstado ?? "boa",
      localizacao: neg.cliente.municipio?.nome ?? null,
      descricao: `Recebida na troca de ${neg.cliente.nome}${neg.maquinaModelo ? ` (venda de ${neg.maquinaModelo})` : ""}.${neg.usadaObs ? ` ${neg.usadaObs}` : ""}`,
      status: "disponivel",
    },
  });
  await db.negociacao.update({ where: { id: negociacaoId }, data: { usadaEstoqueId: usada.id } });
  await registrarAudit({
    acao: "negociacao_atualizada", origem: "sistema",
    descricao: `Usada ${neg.usadaMarca ?? ""} ${neg.usadaModelo} recebida na troca de ${neg.cliente.nome} entrou no estoque de Máquinas Usadas.`,
    entidade: "Negociacao", entidadeId: negociacaoId, clienteId: neg.clienteId,
  }).catch(() => {});
  revalidatePath("/usadas");
  return { criada: true };
}

export async function criarNegociacaoCompleta(formData: FormData) {
  let clienteId = String(formData.get("clienteId") ?? "") || null;
  const nomeNovo = String(formData.get("nomeNovo") ?? "").trim();
  if (!clienteId && nomeNovo) {
    if (await deveDescartarContato(nomeNovo)) return { ok: false, erro: "Nome inválido" };
    const novo = await db.cliente.create({ data: { nome: nomeNovo, origem: "negociacao" } });
    clienteId = novo.id;
  }
  if (!clienteId) return { ok: false, erro: "Cliente obrigatório" };

  // Valor: remove tudo que não for dígito ou vírgula/ponto, depois converte
  // (Number.isFinite descarta entradas que só sobraram símbolos, ex: "..").
  const valorRaw = String(formData.get("valor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const valorParsed = valorRaw ? parseFloat(valorRaw) : null;
  const valor = valorParsed != null && Number.isFinite(valorParsed) ? valorParsed : null;

  const tipoPagamento = String(formData.get("tipoPagamento") ?? "") || null;
  const estagio = String(formData.get("estagio") ?? "") || "Primeiro contato";
  const negociacaoAntiga = formData.get("negociacaoAntiga") === "true";
  const mesAnoReferencia = negociacaoAntiga ? String(formData.get("mesAnoReferencia") ?? "") || null : null;
  const papelEstagio = (await resolverColunaFunil(estagio))?.papel ?? "em_negociacao";
  const isFaturadoEstagio = papelEstagio === "faturado";
  const usada = lerUsadaDoForm(formData);

  // Data de faturamento: usa a informada manualmente (ex: CRD PME) ou, se a
  // coluna já é FATURADO, a data de agora.
  const dataFaturamentoRaw = String(formData.get("dataFaturamento") ?? "");
  const faturadoEmFinal = dataFaturamentoRaw
    ? new Date(dataFaturamentoRaw + "T12:00:00-03:00")
    : isFaturadoEstagio
    ? new Date()
    : null;

  // Entrada
  const entradaValorRaw = String(formData.get("entradaValor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const entradaValorParsed = entradaValorRaw ? parseFloat(entradaValorRaw) : null;
  const entradaValor = entradaValorParsed != null && Number.isFinite(entradaValorParsed) ? entradaValorParsed : null;
  const entradaPercentualRaw = String(formData.get("entradaPercentual") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const entradaPercentualParsed = entradaPercentualRaw ? parseFloat(entradaPercentualRaw) : null;
  const entradaPercentual = entradaPercentualParsed != null && Number.isFinite(entradaPercentualParsed) ? entradaPercentualParsed : null;

  // À vista
  const dataPagamentoRaw = String(formData.get("dataPagamentoAvista") ?? "");
  const pagamentoNaEntrega = formData.get("pagamentoNaEntrega") === "true";

  // CRD PME
  const crdQtdRaw = String(formData.get("crdSaldoParcelasQtd") ?? "");
  const crdParcelaRaw = String(formData.get("crdParcelaValor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");

  const criada = await db.negociacao.create({
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
      concorrenteMencionado: String(formData.get("concorrenteMencionado") ?? "") || null,
      proximaAcao: String(formData.get("proximaAcao") ?? "") || null,
      dataVisita: String(formData.get("dataVisita") ?? "") ? new Date(String(formData.get("dataVisita")) + ":00-03:00") : null,
      estagio,
      negociacaoAntiga,
      mesAnoReferencia,
      ultimoContato: new Date(),
      // O papel da coluna decide o status inicial.
      status: isFaturadoEstagio || papelEstagio === "confirmada" ? "ganha" : papelEstagio === "perdida" ? "perdida" : "aberta",
      faturadoEm: faturadoEmFinal,
      ...usada,
    },
  });

  if (isFaturadoEstagio || papelEstagio === "confirmada") {
    await db.cliente.update({ where: { id: clienteId }, data: { jaComprou: true } });
    revalidatePath("/financeiro");
    revalidatePath("/dashboard");
  }
  if (isFaturadoEstagio) await usadaDaTrocaParaEstoque(criada.id).catch((e) => console.error("[usada-troca] estoque:", e));

  revalidatePath("/negociacoes");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Edita uma negociação já existente com o mesmo conjunto completo de campos
// de criarNegociacaoCompleta (usado pelo formulário unificado FormNovaNegociacao
// em modo de edição — mesmo card para criar e editar, em todo o CRM).
export async function editarNegociacaoCompleta(id: string, formData: FormData) {
  const antes = await db.negociacao.findUnique({ where: { id }, select: { clienteId: true } });
  if (!antes) return { ok: false, erro: "Negociação não encontrada" };

  const valorRaw = String(formData.get("valor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const valorParsed = valorRaw ? parseFloat(valorRaw) : null;
  const valor = valorParsed != null && Number.isFinite(valorParsed) ? valorParsed : null;

  const tipoPagamento = String(formData.get("tipoPagamento") ?? "") || null;
  const estagio = String(formData.get("estagio") ?? "") || undefined;
  const papelEstagio = estagio ? ((await resolverColunaFunil(estagio))?.papel ?? "em_negociacao") : null;
  const isFaturadoEstagio = papelEstagio === "faturado";
  const usada = lerUsadaDoForm(formData);

  const dataFaturamentoRaw = String(formData.get("dataFaturamento") ?? "");
  const faturadoEmFinal = dataFaturamentoRaw
    ? new Date(dataFaturamentoRaw + "T12:00:00-03:00")
    : isFaturadoEstagio
    ? new Date()
    : null;

  const entradaValorRaw = String(formData.get("entradaValor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const entradaValorParsed = entradaValorRaw ? parseFloat(entradaValorRaw) : null;
  const entradaValor = entradaValorParsed != null && Number.isFinite(entradaValorParsed) ? entradaValorParsed : null;
  const entradaPercentualRaw = String(formData.get("entradaPercentual") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");
  const entradaPercentualParsed = entradaPercentualRaw ? parseFloat(entradaPercentualRaw) : null;
  const entradaPercentual = entradaPercentualParsed != null && Number.isFinite(entradaPercentualParsed) ? entradaPercentualParsed : null;

  const dataPagamentoRaw = String(formData.get("dataPagamentoAvista") ?? "");
  const pagamentoNaEntrega = formData.get("pagamentoNaEntrega") === "true";

  const crdQtdRaw = String(formData.get("crdSaldoParcelasQtd") ?? "");
  const crdParcelaRaw = String(formData.get("crdParcelaValor") ?? "").replace(/[^0-9,.]/g, "").replace(",", ".");

  const dataVisitaRaw = String(formData.get("dataVisita") ?? "");

  const neg = await db.negociacao.update({
    where: { id },
    data: {
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
      concorrenteMencionado: String(formData.get("concorrenteMencionado") ?? "") || null,
      proximaAcao: String(formData.get("proximaAcao") ?? "") || null,
      dataVisita: dataVisitaRaw ? new Date(dataVisitaRaw + ":00-03:00") : null,
      estagio,
      ultimoContato: new Date(),
      ...usada,
      ...(isFaturadoEstagio ? { status: "ganha" as const, faturadoEm: faturadoEmFinal } : {}),
      ...(papelEstagio === "confirmada" ? { status: "ganha" as const } : {}),
      ...(papelEstagio === "perdida" ? { status: "perdida" as const } : {}),
      ...(papelEstagio === "em_negociacao" || papelEstagio === "banco" ? { status: "aberta" as const, faturadoEm: null } : {}),
    },
  });

  if (isFaturadoEstagio || papelEstagio === "confirmada") {
    await db.cliente.update({ where: { id: antes.clienteId }, data: { jaComprou: true } });
  }
  if (isFaturadoEstagio) await usadaDaTrocaParaEstoque(id).catch((e) => console.error("[usada-troca] estoque:", e));

  // Interesse futuro: mês/ano para retomar contato.
  const interesseFuturoMes = String(formData.get("interesseFuturoMes") ?? "");
  if (interesseFuturoMes) {
    const [ano, mes] = interesseFuturoMes.split("-").map(Number);
    if (ano && mes) {
      await db.cliente.update({
        where: { id: antes.clienteId },
        data: {
          interesseFuturo: true,
          interesseFuturoData: new Date(ano, mes - 1, 1),
          interesseFuturoNota: neg.maquinaModelo ? `Retomar negociação — ${neg.maquinaModelo}` : "Retomar negociação",
        },
      });
    }
  }

  revalidatePath("/negociacoes");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  return { ok: true };
}

// Ajusta a data de faturamento de uma negociação já faturada (usado no pop-up
// que pergunta, ao arrastar o card para FATURADO, se o faturamento foi hoje
// ou em uma data retroativa).
export async function definirFaturadoEm(id: string, data: string) {
  "use server";
  if (!data) return { ok: false };
  await db.negociacao.update({
    where: { id },
    data: { faturadoEm: new Date(data + "T12:00:00-03:00") },
  });
  revalidatePath("/negociacoes");
  revalidatePath("/pipeline");
  revalidatePath("/financeiro");
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
export async function calcularComissao(valor: number | null, taxa?: number): Promise<number> {
  if (!valor) return 0;
  return valor * (taxa ?? (await lerParametros()).taxaComissao);
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

// ---------- Orientador de Vendas ----------

// Quantos clientes (cadastrados) conversaram no WhatsApp em cada janela —
// mostrado no Orientador e no Dashboard.
export async function contarClientesConversados(): Promise<Record<PeriodoOrientador, number>> {
  const chaves = Object.keys(PERIODOS_ORIENTADOR) as PeriodoOrientador[];
  const entradas = await Promise.all(
    chaves.map(async (p) => {
      const linhas = await db.whatsAppConversation.findMany({
        where: { isGroup: false, clienteId: { not: null }, lastMessageAt: { gte: corteDoPeriodo(p) } },
        select: { clienteId: true },
        distinct: ["clienteId"],
      });
      return [p, linhas.length] as const;
    })
  );
  return Object.fromEntries(entradas) as Record<PeriodoOrientador, number>;
}

// Nível do alerta do coaching guardado como JSON — usado pela ordem de atacar.
function nivelDoAlerta(coaching: unknown): "vermelho" | "amarelo" | "verde" | null {
  const c = coaching as { alertaAgora?: { nivel?: string } } | null;
  const n = c?.alertaAgora?.nivel;
  return n === "vermelho" || n === "amarelo" || n === "verde" ? n : null;
}

// Cards do Orientador: um por cliente com conversa no período (a conversa
// mais recente manda), com a análise da IA quando já existe. Cards ocultados
// (X vermelho / ✓ negociação criada) só voltam se chegar mensagem nova.
export async function listarOrientadorPorPeriodo(periodo: PeriodoOrientador) {
  const convs = await db.whatsAppConversation.findMany({
    where: { isGroup: false, clienteId: { not: null }, lastMessageAt: { gte: corteDoPeriodo(periodo) } },
    orderBy: { lastMessageAt: "desc" },
    take: 400,
    select: {
      id: true, clienteId: true, lastMessageAt: true,
      messages: { where: { isDraft: false }, orderBy: { sentAt: "desc" }, take: 1, select: { body: true, direction: true } },
    },
  });

  const porCliente = new Map<string, (typeof convs)[number]>();
  for (const c of convs) if (c.clienteId && !porCliente.has(c.clienteId)) porCliente.set(c.clienteId, c);
  const ids = Array.from(porCliente.keys());
  if (!ids.length) return [];

  const [clientes, contextos] = await Promise.all([
    db.cliente.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, nome: true, orientadorOcultoEm: true,
        municipio: { select: { nome: true } },
        orientador: true,
      },
    }),
    db.notaContextoCliente.groupBy({ by: ["clienteId"], where: { clienteId: { in: ids } }, _count: { _all: true } }).catch(() => []),
  ]);
  const mapa = new Map(clientes.map((c) => [c.id, c]));
  const contextoPorCliente = new Map(contextos.map((c) => [c.clienteId, c._count._all]));

  const itens = [];
  for (const id of ids) {
    const conv = porCliente.get(id)!;
    const cli = mapa.get(id);
    if (!cli) continue;
    if (cli.orientadorOcultoEm && conv.lastMessageAt <= cli.orientadorOcultoEm) continue;
    const a = cli.orientador;
    const ult = conv.messages[0];
    itens.push({
      clienteId: id,
      conversaId: conv.id,
      clienteNome: cli.nome,
      municipio: cli.municipio?.nome ?? null,
      ultimaMensagem: ult ? `${ult.direction === "OUT" ? "Você: " : ""}${ult.body}` : null,
      ultimaMensagemEm: conv.lastMessageAt.toISOString(),
      estagioVenda: a?.estagioVenda ?? null,
      perfilComprador: a?.perfilComprador ?? null,
      temperatura: a?.temperatura ?? null,
      probabilidadeFechamento: a?.probabilidadeFechamento ?? null,
      proximaAcao: a?.proximaAcao ?? null,
      atualizadoEm: a ? a.atualizadoEm.toISOString() : null,
      // Usados pela ordem de atacar (lib/orientador-prioridade.ts): quem está
      // devendo resposta e se o coaching levantou alerta vermelho.
      ultimaFoiDoCliente: ult ? ult.direction === "IN" : false,
      alertaNivel: nivelDoAlerta(a?.coaching),
      temContexto: (contextoPorCliente.get(id) ?? 0) > 0,
    });
  }
  return itens;
}

// "Zerar e recomeçar": apaga todas as leituras antigas do Orientador (e os
// alertas gerados por elas) e volta a mostrar cards escondidos. As análises
// novas são feitas sob demanda (botão em cada card / "Analisar recentes").
export async function zerarOrientadorAction(): Promise<{ ok: boolean; apagadas: number }> {
  const r = await db.orientadorAnalise.deleteMany({});
  await db.alerta.updateMany({ where: { tipo: "orientador", resolvido: false }, data: { resolvido: true } }).catch(() => {});
  await db.cliente.updateMany({ where: { orientadorOcultoEm: { not: null } }, data: { orientadorOcultoEm: null } }).catch(() => {});
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: `Orientador de Vendas zerado: ${r.count} leitura(s) antiga(s) apagada(s).` }).catch(() => {});
  revalidatePath("/orientador");
  revalidatePath("/atendimento");
  return { ok: true, apagadas: r.count };
}

// Analisa até 3 conversas por chamada (limite de tempo da função); o cliente
// chama em lotes até acabar.
export async function analisarLoteOrientadorAction(conversaIds: string[]): Promise<{ feitas: number; erros: string[] }> {
  const { analisarConversaSemResposta } = await import("@/lib/zeus/orientador");
  let feitas = 0;
  const erros: string[] = [];
  for (const id of conversaIds.slice(0, 3)) {
    const r = await analisarConversaSemResposta(id);
    if (r.ok) feitas++;
    else erros.push(r.erro ?? "falha");
    if (r.erro?.includes("Orçamento") || r.erro?.includes("Nenhuma chave")) break;
  }
  revalidatePath("/orientador");
  return { feitas, erros };
}

// (✓/✗ do Orientador foram removidos: a negociação entra no funil sozinha —
// ver lib/zeus/regra-negociacao.ts — e sai/edita pelo próprio funil.)

// Análise completa de um cliente (drill-down do painel + badge compacto em
// Atendimento/Cadastro do cliente).
export async function buscarOrientadorAnalise(clienteId: string) {
  const a = await db.orientadorAnalise.findUnique({
    where: { clienteId },
    include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
  });
  if (!a) return null;
  const { normalizarCoaching } = await import("@/lib/zeus/orientador-coaching");
  const contexto = await db.notaContextoCliente.findMany({
    where: { clienteId }, orderBy: { criadoEm: "desc" }, take: 20,
    select: { id: true, texto: true, origem: true, criadoEm: true },
  }).catch(() => []);

  return {
    clienteNome: a.cliente.nome,
    municipio: a.cliente.municipio?.nome ?? null,
    estagioVenda: a.estagioVenda,
    perfilComprador: a.perfilComprador,
    objecoes: a.objecoes,
    probabilidadeFechamento: a.probabilidadeFechamento,
    probabilidadeExplicacao: a.probabilidadeExplicacao,
    temperatura: a.temperatura,
    proximaAcao: a.proximaAcao,
    melhorResposta: a.melhorResposta,
    oportunidadesPerdidas: a.oportunidadesPerdidas,
    resumoNegociacao: a.resumoNegociacao,
    atualizadoEm: a.atualizadoEm.toISOString(),
    // O coaching inteiro (a IA sempre gerou; a tela só mostrava um terço).
    combinados: a.combinados ?? [],
    pendencias: a.pendencias ?? [],
    coaching: normalizarCoaching(a.coaching),
    contexto: contexto.map((c) => ({ id: c.id, texto: c.texto, origem: c.origem, criadoEm: c.criadoEm.toISOString() })),
  };
}

// "Virar demanda": a próxima ação do Orientador entra na lista de tarefas com
// prazo, em vez de ficar só na tela.
export async function proximaAcaoViraDemandaAction(clienteId: string, texto: string, quando: "hoje" | "amanha" = "hoje"): Promise<{ ok: boolean; erro?: string }> {
  const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };
  const prazo = inicioDoDiaBrasilia(new Date(), quando === "amanha" ? 1 : 0);
  await db.tarefaKanban.create({
    data: {
      titulo: texto.slice(0, 200),
      descricao: `Próxima ação do Orientador para ${cliente.nome}.`,
      coluna: "demandas",
      clienteId,
      prioridade: "alta",
      origem: "orientador",
      dueDate: prazo,
    },
  });
  await registrarAudit({ acao: "tarefa_criada", origem: "usuario", clienteId, descricao: `Próxima ação virou demanda: ${texto.slice(0, 120)}` }).catch(() => {});
  revalidatePath("/pipeline");
  revalidatePath("/orientador");
  return { ok: true };
}

// ---------- Setor de Pós-venda ----------

// Marcos de acompanhamento desde a data de faturamento (do mais avançado pro
// mais recente — o primeiro que já venceu e ainda não foi registrado como
// feito é o "marco pendente" do cliente). Registrar um marco como feito é só
// criar um PosVendaContato com tipo = o próprio marco (ex: "marco_30d").
const MARCOS_POS_VENDA = [
  { tipo: "marco_365d", dias: 365, label: "1 ano" },
  { tipo: "marco_180d", dias: 180, label: "6 meses" },
  { tipo: "marco_60d", dias: 60, label: "60 dias" },
  { tipo: "marco_30d", dias: 30, label: "30 dias" },
] as const;

function calcularMarcoPendente(diasDesdeFaturamento: number, tiposFeitos: Set<string>) {
  const marco = MARCOS_POS_VENDA.find((m) => diasDesdeFaturamento >= m.dias && !tiposFeitos.has(m.tipo));
  return marco ? { tipo: marco.tipo, label: marco.label } : null;
}

// Data efetiva de faturamento de uma negociação ganha: usa `faturadoEm`
// quando existe; para vendas antigas registradas só com "mês/ano de
// referência" (sem data exata), aproxima pelo dia 1 do mês informado — sem
// isso, vendas históricas reais somem da lista por falta de data exata.
function dataEfetivaFaturamento(n: { faturadoEm: Date | null; mesAnoReferencia: string | null }): Date | null {
  if (n.faturadoEm) return n.faturadoEm;
  if (n.mesAnoReferencia && /^\d{4}-\d{2}$/.test(n.mesAnoReferencia)) {
    return new Date(`${n.mesAnoReferencia}-01T12:00:00-03:00`);
  }
  return null;
}

// Lista clientes com negociação GANHA e FATURADA (fonte de verdade real de
// "já comprou" — Cliente.dataCompra/jaComprou não é confiável, nunca é
// preenchido pelo fluxo normal de fechamento). Cruza com a última mensagem
// de WhatsApp (não só contatos registrados manualmente) e calcula o marco de
// acompanhamento (30/60/180/365 dias) pendente — alimenta a página /pos-venda.
export async function listarClientesPosVenda() {
  const negociacoes = await db.negociacao.findMany({
    where: { status: "ganha", OR: [{ faturadoEm: { not: null } }, { mesAnoReferencia: { not: null } }] },
    select: {
      clienteId: true, marca: true, maquinaModelo: true, faturadoEm: true, mesAnoReferencia: true,
      cliente: { select: { nome: true, municipio: { select: { nome: true } } } },
    },
  });

  // Agrupa por cliente: a compra MAIS RECENTE define a data de referência dos
  // marcos e a máquina em destaque; as demais entram só na lista de máquinas.
  type Ref = { clienteId: string; nome: string; municipio: string | null; faturadoEm: Date; maquinaPrincipal: string | null; maquinas: Set<string> };
  const porCliente = new Map<string, Ref>();
  for (const n of negociacoes) {
    const dataEfetiva = dataEfetivaFaturamento(n);
    if (!dataEfetiva) continue;
    const maquina = [n.marca, n.maquinaModelo].filter(Boolean).join(" ") || null;
    const atual = porCliente.get(n.clienteId);
    if (!atual) {
      porCliente.set(n.clienteId, {
        clienteId: n.clienteId, nome: n.cliente.nome, municipio: n.cliente.municipio?.nome ?? null,
        faturadoEm: dataEfetiva, maquinaPrincipal: maquina,
        maquinas: new Set(maquina ? [maquina] : []),
      });
    } else {
      if (maquina) atual.maquinas.add(maquina);
      if (dataEfetiva > atual.faturadoEm) {
        atual.faturadoEm = dataEfetiva;
        if (maquina) atual.maquinaPrincipal = maquina;
      }
    }
  }

  const clienteIds = Array.from(porCliente.keys());
  if (!clienteIds.length) return [];

  const [conversas, contatos] = await Promise.all([
    db.whatsAppConversation.findMany({
      where: { clienteId: { in: clienteIds } },
      select: { clienteId: true, lastMessageAt: true },
    }),
    db.posVendaContato.findMany({
      where: { clienteId: { in: clienteIds } },
      orderBy: { data: "desc" },
      select: { clienteId: true, tipo: true, data: true },
    }),
  ]);

  const ultimaMsgPorCliente = new Map<string, Date>();
  for (const c of conversas) {
    if (!c.clienteId) continue;
    const atual = ultimaMsgPorCliente.get(c.clienteId);
    if (!atual || c.lastMessageAt > atual) ultimaMsgPorCliente.set(c.clienteId, c.lastMessageAt);
  }
  const contatosPorCliente = new Map<string, typeof contatos>();
  for (const ct of contatos) {
    const lista = contatosPorCliente.get(ct.clienteId) ?? [];
    lista.push(ct);
    contatosPorCliente.set(ct.clienteId, lista);
  }

  const agora = Date.now();
  const linhas = Array.from(porCliente.values()).map((c) => {
    const contatosCliente = contatosPorCliente.get(c.clienteId) ?? [];
    const ultimoContatoManual = contatosCliente[0]?.data ?? null;
    const ultimaMsgWhats = ultimaMsgPorCliente.get(c.clienteId) ?? null;
    const candidatos = [ultimoContatoManual, ultimaMsgWhats].filter((d): d is Date => d != null);
    const ultimoContato = candidatos.length ? new Date(Math.max(...candidatos.map((d) => d.getTime()))) : null;

    const diasDesdeFaturamento = Math.floor((agora - c.faturadoEm.getTime()) / 86_400_000);
    const diasSemContato = ultimoContato ? Math.floor((agora - ultimoContato.getTime()) / 86_400_000) : diasDesdeFaturamento;
    // Marcos registrados ANTES da compra mais recente pertencem ao ciclo da
    // máquina anterior — não podem suprimir os marcos da compra nova.
    const tiposFeitos = new Set(
      contatosCliente
        .filter((ct) => !ct.tipo.startsWith("marco_") || ct.data >= c.faturadoEm)
        .map((ct) => ct.tipo)
    );

    return {
      clienteId: c.clienteId,
      nome: c.nome,
      municipio: c.municipio,
      maquina: c.maquinaPrincipal,
      maquinas: Array.from(c.maquinas),
      dataCompra: c.faturadoEm.toISOString(),
      ultimoContato: ultimoContato ? ultimoContato.toISOString() : null,
      diasSemContato,
      diasDesdeFaturamento,
      marcoPendente: calcularMarcoPendente(diasDesdeFaturamento, tiposFeitos),
      entregaTecnica: tiposFeitos.has("entrega_tecnica"),
    };
  });

  // Marco pendente primeiro (precisa de ação de acompanhamento programado);
  // dentro de cada grupo, quem está há mais tempo sem contato primeiro.
  linhas.sort((a, b) => {
    if (!!a.marcoPendente !== !!b.marcoPendente) return a.marcoPendente ? -1 : 1;
    return (b.diasSemContato ?? 0) - (a.diasSemContato ?? 0);
  });
  return linhas;
}

// Histórico completo de contatos pós-venda de um cliente.
export async function listarContatosPosVenda(clienteId: string) {
  const contatos = await db.posVendaContato.findMany({
    where: { clienteId },
    orderBy: { data: "desc" },
  });
  return contatos.map((c) => ({
    id: c.id, tipo: c.tipo, nota: c.nota, data: c.data.toISOString(),
  }));
}

// Registra um novo contato/ação de pós-venda (ligação, visita, manutenção,
// entrega técnica, marco de acompanhamento cumprido, etc.).
export async function registrarContatoPosVenda(clienteId: string, tipo: string, nota: string) {
  if (!nota.trim()) return;
  await db.posVendaContato.create({ data: { clienteId, tipo, nota: nota.trim() } });
  revalidatePath("/pos-venda");
}

// Gera sugestões de ações de pós-venda via IA para um cliente específico —
// não salva sozinho; o vendedor decide se quer registrar como contato. Se o
// cliente estiver com um marco de acompanhamento pendente (30/60/180/365
// dias), prioriza gerar a mensagem pronta daquele marco.
export async function gerarIdeiasPosVendaAction(clienteId: string): Promise<{ ok: boolean; ideias?: string; erro?: string }> {
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { nome: true, observacoes: true },
  });
  if (!cliente) return { ok: false, erro: "Cliente não encontrado." };

  const [negociacao, contatos, conversa] = await Promise.all([
    db.negociacao.findFirst({
      where: { clienteId, status: "ganha", OR: [{ faturadoEm: { not: null } }, { mesAnoReferencia: { not: null } }] },
      orderBy: { faturadoEm: "desc" },
      select: { marca: true, maquinaModelo: true, faturadoEm: true, mesAnoReferencia: true },
    }),
    db.posVendaContato.findMany({ where: { clienteId }, orderBy: { data: "desc" }, take: 8 }),
    db.whatsAppConversation.findFirst({ where: { clienteId }, select: { lastMessageAt: true } }),
  ]);

  const faturadoEm = negociacao ? dataEfetivaFaturamento(negociacao) : null;
  const maquina = negociacao ? [negociacao.marca, negociacao.maquinaModelo].filter(Boolean).join(" ") || null : null;
  const agora = Date.now();

  const ultimoContatoManual = contatos[0]?.data ?? null;
  const candidatos = [ultimoContatoManual, conversa?.lastMessageAt ?? null].filter((d): d is Date => d != null);
  const ultimoContato = candidatos.length ? new Date(Math.max(...candidatos.map((d) => d.getTime()))) : null;

  const marcoPendente = faturadoEm
    ? calcularMarcoPendente(
        Math.floor((agora - faturadoEm.getTime()) / 86_400_000),
        // Mesmo critério da listagem: marcos de compras anteriores não contam.
        new Set(contatos.filter((c) => !c.tipo.startsWith("marco_") || c.data >= faturadoEm).map((c) => c.tipo))
      )
    : null;

  const ideias = await gerarIdeiasPosVendaIA({
    nomeCliente: cliente.nome,
    maquina,
    dataCompra: faturadoEm ? faturadoEm.toLocaleDateString("pt-BR") : null,
    diasDesdeCompra: faturadoEm ? Math.floor((agora - faturadoEm.getTime()) / 86_400_000) : null,
    diasDesdeUltimoContato: ultimoContato ? Math.floor((agora - ultimoContato.getTime()) / 86_400_000) : null,
    historicoContatos: contatos.map((c) => `[${c.data.toLocaleDateString("pt-BR")}] (${c.tipo}) ${c.nota}`),
    observacoes: cliente.observacoes,
    marcoPendente: marcoPendente?.label ?? null,
  });

  if (!ideias) {
    return { ok: false, erro: "IA não habilitada. Configure GEMINI_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY ou ANTHROPIC_API_KEY." };
  }
  return { ok: true, ideias };
}
