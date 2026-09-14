"use client";

import { useState, useTransition } from "react";
import { Card, Badge } from "@/components/ui";
import { iniciarCadenciaAction, encerrarCadenciaAction } from "@/lib/cadencia-actions";
import type { CadenciaResumo } from "@/lib/cadencias";
import { Repeat, Loader2, Phone, MessageCircle, MapPin, XCircle, CheckCircle2 } from "lucide-react";

type Tipo = { id: string; label: string; descricao: string };
type Etapa = { numero: number; dia: number; canal: string; titulo: string };

const ICONE_CANAL: Record<string, typeof Phone> = { whatsapp: MessageCircle, ligacao: Phone, visita: MapPin };
const NOME_CANAL: Record<string, string> = { whatsapp: "WhatsApp", ligacao: "Ligação", visita: "Visita" };
const MOTIVO: Record<string, string> = {
  respondeu: "o cliente respondeu",
  concluida: "os 7 toques foram concluídos",
  manual: "encerrada por você",
  sem_telefone: "o cliente ficou sem telefone",
};

function quando(iso: string): string {
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "no próximo ciclo do ZEUS (até 15 min)";
  const dias = Math.floor(diff / 86400000);
  if (dias === 0) return "hoje, " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  if (dias === 1) return "amanhã";
  return `em ${dias} dias (${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })})`;
}

export function CadenciaCliente({ clienteId, inicial, tipos, etapas, temTelefone }: {
  clienteId: string;
  inicial: CadenciaResumo | null;
  tipos: Tipo[];
  etapas: Etapa[];
  temTelefone: boolean;
}) {
  const [cad, setCad] = useState<CadenciaResumo | null>(inicial);
  const [tipo, setTipo] = useState(tipos[0]?.id ?? "geral");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  function iniciar() {
    setErro(null);
    start(async () => {
      const r = await iniciarCadenciaAction(clienteId, tipo);
      if (!r.ok) { setErro(r.erro ?? "Não foi possível iniciar."); return; }
      setCad(r.cadencia ?? null);
    });
  }

  function encerrar() {
    if (!cad || !confirm("Encerrar a cadência deste cliente? Os toques restantes não serão preparados.")) return;
    start(async () => {
      const r = await encerrarCadenciaAction(cad.id);
      if (r.ok) setCad(r.cadencia ?? null);
    });
  }

  const ativa = !!cad?.ativa;
  const descricaoTipo = tipos.find((t) => t.id === tipo)?.descricao;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 ${ativa ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-400"}`}>
          <Repeat size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">Cadência de 7 toques</span>
            {ativa && cad ? (
              <Badge tom="blue">ativa · toque {cad.toqueAtual}/{cad.totalToques} · {cad.tipoLabel}</Badge>
            ) : cad ? (
              <Badge tom="slate">encerrada</Badge>
            ) : (
              <Badge tom="slate">não iniciada</Badge>
            )}
          </div>

          {ativa && cad ? (
            <div className="mt-2 space-y-3 text-sm text-slate-600">
              <p>
                {cad.proximo
                  ? <>Próximo: <strong>toque {cad.proximo.numero}</strong> ({NOME_CANAL[cad.proximo.canal]}) · {cad.proximo.titulo} · <span className="text-slate-500">{quando(cad.proximo.quando)}</span>.</>
                  : "Último toque preparado."}
              </p>
              <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {etapas.map((e) => {
                  const Icone = ICONE_CANAL[e.canal] ?? MessageCircle;
                  const feito = e.numero <= cad.toqueAtual;
                  const proximo = e.numero === cad.toqueAtual + 1;
                  return (
                    <li key={e.numero} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${feito ? "text-slate-400 line-through" : proximo ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600"}`}>
                      {feito ? <CheckCircle2 size={14} className="text-green-500" /> : <Icone size={14} />}
                      <span>D{e.dia} · {e.titulo}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="text-xs text-slate-500">
                Toques de WhatsApp aparecem como rascunho no Atendimento para você revisar e enviar. Ligação e visita viram alerta na Central. A cadência para sozinha quando o cliente responder.
              </p>
              <button type="button" onClick={encerrar} disabled={pendente} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                {pendente ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Encerrar cadência
              </button>
            </div>
          ) : (
            <div className="mt-2 space-y-3 text-sm text-slate-600">
              {cad && !cad.ativa && (
                <p className="text-xs text-slate-500">
                  Última cadência ({cad.tipoLabel}) parou no toque {cad.toqueAtual}/{cad.totalToques}: {MOTIVO[cad.motivoEncerramento ?? ""] ?? "encerrada"}.
                </p>
              )}
              <p>
                Prospecto que não responde? Inicie a cadência: 7 contatos em 30 dias, alternando WhatsApp, ligação e visita, cada um com valor novo. O ZEUS prepara os textos e avisa nos dias certos.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-medium text-slate-600">
                  Nicho do cliente
                  <select id="cadencia-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                    {tipos.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
                <button type="button" onClick={iniciar} disabled={pendente || !temTelefone} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {pendente ? <Loader2 size={14} className="animate-spin" /> : <Repeat size={14} />} Iniciar cadência
                </button>
              </div>
              {descricaoTipo && <p className="text-xs text-slate-500">{descricaoTipo}</p>}
              {!temTelefone && <p className="text-xs text-amber-600">Cadastre o telefone do cliente para iniciar.</p>}
              {erro && <p className="text-xs text-red-600">{erro}</p>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
