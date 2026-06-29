"use client";

import { useState, useTransition } from "react";
import {
  METODOLOGIAS, PERFIS_DISC, OBJECOES, FECHAMENTOS,
  PSICOLOGIA_PERSUASAO, NEUROCIENCIA_VENDAS, NEGOCIACAO_AVANCADA, SCRIPTS_WHATSAPP, DICAS_PROSPECCAO, ROTEIRO_VISITA_COMPLETO,
  type Metodologia, type PerfilCliente, type Objecao, type Fechamento,
  type PsicologiaTopico, type NeurocienciaTopico, type TecnicaNegociacao, type ScriptWhatsApp, type DicaProspeccao, type FaseVisita,
} from "@/lib/academia";
import { gerarEstrategiaAction, toggleFavoritoEstrategia, excluirEstrategia } from "@/lib/actions";
import { cn } from "@/lib/utils";
import {
  BookOpen, Users, MessageSquareWarning, Handshake, Sparkles, Star,
  Trash2, ChevronDown, ChevronRight, Lightbulb, Copy, Check, Brain, Zap, Trophy,
} from "lucide-react";

type EstrategiaRow = {
  id: string;
  titulo: string;
  categoria: string;
  perfilAlvo: string | null;
  conteudo: string;
  fonte: string;
  favorito: boolean;
  criadoEm: string;
};

type Tab = "metodologias" | "disc" | "objecoes" | "fechamentos" | "psicologia" | "neurociencia" | "negociacao" | "estrategias" | "scripts" | "prospeccao" | "roteiro";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "metodologias", label: "Metodologias", icon: BookOpen },
  { id: "disc", label: "Perfis DISC", icon: Users },
  { id: "objecoes", label: "Objeções", icon: MessageSquareWarning },
  { id: "fechamentos", label: "Fechamentos", icon: Handshake },
  { id: "psicologia", label: "Psicologia", icon: Brain },
  { id: "neurociencia", label: "Neurociência", icon: Zap },
  { id: "negociacao", label: "Negociação Elite", icon: Trophy },
  { id: "estrategias", label: "Gerador IA", icon: Sparkles },
  { id: "scripts", label: "Scripts WhatsApp", icon: MessageSquareWarning },
  { id: "prospeccao", label: "Prospecção", icon: Users },
  { id: "roteiro", label: "Roteiro de Visita", icon: Handshake },
];

const NIVEL_COR: Record<string, string> = {
  "Graduação":    "bg-slate-100 text-slate-600",
  "Pós-Graduação":"bg-blue-100 text-blue-700",
  "Mestrado":     "bg-purple-100 text-purple-700",
  "Doutorado":    "bg-amber-100 text-amber-700",
  "PHD":          "bg-red-100 text-red-700",
};

function NivelBadge({ nivel }: { nivel: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", NIVEL_COR[nivel] ?? "bg-slate-100 text-slate-600")}>
      {nivel}
    </span>
  );
}

const DISC_COR: Record<string, string> = {
  D: "bg-red-500",
  I: "bg-yellow-400",
  S: "bg-green-500",
  C: "bg-blue-500",
};
const DISC_BG: Record<string, string> = {
  D: "bg-red-50 border-red-200",
  I: "bg-yellow-50 border-yellow-200",
  S: "bg-green-50 border-green-200",
  C: "bg-blue-50 border-blue-200",
};
const DISC_TEXT: Record<string, string> = {
  D: "text-red-700",
  I: "text-yellow-700",
  S: "text-green-700",
  C: "text-blue-700",
};

