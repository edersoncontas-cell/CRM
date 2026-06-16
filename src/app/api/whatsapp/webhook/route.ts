import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analisarConversaIA } from "@/lib/ai";
import * as whatsapp from "@/lib/integrations/whatsapp";

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

// Recebimento de mensagens: cria conversa, identifica/cria cliente e analisa.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const texto = msg?.text?.body;
    const telefone = msg?.from;
    if (!texto || !telefone) return NextResponse.json({ ok: true });

    let cliente = await db.cliente.findFirst({ where: { telefone } });
    if (!cliente) {
      // contato desconhecido -> gera sugestão estilo Google Fotos
      await db.sugestaoVinculo.create({
        data: { telefone, textoContexto: texto.slice(0, 120), confianca: 50 },
      });
    }

    const estilo = await db.estiloDeFala.findFirst();
    const extracao = await analisarConversaIA(texto, { estiloDeFala: estilo?.guia });

    const conversa = await db.conversa.create({
      data: {
        conteudo: texto,
        clienteId: cliente?.id ?? null,
        canal: "whatsapp",
        tipo: "texto",
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro no webhook WhatsApp:", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
