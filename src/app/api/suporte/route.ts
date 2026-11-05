import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { waitUntil } from "@vercel/functions";
import { suporteLigado, criarTicket, responderTicket, ticketsNaUltimaHora } from "@/lib/suporte";
import { validarNovoTicket, validarAnexos, ladoValido, LIMITES } from "@/lib/suporte-regra";
import { enviarPushNotificacao } from "@/lib/push";

export const dynamic = "force-dynamic";

// Criar pedido e responder pedido. Rota (e não ação "use server") porque leva
// até 3 prints: o corpo passa de 1 MB, e a rota aceita até o limite da Vercel.
// Protegida pelo login (middleware). O worker do modo sem sinal NÃO responde
// por ela — sem internet, o envio falha e a tela diz que não foi.
export async function POST(req: Request) {
  if (!(await suporteLigado())) {
    return NextResponse.json({ ok: false, erro: "O suporte está desligado. Ligue em Configurações." }, { status: 403 });
  }
  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Pedido em formato inválido." }, { status: 400 });
  }
  const anexos = validarAnexos(corpo.anexos);
  if (!anexos.ok) return NextResponse.json({ ok: false, erro: anexos.erro }, { status: 400 });

  try {
    if (corpo.acao === "novo") {
      const v = validarNovoTicket(corpo);
      if (!v.ok) return NextResponse.json({ ok: false, erro: v.erro }, { status: 400 });
      if ((await ticketsNaUltimaHora()) >= LIMITES.ticketsPorHora) {
        return NextResponse.json({ ok: false, erro: "Muitos pedidos na última hora. Tente de novo daqui a pouco." }, { status: 429 });
      }
      const t = await criarTicket(v.valor, anexos.valor);
      revalidatePath("/suporte");
      // Aviso ao admin em segundo plano: se o push falhar, o pedido já está salvo.
      waitUntil(
        enviarPushNotificacao({ title: "Novo pedido de suporte", body: t.assunto, url: "/suporte", tag: `suporte-${t.id}` }).catch(() => {}),
      );
      return NextResponse.json({ ok: true, ticketId: t.id });
    }

    if (corpo.acao === "responder") {
      const ticketId = typeof corpo.ticketId === "string" ? corpo.ticketId : "";
      const texto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
      if (!ladoValido(corpo.lado)) return NextResponse.json({ ok: false, erro: "Quem respondeu não foi informado." }, { status: 400 });
      if (!texto && anexos.valor.length === 0) return NextResponse.json({ ok: false, erro: "Escreva a resposta ou cole um print." }, { status: 400 });
      if (texto.length > LIMITES.resposta) return NextResponse.json({ ok: false, erro: `Resposta longa demais (máximo ${LIMITES.resposta}).` }, { status: 400 });
      const ok = await responderTicket(ticketId, corpo.lado, texto || "(print)", anexos.valor);
      if (!ok) return NextResponse.json({ ok: false, erro: "Pedido não encontrado." }, { status: 404 });
      revalidatePath("/suporte");
      return NextResponse.json({ ok: true, ticketId });
    }

    return NextResponse.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    console.error("[suporte]", e);
    return NextResponse.json({ ok: false, erro: "Não foi possível salvar agora. O banco não respondeu; tente de novo." }, { status: 500 });
  }
}
