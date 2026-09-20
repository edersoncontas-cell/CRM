"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import { ClienteAcoes } from "@/components/ClienteAcoes";
import { CheckSquare, Square, Trash2, Loader2, X, AlertTriangle } from "lucide-react";
import { excluirClientesEmLote, definirStatusEmLote } from "@/lib/clientes-lote-actions";
import { ROTULO_STATUS, MAX_POR_LOTE, type StatusCliente } from "@/lib/clientes-lote";

// LISTA DE CLIENTES COM SELEÇÃO.
//
//   "Coloque na sessão clientes a opção de selecionar eles, após selecionar
//    que apareça a opção de excluir contato do crm ou de marcar como sendo
//    cliente, potencial ou não cliente"
//
// Com 1.681 cadastros, arrumar um por um pelo ⋮ é trabalho de dias. A régua
// que guia esta tela: a seleção só aparece quando o vendedor pede (o modo
// seleção), porque com ela sempre ligada a caixinha atrapalha o clique de
// abrir o cadastro, que é o uso normal da lista.

export type ClienteCard = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  municipioId: string | null;
  municipioNome: string | null;
  observacoes: string | null;
  jaComprou: boolean;
  visitado: boolean;
  interesseFuturo: boolean;
  interesseFuturoData: string | null;
  interesseFuturoNota: string | null;
  dataNascimento: string | null;
  dataNascimentoOrigem: string | null;
  googleContatoId: string | null;
  status: string;
  maquinaModelo: string | null;
  diasSemContato: number | null;
  iniciais: string;
};

type Municipio = { id: string; nome: string; foraDeArea?: boolean };
type MaquinaOpt = { id: string; marca: string; modelo: string; categoria: string };

