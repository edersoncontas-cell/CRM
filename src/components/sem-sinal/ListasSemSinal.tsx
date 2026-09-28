"use client";

import { useMemo, useState } from "react";
import { Phone, Check, X, CalendarPlus, Handshake, Search, CloudOff, AlertTriangle, CheckCircle2, RotateCcw, Trash2, Loader2 } from "lucide-react";
import {
  agruparVisitas, buscarClientes, negociacoesPorColuna, horaBrasilia, rotuloDia, diaBrasilia, formatarReais, descreverOperacao,
  type VisitaVista, type ClienteVista, type NegociacaoVista, type ColunaPacote, type RegistroFila, type Sincronia,
} from "@/lib/sem-sinal-regra";
import { campo } from "@/components/sem-sinal/SeletorClienteSemSinal";
import type { ClienteEscolhido } from "@/components/sem-sinal/SeletorClienteSemSinal";

// Lista dentro de card: altura travada com rolagem interna (ele usa na rua,
// no celular — lista solta empurraria o resto da tela para longe).
const rolagem = "max-h-[28rem] overflow-y-auto";
const cartao = "rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm";

export function SeloSincronia({ sync }: { sync: Sincronia }) {
  if (sync === "pendente") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"><CloudOff size={11} /> esperando sinal</span>;
  }
  if (sync === "erro") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700"><AlertTriangle size={11} /> não subiu</span>;
  }
  return null;
}

function SeloStatus({ status }: { status: string }) {
  if (status === "realizada") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">feita</span>;
  if (status === "nao_realizada") return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">não aconteceu</span>;
  return null;
}

