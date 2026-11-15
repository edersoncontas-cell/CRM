"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Target, Sparkles, Trophy } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import {
  INDICADORES, PERIODOS_META, ROTULO_INDICADOR, ROTULO_PERIODO, mesInicialSugerido, rotuloDoIntervalo, valorDoIndicador,
  type Indicador, type PeriodoMeta,
} from "@/lib/metas-regra";
import { salvarMetaAction, excluirMetaAction, usarMetasDeExemploAction } from "@/lib/metas-actions";
import type { MetaComProgresso } from "@/lib/metas-cadastro";

const campo = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 sm:text-sm";
const rotulo = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const botaoPrincipal = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-agro-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60";
const botaoSecundario = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60";

type FormState = {
  id?: string; periodo: PeriodoMeta; mes: string; indicador: Indicador;
  meta: string; supermeta: string; recompensa: string; valorRecompensa: string;
};

function formVazio(agora: Date): FormState {
  return { periodo: "mensal", mes: mesInicialSugerido("mensal", agora), indicador: "maquinas_faturadas", meta: "", supermeta: "", recompensa: "", valorRecompensa: "" };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function MetasClient({ metas, agoraIso }: { metas: MetaComProgresso[]; agoraIso: string }) {
  const router = useRouter();
  const agora = new Date(agoraIso);
  const [form, setForm] = useState<FormState | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [ocupado, start] = useTransition();

  function abrirNova() { setErro(null); setAviso(null); setForm(formVazio(agora)); }
  function abrirEdicao(m: MetaComProgresso) {
    setErro(null); setAviso(null);
    const ini = new Date(m.inicio);
    // Mês de início em horário de Brasília (UTC−3): 00:00 BRT = 03:00 UTC do dia 1.
    const brt = new Date(ini.getTime() - 3 * 60 * 60 * 1000);
    setForm({
      id: m.id, periodo: m.periodo as PeriodoMeta, mes: `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, "0")}`,
      indicador: m.indicador, meta: String(m.meta), supermeta: m.supermeta != null ? String(m.supermeta) : "",
      recompensa: m.recompensa?.descricao ?? "", valorRecompensa: m.recompensa?.valorReais != null ? String(m.recompensa.valorReais) : "",
    });
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro(null);
    start(async () => {
      const r = await salvarMetaAction({ ...form }, form.id);
      if (!r.ok) { setErro(r.erro ?? "Não salvou."); return; }
      setForm(null);
      setAviso(form.id ? "Meta alterada." : "Meta criada.");
      router.refresh();
    });
  }

  function apagar(id: string) {
    setErro(null);
    start(async () => {
      const r = await excluirMetaAction(id);
      setApagando(null);
      if (!r.ok) { setErro(r.erro ?? "Não apagou."); return; }
      setAviso("Meta apagada.");
      router.refresh();
    });
  }

  function exemplos() {
    setErro(null);
    start(async () => {
      const r = await usarMetasDeExemploAction();
      if (!r.ok) { setErro(r.erro ?? "Não criou."); return; }
      setAviso(`${r.criadas} metas de exemplo criadas. Ajuste os números para a sua realidade.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {erro && !form && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {aviso && !form && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{aviso}</p>}

      {!form && metas.length > 0 && (
        <div className="flex justify-end">
          <button type="button" onClick={abrirNova} className={botaoPrincipal}><Plus size={16} /> Nova meta</button>
        </div>
      )}

      {form && (
        <Card>
          <form onSubmit={salvar} className="space-y-3">
            <h2 className="flex items-center gap-2 font-bold"><Target size={18} /> {form.id ? "Editar meta" : "Nova meta"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={rotulo} htmlFor="m-ind">O que mede</label>
                <select id="m-ind" className={campo} value={form.indicador} onChange={(e) => setForm({ ...form, indicador: e.target.value as Indicador })}>
                  {INDICADORES.map((i) => <option key={i} value={i}>{ROTULO_INDICADOR[i]}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo} htmlFor="m-per">Período</label>
                <select
                  id="m-per" className={campo} value={form.periodo}
                  onChange={(e) => { const p = e.target.value as PeriodoMeta; setForm({ ...form, periodo: p, mes: form.id ? form.mes : mesInicialSugerido(p, agora) }); }}
                >
                  {PERIODOS_META.map((p) => <option key={p} value={p}>{ROTULO_PERIODO[p]}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo} htmlFor="m-mes">Começa em</label>
                <input id="m-mes" type="month" className={campo} value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} required />
              </div>
              <div>
                <label className={rotulo} htmlFor="m-meta">Meta {form.indicador === "faturamento" ? "(R$)" : ""}</label>
                <input id="m-meta" inputMode="decimal" className={campo} value={form.meta} onChange={(e) => setForm({ ...form, meta: e.target.value })} required />
              </div>
              <div>
                <label className={rotulo} htmlFor="m-super">Supermeta (opcional)</label>
                <input id="m-super" inputMode="decimal" className={campo} value={form.supermeta} onChange={(e) => setForm({ ...form, supermeta: e.target.value })} />
              </div>
              <div>
                <label className={rotulo} htmlFor="m-rec">Recompensa (opcional)</label>
                <input id="m-rec" className={campo} maxLength={120} value={form.recompensa} onChange={(e) => setForm({ ...form, recompensa: e.target.value })} placeholder="Ex.: jantar com a família" />
              </div>
              {form.recompensa.trim() && (
                <div>
                  <label className={rotulo} htmlFor="m-valrec">Valor da recompensa em R$ (opcional)</label>
                  <input id="m-valrec" inputMode="decimal" className={campo} value={form.valorRecompensa} onChange={(e) => setForm({ ...form, valorRecompensa: e.target.value })} />
                </div>
              )}
            </div>
            {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={ocupado} className={botaoPrincipal}>
                {ocupado && <Loader2 size={15} className="animate-spin" />} Salvar meta
              </button>
              <button type="button" disabled={ocupado} onClick={() => { setForm(null); setErro(null); }} className={botaoSecundario}>Cancelar</button>
            </div>
          </form>
        </Card>
      )}

      {metas.length === 0 && !form && (
        <EmptyState
          icone={<Target size={32} />}
          texto="Defina sua primeira meta"
          subtexto="Escolha o que medir e em quanto tempo, ou comece pelas metas de exemplo a partir da sua meta anual."
          acao={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={abrirNova} className={botaoPrincipal}><Plus size={16} /> Criar minha primeira meta</button>
              <button type="button" onClick={exemplos} disabled={ocupado} className={botaoSecundario}>
                {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Usar metas de exemplo
              </button>
            </div>
          }
        />
      )}

      <ul className="space-y-3">
        {metas.map((m) => (
          <li key={m.id}><CartaoMeta m={m} apagando={apagando === m.id} ocupado={ocupado}
            onEditar={() => abrirEdicao(m)} onPedirApagar={() => setApagando(m.id)} onCancelarApagar={() => setApagando(null)} onApagar={() => apagar(m.id)} /></li>
        ))}
      </ul>
    </div>
  );
}

function CartaoMeta({ m, apagando, ocupado, onEditar, onPedirApagar, onCancelarApagar, onApagar }: {
  m: MetaComProgresso; apagando: boolean; ocupado: boolean;
  onEditar: () => void; onPedirApagar: () => void; onCancelarApagar: () => void; onApagar: () => void;
}) {
  const p = m.progresso;
  const v = (n: number) => valorDoIndicador(m.indicador, n);
  const topo = m.supermeta ?? m.meta;
  const larguraBarra = Math.min(100, (p.atual / topo) * 100);
  const marcaMeta = m.supermeta ? (m.meta / m.supermeta) * 100 : null;
  const periodo = rotuloDoIntervalo(new Date(m.inicio), new Date(m.fim));

  const faseTexto = p.fase === "futura" ? "Ainda não começou"
    : p.fase === "encerrada" ? (p.bateu ? "Encerrada — meta batida" : "Encerrada — meta não batida")
    : `${p.diasRestantes} dia${p.diasRestantes === 1 ? "" : "s"} restante${p.diasRestantes === 1 ? "" : "s"}`;
  const ritmoTexto = p.ritmo === "adiantado" ? { t: "Adiantado", c: "bg-emerald-100 text-emerald-800" }
    : p.ritmo === "atrasado" ? { t: "Atrasado", c: "bg-red-100 text-red-700" }
    : p.ritmo === "no_ritmo" ? { t: "No ritmo", c: "bg-sky-100 text-sky-800" } : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold">{ROTULO_INDICADOR[m.indicador]} · {ROTULO_PERIODO[m.periodo as PeriodoMeta] ?? m.periodo}</h3>
          <p className="text-xs text-slate-500">{periodo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {m.exemplo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Exemplo — ajuste os números</span>}
          {ritmoTexto && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ritmoTexto.c}`}>{ritmoTexto.t}</span>}
          {p.bateuSupermeta ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800"><Trophy size={11} /> Supermeta batida</span>
            : p.bateu ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Meta batida</span> : null}
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
          <span><strong className="text-lg">{v(p.atual)}</strong> de {v(m.meta)} <span className="text-slate-500">({pct(p.pct)})</span></span>
          <span className="text-xs text-slate-500">{faseTexto}</span>
        </div>
        <div
          className="relative h-3 overflow-hidden rounded-full bg-slate-200"
          role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, p.pct * 100))}
          aria-label={`${ROTULO_INDICADOR[m.indicador]}: ${pct(p.pct)} da meta`}
        >
          <div className={`h-full rounded-full ${p.bateu ? "bg-emerald-500" : "bg-agro-400"}`} style={{ width: `${larguraBarra}%` }} />
          {marcaMeta != null && <div className="absolute inset-y-0 w-0.5 bg-slate-700" style={{ left: `${marcaMeta}%` }} title="Meta" />}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-slate-500">Falta para a meta</dt><dd className="font-semibold">{p.bateu ? "Batida" : v(p.falta)}</dd></div>
        {m.supermeta != null && <div><dt className="text-xs text-slate-500">Supermeta ({v(m.supermeta)})</dt><dd className="font-semibold">{p.bateuSupermeta ? "Batida" : `faltam ${v(p.faltaSupermeta ?? 0)}`}</dd></div>}
        {p.porSemanaNecessario != null && <div><dt className="text-xs text-slate-500">Ritmo necessário</dt><dd className="font-semibold">{v(Math.round(p.porSemanaNecessario * 10) / 10)} por semana</dd></div>}
        {m.recompensa && <div><dt className="text-xs text-slate-500">Recompensa</dt><dd className="font-semibold">{m.recompensa.descricao}</dd></div>}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {apagando ? (
          <>
            <span className="text-sm text-red-700">Apagar esta meta?</span>
            <button type="button" onClick={onApagar} disabled={ocupado} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">Sim, apagar</button>
            <button type="button" onClick={onCancelarApagar} disabled={ocupado} className={botaoSecundario}>Não</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEditar} className={botaoSecundario}><Pencil size={14} /> Editar</button>
            <button type="button" onClick={onPedirApagar} className={botaoSecundario}><Trash2 size={14} /> Apagar</button>
          </>
        )}
      </div>
    </Card>
  );
}
