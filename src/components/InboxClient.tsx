"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { enviarResposta, marcarRespondido, definirModoFimDeSemana } from "@/lib/actions";
import { iniciais, diasDesde, cn } from "@/lib/utils";
import {
  Send, Sparkles, Check, CheckCheck, Mic, User, ArrowLeft, Phone,
  MapPin, Search, Smile, Paperclip, MoreVertical, Bot, X, GripHorizontal,
} from "lucide-react";

export type Mensagem = {
  id: string;
  conteudo: string;
  remetente: string;
  tipo: string;
  criadoEm: string;
};

export type Contato = {
  id: string;
  nome: string;
  telefone: string | null;
  municipio: string | null;
  aguardando: boolean;
  ultimoContato: string;
  previa: string;
  mensagens: Mensagem[];
  rascunho: string | null;
};

// Resumo leve de uma conversa, devolvido por /api/inbox/resumo.
type ResumoContato = {
  id: string;
  nome: string;
  telefone: string | null;
  municipio: string | null;
  aguardando: boolean;
  ultimoContato: string;
  previa: string;
  ultimaMsgId: string | null;
  ultimaMsgRemetente: string | null;
  totalMensagens: number;
};

// Toca um bipe curto quando chega mensagem nova (Web Audio — sem arquivo externo).
function tocarAlerta() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    osc.onended = () => ctx.close();
  } catch {}
}

function horaMsg(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
  });
}

