import { NextResponse } from "next/server";
import { ufValida, municipiosDaUf } from "@/lib/municipios-brasil";

export const dynamic = "force-dynamic";

// Municípios de um estado, para o evento que acontece fora da área de
// atuação. Vem da base do IBGE que mora no próprio CRM
// (lib/municipios-brasil.json): não depende de rede nem do IBGE estar de pé.
export async function GET(_req: Request, { params }: { params: { uf: string } }) {
  const uf = params.uf.toUpperCase();
  if (!ufValida(uf)) return NextResponse.json({ erro: "UF inválida." }, { status: 400 });
  const municipios = municipiosDaUf(uf).map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return NextResponse.json({ uf, municipios });
}
