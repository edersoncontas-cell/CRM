import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PERMITIDOS = new Set(["nh-escavadeiras.jpg", "dynapac-rolos.jpg"]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { nome: string } }
) {
  if (!PERMITIDOS.has(params.nome)) {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const filePath = path.join(process.cwd(), "public", params.nome);
    const buffer = fs.readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
