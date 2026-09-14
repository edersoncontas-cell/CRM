"use client";

import { useEffect, useState } from "react";
import type { CotacoesMercado } from "@/lib/mercado";
import type { Noticia } from "@/lib/noticias";
import { T } from "@/lib/dash-tema";

export type DadosTicker = { cotacoes: CotacoesMercado; noticias: Noticia[] };

const fmtBRL = (v: number | null, casas = 2) =>
  v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

function Variacao({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return null;
  const cor = pct > 0 ? T.verde : pct < 0 ? T.vermelho : T.mudo;
  const seta = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
  return <span className="ml-1 text-[11px] font-bold" style={{ color: cor }}>{seta} {Math.abs(pct).toFixed(2)}%</span>;
}

const COR_TEMA: Record<string, string> = { Café: T.amarelo, Crédito: T.verde, Obras: T.laranja, Máquinas: T.ciano, Marcas: T.violeta, Agro: T.verde };

// Letreiro estilo painel de bolsa: cotações (café NY/Londres em R$/saca,
// dólar) + manchetes do setor. Recebe os dados iniciais do servidor e se
// atualiza sozinho a cada 60 s (e ao voltar para a aba).
export function TickerMercado({ inicial }: { inicial: DadosTicker }) {
  const [dados, setDados] = useState<DadosTicker>(inicial);

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

  const c = dados.cotacoes;
  const cotacoes: { label: string; valor: string; pct?: number | null; sub?: string }[] = [];
  if (c.cafeArabica != null) cotacoes.push({ label: "☕ Café Arábica (sc/60kg)", valor: fmtBRL(c.cafeArabica, 0), pct: c.detalhe?.arabica?.variacaoPct, sub: c.detalhe?.arabica?.bruto != null ? `${c.detalhe.arabica.bruto.toFixed(2)} ${c.detalhe.arabica.unidadeBruta}` : undefined });
  if (c.cafeConilon != null) cotacoes.push({ label: "☕ Café Conilon (sc/60kg)", valor: fmtBRL(c.cafeConilon, 0), pct: c.detalhe?.conilon?.variacaoPct, sub: c.detalhe?.conilon?.bruto != null ? `${c.detalhe.conilon.bruto.toFixed(0)} ${c.detalhe.conilon.unidadeBruta}` : undefined });
  if (c.dolar != null) cotacoes.push({ label: "💵 Dólar", valor: fmtBRL(c.dolar), pct: c.detalhe?.dolar?.variacaoPct });

  const manchetes = dados.noticias.slice(0, 14);
  if (!cotacoes.length && !manchetes.length) return null;

  const duracao = Math.max(30, (cotacoes.length + manchetes.length) * 7);

  const conteudo = (
    <>
      {cotacoes.map((it, i) => (
        <span key={`c${i}`} className="inline-flex items-center gap-1.5 whitespace-nowrap px-6 text-sm font-semibold" style={{ color: "#e9e2f7" }}>
          {it.label}: <span className="font-bold" style={{ color: T.verde }}>{it.valor}</span>
          <Variacao pct={it.pct} />
          {it.sub && <span className="text-[11px]" style={{ color: T.mudo }}>({it.sub})</span>}
        </span>
      ))}
      {c.fonte === "reserva-manual" && (
        <span className="inline-flex items-center whitespace-nowrap px-6 text-[11px]" style={{ color: T.mudo }}>bolsa indisponível — valores de reserva</span>
      )}
      {manchetes.map((n, i) => (
        <a key={`n${i}`} href={n.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 whitespace-nowrap px-6 text-sm hover:underline" style={{ color: "#e9e2f7" }}>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${COR_TEMA[n.tema] ?? T.violeta}22`, color: COR_TEMA[n.tema] ?? T.violeta }}>{n.tema}</span>
          {n.titulo}
          {n.fonte && <span className="text-[11px]" style={{ color: T.mudo }}>— {n.fonte}</span>}
        </a>
      ))}
    </>
  );

  return (
    <div className="mb-4 overflow-hidden rounded-xl" style={{ background: T.card, border: `1px solid ${T.borda}` }}>
      <div className="flex py-2 hover:[animation-play-state:paused]" style={{ animation: `ticker ${duracao}s linear infinite` }}>
        <div className="flex shrink-0">{conteudo}</div>
        <div className="flex shrink-0" aria-hidden="true">{conteudo}</div>
      </div>
    </div>
  );
}
