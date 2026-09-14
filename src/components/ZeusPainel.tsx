"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Activity, Power, ShieldAlert, Wrench, Bot, MessageCircle, Database, Zap, Copy, Check, RefreshCw, CheckCircle2, Users,
} from "lucide-react";
import {
  alternarZeusAtivoAction, alternarAuditModeAction, forcarZeusTickAction, resolverZeusEventoAction,
} from "@/lib/zeus/actions";
import type { ResumoTick } from "@/lib/zeus/tick";
import { MesclarClientesModal } from "@/components/MesclarClientesModal";

// Extrai a lista {id,nome} de um alerta "Possíveis clientes duplicados"
// (detalhe é JSON livre gravado por higieneDados() em zeus/tick.ts).
function idsClientesDuplicados(detalhe: string | null): string[] | null {
  if (!detalhe) return null;
  try {
    const d = JSON.parse(detalhe);
    if (Array.isArray(d?.clientes) && d.clientes.length >= 2) {
      return d.clientes.map((c: { id: string }) => c.id);
    }
  } catch {}
  return null;
}

export type ZeusEventoRow = {
  id: string; tipo: string; severidade: string; titulo: string; detalhe: string | null; resolvido: boolean; criadoEm: string;
};
export type AuditRow = { id: string; acao: string; descricao: string; criadoEm: string };

type Heartbeat = { nome: string; minutosEsperados: number; ultimo: string | null };

const COR_SEVERIDADE: Record<string, string> = {
  baixa: "#60a5fa", media: "#f59e0b", alta: "#f87171", critica: "#ef4444",
};
const ICONE_TIPO: Record<string, typeof Activity> = {
  health: Activity, fix: Wrench, alerta: ShieldAlert, acao: Bot, erro: Zap,
};

function tempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "agora há pouco";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function StatusCard({ ok, label, valor, icon: Icon }: { ok: boolean | null; label: string; valor: string; icon: typeof Activity }) {
  const cor = ok === null ? "#a1a1aa" : ok ? "#4ade80" : "#f87171";
  return (
    <div className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
      <div className="mb-1.5 flex items-center gap-2">
        <Icon size={15} style={{ color: cor }} />
        <span className="text-xs font-semibold text-zinc-400">{label}</span>
      </div>
      <div className="text-sm font-bold" style={{ color: cor }}>{valor}</div>
    </div>
  );
}

