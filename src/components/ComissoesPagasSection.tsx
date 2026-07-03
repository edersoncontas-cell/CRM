"use client";

import { useState } from "react";
import Link from "next/link";
import { DollarSign, ChevronDown, ChevronUp } from "lucide-react";

type NegItem = {
  clienteNome: string;
  clienteId: string;
  valor: number;
  comissao: number;
  faturadoEm: Date | null;
  maquina: string;
};

type AnoData = {
  total: number;
  quantidade: number;
  negs: NegItem[];
};

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateBR(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ComissoesPagasSection({
  anosComissoes,
  comissoesPagasPorAno,
}: {
  anosComissoes: string[];
  comissoesPagasPorAno: Record<string, AnoData>;
}) {
  const [anoSel, setAnoSel] = useState<string>(anosComissoes[0] ?? "");
  const [expanded, setExpanded] = useState(false);

  const dadosAno = anoSel ? comissoesPagasPorAno[anoSel] : null;
  const totalGeral = anosComissoes.reduce(
    (s, a) => s + (comissoesPagasPorAno[a]?.total ?? 0),
    0
  );

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-slate-700 text-base">
          <DollarSign size={18} className="text-emerald-500" />
          Comissões Pagas
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Total geral</div>
          <div className="text-lg font-bold text-emerald-700">{formatBRL(totalGeral)}</div>
        </div>
      </div>

      {/* Year filter */}
      {anosComissoes.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma comissão registrada.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setAnoSel("")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                anoSel === ""
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Todos os anos
            </button>
            {anosComissoes.map((ano) => (
              <button
                key={ano}
                onClick={() => setAnoSel(ano)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  anoSel === ano
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {ano}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          {anoSel === "" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {anosComissoes.map((ano) => {
                const d = comissoesPagasPorAno[ano];
                return (
                  <button
                    key={ano}
                    onClick={() => setAnoSel(ano)}
                    className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left transition-colors hover:bg-emerald-100"
                  >
                    <div className="mb-1 text-sm font-bold text-slate-700">{ano}</div>
                    <div className="text-lg font-bold text-emerald-700">{formatBRL(d.total)}</div>
                    <div className="text-xs text-slate-500">{d.quantidade} negociação(ões)</div>
                  </button>
                );
              })}
            </div>
          ) : dadosAno ? (
            <div>
              {/* KPI row */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <div className="text-xs text-slate-500 mb-1">Total comissões</div>
                  <div className="text-xl font-bold text-emerald-700">{formatBRL(dadosAno.total)}</div>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <div className="text-xs text-slate-500 mb-1">Quantidade</div>
                  <div className="text-xl font-bold text-blue-700">{dadosAno.quantidade}</div>
                  <div className="text-xs text-slate-400">negociações</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="text-xs text-slate-500 mb-1">Média por venda</div>
                  <div className="text-xl font-bold text-gray-700">
                    {formatBRL(dadosAno.quantidade > 0 ? dadosAno.total / dadosAno.quantidade : 0)}
                  </div>
                </div>
              </div>

              {/* Deals list */}
              <div>
                <button
                  onClick={() => setExpanded((p) => !p)}
                  className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expanded ? "Ocultar" : "Ver"} detalhes das negociações ({dadosAno.negs.length})
                </button>
                {expanded && (
                  <ul className="max-h-80 space-y-2 overflow-y-auto">
                    {dadosAno.negs.map((n, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-green-50 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/clientes/${n.clienteId}`}
                            className="block truncate text-sm font-semibold text-slate-800 hover:text-emerald-600"
                          >
                            {n.clienteNome}
                          </Link>
                          <p className="truncate text-xs text-slate-500">
                            {n.maquina} · {formatDateBR(n.faturadoEm)}
                          </p>
                        </div>
                        <div className="ml-3 shrink-0 text-right">
                          <div className="text-sm font-bold text-slate-800">
                            {formatBRL(n.valor)}
                          </div>
                          <div className="text-xs font-bold text-emerald-600">
                            +{formatBRL(n.comissao)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Nenhum dado para o período selecionado.</p>
          )}
        </>
      )}
    </div>
  );
}
