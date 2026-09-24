"use client";

import { useEffect, useMemo, useState } from "react";
import { INTERVALO_MERCADO } from "@/lib/intervalos-atualizacao";
import type { CotacoesMercado } from "@/lib/mercado";
import type { Noticia } from "@/lib/noticias";
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

// AMARELO NEW HOLLAND (agro-400) na faixa inteira, texto preto — letreiro de
// bolsa de verdade, e a cor da marca. Sobre amarelo, verde e vermelho claros
// somem: a alta e a baixa usam tons escuros para continuarem legíveis.
const NH_AMARELO = "#ffcb2d";
const NH_BORDA = "#e09e00";
const NH_TEXTO = "#141416";

// "o percentual com a setinha pra cima ou pra baixo no padrão de verde quando
//  positiva e vermelho quando negativo" — e, depois de ver o branco na tela:
//  "Não gostei em branco, deixa em preto mesmo."
//
// O nome do ativo voltou ao preto. Foi a escolha certa: branco sobre o amarelo
// da marca tem contraste de ≈1.7:1, e nem a sombra que eu tinha posto para
// segurar resolvia de verdade num celular ao sol.
//
// Verde e vermelho ESCUROS, pelo mesmo motivo: o verde-claro e o vermelho-claro
// de costume somem sobre amarelo. Estes continuam sendo lidos como verde e
// vermelho, e continuam legíveis. As setas ▲ e ▼ seguem ao lado — são forma,
// não cor, e é o que faz a informação chegar também a quem não distingue as
// duas.
const VERDE_ALTA = "#0f7a33";
const VERMELHO_BAIXA = "#c0261c";
const NH_SUAVE = "rgba(20,20,22,0.66)";

/**
 * As cotações do letreiro — AS MESMAS dos cartões do topo do Dashboard.
 *
 *   "os valores do letreiro de cima que mantemos sempre atualizado não está
 *    refletindo no letreiro de baixo, corrija"
 *
 * Estava, mas não parecia: eu punha o preço FÍSICO do ES e o da BOLSA como
 * ativos separados, para ter seis itens e o rodízio mostrar "outros ativos" a
 * cada grupo. Só que aí o rodapé exibia dois preços de arábica diferentes,
 * enquanto o cartão de cima mostrava um — e duas verdades na mesma tela lêem
 * como erro, não como informação.
 *
 * Agora a régua é uma só, e é a mesma do cartão: preço do ES quando existe,
 * bolsa só como reserva quando o ES não veio. O que o vendedor lê em cima é
 * exatamente o que passa embaixo.
 */
function cotacoesDaFita(c: CotacoesMercado): CotacaoFita[] {
  const es = c.cafeES ?? null;
  const lista: CotacaoFita[] = [];

  if (es?.arabica != null) lista.push({ chave: "arabica-es", rotulo: "Arábica ES", valor: fmtBRL(es.arabica), pct: es.variacaoArabicaPct ?? null });
  else if (c.cafeArabica != null) lista.push({ chave: "arabica-ny", rotulo: "Arábica NY", valor: fmtBRL(c.cafeArabica, 0), pct: c.detalhe?.arabica?.variacaoPct ?? null });

  if (es?.conilon != null) lista.push({ chave: "conilon-es", rotulo: "Conilon ES", valor: fmtBRL(es.conilon), pct: es.variacaoConilonPct ?? null });
  else if (c.cafeConilon != null) lista.push({ chave: "conilon-ldn", rotulo: "Conilon Londres", valor: fmtBRL(c.cafeConilon, 0), pct: c.detalhe?.conilon?.variacaoPct ?? null });

  const dolar = es?.dolar ?? c.dolar;
  if (dolar != null) lista.push({ chave: "dolar", rotulo: "Dólar", valor: fmtBRL(dolar), pct: es?.dolar != null ? null : c.detalhe?.dolar?.variacaoPct ?? null });

  return lista;
}

function Peca({ item }: { item: ItemFita }) {
  if (item.tipo === "cotacao") {
    const seta = item.pct == null ? "" : item.pct > 0 ? "▲" : item.pct < 0 ? "▼" : "•";
    // Sem variação no dia (0,00% ou dado ausente) não é alta nem baixa: fica no
    // preto. Pintar de verde um dia parado diria que subiu.
    const corDaVariacao =
      item.pct == null || item.pct === 0 ? NH_TEXTO : item.pct > 0 ? VERDE_ALTA : VERMELHO_BAIXA;
    return (
      <span className="inline-flex shrink-0 items-baseline gap-1.5 pr-8 text-[12px]">
        <span className="font-black uppercase tracking-wider" style={{ color: NH_SUAVE }}>{item.rotulo}</span>
        <span className="font-bold" style={{ color: NH_TEXTO }}>{item.valor}</span>
        {item.pct != null && (
          <span className="text-[11px] font-black" style={{ color: corDaVariacao }}>{seta} {Math.abs(item.pct).toFixed(2).replace(".", ",")}%</span>
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
      style={{ color: NH_TEXTO }}
    >
      <span className="rounded-full px-1.5 py-[1px] text-[9px] font-black uppercase tracking-wide" style={{ background: NH_TEXTO, color: NH_AMARELO }}>
        {item.tema}
      </span>
      {item.titulo}
      {item.fonte && <span className="text-[10px] font-normal" style={{ color: NH_SUAVE }}>— {item.fonte}</span>}
      <span style={{ color: NH_SUAVE }}>◆</span>
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
    // Aba escondida não chama: a rota consulta o banco (docs/consumo-invocacoes.md).
    const id = setInterval(() => { if (document.visibilityState === "visible") buscar(); }, INTERVALO_MERCADO);
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
      style={{ height: "var(--rodape-mercado)", background: NH_AMARELO, borderColor: NH_BORDA }}
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
