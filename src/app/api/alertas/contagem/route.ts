import { NextResponse } from "next/server";
import { listarCentralAlertas } from "@/lib/central-alertas";

export const dynamic = "force-dynamic";

// Contador do menu lateral (badge em "Alertas"). Protegido pelo login.
export async function GET() {
  try {
    const { total, alta } = await listarCentralAlertas();
    return NextResponse.json({ total, alta });
  } catch (e) {
    console.error("[alertas/contagem]", e);
    return NextResponse.json({ total: 0, alta: 0 });
  }
}