export function AcademiaClient({
  estrategias: estrategiasInit,
  dicaDoDia,
}: {
  estrategias: EstrategiaRow[];
  dicaDoDia: string;
}) {
  const [aba, setAba] = useState<Tab>("metodologias");
  const [estrategias, setEstategias] = useState<EstrategiaRow[]>(estrategiasInit);

  return (
    <div className="space-y-4">
      {/* Dica do dia */}
      <div className="flex items-start gap-3 rounded-xl border border-agro-200 bg-agro-50 px-4 py-3">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-agro-600" />
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-agro-600">Dica do dia</span>
          <p className="mt-0.5 text-sm font-medium text-slate-700">{dicaDoDia}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                aba === t.id
                  ? "bg-white text-brand-700 shadow"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {aba === "metodologias" && <TabMetodologias />}
      {aba === "disc" && <TabDisc />}
      {aba === "objecoes" && <TabObjecoes />}
      {aba === "fechamentos" && <TabFechamentos />}
      {aba === "psicologia" && <TabPsicologia />}
      {aba === "neurociencia" && <TabNeurociencia />}
      {aba === "negociacao" && <TabNegociacao />}
      {aba === "estrategias" && (
        <TabEstategias
          estrategias={estrategias}
          onAdd={(e) => setEstategias((prev) => [e, ...prev])}
          onToggleFav={(id, fav) =>
            setEstategias((prev) =>
              prev.map((e) => (e.id === id ? { ...e, favorito: fav } : e))
            )
          }
          onDelete={(id) => setEstategias((prev) => prev.filter((e) => e.id !== id))}
        />
      )}
      {aba === "scripts" && <TabScripts />}
      {aba === "prospeccao" && <TabProspeccao />}
      {aba === "roteiro" && <TabRoteiro />}
    </div>
  );
}

function TabMetodologias() {
  const [aberta, setAberta] = useState<string | null>(METODOLOGIAS[0]?.nome ?? null);

  return (
    <div className="space-y-3">
      {METODOLOGIAS.map((m) => (
        <MetodologiaCard key={m.nome} m={m} aberta={aberta === m.nome} onToggle={() => setAberta(aberta === m.nome ? null : m.nome)} />
      ))}
    </div>
  );
}

