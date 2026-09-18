"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Card, Badge, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import { listarContatosPosVenda, registrarContatoPosVenda, gerarIdeiasPosVendaAction } from "@/lib/actions";
import { HeartHandshake, X, Sparkles, Phone, MapPin, Wrench, Package, Users, MessageCircle, Plus, ClipboardCheck, CalendarClock } from "lucide-react";

type MarcoPendente = { tipo: string; label: string } | null;

type ItemLista = {
  clienteId: string;
  nome: string;
  municipio: string | null;
  maquina: string | null;
  maquinas: string[];
  dataCompra: string | null;
  ultimoContato: string | null;
  diasSemContato: number | null;
  diasDesdeFaturamento: number;
  marcoPendente: MarcoPendente;
  entregaTecnica: boolean;
};

type Contato = { id: string; tipo: string; nota: string; data: string };

const TIPO_LABEL: Record<string, { label: string; icon: typeof Phone }> = {
  ligacao: { label: "Ligação", icon: Phone },
  visita: { label: "Visita", icon: MapPin },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  manutencao: { label: "Manutenção", icon: Wrench },
  peca_vendida: { label: "Peça vendida", icon: Package },
  indicacao_pedida: { label: "Indicação pedida", icon: Users },
  ideia_ia: { label: "Ideia da IA", icon: Sparkles },
  entrega_tecnica: { label: "Entrega técnica", icon: ClipboardCheck },
  marco_30d: { label: "Marco de 30 dias", icon: CalendarClock },
  marco_60d: { label: "Marco de 60 dias", icon: CalendarClock },
  marco_180d: { label: "Marco de 6 meses", icon: CalendarClock },
  marco_365d: { label: "Marco de 1 ano", icon: CalendarClock },
  outro: { label: "Outro", icon: HeartHandshake },
};

function urgencia(dias: number | null): { tom: "red" | "yellow" | "green" | "slate"; label: string } {
  if (dias == null) return { tom: "slate", label: "sem registro" };
  if (dias >= 120) return { tom: "red", label: `${dias} dias sem contato` };
  if (dias >= 60) return { tom: "yellow", label: `${dias} dias sem contato` };
  return { tom: "green", label: `${dias} dias sem contato` };
}

