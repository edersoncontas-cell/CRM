"use client";

import { useState, useTransition } from "react";
import { X, Calendar, Bell, Trash2, Repeat } from "lucide-react";
import { CampoCliente } from "@/components/CampoCliente";
import { papelDaColuna } from "@/lib/pipeline";
import { criarNegociacaoCompleta, editarNegociacaoCompleta, excluirNegociacao } from "@/lib/actions";
import { WheelDatePicker, WheelDateTimePicker, WheelMonthPicker } from "@/components/WheelDatePicker";

type Cliente = { id: string; nome: string };
type ColunaOpcao = { id: string; titulo: string; papel?: string | null };
type MaquinaPropria = { marca: string; modelo: string };

// Valores de uma negociação já existente — usados para pré-preencher o
// formulário em modo de edição (mesmo card usado para criar e editar).
export type ValoresNegociacao = {
  marca?: string | null;
  maquinaModelo?: string | null;
  valor?: number | null;
  tipoPagamento?: string | null;
  bancoFinanciamento?: string | null;
  entradaValor?: number | null;
  entradaPercentual?: number | null;
  dataPagamentoAvista?: string | null;
  pagamentoNaEntrega?: boolean;
  consorcioTipo?: string | null;
  consorcioCotas?: number | null;
  consorcioCredito?: number | null;
  crdSaldoParcelasQtd?: number | null;
  dataVisita?: string | null;
  dataFaturamento?: string | null;
  concorrenteMencionado?: string | null;
  proximaAcao?: string | null;
  usadaTroca?: boolean;
  usadaMarca?: string | null;
  usadaModelo?: string | null;
  usadaAno?: number | null;
  usadaHorimetro?: number | null;
  usadaEstado?: string | null;
  usadaValor?: number | null;
  usadaObs?: string | null;
};

const ESTADOS_USADA = [
  { id: "seminova", label: "Seminova" },
  { id: "boa", label: "Boa" },
  { id: "regular", label: "Regular" },
];

const MESES_LABEL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function formatMesAnoLabel(mesAno: string): string {
  const [ano, mes] = mesAno.split("-").map(Number);
  if (!ano || !mes) return mesAno;
  return `${MESES_LABEL[mes - 1]} de ${ano}`;
}

function agruparPorMarca(maquinas: MaquinaPropria[]): Record<string, string[]> {
  const grupos: Record<string, string[]> = {};
  for (const m of maquinas) (grupos[m.marca] ??= []).push(m.modelo);
  return grupos;
}