function MetodologiaCard({ m, aberta, onToggle }: { m: Metodologia; aberta: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">{m.nome}</span>
            <NivelBadge nivel={m.nivel} />
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{m.origem}</div>
        </div>
        {aberta ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
      </button>
      {aberta && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <div>
            <p className="text-sm text-slate-600 leading-relaxed">{m.resumo}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
              <BookOpen size={12} />
              Quando usar: {m.quandoUsar}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Passo a passo</div>
            <div className="space-y-2">
              {m.passos.map((p, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-slate-700">{p.titulo}: </span>
                    <span className="text-sm text-slate-600">{p.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-agro-50 border border-agro-200 px-4 py-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-agro-600">Exemplo real — máquinas pesadas</div>
            <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{m.exemplo}&rdquo;</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab DISC ────────────────────────────────────────────────────────────────

function TabDisc() {
  const [sel, setSel] = useState<string>("D");
  const perfil = PERFIS_DISC.find((p) => p.letra === sel)!;

  return (
    <div className="space-y-4">
      {/* Seletor de perfil */}
      <div className="flex gap-3">
        {PERFIS_DISC.map((p) => (
          <button
            key={p.letra}
            onClick={() => setSel(p.letra)}
            className={cn(
              "flex flex-1 flex-col items-center rounded-xl border-2 px-2 py-3 transition",
              sel === p.letra ? DISC_BG[p.letra] + " " + "border-current" : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-xl font-black text-white", DISC_COR[p.letra])}>
              {p.letra}
            </span>
            <span className={cn("mt-1 text-xs font-bold", sel === p.letra ? DISC_TEXT[p.letra] : "text-slate-600")}>
              {p.nome}
            </span>
            <span className="mt-0.5 text-[10px] text-slate-400 text-center">{p.apelido.split("/")[0].trim()}</span>
          </button>
        ))}
      </div>

      {/* Detalhe do perfil */}
      <div className={cn("rounded-xl border-2 p-5 space-y-4", DISC_BG[perfil.letra])}>
        <div>
          <div className={cn("text-lg font-black", DISC_TEXT[perfil.letra])}>{perfil.nome} — {perfil.apelido}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DiscSection titulo="Como reconhecer" cor={DISC_TEXT[perfil.letra]} items={perfil.comoReconhecer} bullet="👁️" />
          <DiscSection titulo="O que valoriza" cor={DISC_TEXT[perfil.letra]} items={perfil.valoriza} bullet="⭐" />
          <DiscSection titulo="Como vender" cor={DISC_TEXT[perfil.letra]} items={perfil.comoVender} bullet="✅" />
          <DiscSection titulo="Evitar" cor={DISC_TEXT[perfil.letra]} items={perfil.evitar} bullet="❌" />
        </div>

        <div className={cn("rounded-xl bg-white/70 border px-4 py-3", "border-" + perfil.cor + "-300")}>
          <div className={cn("mb-1 text-xs font-bold uppercase tracking-wide", DISC_TEXT[perfil.letra])}>
            Técnica de fechamento ideal
          </div>
          <p className="text-sm font-medium text-slate-700 italic">&ldquo;{perfil.fechamento}&rdquo;</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">💬 WhatsApp ideal</div>
            <p className="text-sm text-slate-700 leading-relaxed">{perfil.abordagemWhatsApp}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">🔑 Palavras-chave</div>
            <div className="flex flex-wrap gap-1.5">
              {perfil.palavrasChave.map((p) => (
                <span key={p} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", DISC_BG[perfil.letra], DISC_TEXT[perfil.letra])}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscSection({ titulo, cor, items, bullet }: { titulo: string; cor: string; items: string[]; bullet: string }) {
  return (
    <div>
      <div className={cn("mb-2 text-xs font-bold uppercase tracking-wide", cor)}>{titulo}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5 text-sm text-slate-700">
            <span className="shrink-0">{bullet}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Tab Objeções ─────────────────────────────────────────────────────────────

function TabObjecoes() {
  const [copiado, setCopiado] = useState<string | null>(null);

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  return (
    <div className="space-y-3">
      {OBJECOES.map((o, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-slate-800">&ldquo;{o.objecao}&rdquo;</div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  {o.tecnica}
                </span>
                {o.nivel && <NivelBadge nivel={o.nivel} />}
              </div>
            </div>
          </div>
          <div className="relative rounded-lg bg-agro-50 px-4 py-3">
            <p className="pr-8 text-sm text-slate-700 leading-relaxed italic">{o.resposta}</p>
            <button
              onClick={() => copiar(o.resposta.replace(/^'|'$/g, ""), `obj-${i}`)}
              className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-agro-600"
              title="Copiar resposta"
            >
              {copiado === `obj-${i}` ? <Check size={14} className="text-agro-600" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab Fechamentos ──────────────────────────────────────────────────────────

function TabFechamentos() {
  const [copiado, setCopiado] = useState<string | null>(null);

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {FECHAMENTOS.map((f, i) => (
        <div key={i} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {i + 1}
            </span>
            <span className="font-bold text-slate-800">{f.nome}</span>
            <NivelBadge nivel={f.nivel} />
          </div>
          <p className="mb-2 flex-1 text-sm text-slate-600">{f.descricao}</p>
          {f.quandoUsar && (
            <p className="mb-2 text-xs text-slate-400 italic">Usar quando: {f.quandoUsar}</p>
          )}
          <div className="relative rounded-lg bg-brand-50 px-4 py-3">
            <p className="pr-8 text-sm italic text-brand-800 font-medium">&ldquo;{f.exemplo}&rdquo;</p>
            <button
              onClick={() => copiar(f.exemplo.replace(/^"|"$/g, ""), `fech-${i}`)}
              className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-brand-600"
              title="Copiar frase"
            >
              {copiado === `fech-${i}` ? <Check size={14} className="text-brand-600" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab Psicologia da Persuasão ─────────────────────────────────────────────

function TabPsicologia() {
  const [aberta, setAberta] = useState<string | null>(PSICOLOGIA_PERSUASAO[0]?.nome ?? null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 leading-relaxed">
        A ciência da persuasão aplicada a vendas de alto valor. Entenda como o cérebro do cliente toma decisões e use esse conhecimento com ética para aumentar suas conversões.
      </p>
      {PSICOLOGIA_PERSUASAO.map((p) => (
        <PsicologiaCard key={p.nome} p={p} aberta={aberta === p.nome} onToggle={() => setAberta(aberta === p.nome ? null : p.nome)} />
      ))}
    </div>
  );
}

function PsicologiaCard({ p, aberta, onToggle }: { p: PsicologiaTopico; aberta: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50">
        <div className="flex items-center gap-3">
          <Brain size={18} className="shrink-0 text-purple-500" />
          <div>
            <div className="font-bold text-slate-800">{p.nome}</div>
            <NivelBadge nivel={p.nivel} />
          </div>
        </div>
        {aberta ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
      </button>
      {aberta && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{p.principio}</p>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Como aplicar</div>
            <ul className="space-y-2">
              {p.comoAplicar.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-purple-700">Exemplo prático</div>
            <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{p.exemplo}&rdquo;</p>
          </div>
          {p.atencao && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">⚠️ Atenção</div>
              <p className="text-sm text-slate-700 leading-relaxed">{p.atencao}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab Neurociência ─────────────────────────────────────────────────────────

function TabNeurociencia() {
  const [aberta, setAberta] = useState<string | null>(NEUROCIENCIA_VENDAS[0]?.vies ?? null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 leading-relaxed">
        Como os vieses cognitivos do cliente influenciam a decisão de comprar uma escavadeira ou compactador — e como usar isso a seu favor eticamente.
      </p>
      {NEUROCIENCIA_VENDAS.map((n) => (
        <NeurocienciaCard key={n.vies} n={n} aberta={aberta === n.vies} onToggle={() => setAberta(aberta === n.vies ? null : n.vies)} />
      ))}
    </div>
  );
}

function NeurocienciaCard({ n, aberta, onToggle }: { n: NeurocienciaTopico; aberta: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50">
        <div className="flex items-center gap-3">
          <Zap size={18} className="shrink-0 text-amber-500" />
          <div>
            <div className="font-bold text-slate-800">{n.vies}</div>
            <NivelBadge nivel={n.nivel} />
          </div>
        </div>
        {aberta ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
      </button>
      {aberta && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{n.comoFunciona}</p>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Aplicação prática</div>
            <ul className="space-y-2">
              {n.aplicacao.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">Exemplo real</div>
            <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{n.exemplo}&rdquo;</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Negociação Elite ─────────────────────────────────────────────────────

function TabNegociacao() {
  const [aberta, setAberta] = useState<string | null>(NEGOCIACAO_AVANCADA[0]?.nome ?? null);
  const [copiado, setCopiado] = useState<string | null>(null);

  function copiar(texto: string, id: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 leading-relaxed">
        Técnicas de negociação de elite — do FBI (Chris Voss) e Harvard. PHD em fechar negócio e defender seu preço com inteligência.
      </p>
      {NEGOCIACAO_AVANCADA.map((n, i) => (
        <NegociacaoCard
          key={n.nome}
          n={n}
          idx={i}
          aberta={aberta === n.nome}
          onToggle={() => setAberta(aberta === n.nome ? null : n.nome)}
          copiado={copiado}
          onCopiar={(txt) => copiar(txt, `neg-${i}`)}
          copiadoId={`neg-${i}`}
        />
      ))}
    </div>
  );
}

function NegociacaoCard({
  n, idx, aberta, onToggle, copiado, onCopiar, copiadoId,
}: {
  n: TecnicaNegociacao; idx: number; aberta: boolean; onToggle: () => void;
  copiado: string | null; onCopiar: (txt: string) => void; copiadoId: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">{idx + 1}</span>
          <div>
            <div className="font-bold text-slate-800">{n.nome}</div>
            <div className="text-xs text-slate-400">{n.autor}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NivelBadge nivel={n.nivel} />
          {aberta ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </div>
      </button>
      {aberta && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{n.principio}</p>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Passo a passo</div>
            <div className="space-y-2">
              {n.passos.map((passo, i) => (
                <div key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">{i + 1}</span>
                  <p className="text-sm text-slate-700">{passo}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-red-700">Exemplo em máquinas pesadas</div>
            <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{n.exemplo}&rdquo;</p>
          </div>
          {n.frasePoder && (
            <div className="relative rounded-xl bg-slate-900 px-4 py-3">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-agro-400">⚡ Frase-poder</div>
              <p className="pr-8 text-sm font-medium text-white">{n.frasePoder}</p>
              <button
                onClick={() => onCopiar(n.frasePoder!)}
                className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-agro-400"
                title="Copiar frase"
              >
                {copiado === copiadoId ? <Check size={14} className="text-agro-400" /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab Gerador de Estratégias ───────────────────────────────────────────────

function TabEstategias({
  estrategias,
  onAdd,
  onToggleFav,
  onDelete,
}: {
  estrategias: EstrategiaRow[];
  onAdd: (e: EstrategiaRow) => void;
  onToggleFav: (id: string, fav: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [tema, setTema] = useState("");
  const [perfil, setPerfil] = useState("");
  const [contexto, setContexto] = useState("");
  const [gerando, startGerar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const favoritas = estrategias.filter((e) => e.favorito);
  const outras = estrategias.filter((e) => !e.favorito);

  function gerar() {
    if (!tema.trim()) { setErro("Digite um tema para gerar a estratégia."); return; }
    setErro(null);
    const fd = new FormData();
    fd.set("tema", tema);
    if (perfil) fd.set("perfil", perfil);
    if (contexto) fd.set("contexto", contexto);
    startGerar(async () => {
      const r = await gerarEstrategiaAction(fd);
      if (r.ok && r.estrategia) {
        onAdd({
          id: r.estrategia.id,
          titulo: r.estrategia.titulo,
          categoria: "ideia",
          perfilAlvo: perfil || null,
          conteudo: r.estrategia.conteudo,
          fonte: "ia",
          favorito: false,
          criadoEm: new Date().toISOString(),
        });
        setTema("");
        setContexto("");
      } else {
        setErro(r.erro ?? "Erro ao gerar.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Formulário gerador */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-brand-600" />
          <span className="font-bold text-brand-800">Gerar nova estratégia com IA</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tema ou situação</label>
            <input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ex: como fechar com cliente que quer pensar, cliente D que só fala de preço..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Perfil DISC (opcional)</label>
              <select
                value={perfil}
                onChange={(e) => setPerfil(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="">Qualquer perfil</option>
                <option value="D">D — Dominante</option>
                <option value="I">I — Influente</option>
                <option value="S">S — Estável</option>
                <option value="C">C — Cauteloso-Analítico</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Contexto extra (opcional)</label>
              <input
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                placeholder="Ex: cliente no Cachoeiro, quer escavadeira E215C..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
          </div>
          {erro && <p className="text-xs font-medium text-red-600">{erro}</p>}
          <button
            onClick={gerar}
            disabled={gerando}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            <Sparkles size={15} />
            {gerando ? "Gerando estratégia..." : "Gerar estratégia"}
          </button>
        </div>
      </div>

      {/* Lista de estratégias */}
      {favoritas.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-600">
            <Star size={14} className="text-yellow-500" fill="currentColor" /> Favoritas
          </div>
          <div className="space-y-2">
            {favoritas.map((e) => (
              <EstrategiaCard
                key={e.id}
                e={e}
                aberta={aberta === e.id}
                onToggle={() => setAberta(aberta === e.id ? null : e.id)}
                onToggleFav={() => { toggleFavoritoEstrategia(e.id, !e.favorito); onToggleFav(e.id, !e.favorito); }}
                onDelete={() => { excluirEstrategia(e.id); onDelete(e.id); }}
              />
            ))}
          </div>
        </div>
      )}

      {outras.length > 0 && (
        <div>
          {favoritas.length > 0 && (
            <div className="mb-2 text-sm font-bold text-slate-600">Todas as estratégias</div>
          )}
          <div className="space-y-2">
            {outras.map((e) => (
              <EstrategiaCard
                key={e.id}
                e={e}
                aberta={aberta === e.id}
                onToggle={() => setAberta(aberta === e.id ? null : e.id)}
                onToggleFav={() => { toggleFavoritoEstrategia(e.id, !e.favorito); onToggleFav(e.id, !e.favorito); }}
                onDelete={() => { excluirEstrategia(e.id); onDelete(e.id); }}
              />
            ))}
          </div>
        </div>
      )}

      {estrategias.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
          <Sparkles size={24} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm">Gere a primeira estratégia acima!</p>
        </div>
      )}
    </div>
  );
}

function EstrategiaCard({
  e, aberta, onToggle, onToggleFav, onDelete,
}: {
  e: EstrategiaRow;
  aberta: boolean;
  onToggle: () => void;
  onToggleFav: () => void;
  onDelete: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    navigator.clipboard.writeText(e.conteudo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const DISC_BADGE: Record<string, string> = {
    D: "bg-red-100 text-red-700",
    I: "bg-yellow-100 text-yellow-700",
    S: "bg-green-100 text-green-700",
    C: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button onClick={onToggle} className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          {e.perfilAlvo && (
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", DISC_BADGE[e.perfilAlvo] ?? "bg-slate-100 text-slate-600")}>
              {e.perfilAlvo}
            </span>
          )}
          <span className="truncate text-sm font-semibold text-slate-800">{e.titulo}</span>
          {e.fonte === "ia" && (
            <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">IA</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={(ev) => { ev.stopPropagation(); onToggleFav(); }}
            className="rounded-lg p-1 hover:bg-slate-100"
            title={e.favorito ? "Remover dos favoritos" : "Favoritar"}
          >
            <Star size={14} className={e.favorito ? "text-yellow-500" : "text-slate-300"} fill={e.favorito ? "currentColor" : "none"} />
          </button>
          {aberta ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </button>
      {aberta && (
        <div className="border-t border-slate-100 px-4 py-4">
          <div className="relative rounded-lg bg-slate-50 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed pr-8">{e.conteudo}</p>
            <button
              onClick={copiar}
              className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-brand-600"
              title="Copiar"
            >
              {copiado ? <Check size={14} className="text-brand-600" /> : <Copy size={14} />}
            </button>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={onDelete}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function TabScripts() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-bold text-slate-800 mb-3">Scripts WhatsApp Profissionais</h3>
        <p className="text-sm text-slate-500 mb-4">Textos prontos para cada situacao de venda. Copie, adapte e envie.</p>
        <div className="space-y-4">
          {SCRIPTS_WHATSAPP.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-brand-700 bg-brand-100 rounded-full px-2 py-0.5">{s.situacao}</span>
              </div>
              <p className="text-xs text-slate-500 mb-2">{s.contexto}</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{s.mensagem}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabProspeccao() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-bold text-slate-800 mb-3">Dicas de Prospeccao</h3>
        <p className="text-sm text-slate-500 mb-4">Tecnicas para encontrar e abordar novos clientes com eficiencia.</p>
        <div className="space-y-3">
          {DICAS_PROSPECCAO.map((d, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="font-bold text-slate-800 text-sm mb-1">{d.titulo}</div>
              <p className="text-sm text-slate-600 mb-2">{d.descricao}</p>
              <div className="text-xs text-brand-700 font-medium">Acao: {d.acao}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabRoteiro() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-bold text-slate-800 mb-3">Roteiro de Visita Completo</h3>
        <p className="text-sm text-slate-500 mb-4">Estrutura passo a passo para conduzir uma visita de vendas de alto impacto.</p>
        <div className="space-y-4">
          {ROTEIRO_VISITA_COMPLETO.map((fase, i) => (
            <div key={i} className="rounded-lg border border-brand-200 bg-brand-50 p-3">
              <div className="font-bold text-brand-800 mb-2">{fase.fase}</div>
              <div className="space-y-1">
                {fase.perguntas.map((p, j) => (
                  <div key={j} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-brand-600 font-bold shrink-0">{j+1}.</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
              {fase.errosComuns && (
                <div className="mt-2 pt-2 border-t border-brand-200">
                  <div className="text-xs font-bold text-red-600 mb-1">Evitar:</div>
                  {fase.errosComuns.map((e, k) => (
                    <div key={k} className="text-xs text-red-600">- {e}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

