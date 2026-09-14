"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui";
import { calcular, textoRetorno, brl, brl2, type DadosProposta, type MaquinaCalc, type CalcProposta } from "@/lib/proposta";
import type { ContextoProposta } from "@/lib/proposta-pdf";
import { salvarPropostaAction, enviarPropostaWhatsAppAction } from "@/lib/proposta-actions";
import { cn } from "@/lib/utils";
import { Calculator, FileText, Save, Loader2, Send, ExternalLink, ArrowRight, CheckCircle2, Plus, X } from "lucide-react";

const campo = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const rotulo = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

function Num({ id, label, value, onChange, step = "any", sufixo }: { id: string; label: string; value: number; onChange: (v: number) => void; step?: string; sufixo?: string }) {
  return (
    <div>
      <label htmlFor={id} className={rotulo}>{label}{sufixo ? <span className="ml-1 normal-case text-slate-400">({sufixo})</span> : null}</label>
      <input id={id} type="number" inputMode="decimal" step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className={campo} />
    </div>
  );
}

function Txt({ id, label, value, onChange, rows, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className={rotulo}>{label}</label>
      {rows ? (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={campo} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={campo} />
      )}
    </div>
  );
}

function ColunaMaquina({ prefixo, titulo, m, onChange, cor, onRemover }: { prefixo: string; titulo: string; m: MaquinaCalc; onChange: (m: MaquinaCalc) => void; cor: string; onRemover?: () => void }) {
  const set = <K extends keyof MaquinaCalc>(k: K, v: MaquinaCalc[K]) => onChange({ ...m, [k]: v });
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${cor}66`, background: `${cor}0d` }}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-wide" style={{ color: cor }}>{titulo}</div>
        {onRemover && <button onClick={onRemover} className="text-slate-400 hover:text-red-600" title="Remover concorrente"><X size={14} /></button>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><Txt id={`${prefixo}-rotulo`} label="Nome" value={m.rotulo} onChange={(v) => set("rotulo", v)} /></div>
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

export function PropostaClient({ negociacaoId, dadosIniciais, contexto, enviadaEm, whatsapp }: {
  negociacaoId: string; dadosIniciais: DadosProposta; contexto: ContextoProposta; enviadaEm: string | null; whatsapp: boolean;
}) {
  const [d, setD] = useState<DadosProposta>(dadosIniciais);
  const [aba, setAba] = useState<"calc" | "proposta">(d.retorno ? "proposta" : "calc");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviada, setEnviada] = useState<string | null>(enviadaEm);
  const [salvando, startSalvar] = useTransition();
  const [enviando, startEnviar] = useTransition();

  const r = useMemo(() => calcular(d.calc), [d.calc]);
  const setCalc = (patch: Partial<CalcProposta>) => setD((x) => ({ ...x, calc: { ...x.calc, ...patch } }));
  const setCond = (patch: Partial<DadosProposta["condicao"]>) => setD((x) => ({ ...x, condicao: { ...x.condicao, ...patch } }));

  function levarParaProposta() {
    setD((x) => {
      // Mantém calculadora e condição alinhadas (parcela e valor da máquina).
      const parcela = x.calc.nova.parcelaMes || x.condicao.parcelaValor;
      const valor = x.condicao.valor || x.calc.nova.valor;
      const calc = { ...x.calc, nova: { ...x.calc.nova, parcelaMes: parcela, valor } };
      return { ...x, calc, condicao: { ...x.condicao, parcelaValor: parcela, valor }, retorno: textoRetorno(calc, calcular(calc)) };
    });
    setAba("proposta");
  }

  async function salvar(): Promise<boolean> {
    const res = await salvarPropostaAction(negociacaoId, d);
    setMsg(res.ok ? { ok: true, texto: "Proposta salva." } : { ok: false, texto: res.erro ?? "Falha ao salvar." });
    return res.ok;
  }

  function onSalvar() { setMsg(null); startSalvar(async () => { await salvar(); }); }

  function onAbrirPdf() {
    setMsg(null);
    startSalvar(async () => {
      if (await salvar()) window.open(`/api/propostas/${negociacaoId}/pdf`, "_blank");
    });
  }

  function onEnviar() {
    if (!confirm(`Enviar a proposta em PDF pelo WhatsApp para ${contexto.clienteNome}${contexto.clienteTelefone ? ` (${contexto.clienteTelefone})` : ""}?`)) return;
    setMsg(null);
    startEnviar(async () => {
      if (!(await salvar())) return;
      const res = await enviarPropostaWhatsAppAction(negociacaoId);
      if (res.ok) { setEnviada(new Date().toISOString()); setMsg({ ok: true, texto: "Proposta enviada pelo WhatsApp. Ela aparece na conversa do cliente." }); }
      else setMsg({ ok: false, texto: res.erro ?? "Falha ao enviar." });
    });
  }

  const c = d.calc;
  const linhasTabela: { rotulo: string; atual: string; nova: string; conc: string | null }[] = [
    { rotulo: "Custo operacional/mês (diesel + manutenção + paradas)", atual: brl(r.atual.custoMensalOperacional), nova: brl(r.nova.custoMensalOperacional), conc: r.concorrente ? brl(r.concorrente.custoMensalOperacional) : null },
    { rotulo: "Parcela/mês", atual: brl(c.atual.parcelaMes), nova: brl(c.nova.parcelaMes), conc: c.concorrente ? brl(c.concorrente.parcelaMes) : null },
    { rotulo: "Custo total/mês", atual: brl(r.atual.custoMensalTotal), nova: brl(r.nova.custoMensalTotal), conc: r.concorrente ? brl(r.concorrente.custoMensalTotal) : null },
    { rotulo: "Horas efetivas/mês", atual: `${r.atual.horasEfetivas} h`, nova: `${r.nova.horasEfetivas} h`, conc: r.concorrente ? `${r.concorrente.horasEfetivas} h` : null },
    { rotulo: "Custo por hora", atual: brl2(r.atual.custoHora), nova: brl2(r.nova.custoHora), conc: r.concorrente ? brl2(r.concorrente.custoHora) : null },
    { rotulo: `Custo total em ${c.horizonteAnos} anos (TCO, já descontada a revenda)`, atual: brl(r.atual.tcoTotal), nova: brl(r.nova.tcoTotal), conc: r.concorrente ? brl(r.concorrente.tcoTotal) : null },
    { rotulo: "TCO por hora", atual: brl2(r.atual.tcoHora), nova: brl2(r.nova.tcoHora), conc: r.concorrente ? brl2(r.concorrente.tcoHora) : null },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setAba("calc")} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold", aba === "calc" ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}><Calculator size={16} /> 1. Calculadora de custo por hora</button>
        <button onClick={() => setAba("proposta")} className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold", aba === "proposta" ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}><FileText size={16} /> 2. Proposta de uma página</button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {enviada && <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><CheckCircle2 size={13} /> enviada em {new Date(enviada).toLocaleString("pt-BR")}</span>}
          <button onClick={onSalvar} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar</button>
          <button onClick={onAbrirPdf} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60"><ExternalLink size={14} /> Abrir PDF</button>
          <button onClick={onEnviar} disabled={enviando || !whatsapp} title={whatsapp ? "Envia o PDF pelo WhatsApp do cliente" : "WhatsApp não configurado ou cliente sem telefone"} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">{enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar pelo WhatsApp</button>
        </div>
      </div>
      {msg && <div className={cn("rounded-xl border px-3 py-2 text-sm", msg.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700")}>{msg.texto}</div>}

      {aba === "calc" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">Números do cliente</div>
              <p className="mb-3 text-xs text-slate-500">Use os números que ele te deu na visita (horas, diesel, quanto custa um dia parado). Conta com número do cliente convence; com o seu, é argumento de vendedor.</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <Num id="c-horas" label="Horas por mês" value={c.horasMes} onChange={(v) => setCalc({ horasMes: v })} />
                <Num id="c-diesel" label="Diesel" sufixo="R$/L" value={c.dieselLitro} onChange={(v) => setCalc({ dieselLitro: v })} />
                <Num id="c-parada" label="Custo do dia parado" sufixo="R$" value={c.diariaCobertura} onChange={(v) => setCalc({ diariaCobertura: v })} />
                <Num id="c-horizonte" label="Horizonte" sufixo="anos" value={c.horizonteAnos} onChange={(v) => setCalc({ horizonteAnos: v })} />
                <Num id="c-diaria" label="Diária de aluguel (comparar)" sufixo="R$" value={c.diariaAluguel} onChange={(v) => setCalc({ diariaAluguel: v })} />
                <Num id="c-diasalug" label="Dias de aluguel/mês" value={c.diasAluguelMes} onChange={(v) => setCalc({ diasAluguelMes: v })} />
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ColunaMaquina prefixo="atual" titulo="Máquina atual do cliente" m={c.atual} onChange={(m) => setCalc({ atual: m })} cor="#b86a00" />
              <ColunaMaquina prefixo="nova" titulo="Máquina proposta" m={c.nova} onChange={(m) => setCalc({ nova: m })} cor="#2e7d4f" />
              {c.concorrente ? (
                <ColunaMaquina prefixo="conc" titulo="Concorrente" m={c.concorrente} onChange={(m) => setCalc({ concorrente: m })} cor="#b3261e" onRemover={() => setCalc({ concorrente: null })} />
              ) : (
                <button onClick={() => setCalc({ concorrente: { rotulo: "Concorrente", valor: Math.round(c.nova.valor * 0.85), parcelaMes: Math.round(c.nova.parcelaMes * 0.85), consumoLh: c.nova.consumoLh + 1, manutencaoMes: c.nova.manutencaoMes * 1.5, diasParadosMes: 2, revendaPct: 30 } })}
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
                    {linhasTabela.map((l) => (
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
            <button onClick={levarParaProposta} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-agro-400 hover:bg-slate-800">Levar a conta para a proposta <ArrowRight size={16} /></button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="space-y-3">
              <Txt id="p-titulo" label="Título" value={d.titulo} onChange={(v) => setD({ ...d, titulo: v })} />
              <Txt id="p-situacao" label="1. Situação do cliente hoje (nas palavras dele)" rows={3} value={d.situacaoAtual} onChange={(v) => setD({ ...d, situacaoAtual: v })} placeholder="Retro 2011 parando 3 dias por mês, aluguel de R$ 3.300/mês para cobrir, manutenção de R$ 38 mil/ano." />
              <Txt id="p-solucao" label="2. A solução (máquina certa e por quê, 2 linhas)" rows={3} value={d.solucao} onChange={(v) => setD({ ...d, solucao: v })} />
              <div>
                <div className="mb-1 flex items-center justify-between"><label htmlFor="p-retorno" className={rotulo}>3. Retorno em reais</label><button onClick={() => setD((x) => ({ ...x, retorno: textoRetorno(x.calc, calcular(x.calc)) }))} className="text-[11px] font-semibold text-brand-600 hover:underline">Recalcular pela calculadora</button></div>
                <textarea id="p-retorno" rows={6} value={d.retorno} onChange={(e) => setD({ ...d, retorno: e.target.value })} className={campo} />
              </div>
            </Card>
            <Card>
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">4. Condição</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <Num id="k-valor" label="Valor" sufixo="R$" value={d.condicao.valor} onChange={(v) => setCond({ valor: v })} />
                <Num id="k-entrada" label="Entrada" sufixo="R$" value={d.condicao.entradaValor} onChange={(v) => setCond({ entradaValor: v })} />
                <Txt id="k-usada" label="Usada na troca" value={d.condicao.usadaDescricao} onChange={(v) => setCond({ usadaDescricao: v })} placeholder="Retro 2012 avaliada em R$ 95 mil" />
                <Txt id="k-instr" label="Instrumento" value={d.condicao.instrumento} onChange={(v) => setCond({ instrumento: v })} placeholder="Finame, consórcio, CDC…" />
                <Num id="k-parcelas" label="Parcelas" value={d.condicao.parcelas} onChange={(v) => setCond({ parcelas: v })} step="1" />
                <Num id="k-parcela" label="Valor da parcela" sufixo="R$" value={d.condicao.parcelaValor} onChange={(v) => { setCond({ parcelaValor: v }); setCalc({ nova: { ...c.nova, parcelaMes: v } }); }} />
                <Num id="k-carencia" label="Carência" sufixo="dias" value={d.condicao.carenciaDias} onChange={(v) => setCond({ carenciaDias: v })} step="1" />
                <Num id="k-entrega" label="Entrega" sufixo="dias" value={d.condicao.entregaDias} onChange={(v) => setCond({ entregaDias: v })} step="1" />
                <Num id="k-garantia" label="Garantia" sufixo="meses" value={d.condicao.garantiaMeses} onChange={(v) => setCond({ garantiaMeses: v })} step="1" />
                <div className="col-span-2 md:col-span-3"><Txt id="k-inclusos" label="Inclusos" value={d.condicao.inclusos} onChange={(v) => setCond({ inclusos: v })} /></div>
              </div>
            </Card>
            <Card className="space-y-3">
              <Txt id="p-prova" label="5. Quem já fez (caso de cliente parecido, com número)" rows={2} value={d.prova} onChange={(v) => setD({ ...d, prova: v })} placeholder="Construtora X (Cachoeiro) trocou em 2025 e zerou o aluguel: R$ 40 mil/ano." />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div><label htmlFor="p-validade" className={rotulo}>6. Válida até</label><input id="p-validade" type="date" value={d.validade} onChange={(e) => setD({ ...d, validade: e.target.value })} className={campo} /></div>
                <div className="md:col-span-2"><Txt id="p-proximo" label="Próximo passo" value={d.proximoPasso} onChange={(v) => setD({ ...d, proximoPasso: v })} /></div>
              </div>
            </Card>
          </div>

          <Card className="h-fit lg:sticky lg:top-4">
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Prévia</div>
            <div className="rounded-lg bg-slate-900 p-3 text-white">
              <div className="text-sm font-bold">{contexto.nomeEmpresa}</div>
              <div className="text-[10px] uppercase tracking-wide text-agro-400">Proposta comercial · nº {contexto.numero}</div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <div className="font-bold text-slate-900">{d.titulo}</div>
              <div className="text-slate-500">{contexto.clienteNome}{contexto.clienteMunicipio ? ` · ${contexto.clienteMunicipio}` : ""}</div>
              <p><b>1. Situação:</b> {d.situacaoAtual || "—"}</p>
              <p><b>2. Solução:</b> {d.solucao || "—"}</p>
              <p className="whitespace-pre-line"><b>3. Retorno:</b> {d.retorno || "— (use a calculadora)"}</p>
              <p><b>4. Condição:</b> {brl(d.condicao.valor)}{d.condicao.entradaValor ? ` · entrada ${brl(d.condicao.entradaValor)}` : ""}{d.condicao.parcelas ? ` · ${d.condicao.parcelas}x de ${brl(d.condicao.parcelaValor)}` : ""} · entrega {d.condicao.entregaDias} dias · garantia {d.condicao.garantiaMeses} meses</p>
              {d.prova && <p><b>5. Prova:</b> {d.prova}</p>}
              <p><b>Validade:</b> {d.validade ? new Date(`${d.validade}T12:00:00-03:00`).toLocaleDateString("pt-BR") : "—"} · {d.proximoPasso}</p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
