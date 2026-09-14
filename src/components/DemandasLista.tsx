"use client";

// Demandas: lista única, por prazo. Concluir com um toque, criar em segundos,
// tudo com cliente, cidade e prioridade. Alimentada também pelo Orientador,
// pela cadência, pelo pós-venda e pelo Cérebro (coluna "origem").

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarDemandaAction, editarDemandaAction, alternarDemandaAction, excluirTarefa } from "@/lib/actions";
import type { DemandaDTO, GrupoDemandas } from "@/lib/demandas";
import { ROTULO_ORIGEM } from "@/lib/demandas";
import { cn } from "@/lib/utils";
import { Plus, Check, Circle, CheckCircle2, MapPin, User, CalendarClock, Trash2, Pencil, X, Loader2, AlertTriangle, Flag, ListChecks } from "lucide-react";

type Cliente = { id: string; nome: string };

const COR_PRIORIDADE: Record<string, string> = { alta: "text-red-600 bg-red-50 ring-red-200", normal: "text-slate-600 bg-slate-50 ring-slate-200", baixa: "text-sky-700 bg-sky-50 ring-sky-200" };
const ROTULO_PRIORIDADE: Record<string, string> = { alta: "Alta", normal: "Normal", baixa: "Baixa" };

function quando(iso: string | null): string {
  if (!iso) return "sem prazo";
  const d = new Date(iso);
  const temHora = d.getUTCHours() !== 3 || d.getUTCMinutes() !== 0; // 00:00 Brasília = 03:00 UTC
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", ...(temHora ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  return fmt.format(new Date(iso)).replace(" ", "T");
}

function deInputLocal(v: string): string | undefined {
  if (!v) return undefined;
  return new Date(`${v}:00-03:00`).toISOString();
}

type Form = { id?: string; titulo: string; descricao: string; clienteId: string; cidade: string; dueDate: string; prioridade: string; checklist: string };
const FORM_VAZIO: Form = { titulo: "", descricao: "", clienteId: "", cidade: "", dueDate: "", prioridade: "normal", checklist: "" };

