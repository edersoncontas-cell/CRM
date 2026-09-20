import { MapPin, Check, X, CalendarClock } from "lucide-react";
import { resumoDeVisitas, textoDiasDesde, dataDaVisita, visitasPorAno, type VisitaHistorico } from "@/lib/visitas-historico";

// O HISTÓRICO DE VISITAS NA FICHA DO CLIENTE.
//
//   "quero que no cadastro do cliente tenha o registro de quantas visitas ele
//    teve, em que dia, mês e ano, e a quantidade de dias desde a última visita."
//
// As contas moram em lib/visitas-historico.ts, puras e testadas. Aqui é só a
// tela — e ela mostra primeiro os dois números que ele pediu, grandes, porque
// é o que se olha de relance: quantas visitas e faz quanto tempo.
//
// A lista fica rolando dentro de uma altura fixa: cliente de carteira antiga
// junta dezenas de visitas, e uma lista corrida empurraria o resto da ficha
// para fora da tela.

export function HistoricoVisitasCliente({ visitas }: { visitas: VisitaHistorico[] }) {
  const r = resumoDeVisitas(visitas, new Date());
  const porAno = visitasPorAno(visitas);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
        <MapPin size={17} className="text-agro-500" /> Histórico de visitas
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-2xl font-black text-slate-800">{r.realizadas}</div>
          <div className="text-[11px] font-semibold text-slate-500">visita{r.realizadas === 1 ? "" : "s"} feita{r.realizadas === 1 ? "" : "s"}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-sm font-black text-slate-800">{textoDiasDesde(r.diasDesdeUltima)}</div>
          <div className="text-[11px] font-semibold text-slate-500">
            {r.ultima ? `última: ${dataDaVisita(r.ultima)}` : "desde a última"}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-2xl font-black text-slate-800">{r.agendadas}</div>
          <div className="text-[11px] font-semibold text-slate-500">agendada{r.agendadas === 1 ? "" : "s"}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-sm font-black text-slate-800">{r.proxima ? dataDaVisita(r.proxima) : "—"}</div>
          <div className="text-[11px] font-semibold text-slate-500">próxima</div>
        </div>
      </div>

      {visitas.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma visita registrada ainda.</p>
      ) : (
        <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
          {porAno.map(({ ano, visitas: doAno }) => (
            <div key={ano}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {ano} · {doAno.filter((v) => v.status === "realizada").length} feita(s)
              </div>
              <ul className="space-y-1">
                {doAno.map((v) => (
                  <li key={v.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {v.status === "realizada" ? <Check size={13} className="text-emerald-600" />
                        : v.status === "nao_realizada" ? <X size={13} className="text-red-500" />
                        : <CalendarClock size={13} className="text-slate-400" />}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-700">{dataDaVisita(v.data)}</span>
                    {v.observacao && <span className="min-w-0 truncate text-slate-500">{v.observacao}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
