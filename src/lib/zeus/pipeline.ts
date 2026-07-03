// Pipeline de inteligência automática do WhatsApp (FASE 2 do Projeto Zeus).
// Chamado pelo webhook (por mensagem recebida) e pelo cron `zeus-pipeline`
// (fallback para mensagens que não foram processadas em tempo real).
// Responsável por: vincular/criar cliente, transcrever áudio pendente,
// analisar a mensagem com IA, alimentar negociação/agenda/município,
// classificar a conversa e notificar o vendedor — tudo auditado.

import { db } from "@/lib/db";
import { analisarConversaIA, classificarConversaIA, type ExtracaoConversa } from "@/lib/ai";
import { ESTAGIO_INICIAL, ESTAGIOS_PRE_VISITA } from "@/lib/pipeline";
import { deveDescartarContato } from "@/lib/utils";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { registrarAudit } from "@/lib/audit";
import { enviarPushNotificacao } from "@/lib/push";
import { baixarAudio } from "@/lib/zapi";
import { zeusReport } from "@/lib/zeus/eventos";
import { transcreverBuffer } from "@/lib/integrations/transcription";

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Vincula (e cria se necessário) o município do cliente a partir do nome detectado.
export async function vincularMunicipio(
  clienteId: string,
  nomeMunicipio: string | null
): Promise<void> {
  if (!nomeMunicipio?.trim()) return;
  const alvo = normalizar(nomeMunicipio);

  const todos = await db.municipio.findMany();
  let muni = todos.find((m) => normalizar(m.nome) === alvo);
  if (!muni) {
    muni = await db.municipio.create({ data: { nome: nomeMunicipio.trim() } });
  }

  const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
  if (cliente && !cliente.municipioId) {
    await db.cliente.update({ where: { id: clienteId }, data: { municipioId: muni.id } });
  }
}

// Acha um cliente pelo telefone, tolerando as variações de formatação
// brasileiras (DDI, 9º dígito) — mesma lógica usada pelo webhook para achar
// conversas, aplicada agora à ligação Cliente ↔ WhatsAppConversation.
export async function acharClientePorTelefone(telefone: string) {
  const variantes = phoneLookupVariants(telefone);
  if (!variantes.length) return null;
  return db.cliente.findFirst({ where: { telefone: { in: variantes } } });
}

function ajusteTermometro(sentimento: string | null): number {
  if (sentimento === "positivo") return 12;
  if (sentimento === "negativo") return -12;
  return 0;
}

// Alimenta a negociação aberta do cliente (ou cria uma nova se for prospect
// real), incluindo o ajuste do termômetro conforme o sentimento detectado.
async function alimentarNegociacao(
  clienteId: string,
  ex: ExtracaoConversa
): Promise<{ id: string; criada: boolean } | null> {
  const aberta = await db.negociacao.findFirst({
    where: { clienteId, status: "aberta" },
    orderBy: { atualizadoEm: "desc" },
  });

  if (aberta) {
    const estagio =
      ex.dataVisita && ESTAGIOS_PRE_VISITA.includes(aberta.estagio)
        ? "visita_pendente"
        : aberta.estagio;
    const termometro = Math.max(0, Math.min(100, aberta.termometro + ajusteTermometro(ex.sentimento)));
    await db.negociacao.update({
      where: { id: aberta.id },
      data: {
        ...(ex.maquina ? { maquinaModelo: ex.maquina } : {}),
        ...(ex.valor != null ? { valor: ex.valor } : {}),
        ...(ex.condicaoPagamento ? { condicaoPagamento: ex.condicaoPagamento } : {}),
        ...(ex.concorrente ? { concorrenteMencionado: ex.concorrente } : {}),
        ...(ex.dataVisita ? { dataVisita: ex.dataVisita } : {}),
        ultimoContato: new Date(),
        estagio,
        termometro,
      },
    });
    return { id: aberta.id, criada: false };
  }

  if (ex.ehProspectReal || ex.dataVisita) {
    const nova = await db.negociacao.create({
      data: {
        clienteId,
        estagio: ex.dataVisita ? "visita_pendente" : ESTAGIO_INICIAL,
        termometro: ex.sentimento === "positivo" ? 65 : 50,
        proximaAcao: ex.dataVisita ? "Confirmar e realizar a visita" : "Retornar contato e qualificar interesse",
        ...(ex.maquina ? { maquinaModelo: ex.maquina } : {}),
        ...(ex.valor != null ? { valor: ex.valor } : {}),
        ...(ex.condicaoPagamento ? { condicaoPagamento: ex.condicaoPagamento } : {}),
        ...(ex.concorrente ? { concorrenteMencionado: ex.concorrente } : {}),
        ...(ex.dataVisita ? { dataVisita: ex.dataVisita } : {}),
        ultimoContato: new Date(),
      },
    });
    return { id: nova.id, criada: true };
  }

  return null;
}

