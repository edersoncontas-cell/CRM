"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  MapPin, Route, Calendar, Clock, Users, Building2, Search,
  ChevronDown, ChevronUp, ExternalLink, Trash2, Loader2,
  Navigation, Star, AlertCircle,
} from "lucide-react";
import { buscarProspectosIAAction, excluirProspecto } from "@/lib/actions";
import type { GrupoMunicipio, DiaRota, VisitaAgendada } from "@/lib/roteiro";
import { diasDesde } from "@/lib/utils";

type Props = {
  gruposSugeridos: GrupoMunicipio[];
  diasEfetivos: DiaRota[];
  totalClientes: number;
  totalProspectos: number;
};

const DIA_COR: Record<string, string> = {
  "terça":  "rgba(96,165,250,0.15)",
  "quarta": "rgba(167,139,250,0.15)",
  "quinta": "rgba(251,191,36,0.15)",
  "sexta":  "rgba(52,211,153,0.15)",
};
const DIA_TXT: Record<string, string> = {
  "terça": "#60a5fa", "quarta": "#a78bfa", "quinta": "#fbbf24", "sexta": "#34d399",
};

const TIPO_LABEL: Record<string, string> = {
  locacao: "Locação",
  terraplanagem: "Terraplanagem",
  engenharia: "Engenharia",
  asfalto: "Asfalto/Compactação",
  mineracao: "Mineração",
  construcao: "Construção Civil",
};
const TIPO_COR: Record<string, string> = {
  locacao: "#60a5fa",
  terraplanagem: "#fbbf24",
  engenharia: "#a78bfa",
  asfalto: "#f87171",
  mineracao: "#fb923c",
  construcao: "#34d399",
};

function detectarTipo(obs: string | null): string {
  if (!obs) return "construcao";
  const lower = obs.toLowerCase();
  if (lower.includes("locacao") || lower.includes("locaç")) return "locacao";
  if (lower.includes("terraplanagem")) return "terraplanagem";
  if (lower.includes("engenharia")) return "engenharia";
  if (lower.includes("asfalto") || lower.includes("compactação") || lower.includes("compactacao")) return "asfalto";
  if (lower.includes("mineracao") || lower.includes("mineração")) return "mineracao";
  return "construcao";
}

