"use client";

import { useState } from "react";
import {
  calcularFinanciamento, calcularConsorcio, LINHAS_CREDITO, anualParaMensal,
} from "@/lib/finance";
import { formatCurrency } from "@/lib/utils";
import { Calculator } from "lucide-react";

export function Simulador({ valorInicial = 450000 }: { valorInicial?: number }) {
  const [aba, setAba] = useState<"financiamento" | "consorcio">("financiamento");

  // Financiamento
  const [valor, setValor] = useState(valorInicial);
  const [entrada, setEntrada] = useState(Math.round(valorInicial * 0.2));
  const [linha, setLinha] = useState(LINHAS_CREDITO[0].nome);
  const [parcelas, setParcelas] = useState(60);

  const linhaSel = LINHAS_CREDITO.find((l) => l.nome === linha)!;
  const taxaMensal = anualParaMensal(linhaSel.taxaAnual);
  const fin = calcularFinanciamento(valor, entrada, taxaMensal, parcelas);

  // Consórcio
  const [credito, setCredito] = useState(valorInicial);
  const [prazo, setPrazo] = useState(80);
  const [taxaAdm, setTaxaAdm] = useState(18);
  const con = calcularConsorcio(credito, prazo, taxaAdm);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
        <Calculator size={18} className="text-brand-600" /> Simulador
      </div>

      <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        {(["financiamento", "consorcio"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`rounded-md px-4 py-1.5 font-medium capitalize transition ${
              aba === a ? "bg-white text-brand-700 shadow" : "text-slate-500"
            }`}
          >
            {a === "financiamento" ? "Financiamento" : "Consórcio"}
          </button>
        ))}
      </div>

      {aba === "financiamento" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <NumberField label="Valor da máquina" value={valor} onChange={setValor} prefix="R$" />
            <NumberField label="Entrada" value={entrada} onChange={setEntrada} prefix="R$" />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Linha de crédito</label>
              <select
                value={linha}
                onChange={(e) => setLinha(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {LINHAS_CREDITO.map((l) => (
                  <option key={l.nome} value={l.nome}>
                    {l.nome} — {l.taxaAnual}% a.a.
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">{linhaSel.descricao}</p>
            </div>
            <NumberField label="Nº de parcelas (meses)" value={parcelas} onChange={setParcelas} />
          </div>
          <Resultado
            linhas={[
              ["Valor financiado", formatCurrency(fin.valorFinanciado)],
              ["Taxa", `${taxaMensal.toFixed(2)}% a.m.`],
            ]}
            destaque={["Parcela mensal", formatCurrency(fin.parcela)]}
            extras={[
              ["Total pago", formatCurrency(fin.totalPago)],
              ["Total de juros", formatCurrency(fin.totalJuros)],
            ]}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <NumberField label="Crédito (valor da carta)" value={credito} onChange={setCredito} prefix="R$" />
            <NumberField label="Prazo (meses)" value={prazo} onChange={setPrazo} />
            <NumberField label="Taxa de administração total (%)" value={taxaAdm} onChange={setTaxaAdm} />
          </div>
          <Resultado
            linhas={[["Taxa de adm. (total)", formatCurrency(con.taxaTotal)]]}
            destaque={["Parcela mensal", formatCurrency(con.parcela)]}
            extras={[["Total do plano", formatCurrency(con.total)]]}
          />
        </div>
      )}
    </div>
  );
}

function NumberField({
  label, value, onChange, prefix,
}: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center rounded-lg border border-slate-300 px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
        {prefix && <span className="mr-1 text-sm text-slate-400">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </div>
    </div>
  );
}

function Resultado({
  linhas, destaque, extras,
}: {
  linhas: [string, string][]; destaque: [string, string]; extras: [string, string][];
}) {
  return (
    <div className="flex flex-col justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
      <div className="space-y-1 text-sm text-brand-100">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span>{k}</span>
            <span className="font-medium text-white">{v}</span>
          </div>
        ))}
      </div>
      <div className="my-3 border-t border-white/20" />
      <div className="text-sm text-brand-100">{destaque[0]}</div>
      <div className="text-3xl font-bold">{destaque[1]}</div>
      <div className="mt-3 space-y-1 text-xs text-brand-200">
        {extras.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span>{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
