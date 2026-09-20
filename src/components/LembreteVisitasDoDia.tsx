"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Mic, MicOff, Loader2, Check, X, CalendarClock, Clock, ChevronRight, Sparkles } from "lucide-react";
import { useDitadoVoz } from "@/lib/useDitadoVoz";
import { WheelDatePicker, WheelTimePicker } from "@/components/WheelDatePicker";
import { reagendarVisitaAction } from "@/lib/actions";
import { visitasDeHojeAction, registrarVisitaDoDiaAction, type VisitaDoDiaSerial } from "@/lib/visitas-dia-actions";
import { estadoDoLembrete, horaCurta, type VisitaDoDia } from "@/lib/visitas-do-dia";

// O LEMBRETE DAS VISITAS DO DIA.
//
//   "quando tiver visitas agendadas no CRM quero que você crie um pop up toda
//    vez que entrar no CRM (…) Visita Feita? vou ter a opção de selecionar sim
//    ou não (…) já gera um campo de preenchimento do resumo da visita, podendo
//    ter a opção de envia audio e ser transcrito."
//
// A regra de QUANDO aparecer e de QUEM é a vez mora em lib/visitas-do-dia.ts,
// pura e testada. Aqui fica só a tela.
//
// Por que ele é agressivo (abre sozinho, por cima de tudo, e volta a cada
// entrada): o vendedor está na rua. Ele não volta ao CRM para registrar visita
// — volta para ver um preço, uma ficha técnica. O lembrete existe para
// aproveitar essa volta. Mas ele SEMPRE dá saída: "agora não" fecha até a
// próxima entrada, e nada é gravado sem ele mandar.

type Passo = "perguntar" | "relatar" | "reagendar";

const overlay = "fixed inset-0 z-[150] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4";
const caixa = "max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl";

function hojeISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function LembreteVisitasDoDia() {
  const router = useRouter();
  const [visitas, setVisitas] = useState<VisitaDoDiaSerial[] | null>(null);
  const [fechado, setFechado] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [passo, setPasso] = useState<Passo>("perguntar");
  const [feita, setFeita] = useState(true);
  const [relato, setRelato] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string[] | null>(null);
  const [dataNova, setDataNova] = useState(hojeISO());
  const [horaNova, setHoraNova] = useState("09:00");
  const [picker, setPicker] = useState<"data" | "hora" | null>(null);
  const { ouvindo, alternar } = useDitadoVoz((t) => setRelato((p) => (p ? p + " " : "") + t));

  const carregar = useCallback(async () => {
    const r = await visitasDeHojeAction().catch(() => [] as VisitaDoDiaSerial[]);
    setVisitas(r);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  // As datas voltam como texto do servidor; a regra trabalha com Date.
  const doDia: VisitaDoDia[] = useMemo(
    () => (visitas ?? []).map((v) => ({ ...v, data: new Date(v.data) })),
    [visitas],
  );
  const estado = useMemo(() => estadoDoLembrete(doDia, new Date()), [doDia]);

  // A visita da vez é a mais antiga pendente — a menos que ele tenha escolhido
  // outra ("caso tenha atendido algum cliente primeiro").
  const alvo = useMemo(
    () => estado.pendentes.find((v) => v.id === escolhida) ?? estado.daVez,
    [estado, escolhida],
  );

  function reiniciar() {
    setEscolhida(null); setPasso("perguntar"); setRelato(""); setErro(null); setFeito(null);
  }

  async function salvar() {
    if (!alvo) return;
    setSalvando(true); setErro(null);
    const r = await registrarVisitaDoDiaAction(alvo.id, feita, relato).catch(() => ({ ok: false, erro: "Falha ao salvar." }));
    setSalvando(false);
    if (!r.ok) { setErro(r.erro ?? "Não deu para salvar."); return; }

    const linhas: string[] = [];
    if ("resumo" in r && r.resumo) linhas.push(r.resumo);
    if ("negociacao" in r && r.negociacao) linhas.push(`Negociação ${r.negociacao}.`);
    if ("proximaVisita" in r && r.proximaVisita) linhas.push(`Próxima visita agendada para ${r.proximaVisita}.`);
    if ("colunaMovida" in r && r.colunaMovida) {
      linhas.push(r.colunaMovida.startsWith("__nao_achei__:")
        ? `Não achei essa coluna no funil. As que existem: ${r.colunaMovida.replace("__nao_achei__:", "")}.`
        : `Movido no funil para “${r.colunaMovida}”.`);
    }
    setFeito(linhas);
    await carregar();
    router.refresh();
  }

  async function reagendar() {
    if (!alvo) return;
    setSalvando(true); setErro(null);
    const r = await reagendarVisitaAction(alvo.id, dataNova, horaNova).catch(() => ({ ok: false, erro: "Falha ao reagendar." }));
    setSalvando(false);
    if (!r.ok) { setErro(("erro" in r && r.erro) || "Não deu para reagendar."); return; }
    const quando = new Date(`${dataNova}T${horaNova}:00-03:00`);
    const mesmoDia = dataNova === hojeISO();
    setFeito([
      mesmoDia
        ? `Remarcada para hoje às ${horaNova}. Continua na fila do dia.`
        : `Remarcada para ${quando.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${horaNova}, já no calendário.`,
    ]);
    await carregar();
    router.refresh();
  }

  if (fechado || !estado.mostrar || !alvo) return null;

  const restantes = estado.pendentes.filter((v) => v.id !== alvo.id);

  return (
    <>
      <div className={overlay}>
        <div className={caixa}>
          {/* Cabeçalho: onde ele está na fila do dia */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-agro-600">
                <MapPin size={13} /> Visitas de hoje
              </div>
              <div className="mt-0.5 text-sm text-slate-500">
                {estado.sinalizadas} de {estado.total} já sinalizada{estado.total > 1 ? "s" : ""} · falta{estado.pendentes.length > 1 ? "m" : ""} {estado.pendentes.length}
              </div>
            </div>
            <button
              onClick={() => setFechado(true)}
              title="Agora não — volta na próxima vez que você entrar"
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* De quem é a vez */}
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Clock size={15} className="shrink-0 text-agro-600" /> {horaCurta(alvo.data)} · {alvo.clienteNome}
            </div>
            {(alvo.cidade || alvo.observacao) && (
              <div className="mt-1 text-xs text-slate-500">
                {[alvo.cidade, alvo.observacao].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>

          {feito ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-800"><Check size={15} /> Registrado</div>
              {feito.map((l, i) => <p key={i} className="mt-1 text-xs text-emerald-900">{l}</p>)}
              <div className="mt-3 flex gap-2">
                {estado.pendentes.length > 0 ? (
                  <button onClick={reiniciar} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                    Próxima visita <ChevronRight size={13} />
                  </button>
                ) : (
                  <button onClick={() => setFechado(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                    Fechar — dia sinalizado
                  </button>
                )}
              </div>
            </div>
          ) : passo === "perguntar" ? (
            <>
              <p className="mb-3 text-center text-lg font-bold text-slate-800">Visita feita?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setFeita(true); setPasso("relatar"); }}
                  className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Sim
                </button>
                <button
                  onClick={() => { setFeita(false); setPasso("relatar"); }}
                  className="rounded-xl bg-white py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                  Não
                </button>
              </div>

              {/* "a opção se ele vai ser reagendado" e "se o cliente foi
                  atendido no mesmo dia porém mais tarde" — as duas saem daqui,
                  e são o mesmo caminho: escolher outro dia e hora. */}
              <button
                onClick={() => setPasso("reagendar")}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-500 hover:border-agro-400 hover:text-agro-700"
              >
                <CalendarClock size={14} /> Remarcar (outro dia, ou mais tarde hoje)
              </button>
            </>
          ) : passo === "reagendar" ? (
            <>
              <p className="mb-3 text-sm font-semibold text-slate-700">Para quando?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPicker("data")} className="rounded-xl border border-slate-300 px-3 py-2.5 text-left text-sm text-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-400">Dia</span>
                  {new Date(`${dataNova}T12:00:00`).toLocaleDateString("pt-BR")}
                </button>
                <button onClick={() => setPicker("hora")} className="rounded-xl border border-slate-300 px-3 py-2.5 text-left text-sm text-slate-700">
                  <span className="block text-[11px] font-semibold text-slate-400">Hora</span>
                  {horaNova}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                A visita de hoje fica como não realizada e uma nova entra no calendário, ligada a esta.
              </p>
              {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => setPasso("perguntar")} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Voltar</button>
                <button onClick={reagendar} disabled={salvando} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-agro-500 px-4 py-2 text-xs font-bold text-black disabled:opacity-60">
                  {salvando ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />} Remarcar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                {feita ? "O que aconteceu na visita?" : "Por que não aconteceu?"}
              </p>
              <div className="flex items-start gap-2">
                <button
                  onClick={alternar}
                  title="Ditar por voz"
                  className={`shrink-0 rounded-xl p-2.5 ${ouvindo ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600 hover:text-slate-900"}`}
                >
                  {ouvindo ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <textarea
                  value={relato}
                  onChange={(e) => setRelato(e.target.value)}
                  rows={4}
                  autoFocus
                  placeholder={ouvindo ? "Ouvindo… pode falar" : "Toque no microfone e fale, ou digite"}
                  className="flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-agro-400"
                />
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
                <Sparkles size={12} className="mt-0.5 shrink-0 text-agro-600" />
                O que você escrever aqui vira ação: abre ou atualiza a negociação, agenda a próxima visita
                se você citar uma data e move de coluna se você mandar (ex.: “passa pra proposta enviada”).
              </p>
              {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => setPasso("perguntar")} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">Voltar</button>
                <button onClick={salvar} disabled={salvando} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">
                  {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar
                </button>
              </div>
            </>
          )}

          {/* A fila: atendeu outro cliente primeiro? troca aqui. */}
          {!feito && restantes.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Atendeu outro primeiro? Escolha na fila
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {restantes.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setEscolhida(v.id); setPasso("perguntar"); setRelato(""); setErro(null); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100"
                  >
                    <span className="font-bold text-slate-500">{horaCurta(v.data)}</span>
                    <span className="min-w-0 truncate">{v.clienteNome}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {picker === "data" && (
        <WheelDatePicker title="Remarcar para" valueISO={dataNova} onClose={() => setPicker(null)} onConfirm={(v) => { setDataNova(v); setPicker(null); }} />
      )}
      {picker === "hora" && (
        <WheelTimePicker title="Horário" valueHM={horaNova} onClose={() => setPicker(null)} onConfirm={(v) => { setHoraNova(v); setPicker(null); }} />
      )}
    </>
  );
}
