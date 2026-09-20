"use client";

import { useEffect, useMemo, useState } from "react";
import type { CotacoesMercado } from "@/lib/mercado";
import type { Noticia } from "@/lib/noticias";
import { T } from "@/lib/dash-tema";
import { EVENTO_ATUALIZAR } from "@/components/BotaoAtualizar";
import { montarFita, duracaoDaFita, type CotacaoFita, type ItemFita } from "@/lib/ticker-fita";

// LETREIRO FIXO NO RODAPÉ, EM TODAS AS TELAS.
//
//   "quero que o letreiro de notícia passe sem parar no rodapé de todas as
//    páginas do crm, que seja congelado e fixo, passando as cotações do
//    mercado financeiro atualizado, a cada 3 cotações de algum ativo venha
//    uma notícia, e assim sucessivamente"
//
// O ritmo (3 cotações → 1 notícia → 3 OUTRAS cotações) mora em
// lib/ticker-fita.ts, que é puro e testado. Aqui fica só a tela: buscar o
// dado, montar a fita e deixar correr.
//
// A faixa é duplicada de propósito: a animação anda até -50% e recomeça, o
// que faz a emenda ser invisível e o letreiro não ter fim.

const fmtBRL = (v: number | null, casas = 2) =>
  v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

const COR_TEMA: Record<string, string> = { Café: T.amarelo, Crédito: T.verde, Obras: T.laranja, Máquinas: T.ciano, Marcas: T.violeta, Agro: T.verde };

/** As cotações que o CRM tem hoje, na ordem em que passam. */
function cotacoesDaFita(c: CotacoesMercado): CotacaoFita[] {
  const es = c.cafeES ?? null;
  const lista: CotacaoFita[] = [];
  if (es?.arabica != null) lista.push({ chave: "arabica-es", rotulo: "Arábica ES", valor: fmtBRL(es.arabica), pct: es.variacaoArabicaPct ?? null, sub: "sc 60 kg" });
  else if (c.cafeArabica != null) lista.push({ chave: "arabica-ny", rotulo: "Arábica NY", valor: fmtBRL(c.cafeArabica, 0), pct: c.detalhe?.arabica?.variacaoPct ?? null, sub: "sc 60 kg" });
  if (es?.conilon != null) lista.push({ chave: "conilon-es", rotulo: "Conilon ES", valor: fmtBRL(es.conilon), pct: es.variacaoConilonPct ?? null, sub: "sc 60 kg" });
  else if (c.cafeConilon != null) lista.push({ chave: "conilon-ldn", rotulo: "Conilon Londres", valor: fmtBRL(c.cafeConilon, 0), pct: c.detalhe?.conilon?.variacaoPct ?? null, sub: "sc 60 kg" });
  const dolar = es?.dolar ?? c.dolar;
  if (dolar != null) lista.push({ chave: "dolar", rotulo: "Dólar", valor: fmtBRL(dolar), pct: c.detalhe?.dolar?.variacaoPct ?? null });
  // Quando o preço físico do ES existe, a bolsa entra como o ativo seguinte —
  // é o que dá pano para o rodízio mostrar OUTROS ativos no grupo seguinte.
  if (es?.arabica != null && c.cafeArabica != null) lista.push({ chave: "arabica-ny", rotulo: "Arábica NY", valor: fmtBRL(c.cafeArabica, 0), pct: c.detalhe?.arabica?.variacaoPct ?? null, sub: "bolsa" });
  if (es?.conilon != null && c.cafeConilon != null) lista.push({ chave: "conilon-ldn", rotulo: "Conilon Londres", valor: fmtBRL(c.cafeConilon, 0), pct: c.detalhe?.conilon?.variacaoPct ?? null, sub: "bolsa" });
  return lista;
}

function Peca({ item }: { item: ItemFita }) {
  if (item.tipo === "cotacao") {
    const cor = item.pct == null ? T.texto2 : item.pct > 0 ? T.verde : item.pct < 0 ? T.vermelho : T.texto2;
    const seta = item.pct == null ? "" : item.pct > 0 ? "▲" : item.pct < 0 ? "▼" : "•";
    return (
      <span className="inline-flex shrink-0 items-baseline gap-1.5 pr-8 text-[12px]">
        <span className="font-black uppercase tracking-wider" style={{ color: T.mudo }}>{item.rotulo}</span>
        <span className="font-bold" style={{ color: T.texto }}>{item.valor}</span>
        {item.pct != null && (
          <span className="text-[11px] font-bold" style={{ color: cor }}>{seta} {Math.abs(item.pct).toFixed(2).replace(".", ",")}%</span>
        )}
      </span>
    );
  }
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noreferrer"
      title={item.titulo}
      className="inline-flex shrink-0 items-center gap-2 pr-8 text-[12px] font-semibold hover:underline"
      style={{ color: T.texto }}
    >
      <span className="rounded-full px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wide" style={{ background: `${COR_TEMA[item.tema] ?? T.violeta}22`, color: COR_TEMA[item.tema] ?? T.violeta }}>
        {item.tema}
      </span>
      {item.titulo}
      {item.fonte && <span className="text-[10px] font-normal" style={{ color: T.mudo }}>— {item.fonte}</span>}
      <span style={{ color: T.rosa }}>◆</span>
    </a>
  );
}

export function RodapeMercado() {
  const [cotacoes, setCotacoes] = useState<CotacoesMercado | null>(null);
  const [noticias, setNoticias] = useState<Noticia[]>([]);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    let ativo = true;
    const buscar = async (forcar = false) => {
      try {
        const r = await fetch(`/api/mercado/ticker${forcar ? "?forcar=1" : ""}`, { cache: "no-store" });
        const j = await r.json();
        if (ativo && j?.ok) { setCotacoes(j.cotacoes); setNoticias(j.noticias ?? []); }
      } catch { /* mantém o que já está na tela */ }
    };
    buscar();
    const id = setInterval(() => buscar(), 60_000);
    const aoFocar = () => { if (document.visibilityState === "visible") buscar(); };
    const aoPedirAtualizacao = () => { buscar(true); };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoFocar);
    window.addEventListener(EVENTO_ATUALIZAR, aoPedirAtualizacao);
    return () => {
      ativo = false;
      clearInterval(id);
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoFocar);
      window.removeEventListener(EVENTO_ATUALIZAR, aoPedirAtualizacao);
    };
  }, []);

  // Oito manchetes bastam: cada uma vem com 3 cotações na frente, então a
  // volta completa já fica longa. Mais que isso só atrasaria o retorno da
  // primeira notícia.
  const fita = useMemo(
    () => montarFita(cotacoes ? cotacoesDaFita(cotacoes) : [], noticias.slice(0, 8)),
    [cotacoes, noticias],
  );
  const duracao = useMemo(() => duracaoDaFita(fita), [fita]);

  if (!fita.length) return null;

  const faixa = (chave: string) => fita.map((item, i) => (
    <Peca key={`${chave}-${i}-${item.tipo === "cotacao" ? item.chave : item.link}`} item={item} />
  ));

  return (
    // print:hidden — letreiro não vai para o PDF de proposta.
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex items-center overflow-hidden border-t print:hidden"
      style={{ height: "var(--rodape-mercado)", background: T.card, borderColor: T.borda }}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className="letreiro-faixa flex w-max items-center whitespace-nowrap"
          style={{ animationDuration: `${duracao}s`, animationPlayState: pausado ? "paused" : "running" }}
        >
          {faixa("a")}
          {faixa("b")}
        </div>
      </div>
    </div>
  );
}