export function ListaClientesSelecionavel({
  clientes, municipios, maquinas,
}: {
  clientes: ClienteCard[];
  municipios: Municipio[];
  maquinas: MaquinaOpt[];
}) {
  const router = useRouter();
  const [modoSelecao, setModoSelecao] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, start] = useTransition();

  const marcadosSet = useMemo(() => new Set(marcados), [marcados]);
  const todosDaTelaMarcados = clientes.length > 0 && clientes.every((c) => marcadosSet.has(c.id));

  function alternar(id: string) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  function alternarTodos() {
    setMarcados(todosDaTelaMarcados ? [] : clientes.map((c) => c.id));
  }

  function sairDaSelecao() {
    setModoSelecao(false);
    setMarcados([]);
    setConfirmandoExclusao(false);
    setErro(null);
  }

  function marcarComo(status: StatusCliente) {
    setErro(null);
    start(async () => {
      const r = await definirStatusEmLote(marcados, status);
      if (!r.ok) { setErro(r.erro ?? "Não deu para marcar agora."); return; }
      setAviso(`${r.alterados} contato(s) marcados como "${ROTULO_STATUS[status]}".`);
      sairDaSelecao();
      router.refresh();
    });
  }

  function excluir() {
    setErro(null);
    start(async () => {
      const r = await excluirClientesEmLote(marcados);
      if (!r.ok) { setErro(r.erro ?? "Não deu para excluir agora."); return; }
      setAviso(`${r.excluidos} contato(s) excluídos. Nenhum volta pela sincronização do Google.`);
      sairDaSelecao();
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {modoSelecao ? (
          <>
            <button onClick={alternarTodos} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-zinc-800">
              {todosDaTelaMarcados ? <CheckSquare size={14} /> : <Square size={14} />}
              {todosDaTelaMarcados ? "Desmarcar todos" : `Selecionar os ${clientes.length} da tela`}
            </button>
            <button onClick={sairDaSelecao} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-400 hover:bg-zinc-800">
              <X size={14} /> Sair da seleção
            </button>
          </>
        ) : (
          <button onClick={() => setModoSelecao(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-zinc-800">
            <CheckSquare size={14} /> Selecionar
          </button>
        )}
        {aviso && <span className="text-xs font-semibold text-emerald-400">{aviso}</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {clientes.map((c) => {
          const marcado = marcadosSet.has(c.id);
          const statusColor = c.status === "cliente" ? "text-green-600 bg-green-50"
            : c.status === "nao_cliente" ? "text-red-500 bg-red-50"
            : "text-amber-600 bg-amber-50";
          const statusLabel = c.status === "cliente" ? "✓ cliente"
            : c.status === "nao_cliente" ? "não é cliente"
            : "potencial";
          return (
            <div key={c.id} className="relative">
              <div
                className={`rounded-2xl p-4 transition-all hover:-translate-y-0.5 ${marcado ? "ring-2 ring-agro-400" : ""}`}
                style={{ background: "#18181b", border: "1px solid #27272a" }}
              >
                <div className="flex items-start gap-3">
                  {modoSelecao ? (
                    <button
                      onClick={() => alternar(c.id)}
                      aria-label={marcado ? `Desmarcar ${c.nome}` : `Selecionar ${c.nome}`}
                      className="z-30 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: marcado ? "#BFDE4D" : "#BFDE4D22", color: marcado ? "#000" : "#BFDE4D" }}
                    >
                      {marcado ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ background: "#BFDE4D22", color: "#BFDE4D" }}>
                      {c.iniciais}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 pr-8">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-bold text-white">{c.nome}</span>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusColor}`}>{statusLabel}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {c.municipioNome ?? "Sem município"} · {c.telefone ?? "sem telefone"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {c.googleContatoId && <span title="Ligado ao Google Contatos"><Badge tom="slate">Google</Badge></span>}
                      {c.maquinaModelo && <Badge tom="blue">{c.maquinaModelo}</Badge>}
                      {c.diasSemContato != null && c.diasSemContato >= 7 && <Badge tom="red">{c.diasSemContato}d sem contato</Badge>}
                    </div>
                  </div>
                </div>
              </div>
              {/* No modo seleção o card inteiro marca/desmarca, em vez de abrir
                  o cadastro: clicar num card e cair noutra tela no meio de uma
                  seleção de cinquenta contatos seria perder tudo. */}
              {modoSelecao ? (
                <button aria-label={`Selecionar ${c.nome}`} onClick={() => alternar(c.id)} className="absolute inset-0 z-10 rounded-2xl" />
              ) : (
                <Link href={`/clientes/${c.id}`} aria-label={`Abrir ${c.nome}`} className="absolute inset-0 z-10 rounded-2xl" />
              )}
              {!modoSelecao && (
                <div className="absolute right-3 top-3 z-20">
                  <ClienteAcoes
                    cliente={{
                      id: c.id, nome: c.nome, telefone: c.telefone, email: c.email, endereco: c.endereco,
                      municipioId: c.municipioId, observacoes: c.observacoes, jaComprou: c.jaComprou,
                      visitado: c.visitado, interesseFuturo: c.interesseFuturo,
                      interesseFuturoData: c.interesseFuturoData, interesseFuturoNota: c.interesseFuturoNota,
                      dataNascimento: c.dataNascimento, dataNascimentoOrigem: c.dataNascimentoOrigem,
                    }}
                    municipios={municipios}
                    maquinas={maquinas}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barra de ações: só existe com algo marcado, e fica acima do letreiro
          do rodapé (--rodape-mercado) para não ficar escondida atrás dele. */}
      {modoSelecao && marcados.length > 0 && (
        <div
          className="fixed inset-x-0 z-40 border-t border-zinc-700 bg-zinc-900/95 p-3 backdrop-blur"
          style={{ bottom: "var(--rodape-mercado, 0px)" }}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white">{marcados.length} selecionado(s)</span>
            {marcados.length > MAX_POR_LOTE && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                <AlertTriangle size={12} /> máximo {MAX_POR_LOTE} por vez
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button onClick={() => marcarComo("cliente")} disabled={ocupado} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-60">
                ✓ cliente
              </button>
              <button onClick={() => marcarComo("potencial")} disabled={ocupado} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-60">
                potencial
              </button>
              <button onClick={() => marcarComo("nao_cliente")} disabled={ocupado} className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-bold text-white hover:bg-zinc-600 disabled:opacity-60">
                não é cliente
              </button>
              <button onClick={() => setConfirmandoExclusao(true)} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60">
                {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Excluir
              </button>
            </div>
          </div>
          {erro && <p className="mx-auto mt-2 max-w-5xl text-xs font-semibold text-red-300">{erro}</p>}
        </div>
      )}

      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmandoExclusao(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-800">Excluir {marcados.length} contato(s)</h2>
            <p className="mt-2 text-sm text-slate-600">
              Sai cada um com o histórico ligado — conversas, negociações e visitas. E cada um fica registrado para
              <b> não voltar</b> pela sincronização do Google Contatos.
            </p>
            <p className="mt-2 text-xs text-slate-500">Para liberar depois: Configurações › Contatos que não são clientes.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmandoExclusao(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button onClick={excluir} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60">
                {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir {marcados.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
