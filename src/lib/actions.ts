"use server";

import { revalidatePath } from "next/cache";
import { db } from "./db";
import { analisarConversaIA } from "./ai";
import { vincularMunicipio } from "./integrations/inbox";
import { ESTAGIO_INICIAL, ESTAGIOS_PRE_VISITA, COL_PERDIDO } from "./pipeline";
import * as googleCalendar from "./integrations/googleCalendar";
import * as zapi from "./integrations/zapi";
import { registrarAudit } from "./audit";

// ---------- Clientes ----------
export async function criarCliente(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;
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
    },
  });
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
}

export async function atualizarCliente(id: string, formData: FormData) {
  await db.cliente.update({
    where: { id },
    data: {
      nome: String(formData.get("nome") ?? "").trim(),
      telefone: String(formData.get("telefone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      endereco: String(formData.get("endereco") ?? "") || null,
      municipioId: String(formData.get("municipioId") ?? "") || null,
      jaComprou: formData.get("jaComprou") === "on",
      visitado: formData.get("visitado") === "on",
      observacoes: String(formData.get("observacoes") ?? "") || null,
    },
  });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
}

// ---------- Visitas ----------
// Registra uma visita ao cliente (data + observação) e marca como visitado.
export async function adicionarVisita(clienteId: string, formData: FormData) {
  const dataRaw = String(formData.get("data") ?? "");
  if (!dataRaw) return;
  // datetime-local sem fuso: interpretamos como horário de Brasília (-03:00).
  const data = new Date(`${dataRaw}:00-03:00`);
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
      erro: envio.modo === "stub" ? "WhatsApp (Z-API) não está conectado." : "Falha ao enviar pela Z-API.",
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

// Importa clientes de um CSV colado (nome,telefone,municipio). Dedup por telefone/nome.
export async function importarClientesCsv(formData: FormData): Promise<void> {
  const csv = String(formData.get("csv") ?? "");
  const linhas = csv.split(/\r?\n/).filter((l) => l.trim());
  const municipios = await db.municipio.findMany();
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  for (const linha of linhas) {
    const [nomeRaw, telRaw, muniRaw] = linha.split(/[,;]/).map((c) => c?.trim());
    if (!nomeRaw) continue;
    if (/^nome$/i.test(nomeRaw)) continue; // cabeçalho
    const telefone = telRaw ? telRaw.replace(/\D/g, "") : null;

    // dedup
    const existe = await db.cliente.findFirst({
      where: {
        OR: [
          telefone ? { telefone } : undefined,
          { nome: nomeRaw },
        ].filter(Boolean) as object[],
      },
    });
    if (existe) continue;

    const muni = muniRaw
      ? municipios.find((m) => norm(m.nome) === norm(muniRaw))
      : undefined;

    await db.cliente.create({
      data: { nome: nomeRaw, telefone, municipioId: muni?.id ?? null, origem: "importacao" },
    });
  }
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
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
  if (estagio === COL_PERDIDO.id) {
    await db.negociacao.update({
      where: { id },
      data: { status: "perdida", estagio, ultimoContato: new Date() },
    });
  } else {
    // Volta para aberta caso estivesse perdida e seja reposicionada.
    await db.negociacao.update({
      where: { id },
      data: { status: "aberta", estagio, ultimoContato: new Date() },
    });
  }
  revalidatePath("/pipeline");
  revalidatePath("/vendas-perdidas");
}

// Exclui definitivamente uma negociação (card do pipeline).
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

// ---------- Conversas + IA ----------
export async function analisarConversaAction(formData: FormData) {
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!conteudo) return;
  let clienteId = String(formData.get("clienteId") ?? "") || null;

  const estilo = await db.estiloDeFala.findFirst();
  const extracao = await analisarConversaIA(conteudo, { estiloDeFala: estilo?.guia });

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
    // cria novo cliente a partir da sugestão
    await db.cliente.create({
      data: { nome: sug.nomeDetectado ?? "Novo contato", telefone: sug.telefone, origem: "whatsapp" },
    });
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
