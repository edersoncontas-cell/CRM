"use server";

import { revalidatePath } from "next/cache";
import { db } from "./db";
import { analisarConversaIA } from "./ai";
import * as googleCalendar from "./integrations/googleCalendar";

// ---------- Clientes ----------
export async function criarCliente(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;
  await db.cliente.create({
    data: {
      nome,
      telefone: String(formData.get("telefone") ?? "") || null,
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
      municipioId: String(formData.get("municipioId") ?? "") || null,
      jaComprou: formData.get("jaComprou") === "on",
      visitado: formData.get("visitado") === "on",
      observacoes: String(formData.get("observacoes") ?? "") || null,
    },
  });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
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
      estagio: "novo",
      ultimoContato: new Date(),
    },
  });
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/pipeline");
}

export async function moverNegociacao(id: string, estagio: string) {
  await db.negociacao.update({ where: { id }, data: { estagio, ultimoContato: new Date() } });
  revalidatePath("/pipeline");
}

export async function marcarPerdida(id: string, motivo: string) {
  await db.negociacao.update({
    where: { id },
    data: { status: "perdida", motivoPerda: motivo, estagio: "perdido" },
  });
  revalidatePath("/pipeline");
  revalidatePath("/vendas-perdidas");
}

export async function marcarGanha(id: string) {
  const neg = await db.negociacao.update({
    where: { id },
    data: { status: "ganha", estagio: "fechamento" },
  });
  await db.cliente.update({ where: { id: neg.clienteId }, data: { jaComprou: true } });
  revalidatePath("/pipeline");
}

// ---------- Conversas + IA ----------
export async function analisarConversaAction(formData: FormData) {
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!conteudo) return;
  const clienteId = String(formData.get("clienteId") ?? "") || null;

  const estilo = await db.estiloDeFala.findFirst();
  const extracao = await analisarConversaIA(conteudo, { estiloDeFala: estilo?.guia });

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
      await db.negociacao.update({ where: { id: negExistente.id }, data: dados });
      negociacaoId = negExistente.id;
    } else if (extracao.ehProspectReal) {
      const nova = await db.negociacao.create({
        data: { clienteId, estagio: "novo", ...dados },
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

  revalidatePath("/conversas");
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

// ---------- Kanban de tarefas ----------
export async function moverTarefa(id: string, coluna: string) {
  await db.tarefaKanban.update({ where: { id }, data: { coluna } });
  revalidatePath("/pipeline");
}