export function ZeusPainel({
  ativo: ativoInicial, auditMode: auditModeInicial, statusZapi, heartbeats, iaConfigurada, provedorIA, contadores, eventos, audits,
}: {
  ativo: boolean;
  auditMode: boolean;
  statusZapi: { configurado: boolean; conectado: boolean; erro: string | null } | null;
  heartbeats: Heartbeat[];
  iaConfigurada: boolean;
  provedorIA: string | null;
  contadores: { mensagensHoje: number; acoesHoje: number; correcoes: number; alertasAbertos: number };
  eventos: ZeusEventoRow[];
  audits: AuditRow[];
}) {
  const [ativo, setAtivo] = useState(ativoInicial);
  const [auditMode, setAuditMode] = useState(auditModeInicial);
  const [pending, startTransition] = useTransition();
  const [tickResultado, setTickResultado] = useState<ResumoTick | null>(null);
  const [eventosLocais, setEventosLocais] = useState(eventos);
  const [copiado, setCopiado] = useState(false);
  const [mesclando, setMesclando] = useState<{ eventoId: string; clienteIds: string[] } | null>(null);

  const heartbeatsStale = useMemo(
    () => heartbeats.filter((h) => !h.ultimo || (Date.now() - new Date(h.ultimo).getTime()) / 60000 > h.minutosEsperados * 4),
    [heartbeats]
  );

  function toggleAtivo() {
    const novo = !ativo;
    setAtivo(novo);
    startTransition(async () => { await alternarZeusAtivoAction(novo); });
  }

  function toggleAuditMode() {
    const novo = !auditMode;
    setAuditMode(novo);
    startTransition(async () => { await alternarAuditModeAction(novo); });
  }

  function forcarTick() {
    startTransition(async () => {
      const r = await forcarZeusTickAction();
      setTickResultado(r);
    });
  }

  function resolver(id: string) {
    setEventosLocais((prev) => prev.map((e) => (e.id === id ? { ...e, resolvido: true } : e)));
    startTransition(async () => { await resolverZeusEventoAction(id); });
  }

  const bugsAbertos = eventosLocais.filter((e) => e.tipo === "erro" && !e.resolvido);
  const diagnosticos = eventosLocais.filter((e) => e.tipo === "fix" && e.detalhe?.includes("diagnostico"));

  function relatorioBugsTexto(): string {
    const partes: string[] = [];
    for (const d of diagnosticos) {
      try {
        const det = JSON.parse(d.detalhe ?? "{}");
        partes.push(`## ${d.titulo}\nOcorrências: ${det.ocorrencias ?? "?"}\n${det.diagnostico ?? ""}`);
      } catch { partes.push(`## ${d.titulo}`); }
    }
    for (const b of bugsAbertos.slice(0, 10)) {
      partes.push(`## ${b.titulo} (sem diagnóstico ainda, ${tempoRelativo(b.criadoEm)})`);
    }
    return partes.join("\n\n") || "Nenhum bug detectado.";
  }

  async function copiarRelatorio() {
    try {
      await navigator.clipboard.writeText(relatorioBugsTexto());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard icon={MessageCircle} label="WhatsApp" ok={statusZapi ? statusZapi.conectado : null} valor={statusZapi?.conectado ? "conectado" : statusZapi?.configurado ? "desconectado" : "não configurado"} />
        <StatusCard icon={Bot} label="IA" ok={iaConfigurada} valor={iaConfigurada ? (provedorIA ?? "configurada") : "modo heurístico"} />
        <StatusCard icon={Activity} label="Crons" ok={heartbeatsStale.length === 0} valor={heartbeatsStale.length === 0 ? "todos ativos" : `${heartbeatsStale.length} parado(s)`} />
        <StatusCard icon={Database} label="ZEUS" ok={ativo} valor={ativo ? "ativo" : "pausado"} />
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Mensagens processadas hoje", valor: contadores.mensagensHoje, cor: "#60a5fa" },
          { label: "Ações automáticas hoje", valor: contadores.acoesHoje, cor: "#BFDE4D" },
          { label: "Correções de dados (total)", valor: contadores.correcoes, cor: "#4ade80" },
          { label: "Alertas comerciais abertos", valor: contadores.alertasAbertos, cor: "#f59e0b" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
            <div className="text-2xl font-black" style={{ color: m.cor }}>{m.valor}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
        <button
          onClick={toggleAtivo}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
          style={ativo ? { background: "rgba(191,222,77,0.15)", color: "#BFDE4D" } : { background: "rgba(248,113,113,0.15)", color: "#f87171" }}
        >
          <Power size={14} /> {ativo ? "ZEUS ativo — clique para pausar" : "ZEUS pausado — clique para reativar"}
        </button>
        <button
          onClick={toggleAuditMode}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
          style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
        >
          <ShieldAlert size={14} /> Auto-resposta: {auditMode ? "modo rascunho" : "envio automático"}
        </button>
        <button
          onClick={forcarTick}
          disabled={pending}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50"
          style={{ background: "#27272a", color: "#e4e4e7" }}
        >
          <RefreshCw size={14} className={pending ? "animate-spin" : ""} /> Forçar tick agora
        </button>
        {tickResultado && (
          <span className="text-xs text-zinc-400">
            {tickResultado.pausado
              ? "ZEUS está pausado — tick não executou ações."
              : `Tick concluído: ${tickResultado.fila.processadas} msg processada(s), ${tickResultado.alertas.criados} alerta(s), ${tickResultado.autoReparo.unconfirmedReconciliados + tickResultado.autoReparo.rascunhosDescartados} reparo(s), ${(tickResultado.cadencias?.rascunhos ?? 0) + (tickResultado.cadencias?.alertas ?? 0)} toque(s) de cadência.`}
          </span>
        )}
      </div>

      {heartbeatsStale.length > 0 && (
        <div className="rounded-2xl p-3 text-xs" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
          Crons sem heartbeat recente: {heartbeatsStale.map((h) => h.nome).join(", ")}. Confira se `CRON_SECRET` está configurado e se os crons estão ativos na Vercel.
        </div>
      )}

      {/* Relatório de bugs */}
      <div className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white"><Wrench size={16} style={{ color: "#BFDE4D" }} /> Relatório de bugs (para colar no Claude Code)</div>
          <button onClick={copiarRelatorio} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "#27272a", color: "#e4e4e7" }}>
            {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
        {bugsAbertos.length === 0 && diagnosticos.length === 0 ? (
          <p className="text-xs text-zinc-600">Nenhum bug detectado. 🎉</p>
        ) : (
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl p-3 text-xs text-zinc-300" style={{ background: "#09090b", border: "1px solid #27272a" }}>
            {relatorioBugsTexto()}
          </pre>
        )}
      </div>

      {/* Feeds */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
          <div className="mb-3 text-sm font-bold text-white">Eventos do ZEUS</div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {eventosLocais.length === 0 && <p className="text-xs text-zinc-600">Nenhum evento ainda.</p>}
            {eventosLocais.map((e) => {
              const Icon = ICONE_TIPO[e.tipo] ?? Activity;
              const idsDuplicados = e.titulo.startsWith("Possíveis clientes duplicados") ? idsClientesDuplicados(e.detalhe) : null;
              return (
                <div key={e.id} className="rounded-xl px-3 py-2 text-xs" style={{ background: "#09090b", border: "1px solid #27272a" }}>
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold" style={{ color: COR_SEVERIDADE[e.severidade] ?? "#a1a1aa" }}>
                      <Icon size={12} /> {e.tipo}
                    </span>
                    <span className="text-zinc-600">{tempoRelativo(e.criadoEm)}</span>
                  </div>
                  <p className="text-zinc-300">{e.titulo}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {!e.resolvido && e.tipo !== "health" && (
                      <button onClick={() => resolver(e.id)} className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:underline">
                        <CheckCircle2 size={11} /> Marcar resolvido
                      </button>
                    )}
                    {!e.resolvido && idsDuplicados && (
                      <button onClick={() => setMesclando({ eventoId: e.id, clienteIds: idsDuplicados })} className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:underline">
                        <Users size={11} /> Mesclar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
          <div className="mb-3 text-sm font-bold text-white">Ações automáticas (Auditoria, origem ZEUS)</div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {audits.length === 0 && <p className="text-xs text-zinc-600">Nenhuma ação automática ainda.</p>}
            {audits.map((a) => (
              <div key={a.id} className="rounded-xl px-3 py-2 text-xs" style={{ background: "#09090b", border: "1px solid #27272a" }}>
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="font-semibold" style={{ color: "#BFDE4D" }}>{a.acao}</span>
                  <span className="text-zinc-600">{tempoRelativo(a.criadoEm)}</span>
                </div>
                <p className="text-zinc-400">{a.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {mesclando && (
        <MesclarClientesModal
          clienteIds={mesclando.clienteIds}
          onClose={() => setMesclando(null)}
          onMesclado={() => resolver(mesclando.eventoId)}
        />
      )}
    </div>
  );
}
