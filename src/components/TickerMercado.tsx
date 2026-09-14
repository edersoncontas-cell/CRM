"use client";

import { useEffect, useState } from "react";
import type { CotacoesMercado } from "@/lib/mercado";
import type { Noticia } from "@/lib/noticias";
import { T } from "@/lib/dash-tema";
import { Coffee, DollarSign, Newspaper, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

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
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "há minutos";
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// Painel de mercado: cotações em cartões fixos (café conilon do ES, arábica,
// dólar) e UMA manchete por vez, trocando sozinha a cada 7 s — legível, sem
// letreiro correndo. Dados vêm do robô (cron) e se atualizam a cada minuto.
export function TickerMercado({ inicial }: { inicial: DadosTicker }) {
  const [dados, setDados] = useState<DadosTicker>(inicial);
  const [idx, setIdx] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => { setDados(inicial); }, [inicial]);

  useEffect(() => {
    let ativo = true;
    const buscar = async () => {
      try {
        const r = await fetch("/api/mercado/ticker", { cache: "no-store" });
        const j = await r.json();
        if (ativo && j?.ok) setDados({ cotacoes: j.cotacoes, noticias: j.noticias ?? [] });
      } catch { /* mantém o que tem */ }
    };
    const id = setInterval(buscar, 60_000);
    const aoFocar = () => { if (document.visibilityState === "visible") buscar(); };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoFocar);
    return () => { ativo = false; clearInterval(id); window.removeEventListener("focus", aoFocar); document.removeEventListener("visibilitychange", aoFocar); };
  }, []);

  const manchetes = dados.noticias.slice(0, 12);
  useEffect(() => {
    if (pausado || manchetes.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % manchetes.length), 7000);
    return () => clearInterval(id);
  }, [pausado, manchetes.length]);

  const c = dados.cotacoes;
  const es = c.cafeES ?? null;
  const cartoes: { icone: typeof Coffee; label: string; valor: string; pct?: number | null; sub?: string; destaque?: boolean }[] = [];
  if (es?.conilon) cartoes.push({ icone: Coffee, label: "Conilon · ES", valor: fmtBRL(es.conilon, 0), pct: es.variacaoConilonPct, sub: `sc 60 kg · ${es.fonte ?? "físico"}${es.dataReferencia ? ` · ${es.dataReferencia}` : ""}`, destaque: true });
  else if (c.cafeConilon != null) cartoes.push({ icone: Coffee, label: "Conilon · Londres", valor: fmtBRL(c.cafeConilon, 0), pct: c.detalhe?.conilon?.variacaoPct, sub: "sc 60 kg · bolsa (robô do ES ainda sem leitura)" });
  if (es?.arabica) cartoes.push({ icone: Coffee, label: "Arábica · CEPEA", valor: fmtBRL(es.arabica, 0), sub: "sc 60 kg · físico" });
  else if (c.cafeArabica != null) cartoes.push({ icone: Coffee, label: "Arábica · NY", valor: fmtBRL(c.cafeArabica, 0), pct: c.detalhe?.arabica?.variacaoPct, sub: "sc 60 kg · bolsa" });
  if (c.dolar != null) cartoes.push({ icone: DollarSign, label: "Dólar", valor: fmtBRL(c.dolar), pct: c.detalhe?.dolar?.variacaoPct, sub: quando(c.cafeAtualizadoEm) ? `atualizado ${quando(c.cafeAtualizadoEm)}` : undefined });

  if (!cartoes.length && !manchetes.length) return null;
  const n = manchetes.length ? manchetes[idx % manchetes.length] : null;

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
      {n && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: T.card, border: `1px solid ${T.borda}` }} onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)}>
          <Newspaper size={16} className="shrink-0" style={{ color: T.ciano }} />
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${COR_TEMA[n.tema] ?? T.violeta}22`, color: COR_TEMA[n.tema] ?? T.violeta }}>{n.tema}</span>
          <a key={n.link} href={n.link} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline" style={{ color: T.texto, animation: "fadeIn .5s" }} title={n.titulo}>
            {n.titulo}{n.fonte && <span className="ml-1 text-[11px] font-normal" style={{ color: T.mudo }}>— {n.fonte}{n.publicadoEm ? ` · ${quando(n.publicadoEm)}` : ""}</span>}
          </a>
          <ExternalLink size={12} className="shrink-0" style={{ color: T.mudo }} />
          <div className="ml-1 flex shrink-0 items-center gap-0.5">
            <button onClick={() => setIdx((i) => (i - 1 + manchetes.length) % manchetes.length)} className="rounded-md p-1 hover:bg-white/10" aria-label="Anterior" style={{ color: T.texto2, minHeight: 28, minWidth: 28 }}><ChevronLeft size={14} /></button>
            <span className="text-[10px] tabular-nums" style={{ color: T.mudo }}>{(idx % manchetes.length) + 1}/{manchetes.length}</span>
            <button onClick={() => setIdx((i) => (i + 1) % manchetes.length)} className="rounded-md p-1 hover:bg-white/10" aria-label="Próxima" style={{ color: T.texto2, minHeight: 28, minWidth: 28 }}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
