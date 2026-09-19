"use client";

// Painéis da Central Inteligente: o relatório do fim do dia, o radar de
// inovação e a memória do Cérebro (ensinar e procurar). Cada painel fala com
// as ações de servidor em lib/cerebro/acoes.ts.

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText, Send, RefreshCw, Loader2, Radar, Check, X, Lightbulb, BookOpen, Search, Trash2, ExternalLink, Sparkles, ChevronDown,
} from "lucide-react";
import {
  gerarRelatorioHojeAction, enviarRelatorioHojeAction, rodarRadarAction, definirStatusIdeiaAction,
  ensinarCerebroAction, buscarMemoriasAction, esquecerMemoriaAction, type Memoria,
} from "@/lib/cerebro/acoes";
import type { RelatorioGerado } from "@/lib/cerebro/relatorio-diario";
import type { IdeiaRadar } from "@/lib/cerebro/radar";
import { SESSOES } from "@/lib/cerebro/sessoes";

const painel = { background: "#111a24", border: "1px solid #1e2a36" } as const;
const campo = "w-full rounded-xl bg-[#0b1119] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600";

function Cabecalho({ icone, titulo, sub, acao }: { icone: React.ReactNode; titulo: string; sub?: string; acao?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <div className="mt-0.5 shrink-0">{icone}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-black text-white">{titulo}</div>
        {sub && <div className="text-[11px] leading-snug text-slate-500">{sub}</div>}
      </div>
      {acao}
    </div>
  );
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

// ── Relatório do fim do dia ────────────────────────────────────────────────
export function PainelRelatorio({ inicial }: { inicial: RelatorioGerado[] }) {
  const [relatorios, setRelatorios] = useState(inicial);
  const [aberto, setAberto] = useState<string | null>(inicial[0]?.id ?? null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, start] = useTransition();

  function gerar() {
    setAviso(null);
    start(async () => {
      const r = await gerarRelatorioHojeAction();
      if (!r.ok || !r.relatorio) { setAviso({ tipo: "erro", texto: r.erro ?? "Não consegui gerar agora." }); return; }
      setRelatorios((lista) => [r.relatorio!, ...lista.filter((x) => x.dia !== r.relatorio!.dia)]);
      setAberto(r.relatorio.id);
      setAviso({ tipo: "ok", texto: `Relatório de hoje pronto: ${r.relatorio.negociacoes} conversa(s) de negociação.` });
    });
  }

  function enviar() {
    setAviso(null);
    start(async () => {
      const r = await enviarRelatorioHojeAction();
      setAviso(r.ok ? { tipo: "ok", texto: "Relatório enviado para o seu WhatsApp." } : { tipo: "erro", texto: r.erro ?? "Não consegui enviar." });
    });
  }

  const atual = relatorios.find((r) => r.id === aberto) ?? relatorios[0] ?? null;

  return (
    <section className="rounded-2xl p-4" style={painel}>
      <Cabecalho
        icone={<FileText size={18} style={{ color: "#ffcb2d" }} />}
        titulo="Relatório do fim do dia"
        sub="Só conversa em que houve negociação de verdade: máquina, modelo, financiamento. Papo informal fica de fora."
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={gerar} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-[#ffcb2d] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-60">
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Gerar o de hoje
        </button>
        <button onClick={enviar} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-60" style={{ background: "rgba(255,255,255,0.07)" }}>
          <Send size={14} /> Mandar no meu WhatsApp
        </button>
      </div>

      {aviso && (
        <p className={`mb-3 rounded-xl px-3 py-2 text-xs ${aviso.tipo === "ok" ? "text-emerald-300" : "text-red-300"}`} style={{ background: aviso.tipo === "ok" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)" }}>
          {aviso.texto}
        </p>
      )}

      {relatorios.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {relatorios.slice(0, 10).map((r) => (
            <button
              key={r.id}
              onClick={() => setAberto(r.id)}
              className={`rounded-lg px-2 py-1 text-[11px] font-bold ${r.id === atual?.id ? "text-black" : "text-slate-300"}`}
              style={{ background: r.id === atual?.id ? "#ffcb2d" : "rgba(255,255,255,0.06)" }}
            >
              {dataCurta(r.dia)}
            </button>
          ))}
        </div>
      )}

      {!atual ? (
        <p className="text-xs text-slate-500">Nenhum relatório ainda. O Cérebro gera sozinho no fim do dia — ou clique em “Gerar o de hoje”.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              { rotulo: "Negociações", valor: atual.negociacoes, cor: "#ffcb2d" },
              { rotulo: "Contatos novos", valor: atual.novos, cor: "#34d399" },
              { rotulo: "Da carteira", valor: atual.carteira, cor: "#38bdf8" },
            ].map((k) => (
              <div key={k.rotulo} className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="text-xl font-black tabular-nums" style={{ color: k.cor }}>{k.valor}</div>
                <div className="text-[10px] leading-tight text-slate-500">{k.rotulo}</div>
              </div>
            ))}
          </div>

          {atual.detalhes.negocio.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {atual.detalhes.negocio.map((c, i) => (
                <li key={`${c.conversaId}-${i}`} className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black ${c.novo ? "bg-emerald-400/20 text-emerald-300" : "bg-sky-400/20 text-sky-300"}`}>
                    {c.novo ? "NOVO" : "CARTEIRA"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-slate-100">{c.nome}</span>
                    {c.municipio && <span className="text-slate-500"> · {c.municipio}</span>}
                    <span className="block text-slate-400">
                      {[c.maquina, c.financiamento ? "financiamento" : null].filter(Boolean).join(" · ") || c.motivo}
                    </span>
                  </span>
                  {c.clienteId && (
                    <Link href={`/clientes/${c.clienteId}`} className="shrink-0 text-slate-500 hover:text-white" title="Abrir o cliente">
                      <ExternalLink size={13} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white">
              <ChevronDown size={13} className="transition group-open:rotate-180" /> Texto que vai para o WhatsApp
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl p-3 text-[11px] leading-relaxed text-slate-300" style={{ background: "#0b1119" }}>{atual.resumo}</pre>
          </details>
        </>
      )}
    </section>
  );
}

// ── Radar de inovação ──────────────────────────────────────────────────────
const COR_ESFORCO: Record<string, string> = { baixo: "#34d399", medio: "#ffcb2d", alto: "#fb923c" };

export function PainelRadar({ inicial }: { inicial: IdeiaRadar[] }) {
  const [ideias, setIdeias] = useState(inicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, start] = useTransition();

  function rodar() {
    setAviso(null);
    start(async () => {
      const r = await rodarRadarAction();
      if (!r.ok) { setAviso(r.erro ?? "A pesquisa não voltou nada desta vez."); return; }
      setAviso(r.novas ? `${r.novas} ideia(s) nova(s).` : "Nada novo desta vez — o que existia já estava na lista.");
      if (r.novas) location.reload();
    });
  }

  function marcar(id: string, status: IdeiaRadar["status"]) {
    setIdeias((lista) => lista.map((i) => (i.id === id ? { ...i, status } : i)));
    void definirStatusIdeiaAction(id, status);
  }

  const visiveis = ideias.filter((i) => i.status !== "descartada");

  return (
    <section className="rounded-2xl p-4" style={painel}>
      <Cabecalho
        icone={<Radar size={18} style={{ color: "#38bdf8" }} />}
        titulo="Radar de inovação"
        sub="Toda noite o Cérebro procura no mundo o que pode deixar cada sessão melhor, e traz a melhoria, o ganho e o esforço."
        acao={
          <button onClick={rodar} disabled={ocupado} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-60" style={{ background: "rgba(255,255,255,0.07)" }}>
            {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Procurar agora
          </button>
        }
      />
      {aviso && <p className="mb-2 text-[11px] text-slate-400">{aviso}</p>}
      {visiveis.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhuma ideia ainda. A pesquisa roda sozinha no fim do dia.</p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((i) => (
            <li key={i.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", borderLeft: `3px solid ${COR_ESFORCO[i.esforco] ?? "#ffcb2d"}` }}>
              <div className="flex items-start gap-2">
                <Lightbulb size={14} className="mt-0.5 shrink-0" style={{ color: COR_ESFORCO[i.esforco] ?? "#ffcb2d" }} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-white">{i.titulo}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {i.sessaoNome} · esforço {i.esforco} {i.status === "aplicar" && <span className="text-emerald-400">· marcada para aplicar</span>}
                    {i.status === "aplicada" && <span className="text-emerald-400">· aplicada</span>}
                  </div>
                </div>
                {i.status === "nova" && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => marcar(i.id, "aplicar")} title="Quero esta" className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-400/10"><Check size={14} /></button>
                    <button onClick={() => marcar(i.id, "descartada")} title="Não interessa" className="rounded-lg p-1 text-slate-500 hover:bg-white/5"><X size={14} /></button>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{i.melhoria}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400"><b className="text-slate-300">Ganho:</b> {i.beneficio} {i.ganho && <span className="text-slate-500">({i.ganho})</span>}</p>
              {i.fonte && (
                <a href={i.fonte} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] text-sky-400 hover:underline">
                  fonte <ExternalLink size={10} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Memória do Cérebro ─────────────────────────────────────────────────────
export function PainelMemoria({ inicial }: { inicial: Memoria[] }) {
  const [memorias, setMemorias] = useState(inicial);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [sessao, setSessao] = useState("");
  const [termo, setTermo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, start] = useTransition();

  function ensinar() {
    setAviso(null);
    start(async () => {
      const r = await ensinarCerebroAction({ titulo, conteudo, sessao: sessao || null });
      if (!r.ok || !r.memoria) { setAviso(r.erro ?? "Não consegui guardar."); return; }
      setMemorias((m) => [r.memoria!, ...m]);
      setTitulo(""); setConteudo(""); setSessao("");
      setAviso("Guardado. O Cérebro passa a usar isso nas análises e no chat.");
    });
  }

  function buscar() {
    start(async () => { setMemorias(await buscarMemoriasAction(termo)); });
  }

  function esquecer(id: string) {
    setMemorias((m) => m.filter((x) => x.id !== id));
    void esquecerMemoriaAction(id);
  }

  return (
    <section className="rounded-2xl p-4" style={painel}>
      <Cabecalho
        icone={<BookOpen size={18} style={{ color: "#a78bfa" }} />}
        titulo="Ensinar algo novo ao Cérebro"
        sub="Cole aqui o que ele precisa saber: condição do banco, regra da concessionária, jeito de tratar um cliente."
      />
      <div className="space-y-2">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className={campo} />
        <textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={3} placeholder="O que o Cérebro precisa saber…" className={`${campo} resize-y`} />
        <div className="flex flex-wrap gap-2">
          <select value={sessao} onChange={(e) => setSessao(e.target.value)} className={`${campo} max-w-[220px]`}>
            <option value="">Vale para o CRM inteiro</option>
            {SESSOES.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <button onClick={ensinar} disabled={ocupado || !conteudo.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#a78bfa] px-3 py-2 text-xs font-bold text-black disabled:opacity-50">
            {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Ensinar
          </button>
        </div>
      </div>
      {aviso && <p className="mt-2 text-[11px] text-slate-400">{aviso}</p>}

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
            placeholder="Procurar memórias — título ou trecho…"
            className={`${campo} pl-9`}
          />
        </div>
        <button onClick={buscar} disabled={ocupado} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-60" style={{ background: "rgba(255,255,255,0.07)" }}>Buscar</button>
      </div>

      <ul className="mt-3 space-y-2">
        {memorias.length === 0 && <li className="text-xs text-slate-500">Nada guardado ainda.</li>}
        {memorias.map((m) => (
          <li key={m.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-slate-100">{m.titulo}</div>
                <div className="text-[10px] text-slate-500">
                  {dataCurta(m.criadoEm)}{m.sessao ? ` · ${SESSOES.find((s) => s.id === m.sessao)?.nome ?? m.sessao}` : ""}
                </div>
              </div>
              <button onClick={() => esquecer(m.id)} title="Esquecer" className="shrink-0 rounded-lg p-1 text-slate-600 hover:bg-white/5 hover:text-red-400"><Trash2 size={13} /></button>
            </div>
            <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-400">{m.conteudo}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
