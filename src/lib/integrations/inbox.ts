// Processamento compartilhado de mensagens recebidas (Meta Cloud API ou Z-API).
// Cria/encontra o cliente, registra a conversa, roda a IA e alimenta a negociação.

import { db } from "@/lib/db";
import { analisarConversaIA } from "@/lib/ai";
import { ESTAGIO_INICIAL, ESTAGIOS_PRE_VISITA } from "@/lib/pipeline";
import { deveDescartarContato } from "@/lib/utils";
import { modoFimDeSemanaAtivo } from "@/lib/config";
import * as zapi from "@/lib/integrations/zapi";
import { enviarPushNotificacao } from "@/lib/push";

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

type MensagemRecebida = {
  telefone: string;
  nomeContato?: string | null;
  texto: string;
  tipo: "texto" | "audio";
  transcricao?: string | null;
  canal?: string;
};

// Alimenta a negociação aberta do cliente (ou cria uma nova se for prospect real).
async function alimentarNegociacao(
  clienteId: string,
  ex: Awaited<ReturnType<typeof analisarConversaIA>>
) {
  const aberta = await db.negociacao.findFirst({
    where: { clienteId, status: "aberta" },
    orderBy: { atualizadoEm: "desc" },
  });

  const dados = {
    ...(ex.maquina ? { maquinaModelo: ex.maquina } : {}),
    ...(ex.valor != null ? { valor: ex.valor } : {}),
    ...(ex.condicaoPagamento ? { condicaoPagamento: ex.condicaoPagamento } : {}),
    ...(ex.concorrente ? { concorrenteMencionado: ex.concorrente } : {}),
    ...(ex.dataVisita ? { dataVisita: ex.dataVisita } : {}),
    ultimoContato: new Date(),
  };

  if (aberta) {
    // Visita marcada promove o card para "Visitas pendentes".
    const estagio =
      ex.dataVisita && ESTAGIOS_PRE_VISITA.includes(aberta.estagio)
        ? "visita_pendente"
        : aberta.estagio;
    await db.negociacao.update({ where: { id: aberta.id }, data: { ...dados, estagio } });
  } else if (ex.ehProspectReal || ex.dataVisita) {
    // Cria a negociação se for prospect real OU se houver visita agendada
    // (uma visita marcada já é interesse concreto que precisa entrar na agenda).
    await db.negociacao.create({
      data: {
        clienteId,
        estagio: ex.dataVisita ? "visita_pendente" : ESTAGIO_INICIAL,
        termometro: ex.sentimento === "positivo" ? 65 : 50,
        proximaAcao: ex.dataVisita ? "Confirmar e realizar a visita" : "Retornar contato e qualificar interesse",
        ...dados,
      },
    });
  }
}

// Registra a visita detectada na agenda do cliente (tabela Visita), evitando
// duplicar a mesma data. Alimentado tanto por mensagens do cliente quanto por
// áudios meus (ex.: "marquei visita quinta 14h").
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

// Casa um telefone de forma flexível: tenta exato e, se não achar, pelos últimos
// 8 dígitos (resolve diferenças de DDI/9º dígito entre o que a Z-API manda e o
// que está salvo no cadastro). Evita duplicar cliente e perder mensagens.
async function acharClientePorTelefone(telefone: string) {
  const digits = telefone.replace(/\D/g, "");
  if (!digits) return null;
  const exato = await db.cliente.findFirst({ where: { telefone: digits } });
  if (exato) return exato;
  const sufixo = digits.slice(-8);
  if (sufixo.length < 8) return null;
  return db.cliente.findFirst({ where: { telefone: { endsWith: sufixo } } });
}

