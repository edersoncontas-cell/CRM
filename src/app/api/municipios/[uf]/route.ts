import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Municípios de um estado, para o evento que acontece fora do Espírito Santo
// (o CRM só tem os municípios do ES cadastrados). Vem do IBGE, que é público e
// não pede chave; o resultado fica em memória porque a lista quase não muda.
const cache = new Map<string, string[]>();

export async function GET(_req: Request, { params }: { params: { uf: string } }) {
  const uf = params.uf.toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return NextResponse.json({ erro: "UF inválida." }, { status: 400 });

  const emCache = cache.get(uf);
  if (emCache) return NextResponse.json({ uf, municipios: emCache });

  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, {
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);
    const dados = (await res.json()) as { nome: string }[];
    const municipios = dados.map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
    cache.set(uf, municipios);
    return NextResponse.json({ uf, municipios });
  } catch (e) {
    return NextResponse.json(
      { erro: `Não consegui carregar as cidades de ${uf}: ${e instanceof Error ? e.message : String(e)}. Dá para digitar o nome da cidade à mão.` },
      { status: 502 }
    );
  }
}
