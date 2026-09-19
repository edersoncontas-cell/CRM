import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings } from "@/lib/whatsapp-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getWaSettings();
  return NextResponse.json({ auditMode: s.auditMode, isActive: s.isActive, autoHoraInicio: s.autoHoraInicio, autoHoraFim: s.autoHoraFim, autoLimiteDia: s.autoLimiteDia });
}

// Ajusta o comportamento do Orientador: auditMode (rascunho x automático) e master on/off.
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const s = await getWaSettings();
  const data: Record<string, unknown> = {};
  if (typeof body.auditMode === "boolean") data.auditMode = body.auditMode;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  const inteiro = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : null);
  const hi = inteiro(body.autoHoraInicio, 0, 23); if (hi != null) data.autoHoraInicio = hi;
  const hf = inteiro(body.autoHoraFim, 1, 24); if (hf != null) data.autoHoraFim = hf;
  const lim = inteiro(body.autoLimiteDia, 0, 1000); if (lim != null) data.autoLimiteDia = lim;
  if (!Object.keys(data).length) return NextResponse.json({ ok: false }, { status: 400 });
  const upd = await db.whatsAppSettings.update({ where: { id: s.id }, data });
  return NextResponse.json({ ok: true, auditMode: upd.auditMode, isActive: upd.isActive, autoHoraInicio: upd.autoHoraInicio, autoHoraFim: upd.autoHoraFim, autoLimiteDia: upd.autoLimiteDia });
}
