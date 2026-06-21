import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings } from "@/lib/whatsapp-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getWaSettings();
  return NextResponse.json({ auditMode: s.auditMode, isActive: s.isActive });
}

// Ajusta o comportamento da Agnes: auditMode (rascunho x automático) e master on/off.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const s = await getWaSettings();
  const data: Record<string, unknown> = {};
  if (typeof body.auditMode === "boolean") data.auditMode = body.auditMode;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (!Object.keys(data).length) return NextResponse.json({ ok: false }, { status: 400 });
  const upd = await db.whatsAppSettings.update({ where: { id: s.id }, data });
  return NextResponse.json({ ok: true, auditMode: upd.auditMode, isActive: upd.isActive });
}
