"use client";

import { useEffect, useMemo, useState } from "react";
import type { CotacoesMercado } from "@/lib/mercado";
import type { Noticia } from "@/lib/noticias";
import { T } from "@/lib/dash-tema";
import { EVENTO_ATUALIZAR } from "@/components/BotaoAtualizar";
import { Coffee, DollarSign, Newspaper, RefreshCw } from "lucide-react";

export type DadosTicker = { cotacoes: CotacoesMercado; noticias: Noticia[] };

const fmtBRL = (v: number | null, casas = 2) =>
  v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;

// Seta + percentual. Só some quando não há variação calculável (pct null);
// 0% aparece como "• 0,00%" para o vendedor saber que o preço não mexeu.
function Variacao({ pct, base }: { pct: number | null | undefined; base?: string | null }) {
  if (pct == null) return null;
  const cor = pct > 0 ? T.verde : pct < 0 ? T.vermelho : T.texto2;
  const seta = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
  const titulo = base ? `Variação contra ${base}` : "Variação";
  return <span className="text-[11px] font-bold" style={{ color: cor }} title={titulo}>{seta} {Math.abs(pct).toFixed(2).replace(".", ",")}%</span>;
}

const COR_TEMA: Record<string, string> = { Café: T.amarelo, Crédito: T.verde, Obras: T.laranja, Máquinas: T.ciano, Marcas: T.violeta, Agro: T.verde };

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

// Painel de mercado: cotações em cartões fixos (arábica e conilon do Painel do
// Café, dólar) e um LETREIRO estilo bolsa de valores, correndo para a esquerda
// com as notícias do setor. Os dados são atualizados pela rota
// /api/mercado/ticker toda vez que a tela abre, volta ao foco, a cada 60 s e
// quando o botão "Atualizar" é clicado.
export function TickerMercado({ inicial }: { inicial: DadosTicker }) {
  const [dados, setDados] = useState<DadosTicker>(inicial);
  const [atualizando, setAtualizando] = useState(false);
  const [pausado, setPausado] = useState(false);
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
    const id = setInterval(() => buscar(), 60_000);
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

  const manchetes = useMemo(() => dados.noticias.slice(0, 20), [dados.noticias]);
  // Duração proporcional ao tamanho do texto (~ 55 px/s), para a leitura ser
  // confortável em qualquer quantidade de notícias.
  const duracao = Math.max(30, Math.round(manchetes.reduce((s, n) => s + n.titulo.length + 30, 0) * 8.5 / 55));

  if (!cartoes.length && !manchetes.length) return null;

  const faixa = (chave: string) => manchetes.map((n, i) => (
    <a key={`${chave}-${i}`} href={n.link} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 pr-10 text-sm font-semibold hover:underline" style={{ color: T.texto }} title={n.titulo}>
      <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide" style={{ background: `${COR_TEMA[n.tema] ?? T.violeta}22`, color: COR_TEMA[n.tema] ?? T.violeta }}>{n.tema}</span>
      {n.titulo}
      {n.fonte && <span className="text-[11px] font-normal" style={{ color: T.mudo }}>— {n.fonte}{n.publicadoEm ? ` · ${quando(n.publicadoEm, agora)}` : ""}</span>}
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
              <div className="flex items-baseline gap-1.5"><span className="text-base font-black" style={{ color: T.texto }}>{k.valor}</span><Variacao pct={k.pct} base={k.base} />{atualizando && k.destaque && <RefreshCw size={10} className="animate-spin" style={{ color: T.mudo }} />}</div>
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
