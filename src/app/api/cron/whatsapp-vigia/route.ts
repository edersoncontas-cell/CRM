import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { vigiarConexao } from "@/lib/whatsapp-vigia";
import { unificarConversasDuplicadas } from "@/lib/whatsapp-dedupe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vigia da conexão do WhatsApp: se o socket caiu, religa sozinho (connect →
// restart) e só pede o QR depois de esgotar as tentativas. Também reaponta o
// webhook quando ele sai do lugar.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const conexao = await vigiarConexao();

  // De carona: junta conversa do mesmo contato que tenha ficado partida em
  // duas ou mais (o bug do álbum de mídias). Não tendo duplicata, não faz
  // nada — e se falhar, não pode derrubar o vigia da conexão, que é o que
  // realmente importa nesta rota.
  let unificacao = null;
  try {
    const r = await unificarConversasDuplicadas();
    unificacao = r.gruposUnificados ? r : null;
  } catch (e) {
    console.error("[whatsapp-vigia] unificação de conversas:", e);
  }

  return NextResponse.json({ ...conexao, ...(unificacao ? { unificacao } : {}) });
}
