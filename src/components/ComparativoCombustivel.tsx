"use client";

import { useMemo, useState } from "react";
import { Fuel, TrendingUp } from "lucide-react";

type Conc = { id: string; marca: string; modelo: string; consumo: number | null };

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Comparativo de combustível — quanto o cliente gasta A MAIS com a máquina do
// concorrente. Cálculo 100% local (funciona offline).
export function ComparativoCombustivel({
  minhaModelo,
  minhaConsumo,
  concorrentes,
}: {
  minhaModelo: string;
  minhaConsumo: number | null;
  concorrentes: Conc[];
}) {
  const comConsumo = concorrentes.filter((c) => c.consumo != null);
  const [concId, setConcId] = useState<string>(comConsumo[0]?.id ?? "manual");
  const [litrosManual, setLitrosManual] = useState("2"); // L/h a mais (modo manual)
  const [preco, setPreco] = useState("6,00"); // R$/litro do diesel
  const [horasDia, setHorasDia] = useState("8");
  const [diasMes, setDiasMes] = useState("22");

  const conc = comConsumo.find((c) => c.id === concId);
  const num = (s: string) => Number(s.replace(",", ".")) || 0;

  const r = useMemo(() => {
    // litros a mais por hora: do concorrente escolhido (se tiver consumo das duas) ou manual.
    let extraHora = num(litrosManual);
    if (concId !== "manual" && conc?.consumo != null && minhaConsumo != null) {
      extraHora = conc.consumo - minhaConsumo;
    }
    const p = num(preco), h = num(horasDia), d = num(diasMes);
    const custoHora = extraHora * p;
    const dia = custoHora * h;
    const semana = dia * 6;
    const mes = dia * d;
    const ano = mes * 12;
    return { extraHora, dia, semana, mes, ano };
  }, [concId, conc, minhaConsumo, litrosManual, preco, horasDia, diasMes]);

  const modoManual = concId === "manual" || minhaConsumo == null || conc?.consumo == null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-700">
        <Fuel size={18} className="text-amber-600" /> Comparativo de combustível
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Quanto o cliente <b>gasta a mais</b> em diesel com a máquina do concorrente. Cálculo na hora — funciona offline.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 text-xs font-medium text-slate-600 sm:col-span-2">
          Comparar com
          <select
            value={concId}
            onChange={(e) => setConcId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
          >
            {comConsumo.map((c) => (
              <option key={c.id} value={c.id}>{c.marca} {c.modelo} ({c.consumo} L/h)</option>
            ))}
            <option value="manual">Informar litros a mais manualmente</option>
          </select>
        </label>

        {modoManual ? (
          <label className="text-xs font-medium text-slate-600">
            Litros a mais (L/h)
            <input value={litrosManual} onChange={(e) => setLitrosManual(e.target.value)} inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800" />
          </label>
        ) : (
          <div className="text-xs font-medium text-slate-600">
            Diferença
            <div className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-bold text-amber-700">
              +{r.extraHora.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L/h
            </div>
          </div>
        )}

        <label className="text-xs font-medium text-slate-600">
          Diesel (R$/L)
          <input value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Horas/dia
          <input value={horasDia} onChange={(e) => setHorasDia(e.target.value)} inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Dias/mês
          <input value={diasMes} onChange={(e) => setDiasMes(e.target.value)} inputMode="numeric"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800" />
        </label>
      </div>

      {r.extraHora > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { l: "Por dia", v: r.dia },
              { l: "Por semana", v: r.semana },
              { l: "Por mês", v: r.mes },
              { l: "Por ano", v: r.ano },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border border-amber-200 bg-white p-3 text-center">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{x.l}</div>
                <div className="text-lg font-bold text-amber-700">{brl(x.v)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <TrendingUp size={15} className="mt-0.5 shrink-0" />
            <span>
              Argumento: <b>“Com a {minhaModelo} você economiza {brl(r.ano)} por ano só em diesel”</b> — em 5 anos são <b>{brl(r.ano * 5)}</b>.
            </span>
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          {modoManual
            ? "Informe quantos litros a mais por hora a máquina do concorrente consome."
            : "Cadastre o consumo (L/h) das duas máquinas nas Fichas Técnicas para o comparativo automático."}
        </p>
      )}
    </div>
  );
}
