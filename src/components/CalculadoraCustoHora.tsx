"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { CampoNumero } from "@/components/CampoNumero";
import { brl, brl2 } from "@/lib/proposta";
import { cn } from "@/lib/utils";
import { RotateCcw, Fuel } from "lucide-react";

const campo = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const rotulo = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

import { calcularCombustivel, calcCombustivelPadrao as padrao, type CalcCombustivel as Calc, type MaquinaCombustivel as Maquina } from "@/lib/calculadora-combustivel";

function Num({ id, label, value, onChange, sufixo }: { id: string; label: string; value: number; onChange: (v: number) => void; sufixo?: string }) {
  return (
    <div>
      <label htmlFor={id} className={rotulo}>{label}{sufixo ? <span className="ml-1 normal-case text-slate-400">({sufixo})</span> : null}</label>
      <CampoNumero id={id} value={value} onChange={onChange} className={campo} />
    </div>
  );
}

function ColunaMaquina({ prefixo, titulo, m, onChange, cor, placeholder }: { prefixo: string; titulo: string; m: Maquina; onChange: (m: Maquina) => void; cor: string; placeholder: string }) {
  const set = <K extends keyof Maquina>(k: K, v: Maquina[K]) => onChange({ ...m, [k]: v });
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${cor}66`, background: `${cor}0d` }}>
      <div className="mb-2 text-xs font-black uppercase tracking-wide" style={{ color: cor }}>{titulo}</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><label htmlFor={`${prefixo}-nome`} className={rotulo}>Modelo</label><input id={`${prefixo}-nome`} value={m.nome} placeholder={placeholder} onChange={(e) => set("nome", e.target.value)} className={campo} /></div>
        <Num id={`${prefixo}-valor`} label="Valor" sufixo="R$" value={m.valor} onChange={(v) => set("valor", v)} />
        <Num id={`${prefixo}-consumo`} label="Consumo" sufixo="L/h" value={m.consumoLh} onChange={(v) => set("consumoLh", v)} />
      </div>
    </div>
  );
}

const CHAVE = "calculadora.combustivel";

export function CalculadoraCustoHora() {
  const [c, setC] = useState<Calc>(() => {
    try { const raw = typeof window !== "undefined" ? window.localStorage.getItem(CHAVE) : null; if (raw) return { ...padrao(), ...JSON.parse(raw) }; } catch {}
    return padrao();
  });
  const r = useMemo(() => calcularCombustivel(c), [c]);
  const set = (patch: Partial<Calc>) => setC((x) => { const n = { ...x, ...patch }; try { window.localStorage.setItem(CHAVE, JSON.stringify(n)); } catch {} return n; });

  const nomeConc = c.concorrente.nome || "o concorrente";
  const nomeNH = c.newHolland.nome ? `New Holland ${c.newHolland.nome}` : "a New Holland";
  const economiza = r.difLh > 0;
  const temPreco = c.newHolland.valor > 0 && c.concorrente.valor > 0;

  const linhas = [
    { rotulo: "Consumo", conc: `${c.concorrente.consumoLh} L/h`, nh: `${c.newHolland.consumoLh} L/h` },
    { rotulo: "Diesel por mês", conc: `${Math.round(c.concorrente.consumoLh * c.horasMes)} L`, nh: `${Math.round(c.newHolland.consumoLh * c.horasMes)} L` },
    { rotulo: "Gasto com diesel/mês", conc: brl(c.concorrente.consumoLh * c.horasMes * c.dieselLitro), nh: brl(c.newHolland.consumoLh * c.horasMes * c.dieselLitro) },
    { rotulo: "Gasto com diesel/ano", conc: brl(c.concorrente.consumoLh * c.horasMes * c.dieselLitro * 12), nh: brl(c.newHolland.consumoLh * c.horasMes * c.dieselLitro * 12) },
    { rotulo: `Gasto com diesel em ${c.horizonteAnos} anos`, conc: brl(c.concorrente.consumoLh * c.horasMes * c.dieselLitro * 12 * c.horizonteAnos), nh: brl(c.newHolland.consumoLh * c.horasMes * c.dieselLitro * 12 * c.horizonteAnos) },
    { rotulo: "Valor da máquina", conc: brl(c.concorrente.valor), nh: brl(c.newHolland.valor) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-black uppercase tracking-wide text-slate-700">Números do cliente</div>
            <button onClick={() => { try { window.localStorage.removeItem(CHAVE); } catch {} setC(padrao()); }} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><RotateCcw size={12} /> Limpar</button>
          </div>
          <p className="mb-3 text-xs text-slate-500">Use os números que o cliente te deu: quantas horas a máquina roda por mês, quanto ele paga no diesel e por quantos anos vai ficar com ela. Os valores ficam salvos neste aparelho.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Num id="k-horas" label="Horas trabalhadas" sufixo="por mês" value={c.horasMes} onChange={(v) => set({ horasMes: v })} />
            <Num id="k-diesel" label="Diesel" sufixo="R$/L" value={c.dieselLitro} onChange={(v) => set({ dieselLitro: v })} />
            <Num id="k-horizonte" label="Horizonte" sufixo="anos com a máquina" value={c.horizonteAnos} onChange={(v) => set({ horizonteAnos: v })} />
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ColunaMaquina prefixo="conc" titulo="Concorrente" m={c.concorrente} onChange={(m) => set({ concorrente: m })} cor="#b86a00" placeholder="ex.: PC130" />
          <ColunaMaquina prefixo="nh" titulo="New Holland" m={c.newHolland} onChange={(m) => set({ newHolland: m })} cor="#2e7d4f" placeholder="ex.: E145C" />
        </div>
      </div>

      <div className="space-y-3">
        <Card>
          <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">Resultado</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="py-1 pr-2"></th><th className="py-1 pr-2 text-amber-700">Concorrente</th><th className="py-1 text-green-700">New Holland</th></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.rotulo} className="border-t border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-500">{l.rotulo}</td>
                    <td className="py-1.5 pr-2 font-semibold text-slate-700 tabular-nums">{l.conc}</td>
                    <td className="py-1.5 font-bold text-green-700 tabular-nums">{l.nh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className={cn(economiza ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50")}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Fuel size={13} /> Economia só em combustível com {nomeNH}</div>
          {economiza ? (
            <>
              <div className="mt-1 text-3xl font-black text-green-700">{brl(r.horizonte)}</div>
              <div className="text-xs font-semibold text-green-800">em {c.horizonteAnos} anos, comparando com {nomeConc}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/70 p-2"><div className="text-[10px] uppercase text-slate-400">por mês</div><div className="text-sm font-bold text-slate-800">{brl(r.mes)}</div></div>
                <div className="rounded-lg bg-white/70 p-2"><div className="text-[10px] uppercase text-slate-400">por ano</div><div className="text-sm font-bold text-slate-800">{brl(r.ano)}</div></div>
                <div className="rounded-lg bg-white/70 p-2"><div className="text-[10px] uppercase text-slate-400">litros/mês</div><div className="text-sm font-bold text-slate-800">{Math.round(r.litrosMes)} L</div></div>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {r.difLh.toLocaleString("pt-BR")} L/h a menos × {brl2(c.dieselLitro)} × {c.horasMes} h/mês.
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm font-semibold text-amber-800">
              {r.difLh === 0 ? "Os dois consomem o mesmo. Preencha o consumo real de cada máquina." : `Pelos números informados, ${nomeNH} consome ${Math.abs(r.difLh).toLocaleString("pt-BR")} L/h a mais. Confira o consumo.`}
            </div>
          )}
        </Card>

        {temPreco && (
          <Card className={cn(r.liquido >= 0 ? "border-green-300 bg-white" : "border-amber-300 bg-white")}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Descontando a diferença de preço</div>
            <div className="mt-1 text-xs text-slate-600">
              {r.diferencaPreco > 0
                ? <>{nomeNH} custa <b>{brl(r.diferencaPreco)}</b> a mais na compra.</>
                : r.diferencaPreco < 0
                  ? <>{nomeNH} custa <b>{brl(-r.diferencaPreco)}</b> a menos na compra.</>
                  : <>As duas custam o mesmo na compra.</>}
            </div>
            <div className={cn("mt-1 text-2xl font-black", r.liquido >= 0 ? "text-green-700" : "text-amber-700")}>
              {r.liquido >= 0 ? `${brl(r.liquido)} a favor do cliente` : `${brl(-r.liquido)} contra`}
            </div>
            <div className="text-xs text-slate-500">economia em combustível em {c.horizonteAnos} anos menos a diferença de preço</div>
            {r.paybackMeses > 0 && <div className="mt-1 text-xs text-slate-600">A diferença de preço se paga só com o diesel em <b>{r.paybackMeses} meses</b>.</div>}
          </Card>
        )}
      </div>
    </div>
  );
}
