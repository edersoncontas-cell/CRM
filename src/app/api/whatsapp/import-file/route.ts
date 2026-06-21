import { NextRequest, NextResponse } from "next/server";
import { acharOuCriarConversaPorNome, importarMensagens } from "@/lib/whatsapp-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatPayload = {
  name: string;
  isGroup: boolean;
  messages: Array<{ fromMe: boolean; sender: string | null; body: string; sentAt: string }>;
};

// Recebe conversas JÁ parseadas no navegador (a partir do export .zip do WhatsApp)
// e grava no banco, sem duplicar. A mídia não sobe — só o texto das mensagens.
export async function POST(req: NextRequest) {
  let chats: ChatPayload[];
  try {
    const body = (await req.json()) as { chats?: ChatPayload[] };
    chats = Array.isArray(body?.chats) ? body.chats : [];
  } catch {
    return NextResponse.json({ ok: false, error: "payload inválido" }, { status: 400 });
  }
  if (!chats.length) return NextResponse.json({ ok: false, error: "nenhuma conversa" }, { status: 400 });

  let conversas = 0, mensagens = 0;
  for (const chat of chats) {
    const nome = (chat.name || "").trim();
    if (!nome || !Array.isArray(chat.messages) || !chat.messages.length) continue;
    try {
      const conv = await acharOuCriarConversaPorNome(nome, chat.isGroup === true);
      const n = await importarMensagens(conv.id, chat.messages, chat.isGroup === true);
      if (n > 0) { conversas++; mensagens += n; }
    } catch (e) {
      console.error("[import-file] erro em", nome, e);
    }
  }

  return NextResponse.json({ ok: true, conversas, mensagens });
}
