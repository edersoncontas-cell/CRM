import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// SSE: a cada 3s envia as mensagens novas da conversa (push), sem polling pesado.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const convId = params.id;
  const lastEventId = req.headers.get("Last-Event-ID") || new URL(req.url).searchParams.get("after");

  let cursor = new Date();
  if (lastEventId) {
    const m = await db.whatsAppMessage.findUnique({ where: { id: lastEventId }, select: { sentAt: true } }).catch(() => null);
    if (m?.sentAt) cursor = m.sentAt;
  }

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
          const novas = await db.whatsAppMessage.findMany({
            where: { conversationId: convId, sentAt: { gt: cursor } },
            orderBy: { sentAt: "asc" }, take: 50,
          });
          if (novas.length) {
            cursor = novas[novas.length - 1].sentAt;
            send(`event: messages\nid: ${novas[novas.length - 1].id}\ndata: ${JSON.stringify(novas)}\n\n`);
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