function labelData(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const mesma = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (mesma(d, hoje)) return "Hoje";
  if (mesma(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

function previewData(iso: string) {
  const dias = diasDesde(iso);
  if (dias === 0) return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  if (dias === 1) return "ontem";
  if (dias < 7) return `${dias}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

// ── Persistência de "já vi" no localStorage ───────────────────────────────
// Guarda o ID da última mensagem vista por conversa para que badges não voltem
// após recarregar a página — só mensagens POSTERIORES ao que foi visto geram badge.
const LIDO_KEY = "inbox_lido_v2";

function lerLido(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LIDO_KEY) ?? "{}"); } catch { return {}; }
}
function salvarLido(clienteId: string, msgId: string) {
  try {
    const v = lerLido();
    v[clienteId] = msgId;
    localStorage.setItem(LIDO_KEY, JSON.stringify(v));
  } catch {}
}

// Conta mensagens não lidas do cliente. Consulta o localStorage para saber se
// a última mensagem já foi vista antes mesmo do primeiro polling desta sessão.
function naoLidasIniciais(c: Contato, lido: Record<string, string>): number {
  if (!c.aguardando) return 0;
  const ultimaId = c.mensagens[c.mensagens.length - 1]?.id;
  if (ultimaId && lido[c.id] === ultimaId) return 0; // já viu essa mensagem antes
  let n = 0;
  for (let i = c.mensagens.length - 1; i >= 0; i--) {
    if (c.mensagens[i].remetente === "cliente") n++;
    else break;
  }
  return n || 1;
}

export function InboxClient({
  contatos: contatosInit,
  zapiAtiva,
  modoFimDeSemana: modoInicial,
}: {
  contatos: Contato[];
  zapiAtiva: boolean;
  modoFimDeSemana: boolean;
}) {
  const [selId, setSelId] = useState<string | null>(contatosInit[0]?.id ?? null);
  const [busca, setBusca] = useState("");
  const [contatos, setContatos] = useState<Contato[]>(contatosInit);
  const [naoLidos, setNaoLidos] = useState<Record<string, number>>(() => {
    const lido = lerLido();
    return Object.fromEntries(contatosInit.map((c) => [c.id, naoLidasIniciais(c, lido)]));
  });
  const [altura, setAltura] = useState<number | null>(null);
  const [aoVivo, setAoVivo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs para o polling global acessar o estado atual sem re-assinar o intervalo.
  const selIdRef = useRef(selId);
  selIdRef.current = selId;
  // Espelho do estado contatos para callbacks que não podem re-assinar o efeito.
  const contatosRef = useRef(contatos);
  contatosRef.current = contatos;
  // Último ID de mensagem conhecido por contato (detecta novidades no polling).
  const ultimaMsgRef = useRef<Record<string, string>>(
    Object.fromEntries(
      contatosInit.map((c) => [c.id, c.mensagens[c.mensagens.length - 1]?.id ?? ""])
    )
  );
  const primeiroSyncRef = useRef(true);

  // Restaura a altura preferida (redimensionável).
  useEffect(() => {
    const salvo = localStorage.getItem("inbox_altura");
    if (salvo) setAltura(Number(salvo));
  }, []);

  // Ao abrir uma conversa, zera o contador e persiste qual foi a última msg vista
  // para que o badge não reapareça ao recarregar a página.
  const abrir = useCallback((id: string) => {
    setSelId(id);
    setNaoLidos((prev) => ({ ...prev, [id]: 0 }));
    const c = contatosRef.current.find((x) => x.id === id);
    const ultimaId = c?.mensagens[c.mensagens.length - 1]?.id;
    if (ultimaId) salvarLido(id, ultimaId);
  }, []);

  const filtrados = busca.trim()
    ? contatos.filter((c) =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) || (c.telefone ?? "").includes(busca)
      )
    : contatos;

  const sel = contatos.find((c) => c.id === selId) ?? null;

  const updateMensagens = useCallback((clienteId: string, novas: Mensagem[], aguardando: boolean) => {
    setContatos((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== clienteId) return c;
        const existentes = new Set(c.mensagens.map((m) => m.id));
        const add = novas.filter((m) => !existentes.has(m.id));
        if (add.length === 0 && c.aguardando === aguardando) return c;
        const todas = [...c.mensagens, ...add];
        const ultima = todas[todas.length - 1];
        // Se a conversa está aberta, marca imediatamente como lida no localStorage.
        if (ultima && selIdRef.current === clienteId) salvarLido(clienteId, ultima.id);
        return {
          ...c,
          mensagens: todas,
          aguardando,
          previa: ultima?.conteudo ?? c.previa,
          ultimoContato: ultima?.criadoEm ?? c.ultimoContato,
        };
      });
      // Reordena imediatamente: conversa com nova mensagem sobe para o topo.
      return [...updated].sort((a, b) => +new Date(b.ultimoContato) - +new Date(a.ultimoContato));
    });
  }, []);

  // Mescla o resumo global (todas as conversas) no estado: atualiza prévia,
  // "aguardando", reordena, adiciona contatos novos e incrementa não lidas.
  const mergeResumo = useCallback((resumo: ResumoContato[]) => {
    setContatos((prev) => {
      const mapPrev = new Map(prev.map((c) => [c.id, c]));
      const next: Contato[] = resumo.map((r) => {
        const ex = mapPrev.get(r.id);
        if (ex) {
          return {
            ...ex, // mantém mensagens já carregadas
            nome: r.nome,
            telefone: r.telefone,
            municipio: r.municipio,
            aguardando: r.aguardando,
            ultimoContato: r.ultimoContato,
            previa: r.previa || ex.previa,
          };
        }
        // Contato totalmente novo (primeira mensagem chegou agora).
        return {
          id: r.id,
          nome: r.nome,
          telefone: r.telefone,
          municipio: r.municipio,
          aguardando: r.aguardando,
          ultimoContato: r.ultimoContato,
          previa: r.previa,
          mensagens: [],
          rascunho: null,
        } satisfies Contato;
      });
      next.sort((a, b) => +new Date(b.ultimoContato) - +new Date(a.ultimoContato));
      return next;
    });

    // Detecta mensagens novas para badge de não lidas e alerta sonoro.
    let chegouNova = false;
    const lido = lerLido(); // snapshot do que foi visto antes do reload
    setNaoLidos((prev) => {
      const next = { ...prev };
      for (const r of resumo) {
        const conhecida = ultimaMsgRef.current[r.id];
        if (r.ultimaMsgId && r.ultimaMsgId !== conhecida) {
          ultimaMsgRef.current[r.id] = r.ultimaMsgId;
          if (selIdRef.current === r.id) {
            // Conversa aberta: marca como lida automaticamente.
            next[r.id] = 0;
            salvarLido(r.id, r.ultimaMsgId);
          } else if (r.ultimaMsgRemetente === "cliente") {
            // Só gera badge se esta mensagem ainda não foi vista nesta ou em sessão anterior.
            const jaViu = lido[r.id] === r.ultimaMsgId;
            if (!jaViu && !primeiroSyncRef.current) {
              next[r.id] = (next[r.id] ?? 0) + 1;
              chegouNova = true;
            } else if (!jaViu && primeiroSyncRef.current) {
              // Primeiro sync: respeita o que foi calculado na inicialização (evita duplicar).
              // Não incrementa, mas o naoLidasIniciais já calculou corretamente.
            }
          }
        }
      }
      return next;
    });

    if (chegouNova) tocarAlerta();
    primeiroSyncRef.current = false;
  }, []);

  // Polling GLOBAL: a cada 3s busca o resumo de TODAS as conversas.
  // Pausa quando a aba está oculta e retoma ao voltar o foco.
  useEffect(() => {
    let cancelado = false;
    async function pollGlobal() {
      if (cancelado || document.hidden) return;
      try {
        const res = await fetch("/api/inbox/resumo", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelado) return;
        mergeResumo(data.resumo as ResumoContato[]);
        setAoVivo(true);
      } catch {
        setAoVivo(false);
      }
    }
    const iv = setInterval(pollGlobal, 3000);
    pollGlobal();
    const aoFocar = () => { if (!document.hidden) pollGlobal(); };
    document.addEventListener("visibilitychange", aoFocar);
    window.addEventListener("focus", aoFocar);
    return () => {
      cancelado = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", aoFocar);
      window.removeEventListener("focus", aoFocar);
    };
  }, [mergeResumo]);

  // Polling da CONVERSA ABERTA: busca o conteúdo completo das mensagens novas.
  // Usa contatosRef.current (e não 'contatos') para evitar stale closure — o ref
  // é atualizado a cada render, então o 'after' sempre reflete a última mensagem.
  useEffect(() => {
    if (!selId) return;
    const clienteId = selId;
    let cancelado = false;
    async function poll() {
      if (cancelado || document.hidden) return;
      const contato = contatosRef.current.find((c) => c.id === clienteId);
      if (!contato) return;
      const ultima = contato.mensagens[contato.mensagens.length - 1];
      const after = ultima?.criadoEm ?? new Date(0).toISOString();
      try {
        const res = await fetch(
          `/api/inbox?clienteId=${clienteId}&after=${encodeURIComponent(after)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelado && (data.mensagens.length > 0 || data.aguardando !== contato.aguardando)) {
          updateMensagens(clienteId, data.mensagens, data.aguardando);
          setNaoLidos((prev) => ({ ...prev, [clienteId]: 0 }));
          const novaMais = data.mensagens[data.mensagens.length - 1];
          if (novaMais?.id) salvarLido(clienteId, novaMais.id);
        }
      } catch {}
    }
    const iv = setInterval(poll, 2500);
    poll();
    // Retoma imediatamente ao voltar o foco (garante que o usuário não espere 2.5s).
    const aoFocar = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", aoFocar);
    window.addEventListener("focus", aoFocar);
    return () => {
      cancelado = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", aoFocar);
      window.removeEventListener("focus", aoFocar);
    };
  }, [selId, updateMensagens]);

  // Redimensionamento por arraste (mouse).
  const iniciarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = containerRef.current?.offsetHeight ?? 560;
    const onMove = (ev: MouseEvent) => {
      const nh = Math.min(window.innerHeight - 40, Math.max(420, startH + ev.clientY - startY));
      setAltura(nh);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      const h = containerRef.current?.offsetHeight;
      if (h) localStorage.setItem("inbox_altura", String(h));
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (contatosInit.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#25D366]/30 bg-[#111b21] text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#202c33]">
          <Send size={24} className="text-[#25D366]" />
        </div>
        <p className="font-semibold text-[#e9edef]">Nenhuma conversa ainda</p>
        <p className="text-sm text-[#8696a0]">Quando um cliente te mandar mensagem, ela aparece aqui.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="flex overflow-hidden rounded-xl shadow-xl"
        style={{ height: altura ? `${altura}px` : "calc(100vh - 170px)", minHeight: 420, background: "#111b21" }}
      >
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          className={cn("flex w-full shrink-0 flex-col border-r border-[#222d34] sm:w-[360px]", sel ? "hidden sm:flex" : "flex")}
          style={{ background: "#111b21" }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "#202c33" }}>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-[#e9edef]">WhatsApp</span>
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={aoVivo
                  ? { background: "rgba(37,211,102,0.15)", color: "#25D366" }
                  : { background: "rgba(148,163,184,0.15)", color: "#8696a0" }}
                title={aoVivo ? "Atualizando em tempo real" : "Conectando..."}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", aoVivo && "animate-pulse")}
                  style={{ background: aoVivo ? "#25D366" : "#8696a0" }}
                />
                {aoVivo ? "tempo real" : "conectando"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[#8696a0]">
              {!zapiAtiva && (
                <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">não conectado</span>
              )}
              <MoreVertical size={18} className="cursor-pointer hover:text-[#e9edef]" />
            </div>
          </div>

          {/* Modo fim de semana */}
          <ModoFimDeSemana inicial={modoInicial} />

          {/* Busca */}
          <div className="px-3 py-2" style={{ background: "#111b21" }}>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0]" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar ou começar uma nova conversa"
                className="w-full rounded-lg py-2 pl-9 pr-3 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
                style={{ background: "#202c33" }}
              />
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {filtrados.map((c) => {
              const unread = naoLidos[c.id] ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => abrir(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors",
                    selId === c.id ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
                  )}
                  style={{ borderColor: "#222d34" }}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20 text-sm font-bold text-[#25D366]">
                    {iniciais(c.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-semibold text-[#e9edef]">{c.nome}</span>
                      <span className={cn("shrink-0 text-[11px]", unread > 0 ? "text-[#25D366]" : "text-[#8696a0]")}>
                        {previewData(c.ultimoContato)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-[13px] text-[#8696a0]">{c.previa || "—"}</p>
                      {unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-bold text-black">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtrados.length === 0 && (
              <p className="p-6 text-center text-sm text-[#8696a0]">Nenhuma conversa encontrada.</p>
            )}
          </div>
        </aside>

        {/* ── Conversa ────────────────────────────────────────────────── */}
        <section className={cn("flex flex-1 flex-col", sel ? "flex" : "hidden sm:flex")}>
          {sel ? (
            <Conversa
              key={sel.id}
              contato={sel}
              zapiAtiva={zapiAtiva}
              onVoltar={() => setSelId(null)}
              onMensagemEnviada={(nova) => {
                setContatos((prev) =>
                  prev.map((c) =>
                    c.id === sel.id
                      ? { ...c, mensagens: [...c.mensagens, nova], previa: nova.conteudo, ultimoContato: nova.criadoEm, aguardando: false }
                      : c
                  )
                );
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center" style={{ background: "#222e35" }}>
              <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "#2a3942" }}>
                <Send size={36} className="text-[#25D366]" />
              </div>
              <div>
                <p className="text-xl font-semibold text-[#e9edef]">WhatsApp CRM</p>
                <p className="mt-1 text-sm text-[#8696a0]">Selecione uma conversa para começar.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Alça de redimensionamento — arraste para ajustar a altura */}
      <div
        onMouseDown={iniciarResize}
        title="Arraste para aumentar ou diminuir a janela"
        className="group mx-auto mt-1 flex h-4 w-full cursor-ns-resize items-center justify-center"
      >
        <div className="flex h-1.5 w-16 items-center justify-center rounded-full bg-[#2a3942] transition group-hover:bg-[#25D366]">
          <GripHorizontal size={12} className="text-[#8696a0] group-hover:text-black" />
        </div>
      </div>
    </div>
  );
}

// ── Toggle do modo fim de semana ────────────────────────────────────────────
function ModoFimDeSemana({ inicial }: { inicial: boolean }) {
  const [ativo, setAtivo] = useState(inicial);
  const [salvando, start] = useTransition();

  function alternar() {
    const novo = !ativo;
    setAtivo(novo);
    start(async () => {
      const r = await definirModoFimDeSemana(novo);
      if (!r.ok) setAtivo(!novo); // reverte em caso de erro
    });
  }

  return (
    <button
      onClick={alternar}
      disabled={salvando}
      className="flex items-center gap-2 border-b border-[#222d34] px-4 py-2.5 text-left transition hover:bg-[#202c33]"
      style={{ background: ativo ? "rgba(37,211,102,0.08)" : "#111b21" }}
    >
      <Bot size={16} className={ativo ? "text-[#25D366]" : "text-[#8696a0]"} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-[#e9edef]">Resposta automática (fim de semana)</div>
        <div className="text-[10px] text-[#8696a0]">
          {ativo ? "IA respondendo por você, no seu estilo" : "IA apenas sugere — não envia sozinha"}
        </div>
      </div>
      {/* Switch */}
      <span
        className="relative h-5 w-9 shrink-0 rounded-full transition"
        style={{ background: ativo ? "#25D366" : "#3b4a54" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          style={{ left: ativo ? "18px" : "2px" }}
        />
      </span>
    </button>
  );
}

// ── Conversa ────────────────────────────────────────────────────────────────
function Conversa({
  contato, zapiAtiva, onVoltar, onMensagemEnviada,
}: {
  contato: Contato;
  zapiAtiva: boolean;
  onVoltar: () => void;
  onMensagemEnviada: (m: Mensagem) => void;
}) {
  // A caixa de digitação começa VAZIA — a sugestão fica só no campo dela.
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();
  const [baixando, startBaixar] = useTransition();
  const [mostrarRascunho, setMostrarRascunho] = useState(!!contato.rascunho);
  const fimRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [contato.mensagens.length]);
  useEffect(() => { textareaRef.current?.focus(); }, [contato.id]);

  function enviar() {
    setErro(null);
    const t = texto.trim();
    if (!t) return;
    const agora = new Date().toISOString();
    const tempId = `temp-${Date.now()}`;
    onMensagemEnviada({ id: tempId, conteudo: t, remetente: "vendedor", tipo: "texto", criadoEm: agora });
    setTexto("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    startEnviar(async () => {
      const r = await enviarResposta(contato.id, t);
      if (!r.ok) setErro(r.erro ?? "Falha ao enviar.");
    });
  }

  // Agrupa por data.
  const grupos: { data: string; msgs: Mensagem[] }[] = [];
  for (const m of contato.mensagens) {
    const d = labelData(m.criadoEm);
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || ultimo.data !== d) grupos.push({ data: d, msgs: [m] });
    else ultimo.msgs.push(m);
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#202c33" }}>
        <button onClick={onVoltar} className="rounded-full p-1 text-[#8696a0] hover:bg-[#2a3942] sm:hidden">
          <ArrowLeft size={20} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366]/20 text-sm font-bold text-[#25D366]">
          {iniciais(contato.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[#e9edef]">{contato.nome}</div>
          <div className="flex items-center gap-2 text-xs text-[#8696a0]">
            {contato.telefone && <span className="flex items-center gap-1"><Phone size={10} /> {contato.telefone}</span>}
            {contato.municipio && <span className="flex items-center gap-1"><MapPin size={10} /> {contato.municipio}</span>}
          </div>
        </div>
        <Link
          href={`/clientes/${contato.id}`}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef]"
        >
          <User size={13} /> Ficha
        </Link>
      </div>

      {/* Mensagens */}
      <div
        className="flex-1 overflow-y-auto px-6 py-4"
        style={{
          background: "#0b141a",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {grupos.map((grupo) => (
          <div key={grupo.data}>
            <div className="my-3 flex items-center justify-center">
              <span className="rounded-lg px-3 py-1 text-[11px] font-medium text-[#e9edef]" style={{ background: "#182229" }}>
                {grupo.data}
              </span>
            </div>
            {grupo.msgs.map((m) => {
              const meu = m.remetente === "vendedor";
              return (
                <div key={m.id} className={cn("mb-1 flex", meu ? "justify-end" : "justify-start")}>
                  <div
                    className={cn("relative max-w-[65%] rounded-lg px-3 py-2 text-sm shadow", meu ? "rounded-tr-sm" : "rounded-tl-sm")}
                    style={{ background: meu ? "#005c4b" : "#202c33" }}
                  >
                    {meu ? (
                      <span className="absolute -right-1.5 top-0 h-3 w-2 overflow-hidden">
                        <svg viewBox="0 0 8 13" className="h-3 w-2" fill="#005c4b"><path d="M0 0L8 0L8 13L0 0Z" /></svg>
                      </span>
                    ) : (
                      <span className="absolute -left-1.5 top-0 h-3 w-2 overflow-hidden">
                        <svg viewBox="0 0 8 13" className="h-3 w-2" fill="#202c33"><path d="M8 0L0 0L0 13L8 0Z" /></svg>
                      </span>
                    )}
                    {m.tipo === "audio" && (
                      <div className="mb-1 flex items-center gap-1 text-xs text-[#25D366]"><Mic size={11} /> áudio transcrito</div>
                    )}
                    <p className="whitespace-pre-wrap break-words text-[#e9edef]">{m.conteudo}</p>
                    <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#8696a0]">
                      <span>{horaMsg(m.criadoEm)}</span>
                      {meu && (m.id.startsWith("temp-")
                        ? <Check size={12} className="text-[#8696a0]" />
                        : <CheckCheck size={12} className="text-[#53bdeb]" />)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      {/* Caixa de digitação */}
      <div className="flex items-end gap-2 px-3 py-3" style={{ background: "#202c33" }}>
        <div className="flex flex-1 items-end gap-2 overflow-hidden rounded-xl px-3 py-2" style={{ background: "#2a3942" }}>
          <Smile size={22} className="mb-0.5 shrink-0 cursor-pointer text-[#8696a0] hover:text-[#e9edef]" />
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
            }}
            rows={1}
            placeholder={zapiAtiva ? "Digite uma mensagem" : "WhatsApp não conectado"}
            className="max-h-32 flex-1 resize-none bg-transparent text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
            style={{ lineHeight: "1.4" }}
          />
          <Paperclip size={20} className="mb-0.5 shrink-0 cursor-pointer text-[#8696a0] hover:text-[#e9edef]" />
        </div>
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition hover:brightness-110 disabled:opacity-50"
          style={{ background: "#25D366" }}
          title="Enviar"
        >
          <Send size={18} className="text-white" />
        </button>
      </div>

      {/* Campo de SUGESTÃO da IA — colado abaixo da caixa, separado da digitação */}
      {mostrarRascunho && contato.rascunho && (
        <div className="border-t border-[#0b141a] px-3 py-2" style={{ background: "#1d2a31" }}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#25D366]">
            <Sparkles size={12} /> Sugestão da IA
          </div>
          <div className="mt-1 flex items-end gap-2">
            <p className="flex-1 rounded-lg px-3 py-2 text-[13px] italic text-[#cfd8dc]" style={{ background: "#0b141a" }}>
              {contato.rascunho}
            </p>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                onClick={() => {
                  setTexto(contato.rascunho ?? "");
                  setMostrarRascunho(false);
                  setTimeout(() => textareaRef.current?.focus(), 0);
                }}
                className="rounded-lg bg-[#25D366] px-3 py-1 text-xs font-bold text-black hover:bg-[#1da851]"
              >
                Usar
              </button>
              <button
                onClick={() => setMostrarRascunho(false)}
                className="flex items-center justify-center gap-1 rounded-lg px-3 py-1 text-xs font-medium text-[#8696a0] hover:bg-[#0b141a] hover:text-[#e9edef]"
              >
                <X size={11} /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erros + marcar respondido */}
      {(erro || contato.aguardando) && (
        <div className="flex items-center justify-between px-4 py-1.5" style={{ background: "#182229" }}>
          {erro && (
            <span className="text-xs text-red-400">{erro}{!zapiAtiva && " — Conecte o WhatsApp em Configurações."}</span>
          )}
          {contato.aguardando && (
            <button
              onClick={() => startBaixar(() => marcarRespondido(contato.id))}
              disabled={baixando}
              className="ml-auto flex items-center gap-1 text-xs font-medium text-[#8696a0] hover:text-[#25D366]"
            >
              <Check size={12} /> Marcar como respondido
            </button>
          )}
        </div>
      )}
    </>
  );
}
