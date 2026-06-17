"use client";

import { useState, useTransition } from "react";
import { gerarAnaliseCategoriaIAAction, preencherFichasVaziasIA } from "@/lib/actions";
import { parseFicha, type CategoriaTrunfo, type MaqTrunfo } from "@/lib/super-trunfo";
import { Sparkles, Trophy, Crown, ChevronDown, ChevronUp, Wand2 } from "lucide-react";

function corMarca(m: MaqTrunfo): string {
  if (m.proprio) return m.marca === "Dynapac" ? "#60a5fa" : "#BFDE4D";
  return "#a1a1aa";
}

function TrunfoCard({ m, destaque }: { m: MaqTrunfo; destaque: boolean }) {
  const atributos = parseFicha(m.especificacoes);
  const cor = corMarca(m);
  return (
    <div
      className="shrink-0 w-56 rounded-2xl p-4 flex flex-col"
      style={{
        background: destaque ? "rgba(191,222,77,0.06)" : "#18181b",
        border: `1.5px solid ${destaque ? "rgba(191,222,77,0.45)" : "#27272a"}`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold" style={{ color: cor }}>{m.marca}</span>
        {destaque && <Crown size={14} style={{ color: "#BFDE4D" }} />}
      </div>
      <div className="text-lg font-extrabold text-white leading-tight mb-3">{m.modelo}</div>

      {atributos.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">Ficha técnica ainda não preenchida.</p>
      ) : (
        <div className="space-y-1.5">
          {atributos.map((a, i) => (
            <div key={i} className="flex flex-col border-b border-zinc-800/70 pb-1.5 last:border-0">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">{a.rotulo}</span>
              <span className="text-sm font-semibold text-zinc-100">{a.valor || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Renderizador simples de markdown leve (negrito + bullets) para a análise da IA.
function AnaliseTexto({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-zinc-300">
      {linhas.map((l, i) => {
        const t = l.trim();
        if (!t) return <div key={i} className="h-1.5" />;
        const bullet = /^[-*•]\s+/.test(t);
        const conteudo = bullet ? t.replace(/^[-*•]\s+/, "") : t;
        const partes = conteudo.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        const render = partes.map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={j} className="text-white">{p.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{p}</span>
          )
        );
        return bullet ? (
          <div key={i} className="flex gap-2 pl-1">
            <span style={{ color: "#BFDE4D" }}>•</span>
            <span>{render}</span>
          </div>
        ) : (
          <p key={i}>{render}</p>
        );
      })}
    </div>
  );
}

function CategoriaBloco({ deck }: { deck: CategoriaTrunfo }) {
  const [aberto, setAberto] = useState(true);
  const [analise, setAnalise] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function gerar() {
    setErro(null);
    start(async () => {
      const r = await gerarAnaliseCategoriaIAAction(deck.categoria);
      if (!r.ok) setErro(r.erro ?? "Erro.");
      else setAnalise(r.texto ?? "");
    });
  }

  return (
    <div className="mb-6 rounded-2xl overflow-hidden" style={{ border: "1px solid #27272a" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: "#18181b" }}
      >
        <div className="flex items-center gap-3">
          <Trophy size={18} style={{ color: "#BFDE4D" }} />
          <h2 className="text-base font-bold text-white">{deck.label}</h2>
          <span className="text-xs text-zinc-500">
            {deck.minhas.length} minha{deck.minhas.length > 1 ? "s" : ""} · {deck.concorrentes.length} concorrentes
          </span>
        </div>
        {aberto ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
      </button>

      {aberto && (
        <div className="p-5" style={{ background: "#0c0c0e" }}>
          {/* Deck de cartas (super trunfo) */}
          <div className="flex gap-3 overflow-x-auto pb-3">
            {deck.minhas.map((m) => (
              <TrunfoCard key={m.id} m={m} destaque />
            ))}
            <div className="shrink-0 w-px self-stretch bg-zinc-800 mx-1" />
            {deck.concorrentes.map((m) => (
              <TrunfoCard key={m.id} m={m} destaque={false} />
            ))}
          </div>

          {/* Análise da IA */}
          <div className="mt-4 rounded-xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: "#60a5fa" }} />
                <span className="text-sm font-bold text-white">Análise & argumentos de venda</span>
              </div>
              <button
                onClick={gerar}
                disabled={pending}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}
              >
                <Sparkles size={13} />
                {pending ? "Analisando..." : analise ? "Gerar de novo" : "Gerar análise"}
              </button>
            </div>
            {erro && <p className="text-xs text-red-400">{erro}</p>}
            {analise ? (
              <AnaliseTexto texto={analise} />
            ) : (
              !erro && <p className="text-xs text-zinc-500">Clique em “Gerar análise” para a IA montar o comparativo e os argumentos de venda desta categoria.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SuperTrunfoClient({ decks }: { decks: CategoriaTrunfo[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function preencherVazias() {
    setMsg("Preenchendo fichas com a IA, isso pode levar um tempo...");
    start(async () => {
      const r = await preencherFichasVaziasIA(false);
      if (!r.ok) setMsg(r.erro ?? "Erro.");
      else setMsg(r.preenchidas > 0
        ? `${r.preenchidas} ficha(s) preenchida(s) pela IA. Recarregue a página para ver. Confira os números.`
        : "Todas as fichas já estavam preenchidas.");
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
        <p className="text-xs text-zinc-400 max-w-xl">
          Fichas <span style={{ color: "#4ade80" }}>verificadas em fonte oficial</span> aparecem completas.
          As demais podem ser preenchidas pela IA (confira sempre os números antes de usar com o cliente).
        </p>
        <button
          onClick={preencherVazias}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
          style={{ background: "#BFDE4D" }}
        >
          <Wand2 size={15} />
          {pending ? "Preenchendo..." : "Preencher fichas vazias com IA"}
        </button>
      </div>
      {msg && <p className="mb-4 text-sm" style={{ color: "#BFDE4D" }}>{msg}</p>}

      {decks.map((d) => (
        <CategoriaBloco key={d.categoria} deck={d} />
      ))}
    </div>
  );
}