// Registra uma mensagem recebida de qualquer canal de WhatsApp.
export async function registrarMensagemRecebida(msg: MensagemRecebida): Promise<void> {
  const telefone = msg.telefone.replace(/\D/g, "");
  if (!telefone || !msg.texto) return;

  // Descarta silenciosamente contatos de pousadas, hotéis, etc.
  const nomeContato = msg.nomeContato?.trim() || `Contato ${telefone}`;
  if (deveDescartarContato(nomeContato)) return;

  // Encontra ou cadastra o cliente automaticamente.
  let cliente = await acharClientePorTelefone(telefone);
  if (!cliente) {
    cliente = await db.cliente.create({
      data: {
        nome: nomeContato,
        telefone,
        origem: "whatsapp",
      },
    });
  }

  const estilo = await db.estiloDeFala.findFirst();
  const extracao = await analisarConversaIA(msg.texto, { estiloDeFala: estilo?.guia });

  const conversa = await db.conversa.create({
    data: {
      conteudo: msg.texto,
      transcricao: msg.transcricao ?? null,
      clienteId: cliente.id,
      canal: msg.canal ?? "whatsapp",
      tipo: msg.tipo,
      remetente: "cliente",
      analisadaEm: new Date(),
    },
  });

  await db.analiseIA.create({
    data: {
      conversaId: conversa.id,
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

  await vincularMunicipio(cliente.id, extracao.municipio);
  await alimentarNegociacao(cliente.id, extracao);
  await registrarVisitaAgenda(cliente.id, extracao.dataVisita);

  // ── Resposta automática (modo fim de semana) ──────────────────────────────
  // SÓ envia automaticamente se o Ederson tiver ativado o modo fim de semana.
  // Caso contrário, apenas marca que o cliente aguarda o retorno dele.
  const fimDeSemanaAtivo = await modoFimDeSemanaAtivo();
  const respostaIA = extracao.rascunhoResposta?.trim();

  if (fimDeSemanaAtivo && respostaIA && zapi.isEnabled()) {
    const envio = await zapi.enviarMensagem(telefone, respostaIA);
    if (envio.ok) {
      await db.conversa.create({
        data: {
          conteudo: respostaIA,
          clienteId: cliente.id,
          canal: "whatsapp",
          tipo: "texto",
          remetente: "vendedor",
        },
      });
      await db.cliente.update({
        where: { id: cliente.id },
        data: {
          ...(extracao.perfil && !cliente.perfilIA ? { perfilIA: extracao.perfil } : {}),
          ultimoContato: new Date(),
          aguardandoResposta: false, // a IA já respondeu por mim
        },
      });
      return;
    }
  }

  // Modo normal: registra que o cliente aguarda meu retorno.
  await db.cliente.update({
    where: { id: cliente.id },
    data: {
      ...(extracao.perfil && !cliente.perfilIA ? { perfilIA: extracao.perfil } : {}),
      ultimoContato: new Date(),
      aguardandoResposta: true,
    },
  });

  // Envia push notification para o celular (se configurado).
  const previa = msg.texto.length > 60 ? msg.texto.slice(0, 60) + "…" : msg.texto;
  await enviarPushNotificacao({
    title: `📱 ${cliente.nome}`,
    body: previa,
    url: "/inbox",
    tag: `msg-${cliente.id}`,
  });
}

// Registra uma mensagem que EU enviei (pelo celular), mantendo o histórico da
// conversa sincronizado. Se for um áudio agendando visita, a IA interpreta e
// alimenta a agenda/negociação automaticamente.
export async function registrarMensagemEnviada(msg: MensagemRecebida): Promise<void> {
  const telefone = msg.telefone.replace(/\D/g, "");
  if (!telefone || !msg.texto) return;

  // Casa o telefone de forma flexível. Se eu iniciei a conversa com um número
  // ainda não cadastrado, cria o cliente para a conversa aparecer no CRM
  // (comportamento "igual ao WhatsApp"). Descarta contatos indesejados.
  let cliente = await acharClientePorTelefone(telefone);
  if (!cliente) {
    const nome = msg.nomeContato?.trim() || `Contato ${telefone}`;
    if (deveDescartarContato(nome)) return;
    cliente = await db.cliente.create({
      data: { nome, telefone, origem: "whatsapp" },
    });
  }

  await db.conversa.create({
    data: {
      conteudo: msg.texto,
      transcricao: msg.transcricao ?? null,
      clienteId: cliente.id,
      canal: msg.canal ?? "whatsapp",
      tipo: msg.tipo,
      remetente: "vendedor",
    },
  });

  // Eu respondi → não está mais aguardando meu retorno.
  await db.cliente.update({
    where: { id: cliente.id },
    data: { ultimoContato: new Date(), aguardandoResposta: false },
  });

  // Áudio/mensagem minha agendando visita → IA interpreta e joga na agenda.
  if (msg.tipo === "audio" || /\b(visita|visitar|passar a[íi]|agendar|marcar)\b/i.test(msg.texto)) {
    try {
      const extracao = await analisarConversaIA(msg.texto);
      if (extracao.dataVisita) {
        await alimentarNegociacao(cliente.id, extracao);
        await registrarVisitaAgenda(cliente.id, extracao.dataVisita);
      }
    } catch {
      // silencioso — não impede o registro da mensagem
    }
  }
}
