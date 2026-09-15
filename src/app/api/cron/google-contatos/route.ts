import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { googleContatosDisponivel, sincronizarContatosGoogle } from "@/lib/google-contatos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sincroniza a lista de clientes com o Google Contatos. Disparado pelo
// /api/cron/tudo a cada hora; sem conta Google conectada, não faz nada.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await googleContatosDisponivel())) return NextResponse.json({ ok: true, pulado: "google não conectado" });
  const r = await sincronizarContatosGoogle();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
