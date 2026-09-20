"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Gavel, ExternalLink, MapPin, CalendarClock, RefreshCw, Loader2 } from "lucide-react";
import { atualizarLicitacoesAction } from "@/lib/licitacoes-actions";
import type { LicitacoesGuardadas } from "@/lib/licitacoes";

// Licitação de máquina nas cidades da área. Fica logo abaixo dos preços do
// café porque é a mesma leitura de "o que está acontecendo lá fora que vira
// venda" — e prefeitura comprando retroescavadeira é venda na porta.

function dinheiro(v: number | null): string | null {
  if (v == null) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function prazo(iso: string | null): { texto: string; urgente: boolean } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const dias = Math.ceil((t - Date.now()) / 86400000);
  if (dias < 0) return { texto: "encerrada", urgente: false };
  if (dias === 0) return { texto: "encerra hoje", urgente: true };
  if (dias === 1) return { texto: "encerra amanhã", urgente: true };
  return { texto: `${dias} dias para propor`, urgente: dias <= 7 };
}

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

      {itens.length === 0 ? (
        <div className="mt-3 text-xs text-slate-400">
          <p>
            {buscando
              ? "Olhando o portal…"
              : erro
                ? `Não deu para ler o portal agora (${erro}). O robô tenta de novo na próxima passada.`
                : em
                  ? `Nenhum edital de máquina aberto nas suas cidades${editaisLidos ? ` entre os ${editaisLidos.toLocaleString("pt-BR")} editais abertos do ES` : ""}. O robô olha de novo a cada 6 horas.`
                  : "O robô ainda não rodou. Toque no ⟳ aqui do lado para olhar agora."}
          </p>
          {/* O detalhe por modalidade só aparece quando não há resultado — é
              quando ele serve para alguma coisa. */}
          {leituras && leituras.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-slate-500">
              {leituras.map((l) => (
                <li key={l.nome}>
                  {l.nome}: {l.erro ? <span className="text-orange-300">{l.erro}</span> : `${l.editaisLidos} edital(is) em ${l.paginas} página(s)`}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {itens.map((l) => {
            const p = prazo(l.encerramento);
            const valor = dinheiro(l.valor);
            return (
              <li key={l.id} className="rounded-xl border border-slate-700/70 bg-slate-800/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {l.termos.slice(0, 3).map((t) => (
                        <span key={t} className="rounded-full bg-agro-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-agro-300">{t}</span>
                      ))}
                      {p && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.urgente ? "bg-orange-400/20 text-orange-300" : "bg-white/5 text-slate-400"}`}>
                          <CalendarClock size={9} className="mr-0.5 inline" />{p.texto}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">{l.objeto}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      <MapPin size={10} className="mr-0.5 inline" />{l.cidade} · {l.orgao}
                      {l.modalidade ? ` · ${l.modalidade}` : ""}
                      {valor ? ` · ${valor}` : ""}
                    </p>
                  </div>
                  {l.link && (
                    <Link
                      href={l.link}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir o edital no portal"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
