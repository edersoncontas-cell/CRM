import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Enviar foto, áudio ou documento pela conversa saiu do CRM (pedido do
// vendedor, 02/11): o WhatsApp aqui só ESPELHA o que ele manda e recebe pelo
// celular. Fica a resposta clara para uma tela antiga ainda aberta.
export async function POST() {
  return NextResponse.json(
    { ok: false, erro: "O CRM não envia mais arquivo pela conversa — mande pelo WhatsApp do celular. Ele aparece aqui sozinho." },
    { status: 410 },
  );
}
