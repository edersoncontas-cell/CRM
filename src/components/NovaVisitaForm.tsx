"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarVisita } from "@/lib/actions";
import { Plus, X, Calendar, Clock } from "lucide-react";
import { WheelDatePicker, WheelTimePicker } from "@/components/WheelDatePicker";

function formatarDataLabel(iso: string): string {
  if (!iso) return "Selecionar data";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Adiciona uma visita. Se `dataFixa` vier definida (coluna do dia clicada no
// quadro de Visitas), a data já é essa e só falta escolher o horário; senão
// (botão genérico "Nova visita"), também deixa escolher o dia.
export function NovaVisitaForm({
  clientes,
  cidades = [],
  dataFixa,
  rotuloDataFixa,
  compacto,
  clienteInicial,
  abrirInicial,
}: {
  clientes: { id: string; nome: string; cidade?: string | null }[];
  cidades?: string[];
  dataFixa?: string;
  rotuloDataFixa?: string;
  compacto?: boolean;
  // Vindo do Orientador ("Agendar visita"): já abre com o cliente escolhido.
  clienteInicial?: string;
  abrirInicial?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const [data, setData] = useState(dataFixa ?? new Date().toISOString().slice(0, 10));
  const [horario, setHorario] = useState("09:00");
  const [clienteId, setClienteId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [cidade, setCidade] = useState("");
  const [pickerAberto, setPickerAberto] = useState<"data" | "horario" | null>(null);

  useEffect(() => {
    if (!abrirInicial) return;
    const c = clienteInicial ? clientes.find((x) => x.id === clienteInicial) : null;
    if (c) { setClienteId(c.id); if (c.cidade) setCidade(c.cidade); }
    setAberto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirInicial, clienteInicial]);

  function abrir() {
    setData(dataFixa ?? new Date().toISOString().slice(0, 10));
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    // Limpa ?cliente=&novo= da URL para não reabrir no próximo refresh.
    if (abrirInicial) router.replace("/visitas");
  }

  function submeter() {
    if (!clienteId) return;
    const fd = new FormData();
    fd.set("data", data);
    fd.set("horario", horario);
    fd.set("observacao", observacao);
    fd.set("cidade", cidade);
    startSalvar(async () => {
      await adicionarVisita(clienteId, fd);
      setClienteId("");
      setObservacao("");
      setCidade("");
      fechar();
    });
  }

  return (
    <>
      <button
        onClick={abrir}
        className={compacto
          ? "flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-1.5 text-xs font-semibold text-slate-500 hover:border-brand-400 hover:text-brand-600"
          : "flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"}
      >
        <Plus size={compacto ? 13 : 16} /> {compacto ? "Adicionar" : "Nova visita"}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Nova visita</h2>
              <button type="button" onClick={fechar}>
                <X className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cliente *</label>
                <select value={clienteId} onChange={(e) => { setClienteId(e.target.value); const c = clientes.find((x) => x.id === e.target.value); if (c?.cidade && !cidade) setCidade(c.cidade); }} className="campo">
                  <option value="">— Selecionar —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cidade da visita</label>
                <input list="cidades-es" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Marataízes (aparece no mapa)" className="campo" />
                <datalist id="cidades-es">{cidades.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Data *</label>
                  {dataFixa ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <Calendar size={14} className="text-slate-400" /> {rotuloDataFixa ?? formatarDataLabel(data)}
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPickerAberto("data")} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-brand-300 hover:bg-brand-50">
                      <Calendar size={14} className="text-slate-400" /> {formatarDataLabel(data)}
                    </button>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Horário *</label>
                  <button type="button" onClick={() => setPickerAberto("horario")} className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-brand-300 hover:bg-brand-50">
                    <Clock size={14} className="text-slate-400" /> {horario}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Observação</label>
                <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Onde é (obra, fazenda, endereço) e o que será tratado" className="campo" />
              </div>
            </div>
            <button onClick={submeter} disabled={salvando || !clienteId} className="mt-5 w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {pickerAberto === "data" && (
        <WheelDatePicker
          title="Data da visita"
          valueISO={data}
          onClose={() => setPickerAberto(null)}
          onConfirm={(v) => { setData(v); setPickerAberto(null); }}
        />
      )}
      {pickerAberto === "horario" && (
        <WheelTimePicker
          title="Horário da visita"
          valueHM={horario}
          onClose={() => setPickerAberto(null)}
          onConfirm={(v) => { setHorario(v); setPickerAberto(null); }}
        />
      )}
    </>
  );
}
