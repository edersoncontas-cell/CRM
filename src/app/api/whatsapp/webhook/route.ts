import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analisarConversaIA } from "@/lib/ai";
import * as whatsapp from "@/lib/integrations/whatsapp";
import { isEnabled as transcricaoAtiva, transcreverBuffer } from "@/lib/integrations/transcription";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Verificação do webhook (Meta chama com hub.* na ativação).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const challenge = whatsapp.verificarWebhook(
    sp.get("hub.mode"),
    sp.get("hub.verify_token"),
    sp.get("hub.challenge")
  );
  if (challenge !== null) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("forbidden", { status: 403 });
}

// Extrai o texto da mensagem conforme o tipo. Para áudio, baixa e transcreve.
async function extrairTexto(msg: any): Promise<{ texto: string; tipo: "texto" | "audio"; transcricao?: string }> {
  // Texto simples
  if (msg?.text?.body) {
    return { texto: msg.text.body, tipo: "texto" };
  }
  // Imagem/vídeo/documento com legenda
  const legenda = msg?.image?.caption ?? msg?.video?.caption ?? msg?.document?.caption;
  if (legenda) {
    return { texto: legenda, tipo: "texto" };
  }
  // Áudio / mensagem de voz
  const audioId = msg?.audio?.id ?? msg?.voice?.id;
  if (audioId) {
    if (!transcricaoAtiva()) {
      return { texto: "[áudio recebido — transcrição não configurada]", tipo: "audio" };
    }
    try {
      const midia = await whatsapp.baixarMidia(audioId);
      if (!midia) return { texto: "[áudio recebido — falha ao baixar]", tipo: "audio" };
      const transcricao = await transcreverBuffer(midia.buffer, midia.mimeType);
      return { texto: transcricao || "[áudio sem fala detectada]", tipo: "audio", transcricao };
    } catch (e) {
      console.error("Erro ao transcrever áudio:", e);
      return { texto: "[áudio recebido — erro na transcrição]", tipo: "audio" };
    }
  }
  return { texto: "", tipo: "texto" };
}

// Alimenta a negociação do cliente com os dados extraídos pela IA.
async function alimentarNegociacao(clienteId: string, ex: Awaited<ReturnType<typeof analisarConversaIA>>) {
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
    // Cliente sem negociação aberta e demonstrou interesse real: cria uma nova.
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

// Recebimento de mensagens: cria conversa, identifica/cria cliente, transcreve
// áudio, analisa com a IA e alimenta a negociação do cliente.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const telefone = msg?.from;
    if (!msg || !telefone) return NextResponse.json({ ok: true });

    const { texto, tipo, transcricao } = await extrairTexto(msg);
    if (!texto) return NextResponse.json({ ok: true });

    let cliente = await db.cliente.findFirst({ where: { telefone } });
    const nomeContato = body?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name;

    if (!cliente) {
      // contato desconhecido -> gera sugestão de vínculo (estilo Google Fotos)
      await db.sugestaoVinculo.create({
        data: {
          telefone,
          nomeDetectado: nomeContato ?? null,
          textoContexto: texto.slice(0, 160),
          confianca: 50,
        },
      });
    }

    const estilo = await db.estiloDeFala.findFirst();
    const extracao = await analisarConversaIA(texto, { estiloDeFala: estilo?.guia });

    const conversa = await db.conversa.create({
      data: {
        conteudo: texto,
        transcricao: transcricao ?? null,
        clienteId: cliente?.id ?? null,
        canal: "whatsapp",
        tipo,
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

    // Atualiza perfil do cliente e alimenta a negociação.
    if (cliente) {
      if (extracao.perfil && !cliente.perfilIA) {
        await db.cliente.update({ where: { id: cliente.id }, data: { perfilIA: extracao.perfil } });
      }
      await alimentarNegociacao(cliente.id, extracao);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro no webhook WhatsApp:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