function formatBRL(v: string): string {
  const n = v.replace(/\D/g, "");
  if (!n) return "";
  return parseInt(n, 10).toLocaleString("pt-BR");
}
function parseNum(s: string): number {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

const BANCOS = ["Banco do Brasil", "CNH Industrial Capital", "Bradesco", "Sicoob", "Sicredi", "Itaú", "Safra", "BV Financeira", "Outro"];
const CONDICAO_OPTS = [
  { value: "pesquisa_preco", label: "Pesquisa de Preço" },
  { value: "interesse_real", label: "Interesse Real" },
  { value: "avista", label: "À Vista" },
  { value: "financiamento", label: "Financiamento Banco" },
  { value: "crd_pme", label: "CRD PME" },
  { value: "consorcio", label: "Consórcio" },
  { value: "outro", label: "Outro" },
];

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";
const botaoDataCls = "flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors";

function formatarDataHora(local: string): string {
  if (!local) return "Selecionar data e hora";
  const [d, t] = local.split("T");
  const [ano, mes, dia] = d.split("-");
  return `${dia}/${mes}/${ano}${t ? ` às ${t}` : ""}`;
}
function formatarData(iso: string): string {
  if (!iso) return "Selecionar data";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Converte um ISO (com hora) vindo do banco para o formato local usado pelos
// pickers ("YYYY-MM-DDTHH:mm" ou "YYYY-MM-DD"), já no fuso de Brasília.
function paraLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  return fmt.format(new Date(iso)).replace(" ", "T");
}
function paraData(iso: string | null | undefined): string {
  if (!iso) return "";
  return paraLocal(iso).slice(0, 10);
}

// Card padronizado de negociação — usado em Negociações (nova ou venda
// antiga), no cadastro do cliente e ao gerar negociação por uma conversa de
// WhatsApp. Único ponto de manutenção para os campos/condições de pagamento.
// Quando a coluna selecionada é a de FATURADO, "Data da Visita" vira "Data de
// Faturamento" — não faz sentido agendar visita pra uma venda já fechada.
// Em modo de edição (negociacaoId presente), o mesmo formulário pré-preenche
// os valores atuais e salva via editarNegociacaoCompleta em vez de criar.
export function FormNovaNegociacao({
  titulo = "Nova Negociação",
  clienteIdFixo,
  clienteNomeFixo,
  clientes,
  colunas,
  estagioInicial,
  maquinasProprias,
  onFechar,
  onSucesso,
  negociacaoId,
  valoresIniciais,
}: {
  titulo?: string;
  clienteIdFixo?: string;
  clienteNomeFixo?: string;
  clientes?: Cliente[];
  colunas: ColunaOpcao[];
  estagioInicial?: string;
  maquinasProprias: MaquinaPropria[];
  onFechar: () => void;
  onSucesso?: () => void;
  negociacaoId?: string;
  valoresIniciais?: ValoresNegociacao;
}) {
  const vi = valoresIniciais;
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [estagio, setEstagio] = useState(estagioInicial ?? colunas[0]?.titulo ?? "");
  const [pagamento, setPagamento] = useState(vi?.tipoPagamento ?? "");
  const [marca, setMarca] = useState(vi?.marca ?? "");
  const [valorStr, setValorStr] = useState(vi?.valor ? formatBRL(String(vi.valor)) : "");
  const [entradaValorStr, setEntradaValorStr] = useState(vi?.entradaValor ? formatBRL(String(vi.entradaValor)) : "");
  const [entradaPercStr, setEntradaPercStr] = useState(vi?.entradaPercentual ? String(vi.entradaPercentual) : "");
  const [pagamentoNaEntrega, setPagamentoNaEntrega] = useState(vi?.pagamentoNaEntrega ?? false);
  const [dataPagamentoAvista, setDataPagamentoAvista] = useState(paraData(vi?.dataPagamentoAvista));
  const [banco, setBanco] = useState(vi?.bancoFinanciamento ?? "");
  const [consorcioTipo, setConsorcioTipo] = useState(vi?.consorcioTipo ?? "");
  const [consorcioCotas, setConsorcioCotas] = useState(vi?.consorcioCotas ? String(vi.consorcioCotas) : "");
  const [consorcioCredito, setConsorcioCredito] = useState(vi?.consorcioCredito ? formatBRL(String(vi.consorcioCredito)) : "");
  const [crdParcelasQtd, setCrdParcelasQtd] = useState(vi?.crdSaldoParcelasQtd ? String(vi.crdSaldoParcelasQtd) : "1");
  const [dataVisita, setDataVisita] = useState(paraLocal(vi?.dataVisita));
  const [dataFaturamento, setDataFaturamento] = useState(paraData(vi?.dataFaturamento));
  const [concorrente, setConcorrente] = useState(vi?.concorrenteMencionado ?? "");
  const [proximaAcao, setProximaAcao] = useState(vi?.proximaAcao ?? "");
  const [interesseFuturoMes, setInteresseFuturoMes] = useState("");
  const [usadaTroca, setUsadaTroca] = useState(vi?.usadaTroca ?? false);
  const [usadaValorStr, setUsadaValorStr] = useState(vi?.usadaValor ? formatBRL(String(Math.round(vi.usadaValor))) : "");
  const [usadaEstado, setUsadaEstado] = useState(vi?.usadaEstado ?? "boa");
  const [pickerAberto, setPickerAberto] = useState<"visita" | "faturamento" | "avista" | "interesse" | null>(null);

  const colunaSel = colunas.find((c) => c.titulo === estagio);
  const isFaturado = colunaSel ? papelDaColuna(colunaSel) === "faturado" : estagio.toLowerCase().includes("faturad");
  const valorNum = parseNum(valorStr);

  function onValorChange(v: string) {
    setValorStr(formatBRL(v));
    const valorNovo = parseNum(formatBRL(v));
    if (entradaPercStr) {
      const novoValor = (valorNovo * parseNum(entradaPercStr)) / 100;
      setEntradaValorStr(novoValor ? novoValor.toFixed(0) : "");
    }
  }
  function onEntradaValorChange(v: string) {
    setEntradaValorStr(formatBRL(v));
    const num = parseNum(formatBRL(v));
    if (valorNum > 0) setEntradaPercStr(num ? ((num / valorNum) * 100).toFixed(1) : "");
  }
  function onEntradaPercChange(v: string) {
    setEntradaPercStr(v);
    const pct = parseFloat(v.replace(",", ".")) || 0;
    if (valorNum > 0) setEntradaValorStr(pct ? Math.round((valorNum * pct) / 100).toLocaleString("pt-BR") : "");
  }

  const crdSaldoRestante = Math.max(0, valorNum - parseNum(entradaValorStr));
  const crdParcelaValorCalc = crdParcelasQtd ? crdSaldoRestante / Number(crdParcelasQtd) : 0;

  const MARCAS = agruparPorMarca(maquinasProprias);
  const maquinasDisp = MARCAS[marca] ?? [];

  function submeter(fd: FormData) {
    if (clienteIdFixo) fd.set("clienteId", clienteIdFixo);
    fd.set("estagio", estagio);
    fd.set("valor", String(valorNum || ""));
    fd.set("tipoPagamento", pagamento);
    if (pagamento === "avista") {
      if (dataPagamentoAvista) fd.set("dataPagamentoAvista", dataPagamentoAvista);
      fd.set("pagamentoNaEntrega", pagamentoNaEntrega ? "true" : "false");
    }
    if (pagamento === "financiamento") {
      if (banco) fd.set("bancoFinanciamento", banco);
      if (entradaValorStr) fd.set("entradaValor", String(parseNum(entradaValorStr)));
    }
    if (pagamento === "consorcio") {
      if (consorcioTipo) fd.set("consorcioTipo", consorcioTipo);
      if (consorcioCotas) fd.set("consorcioCotas", consorcioCotas);
      if (consorcioCredito) fd.set("consorcioCredito", String(parseNum(consorcioCredito)));
    }
    if (pagamento === "crd_pme") {
      if (entradaValorStr) fd.set("entradaValor", String(parseNum(entradaValorStr)));
      if (entradaPercStr) fd.set("entradaPercentual", entradaPercStr);
      fd.set("crdSaldoParcelasQtd", crdParcelasQtd);
      fd.set("crdParcelaValor", crdParcelaValorCalc.toFixed(2));
    }
    if (isFaturado) {
      if (dataFaturamento) fd.set("dataFaturamento", dataFaturamento);
    } else if (dataVisita) {
      fd.set("dataVisita", dataVisita);
    }
    if (concorrente) fd.set("concorrenteMencionado", concorrente);
    if (proximaAcao) fd.set("proximaAcao", proximaAcao);
    if (interesseFuturoMes) fd.set("interesseFuturoMes", interesseFuturoMes);
    fd.set("usadaTroca", usadaTroca ? "true" : "false");
    if (usadaTroca) {
      fd.set("usadaValor", String(parseNum(usadaValorStr) || ""));
      fd.set("usadaEstado", usadaEstado);
    }

    startTransition(async () => {
      const r = negociacaoId ? await editarNegociacaoCompleta(negociacaoId, fd) : await criarNegociacaoCompleta(fd);
      if (r && typeof r === "object" && "ok" in r && !r.ok) {
        setErro((r as { erro?: string }).erro ?? "Erro ao salvar negociação.");
        return;
      }
      onSucesso?.();
      onFechar();
    });
  }

  function excluir() {
    if (!negociacaoId) return;
    if (!confirm(`Excluir negociação de ${clienteNomeFixo ?? "este cliente"}?`)) return;
    startTransition(async () => {
      await excluirNegociacao(negociacaoId);
      onSucesso?.();
      onFechar();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">{titulo}</h3>
            {clienteNomeFixo && <p className="text-xs text-slate-400 mt-0.5">{clienteNomeFixo}</p>}
          </div>
          <button onClick={onFechar} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>
        <form
          action={(fd) => submeter(fd)}
          className="p-5 space-y-4 overflow-y-auto flex-1"
        >
          <div>
            <label className={labelCls}>Coluna</label>
            <select value={estagio} onChange={(e) => setEstagio(e.target.value)} className={inputCls}>
              {colunas.map((c) => <option key={c.id} value={c.titulo}>{c.titulo}</option>)}
            </select>
          </div>

          {!clienteIdFixo && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Cliente</label>
                <CampoCliente clientes={clientes ?? []} name="clienteId" className={inputCls} placeholder="Buscar pelo nome" />
              </div>
              <div>
                <label className={labelCls}>Novo cliente</label>
                <input name="nomeNovo" placeholder="ou digitar nome" className={inputCls} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Marca</label>
              <select value={marca} onChange={(e) => setMarca(e.target.value)} name="marca" className={inputCls}>
                <option value="">— Selecionar —</option>
                {Object.keys(MARCAS).map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Máquina</label>
              {maquinasDisp.length > 0 ? (
                <select name="maquinaModelo" defaultValue={vi?.maquinaModelo ?? ""} className={inputCls}>
                  <option value="">Selecione</option>
                  {maquinasDisp.map((m) => <option key={m} value={m}>{m}</option>)}
                  {vi?.maquinaModelo && !maquinasDisp.includes(vi.maquinaModelo) && (
                    <option value={vi.maquinaModelo}>{vi.maquinaModelo}</option>
                  )}
                </select>
              ) : (
                <input name="maquinaModelo" defaultValue={vi?.maquinaModelo ?? ""} placeholder="Ex: E215C" className={inputCls} />
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Valor (R$)</label>
            <input value={valorStr} onChange={(e) => onValorChange(e.target.value)} placeholder="0" inputMode="numeric" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Condição de Pagamento</label>
            <select value={pagamento} onChange={(e) => setPagamento(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {CONDICAO_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {pagamento === "avista" && (
            <div className="rounded-xl p-3 space-y-3 bg-sky-50 border border-sky-200">
              <p className="text-xs font-bold uppercase text-sky-700">À Vista</p>
              <div>
                <label className={labelCls}>Data do pagamento</label>
                <button type="button" disabled={pagamentoNaEntrega} onClick={() => setPickerAberto("avista")} className={botaoDataCls}>
                  <Calendar size={14} className="text-slate-400" /> {formatarData(dataPagamentoAvista)}
                </button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                <input type="checkbox" checked={pagamentoNaEntrega} onChange={(e) => setPagamentoNaEntrega(e.target.checked)} />
                Pagamento na entrega
              </label>
            </div>
          )}

          {pagamento === "financiamento" && (
            <div className="rounded-xl p-3 space-y-3 bg-violet-50 border border-violet-200">
              <p className="text-xs font-bold uppercase text-violet-700">Financiamento</p>
              <div>
                <label className={labelCls}>Banco</label>
                <select value={banco} onChange={(e) => setBanco(e.target.value)} className={inputCls}>
                  <option value="">— Selecionar banco —</option>
                  {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Entrada (R$)</label>
                <input value={entradaValorStr} onChange={(e) => onEntradaValorChange(e.target.value)} placeholder="0" inputMode="numeric" className={inputCls} />
              </div>
            </div>
          )}

          {pagamento === "consorcio" && (
            <div className="rounded-xl p-3 space-y-3 bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold uppercase text-amber-700">Consórcio</p>
              <div>
                <label className={labelCls}>Tipo de Consórcio</label>
                <select value={consorcioTipo} onChange={(e) => setConsorcioTipo(e.target.value)} className={inputCls}>
                  <option value="">— Selecionar —</option>
                  <option value="new_holland">New Holland</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nº de Cotas</label>
                  <input value={consorcioCotas} onChange={(e) => setConsorcioCotas(e.target.value.replace(/\D/g, ""))} placeholder="1" inputMode="numeric" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Crédito (R$)</label>
                  <input value={consorcioCredito} onChange={(e) => setConsorcioCredito(formatBRL(e.target.value))} placeholder="0" inputMode="numeric" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {pagamento === "crd_pme" && (
            <div className="rounded-xl p-3 space-y-3 bg-emerald-50 border border-emerald-200">
              <p className="text-xs font-bold uppercase text-emerald-700">CRD PME</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Entrada (R$)</label>
                  <input value={entradaValorStr} onChange={(e) => onEntradaValorChange(e.target.value)} placeholder="0" inputMode="numeric" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Entrada (%)</label>
                  <input value={entradaPercStr} onChange={(e) => onEntradaPercChange(e.target.value)} placeholder="0" inputMode="decimal" className={inputCls} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2">
                <span className="text-xs font-semibold text-emerald-700">Saldo Restante</span>
                <span className="text-sm font-bold text-emerald-800">{crdSaldoRestante.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
              <div>
                <label className={labelCls}>Parcelas (30 em 30 dias)</label>
                <select value={crdParcelasQtd} onChange={(e) => setCrdParcelasQtd(e.target.value)} className={inputCls}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}x de {(crdSaldoRestante / n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{isFaturado ? "Data de Faturamento" : "Data da Visita"}</label>
              <button type="button" onClick={() => setPickerAberto(isFaturado ? "faturamento" : "visita")} className={botaoDataCls}>
                <Calendar size={14} className="text-slate-400" />
                {isFaturado ? formatarData(dataFaturamento) : formatarDataHora(dataVisita)}
              </button>
            </div>
            <div>
              <label className={labelCls}>Concorrente</label>
              <input value={concorrente} onChange={(e) => setConcorrente(e.target.value)} placeholder="Ex: CAT, Komatsu..." className={inputCls} />
            </div>
          </div>

          {/* Usada na troca: entra como parte da entrada; ao faturar vai para o estoque */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-amber-900">
              <input type="checkbox" checked={usadaTroca} onChange={(e) => setUsadaTroca(e.target.checked)} className="h-4 w-4 accent-amber-600" />
              <Repeat size={14} /> Tem usada na troca
            </label>
            {usadaTroca && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Marca da usada</label>
                    <input name="usadaMarca" defaultValue={vi?.usadaMarca ?? ""} placeholder="Ex: Caterpillar" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Modelo da usada</label>
                    <input name="usadaModelo" defaultValue={vi?.usadaModelo ?? ""} placeholder="Ex: 416E" className={inputCls} required />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Ano</label>
                    <input name="usadaAno" defaultValue={vi?.usadaAno ?? ""} inputMode="numeric" placeholder="2016" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Horímetro</label>
                    <input name="usadaHorimetro" defaultValue={vi?.usadaHorimetro ?? ""} inputMode="numeric" placeholder="8500" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Estado</label>
                    <select value={usadaEstado} onChange={(e) => setUsadaEstado(e.target.value)} className={inputCls}>
                      {ESTADOS_USADA.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Valor avaliado da usada (R$) — vale como entrada</label>
                  <input value={usadaValorStr} onChange={(e) => setUsadaValorStr(formatBRL(e.target.value))} inputMode="numeric" placeholder="0" className={inputCls} />
                  {valorNum > 0 && parseNum(usadaValorStr) > 0 && (
                    <p className="mt-1 text-[11px] text-amber-800">
                      Saldo a financiar após a usada: {(valorNum - parseNum(usadaValorStr)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      {" "}({Math.round((parseNum(usadaValorStr) / valorNum) * 100)}% de entrada)
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Checklist / observações da usada</label>
                  <input name="usadaObs" defaultValue={vi?.usadaObs ?? ""} placeholder="Pneus 60%, vazamento no cilindro, cabine ok…" className={inputCls} />
                </div>
                <p className="text-[11px] text-amber-800/80">Ao faturar, a usada entra sozinha no estoque de Máquinas Usadas com estes dados.</p>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Próxima Ação</label>
            <input value={proximaAcao} onChange={(e) => setProximaAcao(e.target.value)} placeholder="Ex: Ligar terça para follow-up" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Interesse futuro — retomar em</label>
            <button type="button" onClick={() => setPickerAberto("interesse")} className={botaoDataCls}>
              <Bell size={14} className="text-slate-400" />
              {interesseFuturoMes ? formatMesAnoLabel(interesseFuturoMes) : "Definir mês/ano para entrar em contato de novo"}
            </button>
          </div>

          {erro && <p className="text-xs font-semibold text-red-600">{erro}</p>}

          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={onFechar} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button disabled={isPending} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 transition-colors disabled:opacity-50">
              {isPending ? "Salvando..." : negociacaoId ? "Salvar Alterações" : "Criar Negociação"}
            </button>
          </div>

          {negociacaoId && (
            <button
              type="button"
              onClick={excluir}
              disabled={isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <Trash2 size={13} /> Excluir negociação
            </button>
          )}
        </form>
      </div>

      {pickerAberto === "interesse" && (
        <WheelMonthPicker
          title="Interesse futuro — retomar em"
          valueMes={interesseFuturoMes}
          onClose={() => setPickerAberto(null)}
          onConfirm={(mesAno) => { setInteresseFuturoMes(mesAno); setPickerAberto(null); }}
        />
      )}
      {pickerAberto === "visita" && (
        <WheelDateTimePicker
          title="Data da Visita"
          valueLocal={dataVisita}
          onClose={() => setPickerAberto(null)}
          onConfirm={(v) => { setDataVisita(v); setPickerAberto(null); }}
        />
      )}
      {pickerAberto === "faturamento" && (
        <WheelDatePicker
          title="Data de Faturamento"
          valueISO={dataFaturamento}
          onClose={() => setPickerAberto(null)}
          onConfirm={(v) => { setDataFaturamento(v); setPickerAberto(null); }}
        />
      )}
      {pickerAberto === "avista" && (
        <WheelDatePicker
          title="Data do pagamento"
          valueISO={dataPagamentoAvista}
          onClose={() => setPickerAberto(null)}
          onConfirm={(v) => { setDataPagamentoAvista(v); setPickerAberto(null); }}
        />
      )}
    </div>
  );
}