function Vazio({ texto, sub, acao }: { texto: string; sub?: string; acao?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center">
      <p className="font-semibold text-slate-600">{texto}</p>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

// ── Visitas ─────────────────────────────────────────────────────────────────

function ItemVisita({
  v, mostrarDia, hoje, onConcluir,
}: {
  v: VisitaVista;
  mostrarDia: boolean;
  hoje: string;
  onConcluir: (v: VisitaVista, feita: boolean, relato: string) => Promise<void>;
}) {
  const [respondendo, setRespondendo] = useState<null | boolean>(null);
  const [relato, setRelato] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    if (respondendo === null) return;
    setSalvando(true);
    setErro(null);
    try {
      await onConcluir(v, respondendo, relato.trim());
      setRespondendo(null);
      setRelato("");
    } catch (e) {
      setErro(`Não guardou no aparelho: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="w-12 shrink-0 pt-0.5 text-sm font-bold tabular-nums text-slate-900">{horaBrasilia(v.data)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0 break-words font-semibold text-slate-900">{v.clienteNome}</span>
            <SeloStatus status={v.status} />
            <SeloSincronia sync={v.sync} />
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {mostrarDia && <>{rotuloDia(diaBrasilia(v.data), hoje)} · </>}
            {v.cidade ?? "sem cidade"}
          </div>
          {v.observacao && <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-slate-600">{v.observacao}</p>}
          {v.relatoPendente && <p className="mt-1 text-xs italic text-slate-600">Relato: “{v.relatoPendente}”</p>}
        </div>
      </div>
      {/* Botões na largura inteira do cartão: embaixo só do nome, no celular
          o "Não aconteceu" caía para uma segunda linha. */}
      {respondendo === null && (
        <div className="mt-2 flex flex-wrap gap-1.5 sm:pl-[3.75rem]">
          {v.telefone && (
            <a href={`tel:${v.telefone}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
              <Phone size={13} /> Ligar
            </a>
          )}
          {v.status === "agendada" && (
            <>
              <button type="button" onClick={() => setRespondendo(true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white">
                <Check size={13} /> Feita
              </button>
              <button type="button" onClick={() => setRespondendo(false)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                <X size={13} /> Não aconteceu
              </button>
            </>
          )}
        </div>
      )}
      {respondendo !== null && (
        <div className="mt-2 rounded-xl bg-slate-50 p-3">
          <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor={`relato-${v.id}`}>
            {respondendo ? "Como foi? (opcional)" : "O que houve? (opcional)"}
          </label>
          <textarea
            id={`relato-${v.id}`}
            className={campo}
            rows={3}
            value={relato}
            onChange={(e) => setRelato(e.target.value)}
            placeholder={respondendo ? "Ex.: gostou da B95B, pediu proposta, volto dia 10" : "Ex.: cliente viajou, remarcar para sexta"}
          />
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Quando o sinal voltar, a IA lê o relato e atualiza a negociação — igual ao lembrete das visitas do dia.
          </p>
          {erro && <p className="mt-1 text-xs font-semibold text-red-600">{erro}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
              {salvando && <Loader2 size={13} className="animate-spin" />}
              {respondendo ? "Marcar como feita" : "Marcar que não aconteceu"}
            </button>
            <button type="button" onClick={() => { setRespondendo(null); setErro(null); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function VisitasSemSinal({
  visitas, hoje, onConcluir, onAgendar,
}: {
  visitas: VisitaVista[];
  hoje: string;
  onConcluir: (v: VisitaVista, feita: boolean, relato: string) => Promise<void>;
  onAgendar: () => void;
}) {
  const g = useMemo(() => agruparVisitas(visitas, hoje), [visitas, hoje]);
  if (!visitas.length) {
    return (
      <Vazio
        texto="Nenhuma visita guardada"
        sub="O aparelho guarda as visitas de 60 dias atrás até 6 meses à frente."
        acao={<button type="button" onClick={onAgendar} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Agendar visita</button>}
      />
    );
  }
  return (
    <div className="space-y-3">
      {g.semResposta.length > 0 && (
        <section className={`${cartao} border-amber-300`}>
          <header className="border-b border-amber-100 bg-amber-50 px-4 py-2.5">
            <h3 className="text-sm font-bold text-amber-900">Passaram sem resposta ({g.semResposta.length})</h3>
            <p className="text-xs text-amber-800">Diga se aconteceram — a meta de visitas conta só as feitas.</p>
          </header>
          <ul className={`divide-y divide-slate-100 ${rolagem}`}>
            {g.semResposta.map((v) => <ItemVisita key={v.id} v={v} mostrarDia hoje={hoje} onConcluir={onConcluir} />)}
          </ul>
        </section>
      )}
      {g.proximas.length === 0 && (
        <Vazio texto="Nada agendado de hoje em diante" acao={<button type="button" onClick={onAgendar} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Agendar visita</button>} />
      )}
      {g.proximas.map((grupo) => (
        <section key={grupo.dia} className={cartao}>
          <header className="flex items-baseline justify-between border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-bold text-slate-900">{grupo.rotulo}</h3>
            <span className="text-xs text-slate-500">{grupo.visitas.length} {grupo.visitas.length === 1 ? "visita" : "visitas"}</span>
          </header>
          <ul className={`divide-y divide-slate-100 ${rolagem}`}>
            {grupo.visitas.map((v) => <ItemVisita key={v.id} v={v} mostrarDia={false} hoje={hoje} onConcluir={onConcluir} />)}
          </ul>
        </section>
      ))}
      {g.anteriores.length > 0 && (
        <details className={cartao}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Anteriores já respondidas ({g.anteriores.length})</summary>
          <ul className={`divide-y divide-slate-100 border-t border-slate-100 ${rolagem}`}>
            {g.anteriores.map((v) => <ItemVisita key={v.id} v={v} mostrarDia hoje={hoje} onConcluir={onConcluir} />)}
          </ul>
        </details>
      )}
    </div>
  );
}

// ── Clientes ────────────────────────────────────────────────────────────────

/** Quantos aparecem antes de ele escrever na busca. */
const SEM_BUSCA = 60;

export function ClientesSemSinal({
  clientes, total, onVisita, onNegociacao,
}: {
  clientes: ClienteVista[];
  total: number;
  onVisita: (c: ClienteEscolhido) => void;
  onNegociacao: (c: ClienteEscolhido) => void;
}) {
  const [termo, setTermo] = useState("");
  const buscando = termo.trim().length > 0;
  // Sem nada escrito, a lista já aparece (em ordem alfabética): só a caixa de
  // busca parecia aba vazia — "os clientes não apareceram".
  const emOrdem = useMemo(() => [...clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [clientes]);
  const achados = useMemo(
    () => (buscando ? buscarClientes(clientes, termo, 40) : { itens: emOrdem.slice(0, SEM_BUSCA), total: emOrdem.length }),
    [buscando, clientes, emOrdem, termo],
  );
  const escolhido = (c: ClienteVista): ClienteEscolhido => ({ id: c.id, nome: c.nome, telefone: c.telefone, municipio: c.municipio });
  return (
    <section className={`${cartao} p-4`}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${campo} pl-9`} value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar por nome, cidade ou telefone" aria-label="Buscar cliente" />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {clientes.length.toLocaleString("pt-BR")} clientes guardados neste aparelho
        {total > clientes.length && <> (de {total.toLocaleString("pt-BR")} no CRM — os demais só com internet)</>}.
      </p>
      {achados.total === 0 ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          {buscando ? <>Ninguém com “{termo.trim()}” no que está guardado.</> : "Nenhum cliente guardado neste aparelho."}
        </p>
      ) : (
        <>
          <ul className={`mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 ${rolagem}`}>
            {achados.itens.map((c) => (
              <li key={c.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="break-words font-semibold text-slate-900">{c.nome}</span>
                  <SeloSincronia sync={c.sync} />
                </div>
                <div className="text-xs text-slate-500">{[c.municipio, c.telefone].filter(Boolean).join(" · ") || "sem cidade e telefone"}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.telefone && (
                    <a href={`tel:${c.telefone}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><Phone size={13} /> Ligar</a>
                  )}
                  <button type="button" onClick={() => onVisita(escolhido(c))} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><CalendarPlus size={13} /> Visita</button>
                  <button type="button" onClick={() => onNegociacao(escolhido(c))} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700"><Handshake size={13} /> Negociação</button>
                </div>
              </li>
            ))}
          </ul>
          {achados.total > achados.itens.length && (
            <p className="mt-2 text-xs text-slate-500">
              Mostrando {achados.itens.length} de {achados.total.toLocaleString("pt-BR")}{buscando ? "" : " em ordem alfabética"}. Escreva {buscando ? "mais " : ""}para achar{buscando ? "" : " os demais"}.
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ── Funil ───────────────────────────────────────────────────────────────────

export function FunilSemSinal({ negociacoes, colunas, onNova }: { negociacoes: NegociacaoVista[]; colunas: ColunaPacote[]; onNova: () => void }) {
  const grupos = useMemo(() => negociacoesPorColuna(negociacoes, colunas), [negociacoes, colunas]);
  if (!negociacoes.length) {
    return <Vazio texto="Nenhuma negociação aberta guardada" acao={<button type="button" onClick={onNova} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Nova negociação</button>} />;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {grupos.map((g) => (
        <section key={g.titulo} className={cartao}>
          <header className="flex items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <h3 className="min-w-0 truncate text-sm font-bold text-slate-900">{g.titulo}</h3>
            <span className="shrink-0 text-xs text-slate-500">{g.negociacoes.length} · {formatarReais(g.total)}</span>
          </header>
          {g.negociacoes.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400">Vazia.</p>
          ) : (
            <ul className={`divide-y divide-slate-100 ${rolagem}`}>
              {g.negociacoes.map((n) => (
                <li key={n.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words font-semibold text-slate-900">{n.clienteNome}</span>
                    <SeloSincronia sync={n.sync} />
                  </div>
                  <div className="text-xs text-slate-600">
                    {[n.marca, n.maquinaModelo].filter(Boolean).join(" ") || "máquina não informada"} · {formatarReais(n.valor)}
                  </div>
                  {n.proximaAcao && <div className="mt-0.5 text-xs text-slate-500">Próxima ação: {n.proximaAcao}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

// ── Pendentes ───────────────────────────────────────────────────────────────

function quando(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function PendentesSemSinal({
  fila, onTentar, onDescartar,
}: {
  fila: RegistroFila[];
  onTentar: (r: RegistroFila) => void;
  onDescartar: (r: RegistroFila) => void;
}) {
  const ordenada = useMemo(() => [...fila].sort((a, b) => b.op.criadaEm.localeCompare(a.op.criadaEm)), [fila]);
  if (!ordenada.length) {
    return <Vazio texto="Nada esperando para subir" sub="Tudo o que foi feito neste aparelho já está no CRM." />;
  }
  return (
    <section className={cartao}>
      <ul className={`divide-y divide-slate-100 ${rolagem}`}>
        {ordenada.map((r) => (
          <li key={r.op.id} className="px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0">
                {r.estado === "enviado" ? <CheckCircle2 size={17} className="text-emerald-600" />
                  : r.estado === "erro" ? <AlertTriangle size={17} className="text-red-600" />
                  : <CloudOff size={17} className="text-amber-600" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="break-words text-sm font-semibold text-slate-900">{descreverOperacao(r.op)}</div>
                <div className="text-xs text-slate-500">
                  Feito em {quando(r.op.criadaEm)} ·{" "}
                  {r.estado === "enviado" ? <span className="font-semibold text-emerald-700">subiu para o CRM</span>
                    : r.estado === "erro" ? <span className="font-semibold text-red-700">não subiu</span>
                    : <span className="font-semibold text-amber-700">esperando sinal{r.tentativas > 0 ? ` (${r.tentativas} tentativa${r.tentativas > 1 ? "s" : ""})` : ""}</span>}
                </div>
                {r.estado === "erro" && r.erro && <p className="mt-1 break-words rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">Motivo: {r.erro.replace(/\.+$/, "")}.</p>}
                {r.estado === "pendente" && r.erro && <p className="mt-1 break-words text-xs text-slate-500">Última tentativa: {r.erro.replace(/\.+$/, "")}.</p>}
                {r.estado === "enviado" && r.aviso && <p className="mt-1 break-words text-xs text-slate-600">{r.aviso}</p>}
                {r.estado === "erro" && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => onTentar(r)} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white"><RotateCcw size={13} /> Tentar de novo</button>
                    <button type="button" onClick={() => onDescartar(r)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={13} /> Descartar</button>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
