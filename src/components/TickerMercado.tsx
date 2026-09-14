"use client";

import { useEffect, useMemo, useState } from "react";
import type { CotacoesMercado } from "@/lib/mercado";
import type { Noticia } from "@/lib/noticias";
import { T } from "@/lib/dash-tema";
import { Coffee, DollarSign, Newspaper, RefreshCw } from "lucide-react";

export type DadosTicker = { cotacoes: CotacoesMercado; noticias: Noticia[] };

const fmtBRL = (v: number | null, casas = 2) =>
  v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

function Variacao({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const cor = pct > 0 ? T.verde : pct < 0 ? T.vermelho : T.mudo;
  const seta = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
  return <span className="text-[11px] font-bold" style={{ color: cor }}>{seta} {Math.abs(pct).toFixed(2)}%</span>;
}

const COR_TEMA: Record<string, string> = { Café: T.amarelo, Crédito: T.verde, Obras: T.laranja, Máquinas: T.ciano, Marcas: T.violeta, Agro: T.verde };

function quando(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// Painel de mercado: cotações em cartões fixos (conilon do ES, arábica,
// dólar) e um LETREIRO estilo bolsa de valores, correndo para a esquerda com
// as notícias do setor. Os dados são atualizados pela rota /api/mercado/ticker
// toda vez que a tela abre, volta ao foco ou a cada 60 s.
export function TickerMercado({ inicial }: { inicial: DadosTicker }) {
  const [dados, setDados] = useState<DadosTicker>(inicial);
  const [atualizando, setAtualizando] = useState(false);
  const [pausado, setPausado] = useState(false);

  useEffect(() => { setDados(inicial); }, [inicial]);

  useEffect(() => {
    let ativo = true;
    const buscar = async () => {
      setAtualizando(true);
      try {
        const r = await fetch("/api/mercado/ticker", { cache: "no-store" });
        const j = await r.json();
        if (ativo && j?.ok) setDados({ cotacoes: j.cotacoes, noticias: j.noticias ?? [] });
      } catch { /* mantém o que tem */ } finally { if (ativo) setAtualizando(false); }
    };
    buscar(); // ao abrir/atualizar a tela
    const id = setInterval(buscar, 60_000);
    const aoFocar = () => { if (document.visibilityState === "visible") buscar(); };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoFocar);
    return () => { ativo = false; clearInterval(id); window.removeEventListener("focus", aoFocar); document.removeEventListener("visibilitychange", aoFocar); };
  }, []);

  const c = dados.cotacoes;
  const es = c.cafeES ?? null;
  const cartoes: { icone: typeof Coffee; label: string; valor: string; pct?: number | null; sub?: string; destaque?: boolean }[] = [];
  if (es?.conilon) cartoes.push({ icone: Coffee, label: `Conilon · ${es.praca ?? "ES"}`, valor: fmtBRL(es.conilon, 0), pct: es.variacaoConilonPct, sub: `sc 60 kg · ${es.fonte ?? "físico"}${es.dataReferencia ? ` · ${es.dataReferencia}` : ""} · lido ${quando(es.atualizadoEm)}`, destaque: true });
  else if (c.cafeConilon != null) cartoes.push({ icone: Coffee, label: "Conilon · Londres", valor: fmtBRL(c.cafeConilon, 0), pct: c.detalhe?.conilon?.variacaoPct, sub: atualizando ? "sc 60 kg · bolsa · buscando o preço do ES…" : "sc 60 kg · bolsa · preço do ES indisponível agora" });
  if (es?.arabica) cartoes.push({ icone: Coffee, label: "Arábica", valor: fmtBRL(es.arabica, 0), sub: `sc 60 kg · ${es.fonte?.replace(" (IA)", "") ?? "físico"}` });
  else if (c.cafeArabica != null) cartoes.push({ icone: Coffee, label: "Arábica · NY", valor: fmtBRL(c.cafeArabica, 0), pct: c.detalhe?.arabica?.variacaoPct, sub: "sc 60 kg · bolsa" });
  if (c.dolar != null) cartoes.push({ icone: DollarSign, label: "Dólar", valor: fmtBRL(c.dolar), pct: c.detalhe?.dolar?.variacaoPct, sub: quando(c.cafeAtualizadoEm) ? `atualizado ${quando(c.cafeAtualizadoEm)}` : undefined });

  const manchetes = useMemo(() => dados.noticias.slice(0, 20), [dados.noticias]);
  // Duração proporcional ao tamanho do texto (~ 55 px/s), para a leitura ser
  // confortável em qualquer quantidade de notícias.
  const duracao = Math.max(30, Math.round(manchetes.reduce((s, n) => s + n.titulo.length + 30, 0) * 8.5 / 55));

  if (!cartoes.length && !manchetes.length) return null;

  const faixa = (chave: string) => manchetes.map((n, i) => (
    <a key={`${chave}-${i}`} href={n.link} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 pr-10 text-sm font-semibold hover:underline" style={{ color: T.texto }} title={n.titulo}>
      <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${COR_TEMA[n.tema] ?? T.violeta}22`, color: COR_TEMA[n.tema] ?? T.violeta }}>{n.tema}</span>
      {n.titulo}
      {n.fonte && <span className="text-[11px] font-normal" style={{ color: T.mudo }}>— {n.fonte}{n.publicadoEm ? ` · ${quando(n.publicadoEm)}` : ""}</span>}
      <span style={{ color: T.rosa }}>◆</span>
    </a>
  ));

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[auto_1fr]">
      <div className="flex flex-wrap gap-2">
        {cartoes.map((k) => (
          <div key={k.label} className="flex min-w-[150px] items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: k.destaque ? T.card2 : T.card, border: `1px solid ${k.destaque ? T.amarelo + "66" : T.borda}` }}>
            <k.icone size={18} style={{ color: k.destaque ? T.amarelo : T.texto2 }} />
            <div className="leading-tight">
              <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.mudo }}>{k.label}</div>
              <div className="flex items-baseline gap-1.5"><span className="text-base font-black" style={{ color: T.texto }}>{k.valor}</span><Variacao pct={k.pct} /></div>
              {k.sub && <div className="text-[10px]" style={{ color: T.mudo }}>{k.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      {manchetes.length > 0 && (
        <div
          className="letreiro flex min-w-0 items-center gap-2 overflow-hidden rounded-xl px-3 py-2"
          style={{ background: T.card, border: `1px solid ${T.borda}` }}
          onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}
          onTouchStart={() => setPausado(true)} onTouchEnd={() => setPausado(false)}
        >
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest" style={{ background: T.sobre2, color: T.ciano }}>
            <Newspaper size={13} /> Notícias {atualizando && <RefreshCw size={11} className="animate-spin" style={{ color: T.mudo }} />}
          </span>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="letreiro-faixa flex w-max items-center whitespace-nowrap" style={{ animationDuration: `${duracao}s`, animationPlayState: pausado ? "paused" : "running" }}>
              {faixa("a")}
              {faixa("b")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