export type { ItemLista as ItemPosVendaModal };
export function PosVendaModal({ item, onClose }: { item: ItemLista; onClose: () => void }) {
  const [contatos, setContatos] = useState<Contato[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tipo, setTipo] = useState("ligacao");
  const [nota, setNota] = useState("");
  const [salvando, startSalvar] = useTransition();
  const [ideias, setIdeias] = useState<string | null>(null);
  const [gerando, startGerar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [entregaFeita, setEntregaFeita] = useState(item.entregaTecnica);
  const [marcoFeito, setMarcoFeito] = useState(false);

  useEffect(() => {
    listarContatosPosVenda(item.clienteId).then((c) => { setContatos(c); setCarregando(false); });
  }, [item.clienteId]);

  function salvarContato() {
    if (!nota.trim()) return;
    startSalvar(async () => {
      await registrarContatoPosVenda(item.clienteId, tipo, nota);
      const atualizado = await listarContatosPosVenda(item.clienteId);
      setContatos(atualizado);
      setNota("");
    });
  }

  function marcarEntregaTecnica() {
    startSalvar(async () => {
      await registrarContatoPosVenda(item.clienteId, "entrega_tecnica", "Entrega técnica realizada.");
      const atualizado = await listarContatosPosVenda(item.clienteId);
      setContatos(atualizado);
      setEntregaFeita(true);
    });
  }

  function marcarMarcoComoFeito() {
    if (!item.marcoPendente) return;
    startSalvar(async () => {
      await registrarContatoPosVenda(item.clienteId, item.marcoPendente!.tipo, `Marco de ${item.marcoPendente!.label} cumprido.`);
      const atualizado = await listarContatosPosVenda(item.clienteId);
      setContatos(atualizado);
      setMarcoFeito(true);
    });
  }

  function gerarIdeias() {
    setErro(null);
    startGerar(async () => {
      const r = await gerarIdeiasPosVendaAction(item.clienteId);
      if (!r.ok || !r.ideias) { setErro(r.erro ?? "Não foi possível gerar agora."); return; }
      setIdeias(r.ideias);
    });
  }

  function salvarIdeiasComoContato() {
    if (!ideias) return;
    startSalvar(async () => {
      await registrarContatoPosVenda(item.clienteId, "ideia_ia", ideias);
      const atualizado = await listarContatosPosVenda(item.clienteId);
      setContatos(atualizado);
      setIdeias(null);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">{item.nome}</h2>
              <Link href={`/clientes/${item.clienteId}`} className="text-xs font-semibold text-brand-600 hover:underline">ver cadastro</Link>
            </div>
            {item.municipio && <p className="text-xs text-slate-400">{item.municipio}</p>}
          </div>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {item.maquinas.length > 0 ? (
            item.maquinas.map((m) => <Badge key={m} tom="blue">{m}</Badge>)
          ) : (
            item.maquina && <Badge tom="blue">{item.maquina}</Badge>
          )}
          {item.dataCompra && <Badge tom="slate">Faturado em {formatDate(item.dataCompra)}</Badge>}
          <Badge tom={urgencia(item.diasSemContato).tom}>{urgencia(item.diasSemContato).label}</Badge>
          {entregaFeita ? (
            <Badge tom="green">Entrega técnica feita</Badge>
          ) : (
            <button
              onClick={marcarEntregaTecnica}
              disabled={salvando}
              className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-60"
            >
              Marcar entrega técnica
            </button>
          )}
        </div>

        {item.marcoPendente && !marcoFeito && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <CalendarClock size={15} /> Marco de {item.marcoPendente.label} pendente
            </div>
            <button
              onClick={marcarMarcoComoFeito}
              disabled={salvando}
              className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Marcar como feito
            </button>
          </div>
        )}

        <div className="mb-4">
          <button
            onClick={gerarIdeias}
            disabled={gerando}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Sparkles size={13} />
            {gerando
              ? "Gerando…"
              : item.marcoPendente && !marcoFeito
              ? `Gerar mensagem do marco de ${item.marcoPendente.label}`
              : "Gerar ideias de pós-venda com IA"}
          </button>
          {erro && <p className="mt-2 text-xs font-semibold text-red-600">{erro}</p>}
          {ideias && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{ideias}</p>
              <button onClick={salvarIdeiasComoContato} disabled={salvando} className="mt-2 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-60">
                Salvar como registro de contato
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 p-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Registrar contato</label>
          <div className="flex flex-wrap gap-2">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              {Object.entries(TIPO_LABEL).filter(([k]) => k !== "ideia_ia").map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="O que foi conversado/feito?"
            className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <button
            onClick={salvarContato}
            disabled={salvando || !nota.trim()}
            className="mt-2 flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus size={13} /> Registrar
          </button>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico</div>
          {carregando ? (
            <p className="text-sm text-slate-400">Carregando…</p>
          ) : !contatos?.length ? (
            <p className="text-sm text-slate-400">Nenhum contato pós-venda registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {contatos.map((c) => {
                const info = TIPO_LABEL[c.tipo] ?? TIPO_LABEL.outro;
                const Icon = info.icon;
                return (
                  <div key={c.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                    <Icon size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-slate-600">{info.label}</span>
                        <span>{formatDate(c.data)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-slate-700">{c.nota}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PosVendaClient({ clientes }: { clientes: ItemLista[] }) {
  const [aberto, setAberto] = useState<ItemLista | null>(null);

  if (!clientes.length) {
    return (
      <EmptyState
        icone={<HeartHandshake size={28} />}
        texto="Nenhum cliente pós-venda ainda"
        subtexto="Assim que uma negociação for faturada (coluna FATURADO, com data de faturamento), o cliente aparece aqui para acompanhamento."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clientes.map((c) => {
          const u = urgencia(c.diasSemContato);
          return (
            <button key={c.clienteId} onClick={() => setAberto(c)} className="text-left">
              <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-800">{c.nome}</div>
                    {c.municipio && <div className="text-xs text-slate-400">{c.municipio}</div>}
                  </div>
                  <Badge tom={u.tom}>{u.label}</Badge>
                </div>
                {c.maquina && <div className="mb-1 text-sm text-slate-600">{c.maquina}</div>}
                {c.dataCompra && <div className="text-xs text-slate-400">Faturado em {formatDate(c.dataCompra)}</div>}
                {c.marcoPendente && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <CalendarClock size={13} /> Marco de {c.marcoPendente.label} pendente
                  </div>
                )}
              </Card>
            </button>
          );
        })}
      </div>

      {aberto && <PosVendaModal item={aberto} onClose={() => setAberto(null)} />}
    </>
  );
}
