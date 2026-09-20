"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Gavel, RefreshCw, Loader2 } from "lucide-react";
import { atualizarLicitacoesAction } from "@/lib/licitacoes-actions";
import type { LicitacoesGuardadas } from "@/lib/licitacoes";

// Estado do robô de licitações. A LISTA de editais não mora mais aqui: ela
// virou um grupo da Central de alertas, a pedido do vendedor — lá ele já é
// cobrado por tudo o que tem prazo, e edital de máquina tem. O que fica neste
// painel é o que a Central não sabe dizer: quantos editais o robô leu, quando
// foi a última passada e o que o portal respondeu.

export function PainelLicitacoes({ dados }: { dados: LicitacoesGuardadas }) {
  const [atual, setAtual] = useState(dados);
  const [buscando, start] = useTransition();
  const { itens, em, cidadesOlhadas, erro, editaisLidos, leituras } = atual;

  function rebuscar() {
    start(async () => { setAtual(await atualizarLicitacoesAction()); });
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-slate-200">
          <Gavel size={15} className="text-agro-400" /> Licitações de máquinas
        </h2>
        <div className="flex items-center gap-2">
          <p className="text-[11px] text-slate-400">
            {cidadesOlhadas > 0 ? `${cidadesOlhadas} cidade(s) da sua área` : "cidades da sua área"}
            {/* Quantos editais o robô de fato leu. É a diferença entre "não há
                edital de máquina" e "o robô não leu nada" — que na tela antiga
                apareciam exatamente iguais. */}
            {editaisLidos != null ? ` · ${editaisLidos.toLocaleString("pt-BR")} editais lidos` : ""}
            {em ? ` · ${new Date(em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
            {" · fonte PNCP"}
          </p>
          <button
            onClick={rebuscar}
            disabled={buscando}
            title="Olhar o portal agora, sem esperar a passada de 6 horas"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            {buscando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>

      {/* A LISTA saiu daqui: os editais agora chegam pela Central de alertas,
          onde o vendedor já é cobrado pelo que tem prazo. Este painel virou o
          ESTADO DO ROBÔ — quantos editais leu, quando, e o que o portal
          respondeu. Sem isso, "nenhum edital de máquina" e "o robô não
          conseguiu ler" apareciam iguais na tela, e eram coisas opostas. */}
      <div className="mt-3 text-xs text-slate-400">
        <p>
          {buscando
            ? "Olhando o portal…"
            : itens.length > 0
              ? `${itens.length} edital(is) de máquina em aberto nas suas cidades.`
              : erro
                ? `Não deu para ler o portal agora (${erro}). O robô tenta de novo na próxima passada.`
                : em
                  ? `Nenhum edital de máquina aberto nas suas cidades${editaisLidos ? ` entre os ${editaisLidos.toLocaleString("pt-BR")} editais abertos do ES` : ""}. O robô olha de novo a cada 6 horas.`
                  : "O robô ainda não rodou. Toque no ⟳ aqui do lado para olhar agora."}
          {itens.length > 0 && (
            <>
              {" "}
              <Link href="/alertas" className="font-bold text-agro-300 hover:underline">Ver na Central de alertas</Link>
            </>
          )}
        </p>
        {/* O detalhe por modalidade só aparece quando não há resultado — é
            quando ele serve para alguma coisa. */}
        {itens.length === 0 && leituras && leituras.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
            {leituras.map((l) => (
              <li key={l.nome}>
                {l.nome}: {l.erro ? <span className="text-orange-300">{l.erro}</span> : `${l.editaisLidos} edital(is) em ${l.paginas} página(s)`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
