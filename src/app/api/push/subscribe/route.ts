import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sub = await req.json();
    if (!sub?.endpoint) return NextResponse.json({ ok: false }, { status: 400 });

    await db.configuracao.upsert({
      where: { chave: "push_subscription" },
      update: { valor: JSON.stringify(sub) },
      create: { chave: "push_subscription", valor: JSON.stringify(sub) },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
