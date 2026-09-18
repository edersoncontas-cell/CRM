"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { lerEstadoDuplicadosAction, unificarLoteAction, desfazerUnificacaoAction, type EstadoDuplicados } from "@/lib/clientes-duplicados-actions";
import { Users, Loader2, Merge, Undo2, ChevronDown, ChevronUp } from "lucide-react";

function fmtData(d: Date | string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Espaço de configuração de Clientes: cadastros duplicados (mesmo telefone
// ou mesmo nome). Quem veio do Google fica; o resto migra para ele. Cada
// rodada pode ser desfeita, voltando exatamente ao que era.
export function ClientesDuplicadosCard({ inicial }: { inicial: EstadoDuplicados }) {
  const [estado, setEstado] = useState<EstadoDuplicados>(inicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<{ grupos: number; removidos: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mostrarPrevia, setMostrarPrevia] = useState(false);

  const { previa, historico } = estado;

  async function recarregar() {
    setEstado(await lerEstadoDuplicadosAction());
  }

  async function unificarTudo() {
    if (ocupado || previa.totalGrupos === 0) return;
    if (!window.confirm(`Unificar ${previa.totalGrupos} grupo(s) de cadastros duplicados? ${previa.totalSomem} cadastro(s) vão sumir e tudo deles (negociações, frota, visitas, conversas, alertas…) passa para o cadastro que fica. Dá para desfazer depois.`)) return;
    setOcupado("unificar"); setAviso(null);
    let grupos = 0, removidos = 0;
    try {
      for (let i = 0; i < 200; i++) {
        const r = await unificarLoteAction(8);
        grupos += r.unificados; removidos += r.cadastrosRemovidos;
        setProgresso({ grupos, removidos });
        if (r.restantes === 0 || r.unificados === 0) break;
      }
      setAviso(`Pronto: ${grupos} cadastro(s) unificado(s), ${removidos} duplicado(s) removido(s). Os links antigos continuam abrindo o cadastro que ficou.`);
    } catch {
      setAviso(`Parou no meio (${grupos} unificado(s)). Clique de novo para continuar — nada se perde.`);
    } finally {
      setOcupado(null); setProgresso(null);
      await recarregar().catch(() => {});
    }
  }

  async function desfazer(id: string) {
    if (ocupado) return;
    if (!window.confirm("Desfazer esta unificação? Os cadastros removidos voltam com o mesmo id e tudo que foi movido volta para eles.")) return;
    setOcupado(id); setAviso(null);
    try {
      const r = await desfazerUnificacaoAction(id);
      setAviso(r.falhas.length
        ? `${r.restaurados} cadastro(s) restaurado(s); ${r.falhas.length} não deu: ${r.falhas[0]}`
        : `Desfeito: ${r.restaurados} cadastro(s) restaurado(s) como estavam.`);
    } catch {
      setAviso("Não consegui desfazer agora. Tente de novo.");
    } finally {
      setOcupado(null);
      await recarregar().catch(() => {});
    }
  }

  const tag = (google: boolean) => google
    ? <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">Google</span>
    : <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">CRM</span>;

  return (
    <Card className="mt-6">
      <div className="mb-1.5 flex items-center gap-2 font-semibold text-slate-700">
        <Users size={18} className="text-brand-600" /> Cadastros duplicados
      </div>
      <p className="text-xs leading-snug text-slate-500">
        Junta cadastros com o mesmo telefone, e cadastros com o mesmo nome quando um deles não tem telefone. Fica quem tem telefone (de
        preferência o que veio do Google); negociações, frota, visitas, conversas, alertas, tarefas e histórico do outro passam para ele.
        Nada se perde, cada rodada pode ser desfeita.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={unificarTudo} disabled={ocupado !== null || previa.totalGrupos === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50">
          {ocupado === "unificar" ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />}
          {ocupado === "unificar" && progresso ? `Unificando… ${progresso.grupos}` : previa.totalGrupos === 0 ? "Nenhum duplicado" : `Unificar ${previa.totalGrupos} grupo(s)`}
        </button>
        <span className="text-xs text-slate-500">
          {previa.totalGrupos === 0 ? "Nenhum cadastro duplicado por nome ou telefone." : `${previa.totalSomem} cadastro(s) vão sumir e virar um só.`}
        </span>
        {previa.totalGrupos > 0 && (
          <button type="button" onClick={() => setMostrarPrevia((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            {mostrarPrevia ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {mostrarPrevia ? "Esconder" : "Ver quem fica"}
          </button>
        )}
      </div>

      {mostrarPrevia && previa.grupos.length > 0 && (
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-2 text-xs">
          {previa.grupos.map((g) => (
            <li key={g.fica.id} className="rounded-md bg-white px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-800">{g.fica.nome}</span>
                {tag(g.fica.google)}
                <span className="text-slate-400">{g.fica.telefone ?? "sem telefone"}</span>
                <span className="ml-auto rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">fica</span>
              </div>
              {g.somem.map((s) => (
                <div key={s.id} className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-3 text-slate-500">
                  <span className="line-through decoration-slate-300">{s.nome}</span>
                  {tag(s.google)}
                  <span className="text-slate-400">{s.telefone ?? "sem telefone"}</span>
                  <span className="ml-auto text-[10px] text-slate-400">mesmo {g.motivo.replace("+", " e ")}</span>
                </div>
              ))}
            </li>
          ))}
          {previa.totalGrupos > previa.grupos.length && <li className="px-2 text-slate-400">… e mais {previa.totalGrupos - previa.grupos.length} grupo(s).</li>}
        </ul>
      )}

      {aviso && <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{aviso}</div>}

      {historico.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-semibold text-slate-600">Rodadas feitas</div>
          <ul className="mt-1 max-h-56 space-y-0.5 overflow-y-auto text-xs">
            {historico.map((h) => (
              <li key={h.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1">
                <span className="shrink-0 text-slate-400">{fmtData(h.criadoEm)}</span>
                <span className="truncate text-slate-700" title={h.resumo}>{h.resumo}</span>
                {h.desfeitaEm
                  ? <span className="ml-auto shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">desfeita em {fmtData(h.desfeitaEm)}</span>
                  : (
                    <button type="button" onClick={() => desfazer(h.id)} disabled={ocupado !== null}
                      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                      {ocupado === h.id ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />} Desfazer
                    </button>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
