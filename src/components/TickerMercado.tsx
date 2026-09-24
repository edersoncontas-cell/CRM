"use client";

import { useEffect, useMemo, useState } from "react";
import { INTERVALO_MERCADO } from "@/lib/intervalos-atualizacao";
import type { CotacoesMercado } from "@/lib/mercado";
import type { Noticia } from "@/lib/noticias";
import type { TemaDash } from "@/lib/dash-tema";
import { useTemaDash } from "@/components/TemaDashProvider";
import { EVENTO_ATUALIZAR } from "@/components/BotaoAtualizar";
import { Coffee, DollarSign, Newspaper, RefreshCw } from "lucide-react";

export type DadosTicker = { cotacoes: CotacoesMercado; noticias: Noticia[] };

const fmtBRL = (v: number | null, casas = 2) =>
  v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

// Seta + percentual. Só some quando não há variação calculável (pct null);
// 0% aparece como "• 0,00%" para o vendedor saber que o preço não mexeu.
function Variacao({ pct, base }: { pct: number | null | undefined; base?: string | null }) {
  const T = useTemaDash();
  if (pct == null) return null;
  const cor = pct > 0 ? T.verde : pct < 0 ? T.vermelho : T.texto2;
  const seta = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
  const titulo = base ? `Variação contra ${base}` : "Variação";
  return <span className="text-[11px] font-bold" style={{ color: cor }} title={titulo}>{seta} {Math.abs(pct).toFixed(2).replace(".", ",")}%</span>;
}

const corTema = (T: TemaDash): Record<string, string> =>
  ({ Café: T.amarelo, Crédito: T.verde, Obras: T.laranja, Máquinas: T.ciano, Marcas: T.violeta, Agro: T.verde });

function quando(iso: string | null | undefined, agora: number): string {
  if (!iso) return "";
  const ms = agora - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// Painel de mercado do Dashboard: só os CARTÕES de cotação (arábica e conilon
// do Painel do Café, dólar). O letreiro de notícias saiu daqui quando ganhou
// o rodapé fixo de todas as telas — ver RodapeMercado.tsx. Mantê-lo nos dois
// lugares deixava a mesma manchete passando duas vezes na mesma tela. Os
// dados são atualizados pela rota
// /api/mercado/ticker toda vez que a tela abre, volta ao foco, a cada 15 min (só com a tela visível) e
// quando o botão "Atualizar" é clicado.
export function TickerMercado({ inicial }: { inicial: DadosTicker }) {
  const T = useTemaDash();
  const [dados, setDados] = useState<DadosTicker>(inicial);
  const [atualizando, setAtualizando] = useState(false);
  // Relógio para o "lido há X min" andar mesmo sem dado novo.
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => { setDados(inicial); }, [inicial]);

  useEffect(() => {
    let ativo = true;
    const buscar = async (forcar = false) => {
      setAtualizando(true);
      try {
        const r = await fetch(`/api/mercado/ticker${forcar ? "?forcar=1" : ""}`, { cache: "no-store" });
        const j = await r.json();
        if (ativo && j?.ok) { setDados({ cotacoes: j.cotacoes, noticias: j.noticias ?? [] }); setAgora(Date.now()); }
      } catch { /* mantém o que tem */ } finally { if (ativo) setAtualizando(false); }
    };
    buscar(); // ao abrir/atualizar a tela
    // Aba escondida não chama: a rota consulta o banco (docs/consumo-invocacoes.md).
    const id = setInterval(() => { if (document.visibilityState === "visible") buscar(); }, INTERVALO_MERCADO);
    const relogio = setInterval(() => setAgora(Date.now()), 20_000);
    const aoFocar = () => { if (document.visibilityState === "visible") buscar(); };
    const aoPedirAtualizacao = (e: Event) => {
      const p = buscar(true);
      (e as CustomEvent<{ registrar?: (p: Promise<unknown>) => void }>).detail?.registrar?.(p);
    };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoFocar);
    window.addEventListener(EVENTO_ATUALIZAR, aoPedirAtualizacao);
    return () => {
      ativo = false; clearInterval(id); clearInterval(relogio);
      window.removeEventListener("focus", aoFocar); document.removeEventListener("visibilitychange", aoFocar);
      window.removeEventListener(EVENTO_ATUALIZAR, aoPedirAtualizacao);
    };
  }, []);

  const c = dados.cotacoes;
  const es = c.cafeES ?? null;
  const fonte = es?.fonte?.replace(" (IA)", "") ?? "físico";
  const doPainel = (es?.fonte ?? "").startsWith("Painel do Café");
  const lido = es ? `lido ${quando(es.atualizadoEm, agora)}` : "";
  const ref = es?.dataReferencia ? ` · ${es.dataReferencia}` : "";
  const cartoes: { icone: typeof Coffee; label: string; valor: string; pct?: number | null; base?: string | null; sub?: string; destaque?: boolean }[] = [];
  // Arábica primeiro: é o café da região do vendedor.
  if (es?.arabica) cartoes.push({ icone: Coffee, label: doPainel ? "Arábica Rio · ES" : "Arábica", valor: fmtBRL(es.arabica, 2), pct: es.variacaoArabicaPct, base: es.variacaoBase, sub: `sc 60 kg · ${fonte}${ref} · ${lido}`, destaque: true });
  else if (c.cafeArabica != null) cartoes.push({ icone: Coffee, label: "Arábica · NY", valor: fmtBRL(c.cafeArabica, 0), pct: c.detalhe?.arabica?.variacaoPct, sub: "sc 60 kg · bolsa", destaque: true });
  if (es?.conilon) cartoes.push({ icone: Coffee, label: doPainel ? "Conilon 7/8 · ES" : `Conilon · ${es.praca ?? "ES"}`, valor: fmtBRL(es.conilon, 2), pct: es.variacaoConilonPct, base: es.variacaoBase, sub: `sc 60 kg · ${fonte}${ref} · ${lido}` });
  else if (c.cafeConilon != null) cartoes.push({ icone: Coffee, label: "Conilon · Londres", valor: fmtBRL(c.cafeConilon, 0), pct: c.detalhe?.conilon?.variacaoPct, sub: atualizando ? "sc 60 kg · bolsa · buscando o preço do ES…" : "sc 60 kg · bolsa · preço do ES indisponível agora" });
  const dolar = es?.dolar ?? c.dolar;
  if (dolar != null) cartoes.push({ icone: DollarSign, label: "Dólar", valor: fmtBRL(dolar), pct: es?.dolar != null ? null : c.detalhe?.dolar?.variacaoPct, sub: es?.dolar != null ? `${fonte}${ref}` : quando(c.cafeAtualizadoEm, agora) ? `atualizado ${quando(c.cafeAtualizadoEm, agora)}` : undefined });

  if (!cartoes.length) return null;


  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {cartoes.map((k) => (
          <div key={k.label} className="flex min-w-[150px] items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: k.destaque ? T.card2 : T.card, border: `1px solid ${k.destaque ? T.amarelo + "66" : T.borda}` }}>
            <k.icone size={18} style={{ color: k.destaque ? T.amarelo : T.texto2 }} />
            <div className="leading-tight">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.mudo }}>{k.label}</div>
              <div className="flex items-baseline gap-1.5"><span className="text-base font-black" style={{ color: T.texto }}>{k.valor}</span><Variacao pct={k.pct} base={k.base} />{atualizando && k.destaque && <RefreshCw size={10} className="animate-spin" style={{ color: T.mudo }} />}</div>
              {k.sub && <div className="text-[10px]" style={{ color: T.mudo }}>{k.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