export function RoteiroClient({ gruposSugeridos, diasEfetivos, totalClientes, totalProspectos }: Props) {
  const [aba, setAba] = useState<"sugerida" | "efetiva">("sugerida");
  const [abertos, setAbertos] = useState<Set<string>>(new Set(gruposSugeridos.slice(0, 3).map(g => g.municipioId)));
  const [buscando, startBusca] = useTransition();
  const [municipioBuscando, setMunicipioBuscando] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Record<string, string>>({});
  const [excluindo, startExcluir] = useTransition();

  function toggleGrupo(id: string) {
    setAbertos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function buscarProspectos(municipioId: string) {
    setMunicipioBuscando(municipioId);
    startBusca(async () => {
      const res = await buscarProspectosIAAction(municipioId);
      setMunicipioBuscando(null);
      if (res.ok) {
        setMensagens((m) => ({
          ...m,
          [municipioId]: res.inseridos > 0
            ? `✅ ${res.inseridos} prospecto(s) adicionado(s)!`
            : "ℹ️ Nenhum novo prospecto encontrado (talvez já existam).",
        }));
      } else {
        setMensagens((m) => ({ ...m, [municipioId]: `❌ ${res.erro ?? "Erro ao buscar"}` }));
      }
      setTimeout(() => setMensagens((m) => { const n = { ...m }; delete n[municipioId]; return n; }), 5000);
    });
  }

  function excluir(clienteId: string) {
    startExcluir(async () => { await excluirProspecto(clienteId); });
  }

  const diasDia: Record<string, string> = { "terça": "Terça", "quarta": "Quarta", "quinta": "Quinta", "sexta": "Sexta" };

  return (
    <div>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Municípios no roteiro", valor: gruposSugeridos.length, cor: "#60a5fa" },
          { label: "Clientes a visitar", valor: totalClientes, cor: "#BFDE4D" },
          { label: "Prospectos IA", valor: totalProspectos, cor: "#a78bfa" },
          { label: "Visitas agendadas", valor: diasEfetivos.reduce((s, d) => s + d.visitas.length, 0), cor: "#34d399" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a" }}>
            <div className="text-2xl font-bold" style={{ color: s.cor }}>{s.valor}</div>
            <div className="text-xs mt-0.5" style={{ color: "#71717a" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex rounded-xl p-1" style={{ background: "#18181b", border: "1px solid #27272a" }}>
        {(["sugerida", "efetiva"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition"
            style={aba === t
              ? { background: "#BFDE4D", color: "#09090b" }
              : { color: "#71717a" }}
          >
            {t === "sugerida" ? "🗺️ Rota Sugerida (IA)" : "📅 Rota Efetiva (Agenda)"}
          </button>
        ))}
      </div>

      {/* ── Rota Sugerida ──────────────────────────────────────────── */}
      {aba === "sugerida" && (
        <div>
          <p className="mb-4 text-sm" style={{ color: "#71717a" }}>
            Clientes priorizados pela IA: sem visita, sem contato há mais de 30 dias ou com negociação aberta.
            Organizado por dia da semana (Ter–Sex) para minimizar deslocamento.
          </p>

          {/* Legenda dias */}
          <div className="mb-5 flex flex-wrap gap-2">
            {(["terça", "quarta", "quinta", "sexta"] as const).map((d) => (
              <span key={d} className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: DIA_COR[d], color: DIA_TXT[d] }}>
                {diasDia[d]}
              </span>
            ))}
            <span className="text-xs self-center" style={{ color: "#52525b" }}>= dia recomendado para cada município</span>
          </div>

          {gruposSugeridos.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: "#18181b", border: "1px solid #27272a" }}>
              <p className="text-sm" style={{ color: "#71717a" }}>Nenhum cliente pendente de visita. Cadastre clientes para gerar o roteiro.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {gruposSugeridos.map((g) => {
                const aberto = abertos.has(g.municipioId);
                const isBuscando = municipioBuscando === g.municipioId;
                const msg = mensagens[g.municipioId];
                const total = g.clientes.length + g.prospectos.length;

                return (
                  <div key={g.municipioId} className="overflow-hidden rounded-2xl" style={{ background: "#18181b", border: "1px solid #27272a" }}>
                    {/* Header do município */}
                    <button
                      onClick={() => toggleGrupo(g.municipioId)}
                      className="flex w-full items-center justify-between p-4 text-left transition hover:brightness-110"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl p-2" style={{ background: DIA_COR[g.diaRecomendado] }}>
                          <MapPin size={18} style={{ color: DIA_TXT[g.diaRecomendado] }} />
                        </div>
                        <div>
                          <div className="font-bold text-white">{g.municipioNome}</div>
                          <div className="text-xs" style={{ color: "#71717a" }}>
                            {g.clientes.length} cliente(s) · {g.prospectos.length} prospecto(s) IA
                          </div>
                        </div>
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold ml-1" style={{ background: DIA_COR[g.diaRecomendado], color: DIA_TXT[g.diaRecomendado] }}>
                          {diasDia[g.diaRecomendado]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{total}</span>
                        {aberto ? <ChevronUp size={16} style={{ color: "#71717a" }} /> : <ChevronDown size={16} style={{ color: "#71717a" }} />}
                      </div>
                    </button>

                    {/* Conteúdo expandido */}
                    {aberto && (
                      <div className="border-t px-4 pb-4" style={{ borderColor: "#27272a" }}>
                        {/* Ações do município */}
                        <div className="mb-3 mt-3 flex flex-wrap gap-2">
                          <a
                            href={g.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:brightness-110"
                            style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
                          >
                            <Navigation size={13} /> Abrir no Maps
                          </a>
                          <button
                            onClick={() => buscarProspectos(g.municipioId)}
                            disabled={isBuscando || buscando}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:brightness-110 disabled:opacity-50"
                            style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}
                          >
                            {isBuscando ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                            {isBuscando ? "Buscando..." : "Buscar prospectos com IA"}
                          </button>
                          {msg && (
                            <span className="self-center text-xs" style={{ color: msg.startsWith("✅") ? "#4ade80" : "#f87171" }}>
                              {msg}
                            </span>
                          )}
                        </div>

                        {/* Clientes existentes */}
                        {g.clientes.length > 0 && (
                          <div className="mb-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{ color: "#a1a1aa" }}>
                              <Users size={12} /> CLIENTES ({g.clientes.length})
                            </div>
                            <div className="space-y-1.5">
                              {g.clientes.map((c) => {
                                const dias = diasDesde(c.ultimoContato);
                                const temNeg = c.negociacoes.some((n) => n.status === "aberta");
                                return (
                                  <div key={c.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "#27272a" }}>
                                    <div className="min-w-0 flex-1">
                                      <Link href={`/clientes/${c.id}`} className="text-sm font-semibold text-white hover:text-[#BFDE4D] truncate block">
                                        {c.nome}
                                      </Link>
                                      <div className="flex flex-wrap gap-1.5 mt-0.5">
                                        {!c.visitado && <Chip cor="#f87171" bg="rgba(248,113,113,0.12)">nunca visitado</Chip>}
                                        {c.jaComprou && <Chip cor="#4ade80" bg="rgba(74,222,128,0.12)">já comprou</Chip>}
                                        {temNeg && <Chip cor="#BFDE4D" bg="rgba(191,222,77,0.12)">neg. aberta</Chip>}
                                        {dias > 60 && <Chip cor="#f59e0b" bg="rgba(245,158,11,0.12)">{dias}d sem contato</Chip>}
                                      </div>
                                    </div>
                                    {c.telefone && (
                                      <a
                                        href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-2 shrink-0 rounded-lg p-1.5 transition hover:brightness-110"
                                        style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
                                      >
                                        <ExternalLink size={13} />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Prospectos IA */}
                        {g.prospectos.length > 0 && (
                          <div>
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold" style={{ color: "#a1a1aa" }}>
                              <Building2 size={12} /> PROSPECTOS IA ({g.prospectos.length})
                            </div>
                            <div className="space-y-1.5">
                              {g.prospectos.map((p) => {
                                const tipo = detectarTipo(p.observacoes ?? null);
                                const cor = TIPO_COR[tipo] ?? "#71717a";
                                return (
                                  <div key={p.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-semibold text-white truncate">{p.nome}</div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${cor}20`, color: cor }}>
                                          {TIPO_LABEL[tipo] ?? tipo}
                                        </span>
                                        {p.observacoes && (
                                          <span className="text-xs truncate" style={{ color: "#71717a" }}>
                                            {p.observacoes?.replace(/^[^—]+—\s*/, "")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="ml-2 flex shrink-0 gap-1.5">
                                      <Link
                                        href={`/clientes/${p.id}`}
                                        className="rounded-lg p-1.5 transition hover:brightness-110"
                                        style={{ background: "rgba(191,222,77,0.1)", color: "#BFDE4D" }}
                                        title="Abrir ficha"
                                      >
                                        <ExternalLink size={13} />
                                      </Link>
                                      <button
                                        onClick={() => excluir(p.id)}
                                        disabled={excluindo}
                                        className="rounded-lg p-1.5 transition hover:brightness-110"
                                        style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}
                                        title="Remover prospecto"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {g.clientes.length === 0 && g.prospectos.length === 0 && (
                          <p className="text-xs text-center py-2" style={{ color: "#52525b" }}>
                            Clique em &ldquo;Buscar prospectos com IA&rdquo; para descobrir empresas neste município.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Rota Efetiva ──────────────────────────────────────────── */}
      {aba === "efetiva" && (
        <div>
          <p className="mb-4 text-sm" style={{ color: "#71717a" }}>
            Visitas confirmadas na agenda, agrupadas por data. Apenas dias úteis (Ter–Sex).
            Clique no mapa para abrir a rota no Google Maps.
          </p>

          {diasEfetivos.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: "#18181b", border: "1px solid #27272a" }}>
              <Calendar size={40} className="mx-auto mb-3" style={{ color: "#3f3f46" }} />
              <p className="text-sm font-medium text-white mb-1">Nenhuma visita agendada</p>
              <p className="text-xs" style={{ color: "#71717a" }}>
                A IA detecta visitas automaticamente ao analisar conversas do WhatsApp.
                Você também pode adicionar manualmente na ficha do cliente.
              </p>
              <Link
                href="/agenda"
                className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold transition hover:brightness-110"
                style={{ background: "rgba(191,222,77,0.15)", color: "#BFDE4D" }}
              >
                Ver agenda completa →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {diasEfetivos.map((dia) => {
                const dataBr = dia.data.toLocaleDateString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });
                const municipiosUnicos = [...new Set(dia.visitas.map((v) => v.municipioNome).filter(Boolean))];

                return (
                  <div key={dia.data.toISOString()} className="rounded-2xl overflow-hidden" style={{ background: "#18181b", border: "1px solid #27272a" }}>
                    {/* Cabeçalho do dia */}
                    <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(191,222,77,0.06)", borderBottom: "1px solid #27272a" }}>
                      <div>
                        <div className="font-bold text-white capitalize">{dataBr}</div>
                        <div className="text-xs mt-0.5" style={{ color: "#71717a" }}>
                          {dia.visitas.length} visita(s) · {municipiosUnicos.join(" → ")}
                        </div>
                      </div>
                      <a
                        href={dia.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:brightness-110"
                        style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
                      >
                        <Navigation size={13} /> Abrir rota
                      </a>
                    </div>

                    {/* Lista de visitas */}
                    <div className="divide-y" style={{ borderColor: "#27272a" }}>
                      {dia.visitas.map((v, i) => {
                        const hora = v.data.toLocaleTimeString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <div key={`${v.id}-${i}`} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold" style={{ background: "rgba(191,222,77,0.1)", color: "#BFDE4D" }}>
                              {hora}
                            </div>
                            <div className="min-w-0 flex-1">
                              <Link href={`/clientes/${v.clienteId}`} className="block truncate text-sm font-semibold text-white hover:text-[#BFDE4D]">
                                {v.clienteNome}
                              </Link>
                              <div className="flex items-center gap-2 text-xs" style={{ color: "#71717a" }}>
                                {v.municipioNome && <><MapPin size={10} /> {v.municipioNome}</>}
                                {v.maquina && <> · {v.maquina}</>}
                              </div>
                            </div>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                              style={v.origem === "visita"
                                ? { background: "rgba(74,222,128,0.12)", color: "#4ade80" }
                                : { background: "rgba(96,165,250,0.12)", color: "#60a5fa" }}
                            >
                              {v.origem === "visita" ? "Agenda" : "Negociação"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ children, cor, bg }: { children: React.ReactNode; cor: string; bg: string }) {
  return (
    <span className="rounded-md px-1.5 py-0.5 text-xs font-medium" style={{ background: bg, color: cor }}>
      {children}
    </span>
  );
}
