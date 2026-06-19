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
  zapiId?: string | null; // id da mensagem na Z-API (dedupe com importação)
};

// True se já registramos essa mensagem da Z-API (evita duplicar ao vivo x import).
async function jaRegistrada(zapiId?: string | null): Promise<boolean> {
  if (!zapiId) return false;
  const existe = await db.conversa.findFirst({ where: { zapiId }, select: { id: true } });
  return !!existe;
}

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

// Casa um telefone de forma flexível pelos últimos 8 dígitos, comparando SOMENTE
// dígitos dos dois lados (ignora DDI, 9º dígito e formatação tipo "(28) 99999-0000").
// Faz a comparação em JS porque o telefone salvo pode ter máscara/símbolos.
export async function acharClientePorTelefone(telefone: string) {
  const alvo = telefone.replace(/\D/g, "").slice(-8);
  if (alvo.length < 8) return null;
  const candidatos = await db.cliente.findMany({
    where: { telefone: { not: null } },
    orderBy: { criadoEm: "asc" },
  });
  return candidatos.find((c) => c.telefone && c.telefone.replace(/\D/g, "").slice(-8) === alvo) ?? null;
}

// Registra uma mensagem recebida de qualquer canal de WhatsApp.
export async function registrarMensagemRecebida(msg: MensagemRecebida): Promise<void> {
  const telefone = msg.telefone.replace(/\D/g, "");
  if (!telefone || !msg.texto) return;
  // Ignora "telefones" longos demais (14+ dígitos): são identificadores internos
  // do WhatsApp (lid), não números reais — evita criar "Contato 7189..." lixo.
  if (telefone.length > 13) return;
  if (await jaRegistrada(msg.zapiId)) return; // já importada/recebida

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
      zapiId: msg.zapiId ?? null,
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
  if (telefone.length > 13) return; // lid do WhatsApp, não é telefone real
  if (await jaRegistrada(msg.zapiId)) return; // já importada/registrada

  // Mensagem QUE EU ENVIEI: só sincroniza se o número já for um cliente do CRM.
  // NÃO cria cliente novo aqui — isso evitava encher o inbox de "Contato 7189..."
  // quando você manda mensagem do celular para números que não são clientes.
  // Quando o cliente existir (ou for criado por uma mensagem recebida), a resposta
  // entra na MESMA conversa graças à busca por telefone flexível.
  const cliente = await acharClientePorTelefone(telefone);
  if (!cliente) return;

  await db.conversa.create({
    data: {
      conteudo: msg.texto,
      transcricao: msg.transcricao ?? null,
      zapiId: msg.zapiId ?? null,
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