export function DemandasLista({ grupos, clientes, abertas, atrasadas, hoje }: { grupos: GrupoDemandas[]; clientes: Cliente[]; abertas: number; atrasadas: number; hoje: number }) {
  const router = useRouter();
  const [form, setForm] = useState<Form | null>(null);
  const [rapida, setRapida] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const [, startTransition] = useTransition();

  const clientePorId = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);

  async function alternar(item: DemandaDTO) {
    setOcupado(item.id);
    await alternarDemandaAction(item.id, !item.concluida);
    setOcupado(null);
    startTransition(() => router.refresh());
  }

  async function excluir(item: DemandaDTO) {
    if (!window.confirm(`Excluir "${item.titulo}"?`)) return;
    setOcupado(item.id);
    await excluirTarefa(item.id);
    setOcupado(null);
    startTransition(() => router.refresh());
  }

  function criarRapida() {
    const t = rapida.trim();
    if (!t) return;
    setErro(null);
    startSalvar(async () => {
      const hojeISO = new Date().toISOString();
      const r = await criarDemandaAction({ titulo: t, dueDate: hojeISO, prioridade: "normal" });
      if (!r.ok) { setErro(r.erro ?? "Erro"); return; }
      setRapida("");
      router.refresh();
    });
  }

  function salvarForm() {
    if (!form) return;
    setErro(null);
    startSalvar(async () => {
      const dados = { titulo: form.titulo, descricao: form.descricao, clienteId: form.clienteId || null, cidade: form.cidade, dueDate: deInputLocal(form.dueDate), prioridade: form.prioridade, checklist: form.checklist };
      const r = form.id ? await editarDemandaAction(form.id, dados) : await criarDemandaAction(dados);
      if (!r.ok) { setErro(r.erro ?? "Erro"); return; }
      setForm(null);
      router.refresh();
    });
  }

  function editar(item: DemandaDTO) {
    setForm({
      id: item.id, titulo: item.titulo, descricao: item.descricao ?? "", clienteId: item.clienteId ?? "", cidade: item.cidade ?? "",
      dueDate: paraInputLocal(item.dueDate), prioridade: item.prioridade, checklist: item.checklist.map((c) => c.t).join("\n"),
    });
  }

  const visiveis = grupos.filter((g) => g.id !== "concluidas" || mostrarConcluidas).filter((g) => g.itens.length > 0);

  return (
    <div className="space-y-5">
      {/* Resumo + criação rápida */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr]">
        <div className="grid grid-cols-3 gap-2">
          {[
            { rotulo: "Abertas", valor: abertas, cor: "text-slate-800" },
            { rotulo: "Atrasadas", valor: atrasadas, cor: atrasadas ? "text-red-600" : "text-slate-800" },
            { rotulo: "Para hoje", valor: hoje, cor: hoje ? "text-agro-700" : "text-slate-800" },
          ].map((k) => (
            <div key={k.rotulo} className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
              <div className={cn("text-2xl font-black", k.cor)}>{k.valor}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k.rotulo}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          <input
            value={rapida}
            onChange={(e) => setRapida(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") criarRapida(); }}
            placeholder="Anotar demanda rápida para hoje (Enter salva) — ex.: Pegar a bomba d'água do Cesar Gotti"
            className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-2 py-2 text-sm outline-none"
            style={{ paddingLeft: 8, paddingRight: 8 }}
          />
          <button onClick={criarRapida} disabled={salvando || !rapida.trim()} className="inline-flex h-10 items-center gap-1 rounded-xl bg-slate-900 px-3 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Hoje
          </button>
          <button onClick={() => setForm({ ...FORM_VAZIO, titulo: rapida.trim() })} className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
            <Pencil size={14} /> Completa
          </button>
        </div>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {abertas === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nenhuma demanda aberta. Anote a próxima acima, ou deixe o CRM criar sozinho: ligações e visitas da cadência, marcos de pós-venda e próximas ações do Orientador entram aqui.
        </div>
      )}

      {visiveis.map((g) => (
        <section key={g.id}>
          <div className="mb-2 flex items-center gap-2">
            {g.id === "atrasadas" ? <AlertTriangle size={15} className="text-red-500" /> : g.id === "hoje" ? <Flag size={15} className="text-agro-600" /> : g.id === "concluidas" ? <CheckCircle2 size={15} className="text-emerald-500" /> : <CalendarClock size={15} className="text-slate-400" />}
            <h2 className={cn("text-sm font-black uppercase tracking-wide", g.id === "atrasadas" ? "text-red-600" : "text-slate-700")}>{g.titulo}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{g.itens.length}</span>
          </div>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {g.itens.map((item) => (
              <div key={item.id} className={cn("flex items-start gap-3 px-3 py-2.5", item.concluida && "opacity-60")}>
                <button onClick={() => alternar(item)} disabled={ocupado === item.id} title={item.concluida ? "Reabrir" : "Concluir"} className={cn("mt-0.5 shrink-0 rounded-full transition", item.concluida ? "text-emerald-500" : "text-slate-300 hover:text-emerald-500")} style={{ minHeight: 28, minWidth: 28 }}>
                  {ocupado === item.id ? <Loader2 size={20} className="animate-spin" /> : item.concluida ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cn("text-sm font-semibold text-slate-800", item.concluida && "line-through")}>{item.titulo}</span>
                    {item.prioridade !== "normal" && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1", COR_PRIORIDADE[item.prioridade])}>{ROTULO_PRIORIDADE[item.prioridade]}</span>}
                    {item.origem !== "manual" && <span className="rounded-full bg-agro-400/15 px-1.5 py-0.5 text-[10px] font-bold text-agro-700">{ROTULO_ORIGEM[item.origem] ?? item.origem}</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                    <span className={cn("inline-flex items-center gap-1", g.id === "atrasadas" && "font-bold text-red-600")}><CalendarClock size={11} /> {quando(item.dueDate)}</span>
                    {item.clienteId && <Link href={`/clientes/${item.clienteId}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><User size={11} /> {item.clienteNome ?? clientePorId.get(item.clienteId) ?? "cliente"}</Link>}
                    {item.cidade && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {item.cidade}</span>}
                    {item.checklist.length > 0 && <span className="inline-flex items-center gap-1"><ListChecks size={11} /> {item.checklist.filter((c) => c.d).length}/{item.checklist.length}</span>}
                  </div>
                  {item.descricao && <p className="mt-1 text-xs text-slate-600">{item.descricao}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => editar(item)} title="Editar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" style={{ minHeight: 28, minWidth: 28 }}><Pencil size={14} /></button>
                  <button onClick={() => excluir(item)} title="Excluir" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" style={{ minHeight: 28, minWidth: 28 }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <button onClick={() => setMostrarConcluidas((v) => !v)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
        {mostrarConcluidas ? "Ocultar concluídas" : `Mostrar concluídas (${grupos.find((g) => g.id === "concluidas")?.itens.length ?? 0} nos últimos 7 dias)`}
      </button>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">{form.id ? "Editar demanda" : "Nova demanda"}</h3>
              <button onClick={() => setForm(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="O que precisa ser feito" className="campo" autoFocus />
              <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} placeholder="Detalhes (opcional)" className="campo" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Prazo</label>
                  <input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="campo" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Prioridade</label>
                  <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })} className="campo">
                    <option value="alta">Alta</option><option value="normal">Normal</option><option value="baixa">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Cliente</label>
                  <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="campo">
                    <option value="">— nenhum —</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Cidade</label>
                  <input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex.: Cachoeiro" className="campo" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Checklist (um item por linha)</label>
                <textarea value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} rows={3} className="campo" placeholder={"Levar proposta\nConferir horímetro"} />
              </div>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <div className="flex gap-2">
                <button onClick={() => setForm(null)} className="flex-1 rounded-xl border border-slate-300 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button onClick={salvarForm} disabled={salvando} className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">{salvando ? "Salvando…" : <span className="inline-flex items-center gap-1"><Check size={14} /> Salvar</span>}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
