"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarVisita } from "@/lib/actions";
import { criarEventoAction } from "@/lib/eventos-actions";
import { CampoCidade } from "@/components/CampoCidade";
import { CampoCliente } from "@/components/CampoCliente";
import { Plus, X, CalendarDays, MapPin, Loader2 } from "lucide-react";

const UFS = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"],
  ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"],
  ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
  ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"], ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"], ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"], ["SP", "São Paulo"],
  ["SE", "Sergipe"], ["TO", "Tocantins"],
] as const;

const campo = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-400";
const rotulo = "mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";

function formatarDia(iso: string): string {
  return new Date(`${iso}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit",
  });
}

// Pop-up do calendário do mês: no dia clicado dá para marcar uma VISITA a
// cliente ou um EVENTO de vários dias (feira, convenção, viagem). Só aqui o
// vendedor escolhe estado e cidade — as visitas são sempre no sul do ES, mas
// evento pode ser em qualquer lugar do país.
export function NovoCompromissoCalendario({
  dia, clientes, cidadesEs,
}: {
  dia: string;
  clientes: { id: string; nome: string; cidade?: string | null }[];
  cidadesEs: string[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"visita" | "evento">("visita");
  const [salvando, salvar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Visita
  const [clienteId, setClienteId] = useState("");
  const [horario, setHorario] = useState("09:00");
  const [cidadeVisita, setCidadeVisita] = useState("");
  const [obsVisita, setObsVisita] = useState("");

  // Evento
  const [titulo, setTitulo] = useState("");
  const [fim, setFim] = useState(dia);
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [uf, setUf] = useState("");
  const [cidadeEvento, setCidadeEvento] = useState("");
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [avisoCidades, setAvisoCidades] = useState<string | null>(null);
  const [obsEvento, setObsEvento] = useState("");

  useEffect(() => { setFim(dia); }, [dia]);

  // Escolheu o estado: busca as cidades dele (IBGE, pela rota do CRM).
  useEffect(() => {
    if (!uf) { setMunicipios([]); return; }
    let vivo = true;
    setCarregandoCidades(true);
    setCidadeEvento("");
    setAvisoCidades(null);
    fetch(`/api/municipios/${uf}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        if (Array.isArray(d.municipios)) setMunicipios(d.municipios);
        else { setMunicipios([]); setAvisoCidades("Não consegui carregar a lista de cidades — digite o nome."); }
      })
      .catch(() => { if (vivo) { setMunicipios([]); setAvisoCidades("Não consegui carregar a lista de cidades — digite o nome."); } })
      .finally(() => { if (vivo) setCarregandoCidades(false); });
    return () => { vivo = false; };
  }, [uf]);

  function fechar() {
    setAberto(false);
    setErro(null);
  }

  function submeter() {
    setErro(null);
    if (tipo === "visita") {
      if (!clienteId) { setErro("Escolha o cliente."); return; }
      const fd = new FormData();
      fd.set("data", dia);
      fd.set("horario", horario);
      fd.set("observacao", obsVisita);
      fd.set("cidade", cidadeVisita);
      salvar(async () => {
        await adicionarVisita(clienteId, fd);
        setClienteId(""); setObsVisita(""); setCidadeVisita("");
        fechar();
        router.refresh();
      });
      return;
    }
    salvar(async () => {
      const r = await criarEventoAction({
        titulo, inicioIso: dia, fimIso: fim, diaInteiro,
        horaInicio, horaFim, uf, cidade: cidadeEvento, observacao: obsEvento,
      });
      if (!r.ok) { setErro(r.erro ?? "Não consegui salvar."); return; }
      setTitulo(""); setObsEvento(""); setCidadeEvento(""); setUf("");
      fechar();
      router.refresh();
    });
  }

  return (
    <>
      {/* Verde cheio, texto branco e em negrito, a pedido do vendedor. Era um
          retângulo tracejado cinza no topo do calendário — parecia moldura, não
          botão, e é o caminho de agendar a visita, a ação mais usada da tela.
          O verde é o mesmo das visitas realizadas na legenda logo abaixo. */}
      <button
        onClick={() => setAberto(true)}
        className="flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
      >
        <Plus size={13} /> Adicionar
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Novo compromisso</h2>
              <button type="button" onClick={fechar}><X className="text-slate-400" /></button>
            </div>
            <p className="mb-4 text-xs text-slate-500">{formatarDia(dia)}</p>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["visita", "evento"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTipo(t); setErro(null); }}
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    tipo === t ? "bg-slate-900 text-agro-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t === "visita" ? "Visita a cliente" : "Evento"}
                </button>
              ))}
            </div>

            {tipo === "visita" ? (
              <div className="space-y-3">
                <div>
                  <label className={rotulo}>Cliente *</label>
                  <CampoCliente
                    clientes={clientes}
                    valor={clienteId}
                    aoMudar={(id, c) => { setClienteId(id); if (c?.cidade && !cidadeVisita) setCidadeVisita(c.cidade); }}
                    className={campo}
                  />
                </div>
                <div>
                  <label className={rotulo}>Cidade da visita</label>
                  <CampoCidade
                    valor={cidadeVisita}
                    aoMudar={setCidadeVisita}
                    opcoes={cidadesEs}
                    placeholder="Ex.: Marataízes (aparece no mapa)"
                    className={campo}
                  />
                </div>
                <div>
                  <label className={rotulo}>Horário *</label>
                  <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className={campo} />
                </div>
                <div>
                  <label className={rotulo}>Observação</label>
                  <textarea value={obsVisita} onChange={(e) => setObsVisita(e.target.value)} rows={3} placeholder="Onde é (obra, fazenda, endereço) e o que será tratado" className={campo} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={rotulo}>Evento *</label>
                  <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Convenção New Holland 2026" className={campo} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo}>Começa</label>
                    <input value={formatarDia(dia)} readOnly className={`${campo} bg-slate-50 text-slate-500`} />
                  </div>
                  <div>
                    <label className={rotulo}>Termina</label>
                    <input type="date" value={fim} min={dia} onChange={(e) => setFim(e.target.value)} className={campo} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  <CalendarDays size={15} className="text-slate-400" /> Dia inteiro
                </label>
                {!diaInteiro && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={rotulo}>Das</label>
                      <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={campo} />
                    </div>
                    <div>
                      <label className={rotulo}>Às</label>
                      <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className={campo} />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={rotulo}>Estado</label>
                    <select value={uf} onChange={(e) => setUf(e.target.value)} className={campo}>
                      <option value="">— UF —</option>
                      {UFS.map(([sigla, nome]) => <option key={sigla} value={sigla}>{sigla} · {nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={rotulo}>
                      Cidade {carregandoCidades && <Loader2 size={11} className="ml-1 inline animate-spin" />}
                    </label>
                    <CampoCidade
                      valor={cidadeEvento}
                      aoMudar={setCidadeEvento}
                      opcoes={municipios}
                      placeholder={uf ? (carregandoCidades ? "Carregando…" : "Digite as primeiras letras") : "Escolha o estado"}
                      desabilitado={!uf}
                      className={`${campo} disabled:bg-slate-50 disabled:text-slate-400`}
                    />
                    {avisoCidades && <p className="mt-1 text-[11px] text-amber-600">{avisoCidades}</p>}
                  </div>
                </div>
                <div>
                  <label className={rotulo}>Observação</label>
                  <textarea value={obsEvento} onChange={(e) => setObsEvento(e.target.value)} rows={2} placeholder="Local, hotel, o que vai acontecer" className={campo} />
                </div>
                <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
                  <MapPin size={12} className="mt-0.5 shrink-0" />
                  Evento de mais de um dia aparece marcado em todos os dias no calendário.
                </p>
              </div>
            )}

            {erro && <p className="mt-3 text-sm font-semibold text-red-600">{erro}</p>}

            <button
              onClick={submeter}
              disabled={salvando || (tipo === "visita" ? !clienteId : !titulo.trim())}
              className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
