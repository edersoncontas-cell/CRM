// Pipeline de inteligência automática do WhatsApp (FASE 2 do Projeto Zeus).
// Chamado pelo webhook (por mensagem recebida) e pelo cron `zeus-pipeline`
// (fallback para mensagens que não foram processadas em tempo real).
// Responsável por: vincular/criar cliente, transcrever áudio pendente,
// analisar a mensagem com IA, alimentar negociação/agenda/município,
// classificar a conversa e notificar o vendedor — tudo auditado.

import { db } from "@/lib/db";
import { analisarConversaIA, classificarConversaIA, type ExtracaoConversa } from "@/lib/ai";
import { ESTAGIO_INICIAL, ESTAGIOS_PRE_VISITA } from "@/lib/pipeline";
import { papelDaColuna } from "@/lib/pipeline";
import { deveDescartarContato } from "@/lib/filtro-contatos";
import { deveAbrirNegociacao } from "@/lib/zeus/regra-negociacao";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { registrarAudit } from "@/lib/audit";
import { enviarPushNotificacao } from "@/lib/push";
import { baixarAudio } from "@/lib/zapi";
import { zeusReport } from "@/lib/zeus/eventos";
import { transcreverBuffer } from "@/lib/integrations/transcription";
import { sincronizarVisitaComAgenda } from "@/lib/integrations/google";
import { municipioDoES, normalizarPagamento } from "@/lib/orientador-fatos";

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Vincula (e cria se necessário) o município do cliente a partir do nome detectado.
export async function vincularMunicipio(
  clienteId: string,
  nomeMunicipio: string | null
): Promise<void> {
  if (!nomeMunicipio?.trim()) return;

  // Só município do Espírito Santo, e com o nome escrito como o CRM escreve.
  //
  // O contrato da IA pedia "cidade do cliente, se mencionada" e aceitava
  // qualquer texto; o CRM então criava o município do jeito que veio. Foi
  // assim que um cliente de Guaçuí ficou marcado como sendo de Recife. E não
  // era só o rótulo errado: o CRM inteiro é do ES (mapa do Dashboard,
  // coordenadas, abordagem por cidade, licitações das cidades atendidas), então
  // uma cidade de fora não desenha no mapa nem entra em conta nenhuma — é
  // dado quebrado. Cidade de fora do ES, ou nome que não existe, é erro de
  // leitura: ignora. Quem precisar cadastrar exceção faz na mão, no cadastro.
  const oficial = municipioDoES(nomeMunicipio);
  if (!oficial) {
    console.warn("[pipeline] município ignorado (não é do ES):", nomeMunicipio);
    return;
  }
  const alvo = normalizar(oficial);

  const todos = await db.municipio.findMany();
  let muni = todos.find((m) => normalizar(m.nome) === alvo);
  if (!muni) {
    muni = await db.municipio.create({ data: { nome: oficial } });
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

// Alimenta a negociação aberta do cliente (ou cria uma nova quando a conversa
// já levantou máquina + pagamento/visita — ver regra-negociacao.ts), incluindo
// o ajuste do termômetro conforme o sentimento detectado.
export { deveAbrirNegociacao };

// Marca pelo catálogo próprio (modelo citado) — evita card "sem marca".
async function marcaDoModelo(modelo: string | null): Promise<string | null> {
  if (!modelo) return null;
  const m = await db.maquina.findFirst({ where: { proprio: true, modelo: { equals: modelo, mode: "insensitive" } }, select: { marca: true } }).catch(() => null);
  return m?.marca ?? null;
}

export async function alimentarNegociacao(
  clienteId: string,
  ex: ExtracaoConversa
): Promise<{ id: string; criada: boolean } | null> {
  const aberta = await db.negociacao.findFirst({
    where: { clienteId, status: "aberta" },
    orderBy: { atualizadoEm: "desc" },
  });
  const marca = await marcaDoModelo(ex.maquina);
  const maquinaOuCategoria = ex.maquina ?? (ex.categoriaMaquina ? ex.categoriaMaquina.charAt(0).toUpperCase() + ex.categoriaMaquina.slice(1) : null);

  // Títulos REAIS das colunas do funil (o usuário pode renomear): a primeira
  // "em negociação" recebe contato novo; a que tem "visita" + "pendente"
  // recebe quem marcou visita.
  const colunas = await db.colunaFunil.findMany({ orderBy: { ordem: "asc" }, select: { titulo: true, papel: true } });
  const abertasCol = colunas.filter((c) => papelDaColuna(c) === "em_negociacao");
  const colInicial = abertasCol[0]?.titulo ?? ESTAGIO_INICIAL;
  const colVisita = abertasCol.find((c) => /visita/i.test(c.titulo) && /pend/i.test(c.titulo))?.titulo ?? abertasCol[1]?.titulo ?? colInicial;

  if (aberta) {
    const estagio =
      ex.dataVisita && (ESTAGIOS_PRE_VISITA.includes(aberta.estagio) || aberta.estagio === colInicial)
        ? colVisita
        : aberta.estagio;
    const termometro = Math.max(0, Math.min(100, aberta.termometro + ajusteTermometro(ex.sentimento)));
    // Modelo explícito substitui categoria genérica; categoria nunca substitui
    // um modelo já conhecido. Valor: só o NOSSO, e nunca apaga o que já existe.
    const trocaMaquina = ex.maquina ? ex.maquina !== aberta.maquinaModelo : (!aberta.maquinaModelo && !!maquinaOuCategoria);
    const concorrenteTexto = ex.concorrente
      ? ex.valorConcorrente ? `${ex.concorrente} (R$ ${Math.round(ex.valorConcorrente).toLocaleString("pt-BR")})` : ex.concorrente
      : null;
    await db.negociacao.update({
      where: { id: aberta.id },
      data: {
        ...(trocaMaquina && maquinaOuCategoria ? { maquinaModelo: maquinaOuCategoria } : {}),
        ...(marca && !aberta.marca ? { marca } : {}),
        ...(ex.valor != null && ex.valor > 0 ? { valor: ex.valor } : {}),
        // Só forma de pagamento de verdade. A IA podia devolver "outro", isso
        // ia para o banco e o painel exibia "Pagamento: outro" como se fosse dado.
        ...(normalizarPagamento(ex.condicaoPagamento) ? { tipoPagamento: normalizarPagamento(ex.condicaoPagamento)! } : {}),
        ...(concorrenteTexto ? { concorrenteMencionado: concorrenteTexto } : {}),
        ...(ex.dataVisita ? { dataVisita: ex.dataVisita } : {}),
        ...(ex.intencao === "comprar" && !aberta.proximaAcao?.toLowerCase().includes("proposta") ? { proximaAcao: "Enviar proposta de uma página e condição" } : {}),
        ultimoContato: new Date(),
        estagio,
        termometro,
      },
    });
    return { id: aberta.id, criada: false };
  }

  if (deveAbrirNegociacao(ex)) {
    const concorrenteTexto = ex.concorrente
      ? ex.valorConcorrente ? `${ex.concorrente} (R$ ${Math.round(ex.valorConcorrente).toLocaleString("pt-BR")})` : ex.concorrente
      : null;
    const nova = await db.negociacao.create({
      data: {
        clienteId,
        estagio: ex.dataVisita ? colVisita : colInicial,
        termometro: ex.intencao === "comprar" ? 70 : ex.sentimento === "positivo" ? 60 : 45,
        proximaAcao: ex.dataVisita
          ? "Confirmar e realizar a visita"
          : ex.intencao === "comprar" ? "Enviar proposta de uma página e condição" : "Qualificar: aplicação, prazo e forma de pagamento",
        ...(maquinaOuCategoria ? { maquinaModelo: maquinaOuCategoria } : {}),
        ...(marca ? { marca } : {}),
        ...(ex.valor != null && ex.valor > 0 ? { valor: ex.valor } : {}),
        ...(normalizarPagamento(ex.condicaoPagamento) ? { tipoPagamento: normalizarPagamento(ex.condicaoPagamento)! } : {}),
        ...(concorrenteTexto ? { concorrenteMencionado: concorrenteTexto } : {}),
        ...(ex.dataVisita ? { dataVisita: ex.dataVisita } : {}),
        ultimoContato: new Date(),
      },
    });
    return { id: nova.id, criada: true };
  }

  return null;
}

// Registra a visita detectada na agenda do cliente, evitando duplicar a mesma data.
export async function registrarVisitaAgenda(clienteId: string, dataVisita: Date | null) {
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
  const visita = await db.visita.create({
    data: { clienteId, data: dataVisita, observacao: "Combinada na conversa do WhatsApp (IA)" },
  });
  await sincronizarVisitaComAgenda(visita.id).catch((e) => console.error("[google] visita:", e));
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
    if (!(await deveDescartarContato(nomeContato))) {
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

      // Contexto: as últimas mensagens da conversa (não só a nova) — "quinta
      // 14h pode ser" só faz sentido com a pergunta anterior do vendedor.
      const anteriores = await db.whatsAppMessage.findMany({
        where: { conversationId: conv.id, isDraft: false, id: { not: msg.id }, sentAt: { lte: msg.sentAt } },
        orderBy: { sentAt: "desc" },
        take: 11,
        select: { direction: true, body: true },
      });
      const contextoConversa = [
        ...anteriores.reverse().map((m) => `${m.direction === "OUT" ? "Vendedor" : "Cliente"}: ${m.body}`),
        `Cliente (ÚLTIMA MENSAGEM, analise esta): ${corpoAnalise}`,
      ].join("\n");
      const extracao = await analisarConversaIA(contextoConversa, { estiloDeFala: estilo?.guia, modelosDestaque });
      // "Amanhã te dou uma posição" / "amanhã falo com meu sócio" NÃO é visita.
      // Só conta (agenda, coluna de visita, regra de abrir negociação) quando a
      // IA viu os dois lados combinando um dia de visita presencial.
      if (!extracao.visitaConfirmada) extracao.dataVisita = null;

      await vincularMunicipio(clienteId, extracao.municipio);
      const negResult = await alimentarNegociacao(clienteId, extracao);
      await registrarVisitaAgenda(clienteId, extracao.dataVisita);

      // Não repete a mesma linha (a heurística devolve "pagamento: avista; visita
      // sugerida" a cada mensagem e o resumo ficava com linhas duplicadas).
      const ultimaLinha = (clienteAtual?.resumoTexto ?? "").split("\n").filter(Boolean).pop()?.replace(/^\[[^\]]*\]\s*/, "").trim();
      const novaLinha = extracao.resumo && extracao.resumo.trim() !== ultimaLinha ? `[${new Date().toLocaleDateString("pt-BR")}] ${extracao.resumo}` : null;
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
