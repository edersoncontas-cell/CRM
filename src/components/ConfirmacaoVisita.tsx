"use client";

// ✓ / ✗ de cada visita. O ✓ confirma que aconteceu (conta na meta); o ✗ abre
// um pop-up perguntando se quer reagendar — com data e hora — ou só marcar
// como não realizada.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarVisitaAction, reagendarVisitaAction } from "@/lib/actions";
import { Check, X, Loader2, CalendarClock, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConfirmacaoVisita({ id, status, dataIso, hora, clienteNome, tamanho = "normal" }: {
  id: string; status: string; dataIso: string; hora: string; clienteNome: string; tamanho?: "normal" | "compacto";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [popup, setPopup] = useState(false);
  const [data, setData] = useState(dataIso);
  const [horario, setHorario] = useState(hora);
  const [erro, setErro] = useState<string | null>(null);

  function marcar(novo: "realizada" | "nao_realizada" | "agendada") {
    startTransition(async () => {
      await marcarVisitaAction(id, novo);
      setPopup(false);
      router.refresh();
    });
  }

  function reagendar() {
    setErro(null);
    startTransition(async () => {
      const r = await reagendarVisitaAction(id, data, horario);
      if (!r.ok) { setErro(r.erro ?? "Falha ao reagendar."); return; }
      setPopup(false);
      router.refresh();
    });
  }

  const alt = tamanho === "compacto" ? "h-7 min-w-[28px] px-1.5 text-[11px]" : "h-8 min-w-[34px] px-2 text-xs";

  if (status === "realizada" || status === "nao_realizada") {
    const ok = status === "realizada";
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold", ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
        {ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />} {ok ? "Realizada" : "Não realizada"}
        <button onClick={() => marcar("agendada")} disabled={pending} title="Desfazer" className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100">
          {pending ? <Loader2 size={11} className="animate-spin" /> : <Undo2 size={11} />}
        </button>
      </span>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1">
        <button onClick={() => marcar("realizada")} disabled={pending} title="Visita realizada (conta na meta)" className={cn("inline-flex items-center justify-center rounded-lg bg-emerald-600 font-black text-white hover:bg-emerald-700 disabled:opacity-60", alt)}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
        </button>
        <button onClick={() => { setData(dataIso); setHorario(hora); setPopup(true); }} disabled={pending} title="Não aconteceu" className={cn("inline-flex items-center justify-center rounded-lg bg-red-600 font-black text-white hover:bg-red-700 disabled:opacity-60", alt)}>
          <X size={14} strokeWidth={3} />
        </button>
      </span>

      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPopup(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center gap-2 text-base font-bold text-slate-800"><CalendarClock size={18} className="text-brand-600" /> Visita não realizada</div>
            <p className="mb-4 text-sm text-slate-600">A visita a <b>{clienteNome}</b> não aconteceu. Quer reagendar?</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Nova data</label>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="campo" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Horário</label>
                <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className="campo" />
              </div>
            </div>
            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            <div className="mt-4 flex flex-col gap-2">
              <button onClick={reagendar} disabled={pending || !data} className="w-full rounded-xl bg-slate-900 py-2 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60">
                {pending ? "Salvando…" : "Confirmar reagendamento"}
              </button>
              <button onClick={() => marcar("nao_realizada")} disabled={pending} className="w-full rounded-xl border border-red-200 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
                Não reagendar, só marcar como não realizada
              </button>
              <button onClick={() => setPopup(false)} className="w-full py-1 text-xs font-semibold text-slate-500 hover:text-slate-800">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
