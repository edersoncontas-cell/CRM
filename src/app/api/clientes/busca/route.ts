import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  
  const where = q
    ? {
        OR: [
          { nome: { contains: q, mode: "insensitive" as const } },
          { telefone: { contains: q.replace(/\D/g, "") } },
        ],
      }
    : {};

  const clientes = await db.cliente.findMany({
    where,
    select: { id: true, nome: true, telefone: true },
    orderBy: { nome: "asc" },
    take: 20,
  });

  return NextResponse.json({ clientes });
}
