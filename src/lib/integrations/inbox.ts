// Processamento compartilhado de mensagens recebidas (Meta Cloud API ou Z-API).
// Cria/encontra o cliente, registra a conversa, roda a IA e alimenta a negociação.

import { db } from "@/lib/db";
import { analisarConversaIA } from "@/lib/ai";

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
    await db.negociacao.update({ where: { id: aberta.id }, data: dados });
  } else if (ex.ehProspectReal) {
    await db.negociacao.create({
      data: {
        clienteId,
        estagio: "novo",
        termometro: ex.sentimento === "positivo" ? 65 : 50,
        proximaAcao: "Retornar contato e qualificar interesse",
        ...dados,
      },
    });
  }
}

// Registra uma mensagem recebida de qualquer canal de WhatsApp.
export async function registrarMensagemRecebida(msg: MensagemRecebida): Promise<void> {
  const telefone = msg.telefone.replace(/\D/g, "");
  if (!telefone || !msg.texto) return;

  // Encontra ou cadastra o cliente automaticamente.
  let cliente = await db.cliente.findFirst({ where: { telefone } });
  if (!cliente) {
    cliente = await db.cliente.create({
      data: {
        nome: msg.nomeContato?.trim() || `Contato ${telefone}`,
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

  if (extracao.perfil && !cliente.perfilIA) {
    await db.cliente.update({ where: { id: cliente.id }, data: { perfilIA: extracao.perfil } });
  }
  await vincularMunicipio(cliente.id, extracao.municipio);
  await alimentarNegociacao(cliente.id, extracao);
}
