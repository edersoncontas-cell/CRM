import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { vigiarConexao } from "@/lib/whatsapp-vigia";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vigia da conexão do WhatsApp: se o socket caiu, religa sozinho (connect →
// restart) e só pede o QR depois de esgotar as tentativas. Também reaponta o
// webhook quando ele sai do lugar.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await vigiarConexao());
}
