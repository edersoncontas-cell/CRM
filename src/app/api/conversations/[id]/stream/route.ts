import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { aEntregar, esquecerForaDaJanela, inicioDaJanela, jaNaTela } from "@/lib/conversa-ao-vivo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// SSE: a cada 3s envia as mensagens novas da conversa (push), sem polling pesado.
// "Nova" é a que ainda não foi entregue, não a de horário mais recente: a
// mensagem que entra no banco fora de ordem também aparece (ver
// lib/conversa-ao-vivo.ts). O "id:" de cada evento é a mensagem mais recente
// já entregue — é dela que a reconexão (Last-Event-ID) continua.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const convId = params.id;
  const lastEventId = req.headers.get("Last-Event-ID") || new URL(req.url).searchParams.get("after");

  let cursor = new Date();
  let idDoCursor: string | null = null;
  if (lastEventId) {
    const m = await db.whatsAppMessage.findUnique({ where: { id: lastEventId }, select: { sentAt: true } }).catch(() => null);
    if (m?.sentAt) { cursor = m.sentAt; idDoCursor = lastEventId; }
  }

  const marcasDaJanela = () => db.whatsAppMessage.findMany({
    where: { conversationId: convId, sentAt: { gt: inicioDaJanela(cursor) } },
    orderBy: { sentAt: "desc" }, take: 200,
    select: { id: true, sentAt: true },
  });
  const vistas = jaNaTela(await marcasDaJanela().catch(() => []), cursor);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let ativo = true;
      const parar = () => { ativo = false; };
      req.signal.addEventListener("abort", parar);
      const send = (s: string) => { try { controller.enqueue(encoder.encode(s)); } catch { ativo = false; } };
      send(": connected\n\n");
      while (ativo) {
        try {
          const faltam = aEntregar(await marcasDaJanela(), vistas);
          const novas = faltam.length
            ? await db.whatsAppMessage.findMany({ where: { id: { in: faltam.map((m) => m.id) } }, orderBy: { sentAt: "asc" } })
            : [];
          if (novas.length) {
            for (const m of novas) {
              vistas.set(m.id, m.sentAt.getTime());
              if (m.sentAt.getTime() >= cursor.getTime()) { cursor = m.sentAt; idDoCursor = m.id; }
            }
            esquecerForaDaJanela(vistas, cursor);
            send(`event: messages\n${idDoCursor ? `id: ${idDoCursor}\n` : ""}data: ${JSON.stringify(novas)}\n\n`);
          } else {
            send(": ping\n\n");
          }
        } catch {
          send(": err\n\n");
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      try { controller.close(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
