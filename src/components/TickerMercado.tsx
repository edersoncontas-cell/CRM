import { obterCotacoes } from "@/lib/mercado";

function fmt(v: number | null, prefixo = "R$ "): string {
  if (v == null) return "—";
  return `${prefixo}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Letreiro estilo painel de bolsa/commodities no topo do Dashboard — café
// (arábica/conilon, atualizado manualmente em Configurações) e dólar
// (buscado ao vivo). Rolagem contínua via CSS puro (sem JS).
export async function TickerMercado() {
  const { dolar, cafeArabica, cafeConilon, cafeAtualizadoEm } = await obterCotacoes();

  if (dolar == null && cafeArabica == null && cafeConilon == null) return null;

  const itens = [
    cafeArabica != null && { label: "☕ Café Arábica (sc/60kg)", valor: fmt(cafeArabica) },
    cafeConilon != null && { label: "☕ Café Conilon (sc/60kg)", valor: fmt(cafeConilon) },
    dolar != null && { label: "💵 Dólar", valor: fmt(dolar) },
  ].filter(Boolean) as { label: string; valor: string }[];

  if (!itens.length) return null;

  const dataRotulo = cafeAtualizadoEm
    ? new Date(cafeAtualizadoEm).toLocaleDateString("pt-BR")
    : null;

  const conteudo = (
    <>
      {itens.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 px-6 text-sm font-semibold text-zinc-200 whitespace-nowrap">
          {it.label}: <span className="font-bold" style={{ color: "#BFDE4D" }}>{it.valor}</span>
        </span>
      ))}
      {dataRotulo && (
        <span className="inline-flex items-center px-6 text-xs text-zinc-500 whitespace-nowrap">
          café atualizado em {dataRotulo}
        </span>
      )}
    </>
  );

  return (
    <div className="mb-4 overflow-hidden rounded-xl" style={{ background: "#18181b", border: "1px solid #27272a" }}>
      <div className="flex animate-[ticker_25s_linear_infinite] py-2">
        <div className="flex shrink-0">{conteudo}</div>
        <div className="flex shrink-0" aria-hidden="true">{conteudo}</div>
      </div>
    </div>
  );
}
