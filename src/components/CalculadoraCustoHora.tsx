"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { calcular, calcPadrao, brl, brl2, type MaquinaCalc, type CalcProposta } from "@/lib/proposta";
import { cn } from "@/lib/utils";
import { Plus, X, RotateCcw } from "lucide-react";

const campo = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const rotulo = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

function Num({ id, label, value, onChange, sufixo }: { id: string; label: string; value: number; onChange: (v: number) => void; sufixo?: string }) {
  return (
    <div>
      <label htmlFor={id} className={rotulo}>{label}{sufixo ? <span className="ml-1 normal-case text-slate-400">({sufixo})</span> : null}</label>
      <input id={id} type="number" inputMode="decimal" step="any" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className={campo} />
    </div>
  );
}

function ColunaMaquina({ prefixo, titulo, m, onChange, cor, onRemover }: { prefixo: string; titulo: string; m: MaquinaCalc; onChange: (m: MaquinaCalc) => void; cor: string; onRemover?: () => void }) {
  const set = <K extends keyof MaquinaCalc>(k: K, v: MaquinaCalc[K]) => onChange({ ...m, [k]: v });
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${cor}66`, background: `${cor}0d` }}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-wide" style={{ color: cor }}>{titulo}</div>
        {onRemover && <button onClick={onRemover} className="text-slate-400 hover:text-red-600" title="Remover"><X size={14} /></button>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><label className={rotulo}>Nome</label><input value={m.rotulo} onChange={(e) => set("rotulo", e.target.value)} className={campo} /></div>
        <Num id={`${prefixo}-valor`} label="Valor" sufixo="R$" value={m.valor} onChange={(v) => set("valor", v)} />
        <Num id={`${prefixo}-parcela`} label="Parcela/mês" sufixo="R$" value={m.parcelaMes} onChange={(v) => set("parcelaMes", v)} />
        <Num id={`${prefixo}-consumo`} label="Consumo" sufixo="L/h" value={m.consumoLh} onChange={(v) => set("consumoLh", v)} />
        <Num id={`${prefixo}-manut`} label="Manutenção/mês" sufixo="R$" value={m.manutencaoMes} onChange={(v) => set("manutencaoMes", v)} />
        <Num id={`${prefixo}-parados`} label="Dias parados/mês" value={m.diasParadosMes} onChange={(v) => set("diasParadosMes", v)} />
        <Num id={`${prefixo}-revenda`} label="Revenda ao fim" sufixo="%" value={m.revendaPct} onChange={(v) => set("revendaPct", v)} />
      </div>
    </div>
  );
}

const CHAVE = "calculadora.custohora";

export function CalculadoraCustoHora() {
  const [c, setC] = useState<CalcProposta>(() => {
    try { const raw = typeof window !== "undefined" ? window.localStorage.getItem(CHAVE) : null; if (raw) return { ...calcPadrao(), ...JSON.parse(raw) }; } catch {}
    return calcPadrao();
  });
  const r = useMemo(() => calcular(c), [c]);
  const set = (patch: Partial<CalcProposta>) => setC((x) => { const n = { ...x, ...patch }; try { window.localStorage.setItem(CHAVE, JSON.stringify(n)); } catch {} return n; });

  const linhas = [
    { rotulo: "Custo operacional/mês (diesel + manutenção + paradas)", atual: brl(r.atual.custoMensalOperacional), nova: brl(r.nova.custoMensalOperacional), conc: r.concorrente ? brl(r.concorrente.custoMensalOperacional) : null },
    { rotulo: "Parcela/mês", atual: brl(c.atual.parcelaMes), nova: brl(c.nova.parcelaMes), conc: c.concorrente ? brl(c.concorrente.parcelaMes) : null },
    { rotulo: "Custo total/mês", atual: brl(r.atual.custoMensalTotal), nova: brl(r.nova.custoMensalTotal), conc: r.concorrente ? brl(r.concorrente.custoMensalTotal) : null },
    { rotulo: "Horas efetivas/mês", atual: `${r.atual.horasEfetivas} h`, nova: `${r.nova.horasEfetivas} h`, conc: r.concorrente ? `${r.concorrente.horasEfetivas} h` : null },
    { rotulo: "Custo por hora", atual: brl2(r.atual.custoHora), nova: brl2(r.nova.custoHora), conc: r.concorrente ? brl2(r.concorrente.custoHora) : null },
    { rotulo: `Custo total em ${c.horizonteAnos} anos (TCO, já descontada a revenda)`, atual: brl(r.atual.tcoTotal), nova: brl(r.nova.tcoTotal), conc: r.concorrente ? brl(r.concorrente.tcoTotal) : null },
    { rotulo: "TCO por hora", atual: brl2(r.atual.tcoHora), nova: brl2(r.nova.tcoHora), conc: r.concorrente ? brl2(r.concorrente.tcoHora) : null },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-black uppercase tracking-wide text-slate-700">Números do cliente</div>
            <button onClick={() => { try { window.localStorage.removeItem(CHAVE); } catch {} setC(calcPadrao()); }} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><RotateCcw size={12} /> Limpar</button>
          </div>
          <p className="mb-3 text-xs text-slate-500">Use os números que ele te deu (horas, diesel, quanto custa um dia parado). Conta com número do cliente convence; com o seu, é argumento de vendedor. Os valores ficam salvos neste aparelho.</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <Num id="k-horas" label="Horas por mês" value={c.horasMes} onChange={(v) => set({ horasMes: v })} />
            <Num id="k-diesel" label="Diesel" sufixo="R$/L" value={c.dieselLitro} onChange={(v) => set({ dieselLitro: v })} />
            <Num id="k-parada" label="Custo do dia parado" sufixo="R$" value={c.diariaCobertura} onChange={(v) => set({ diariaCobertura: v })} />
            <Num id="k-horizonte" label="Horizonte" sufixo="anos" value={c.horizonteAnos} onChange={(v) => set({ horizonteAnos: v })} />
            <Num id="k-diaria" label="Diária de aluguel (comparar)" sufixo="R$" value={c.diariaAluguel} onChange={(v) => set({ diariaAluguel: v })} />
            <Num id="k-diasalug" label="Dias de aluguel/mês" value={c.diasAluguelMes} onChange={(v) => set({ diasAluguelMes: v })} />
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ColunaMaquina prefixo="atual" titulo="Máquina atual do cliente" m={c.atual} onChange={(m) => set({ atual: m })} cor="#b86a00" />
          <ColunaMaquina prefixo="nova" titulo="Máquina proposta" m={c.nova} onChange={(m) => set({ nova: m })} cor="#2e7d4f" />
          {c.concorrente ? (
            <ColunaMaquina prefixo="conc" titulo="Concorrente" m={c.concorrente} onChange={(m) => set({ concorrente: m })} cor="#b3261e" onRemover={() => set({ concorrente: null })} />
          ) : (
            <button onClick={() => set({ concorrente: { rotulo: "Concorrente", valor: Math.round(c.nova.valor * 0.85), parcelaMes: Math.round(c.nova.parcelaMes * 0.85), consumoLh: c.nova.consumoLh + 1, manutencaoMes: c.nova.manutencaoMes * 1.5, diasParadosMes: 2, revendaPct: 30 } })}
              className="flex min-h-[120px] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-700">
              <Plus size={16} /> Comparar com um concorrente (TCO)
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <Card>
          <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">Resultado</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="py-1 pr-2"></th><th className="py-1 pr-2">Atual</th><th className="py-1 pr-2 text-green-700">Nova</th>{r.concorrente && <th className="py-1 text-red-700">Conc.</th>}</tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.rotulo} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-500">{l.rotulo}</td>
                    <td className="py-1.5 pr-2 font-semibold text-slate-700 tabular-nums">{l.atual}</td>
                    <td className="py-1.5 pr-2 font-bold text-green-700 tabular-nums">{l.nova}</td>
                    {r.concorrente && <td className="py-1.5 font-semibold text-red-700 tabular-nums">{l.conc}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className={cn(r.diferencaTotalMes <= 0 ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50")}>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Mesmo com a parcela, a nova custa por mês</div>
          <div className={cn("text-2xl font-black", r.diferencaTotalMes <= 0 ? "text-green-700" : "text-amber-700")}>{r.diferencaTotalMes <= 0 ? `${brl(-r.diferencaTotalMes)} a menos` : `${brl(r.diferencaTotalMes)} a mais`}</div>
          <div className="mt-1 text-xs text-slate-600">Economia operacional: <b>{brl(r.economiaOperacionalMes)}</b>/mês{r.paybackMeses ? ` · se paga em ~${r.paybackMeses} meses` : ""}. Ao fim de {c.horizonteAnos} anos a máquina vale ~<b>{brl(r.patrimonioAoFim)}</b>.</div>
          {c.diariaAluguel > 0 && c.diasAluguelMes > 0 && <div className="mt-1 text-xs text-slate-600">Aluguel: <b>{brl(r.aluguelAno)}</b>/ano sem ficar com nada · parcela: <b>{brl(r.parcelaAno)}</b>/ano e a máquina é sua.</div>}
          {r.tcoDiferencaConcorrente != null && <div className="mt-1 text-xs text-slate-600">TCO em {c.horizonteAnos} anos: {r.tcoDiferencaConcorrente >= 0 ? <>a nossa custa <b>{brl(r.tcoDiferencaConcorrente)}</b> a menos que o concorrente</> : <>o concorrente custa <b>{brl(-r.tcoDiferencaConcorrente)}</b> a menos — reveja os números ou o argumento</>}.</div>}
        </Card>
      </div>
    </div>
  );
}