// Registra a visita detectada na agenda do cliente, evitando duplicar a mesma data.
async function registrarVisitaAgenda(clienteId: string, dataVisita: Date | null) {
  if (!dataVisita) return;
  const jaExiste = await db.visita.findFirst({
    where: {
      clienteId,
      data: {
        gte: new Date(dataVisita.getTime() - 30 * 60 * 1000),
        lte: new Date(dataVisita.getTime() + 30 * 60 * 1000),
      },
    },
  });
  if (jaExiste) return;
  await db.visita.create({
    data: { clienteId, data: dataVisita, observacao: "Detectada automaticamente pela IA" },
  });
}

// Processa UMA mensagem recebida (idempotente — mensagens já processadas ou
// que não sejam "IN" reais são ignoradas). É o coração da FASE 2: transforma
// uma mensagem de WhatsApp em captação/atualização automática do CRM.
export async function processarMensagem(mensagemId: string): Promise<void> {
  const msg = await db.whatsAppMessage.findUnique({
    where: { id: mensagemId },
    include: { conversation: true },
  });
  if (!msg || msg.processedAt || msg.direction !== "IN" || msg.isDraft) return;
  const conv = msg.conversation;

  // Grupos: só classifica (nunca vira Cliente/Negociação automaticamente).
  if (conv.isGroup) {
    if (!conv.categoryConfirmed && conv.category !== "GRUPO") {
      await db.whatsAppConversation.update({ where: { id: conv.id }, data: { category: "GRUPO" } });
    }
    await db.whatsAppMessage.update({ where: { id: msg.id }, data: { processedAt: new Date() } });
    return;
  }

  let clienteId = conv.clienteId;
  let clienteNome: string | null = null;

  // 1) Vincular cliente existente pelo telefone, ou criar um novo automaticamente.
  if (!clienteId) {
    const nomeContato = conv.contactName?.trim() || `Contato ${conv.externalPhone}`;
    if (!deveDescartarContato(nomeContato)) {
      const existente = await acharClientePorTelefone(conv.externalPhone);
      if (existente) {
        clienteId = existente.id;
        clienteNome = existente.nome;
      } else {
        const novo = await db.cliente.create({
          data: { nome: nomeContato, telefone: conv.externalPhone.replace(/\D/g, "") || conv.externalPhone, origem: "whatsapp" },
        });
        clienteId = novo.id;
        clienteNome = novo.nome;
        await registrarAudit({
          acao: "cliente_criado",
          origem: "zeus",
          descricao: `Cliente "${novo.nome}" criado automaticamente a partir de uma mensagem de WhatsApp.`,
          entidade: "Cliente",
          entidadeId: novo.id,
          clienteId: novo.id,
        });
      }
      await db.whatsAppConversation.update({ where: { id: conv.id }, data: { clienteId } });
    }
  } else {
    const cliente = await db.cliente.findUnique({ where: { id: clienteId }, select: { nome: true } });
    clienteNome = cliente?.nome ?? null;
  }

  // 2) Transcrição de áudio (fallback — o webhook já tenta em tempo real).
  let corpoAnalise = msg.body;
  if (msg.mediaType === "audio" && !msg.transcript && msg.mediaUrl) {
    try {
      const audio = await baixarAudio(msg.mediaUrl);
      if (audio) {
        const texto = await transcreverBuffer(audio.buffer, audio.mimeType);
        if (texto) {
          await db.whatsAppMessage.update({ where: { id: msg.id }, data: { transcript: texto, body: `🎤 ${texto}` } });
          corpoAnalise = `🎤 ${texto}`;
        }
      }
    } catch (e) {
      console.error("[zeus-pipeline] transcrição falhou:", e);
    }
  }

  // 3) Notifica o vendedor (independe do resultado da IA), com deep-link direto na conversa.
  const previa = corpoAnalise.length > 60 ? corpoAnalise.slice(0, 60) + "…" : corpoAnalise;
  await enviarPushNotificacao({
    title: `📱 ${clienteNome ?? conv.contactName ?? conv.externalPhone}`,
    body: previa,
    url: `/atendimento?conversa=${conv.id}`,
    tag: `msg-${conv.id}`,
  }).catch(() => {});

  // 4) Classificação automática da conversa (uma única vez, até o vendedor confirmar/mudar).
  if (!conv.categoryConfirmed && !conv.category) {
    const categoria = await classificarConversaIA(corpoAnalise).catch(() => "OUTRO");
    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { category: categoria } });
    await registrarAudit({
      acao: "conversa_classificada",
      origem: "zeus",
      descricao: `Conversa com ${clienteNome ?? conv.contactName ?? conv.externalPhone} classificada automaticamente como ${categoria}.`,
      entidade: "WhatsAppConversation",
      entidadeId: conv.id,
      clienteId: clienteId ?? undefined,
    });
  }

  // 5) Análise de IA + alimentação automática do CRM (negociação, agenda, município, resumo).
  if (clienteId) {
    try {
      const [estilo, modelosDestaque, clienteAtual] = await Promise.all([
        db.estiloDeFala.findFirst(),
        db.maquina.findMany({
          where: { maisComercializado: true, proprio: true },
          select: { marca: true, modelo: true, categoria: true },
          orderBy: [{ volumeVendas: "desc" }, { modelo: "asc" }],
        }),
        db.cliente.findUnique({ where: { id: clienteId }, select: { perfilIA: true, resumoTexto: true } }),
      ]);

      const extracao = await analisarConversaIA(corpoAnalise, { estiloDeFala: estilo?.guia, modelosDestaque });

      await vincularMunicipio(clienteId, extracao.municipio);
      const negResult = await alimentarNegociacao(clienteId, extracao);
      await registrarVisitaAgenda(clienteId, extracao.dataVisita);

      const novaLinha = extracao.resumo ? `[${new Date().toLocaleDateString("pt-BR")}] ${extracao.resumo}` : null;
      const resumoAtualizado = novaLinha
        ? [clienteAtual?.resumoTexto, novaLinha].filter(Boolean).join("\n").split("\n").slice(-12).join("\n")
        : clienteAtual?.resumoTexto ?? null;

      await db.cliente.update({
        where: { id: clienteId },
        data: {
          ...(extracao.perfil && !clienteAtual?.perfilIA ? { perfilIA: extracao.perfil } : {}),
          ultimoContato: new Date(),
          aguardandoResposta: true,
          ...(resumoAtualizado != null ? { resumoTexto: resumoAtualizado } : {}),
        },
      });

      if (extracao.dataVisita) {
        await registrarAudit({
          acao: "visita_detectada",
          origem: "zeus",
          descricao: `Visita detectada automaticamente para ${extracao.dataVisita.toLocaleDateString("pt-BR")}.`,
          entidade: "Negociacao",
          entidadeId: negResult?.id,
          clienteId,
          extra: { dataVisita: extracao.dataVisita.toISOString(), maquina: extracao.maquina },
        });
      }
      if (negResult?.criada) {
        await registrarAudit({
          acao: "negociacao_criada",
          origem: "zeus",
          descricao: `Negociação aberta automaticamente para ${clienteNome ?? "cliente"} a partir de uma conversa de WhatsApp.`,
          entidade: "Negociacao",
          entidadeId: negResult.id,
          clienteId,
          extra: { maquina: extracao.maquina, valor: extracao.valor },
        });
      } else if (negResult) {
        await registrarAudit({
          acao: "negociacao_atualizada",
          origem: "zeus",
          descricao: `Negociação atualizada automaticamente pela conversa de WhatsApp.`,
          entidade: "Negociacao",
          entidadeId: negResult.id,
          clienteId,
          extra: { sentimento: extracao.sentimento, maquina: extracao.maquina, valor: extracao.valor },
        });
      }
    } catch (e) {
      console.error("[zeus-pipeline] análise de IA falhou:", e);
      await zeusReport(e, "pipeline — análise de IA (lib/zeus/pipeline.ts)");
    }
  }

  await db.whatsAppMessage.update({ where: { id: msg.id }, data: { processedAt: new Date() } });
}

// Processa mensagens pendentes (processedAt = null) — fallback do cron para
// mensagens que o webhook não conseguiu processar em tempo real (erro
// transitório, timeout, etc.).
export async function processarPendentes(limit = 25): Promise<{ processadas: number; erros: number }> {
  const pendentes = await db.whatsAppMessage.findMany({
    where: { direction: "IN", isDraft: false, processedAt: null },
    orderBy: { sentAt: "asc" },
    take: limit,
    select: { id: true },
  });

  let processadas = 0;
  let erros = 0;
  for (const m of pendentes) {
    try {
      await processarMensagem(m.id);
      processadas++;
    } catch (e) {
      erros++;
      console.error("[zeus-pipeline] erro ao processar mensagem", m.id, e);
      await zeusReport(e, `pipeline — processarMensagem (mensagem ${m.id})`);
    }
  }
  return { processadas, erros };
}
