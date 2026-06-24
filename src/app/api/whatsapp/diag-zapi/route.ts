import { NextResponse } from "next/server";
import { resolveZApiConfig } from "@/lib/zapi";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await resolveZApiConfig();
  if (!cfg) return NextResponse.json({ erro: "Z-API não configurada" });

  try {
    // Testa endpoint chats
    const url = `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.token}/chats?page=1&pageSize=5`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(cfg.clientToken ? { "Client-Token": cfg.clientToken } : {}) },
      cache: "no-store",
    });
    const status = res.status;
    const text = await res.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 500); }

    return NextResponse.json({ ok: res.ok, status, url: url.replace(cfg.token, "***"), data });
  } catch (e) {
    return NextResponse.json({ erro: String(e) });
  }
}
