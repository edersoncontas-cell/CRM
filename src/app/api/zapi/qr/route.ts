import { NextResponse } from "next/server";
import * as zapi from "@/lib/zapi";

export const dynamic = "force-dynamic";
// Gerar o QR pode exigir reiniciar a instância e consultar a Evolution de
// novo: sem isto a função morria no limite padrão e a tela ficava sem QR.
export const maxDuration = 60;

export async function GET() {
  const qr = await zapi.obterQrCode();
  return NextResponse.json(qr);
}
