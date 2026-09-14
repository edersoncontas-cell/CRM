"use client";

// WhatsApp do CRM (Atendimento) — três colunas: conversas | chat | contexto do
// cliente com o Orientador de Vendas. Visual no padrão do CRM (grafite +
// amarelo), sem imitar o WhatsApp Web. A tela ocupa a área útil inteira com
// posicionamento fixo (nada de margens negativas), então nunca "desenquadra".

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Send, ArrowLeft, Check, CheckCheck, User, MoreVertical, MessageCircle, Users,
  DownloadCloud, Loader2, Brain, Trash2, Pencil, X, FileText, Handshake, Link2,
  CheckCircle2, Compass, Flame, ThermometerSun, Snowflake, EyeOff, Eye, Calendar, Repeat,
  ChevronUp, PanelRightOpen, Sparkles, AlertTriangle, MapPin, Wallet, Bell,
} from "lucide-react";
import { unzipSync, strFromU8 } from "fflate";
import { parseWhatsAppLines, montarChat, nomeDoArquivo, type ParsedChat } from "@/lib/whatsapp-export-parser";
import { FormNovaNegociacao } from "@/components/FormNovaNegociacao";
import {
  contextoConversaAction, marcarRespondidoAction, ignorarConversaAction, resolverAlertaConversaAction, registrarUsoRespostaAction,
  type ContextoConversa,
} from "@/lib/atendimento-actions";
import { cn, formatCurrency } from "@/lib/utils";

export type ConvLista = {
  id: string;
  externalPhone: string;
  contactName: string | null;
  isGroup: boolean;
  groupName: string | null;
  ignored: boolean;
  aiActive: boolean;
  category: string | null;
  contactPhotoUrl: string | null;
  clienteId: string | null;
  lastMessageAt: string;
  naoLida: boolean;
  previa: string;
  temRascunho: boolean;
  aguardando: boolean;
};

type Mensagem = {
  id: string;
  direction: "IN" | "OUT";
  body: string;
  senderName: string | null;
  operatorDisplayName: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  sentAt: string;
  sendStatus: string | null;
  isDraft: boolean;
};

type Conexao = { configurado: boolean; conectado: boolean; provedor: "evolution" | "zapi" | null };
type Settings = { auditMode: boolean; autoHoraInicio: number; autoHoraFim: number; autoLimiteDia: number };
type Filtro = "todas" | "nao_lidas" | "aguardando" | "rascunho" | "sem_vinculo" | "ignoradas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "nao_lidas", label: "Não lidas" },
  { id: "aguardando", label: "Aguardando você" },
  { id: "rascunho", label: "Com rascunho" },
  { id: "sem_vinculo", label: "Sem cadastro" },
  { id: "ignoradas", label: "Ignoradas" },
];

function iniciais(s: string) {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}
function quandoCurto(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) return hora(iso);
  const diff = (hoje.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}
function diaChave(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });
}
function nomeConv(c: { contactName: string | null; groupName: string | null; isGroup: boolean; externalPhone: string }, overlayName?: string | null) {
  if (overlayName) return overlayName;
  return (c.isGroup ? c.groupName : c.contactName) || c.contactName || c.externalPhone;
}
function telefoneBonito(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  return p;
}

function Avatar({ nome, isGroup, photo, size }: { nome: string; isGroup: boolean; photo: string | null; size: number }) {
  const [erro, setErro] = useState(false);
  if (photo && !erro) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" onError={() => setErro(true)} referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", isGroup ? "bg-brand-700 text-brand-200" : "bg-agro-400/20 text-agro-300 ring-1 ring-agro-400/30")}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {isGroup ? <Users size={Math.round(size * 0.45)} /> : iniciais(nome)}
    </div>
  );
}

function Temperatura({ t }: { t: string }) {
  if (t === "muito_quente" || t === "quente") return <span className="inline-flex items-center gap-1 text-orange-300"><Flame size={13} /> {t === "muito_quente" ? "Muito quente" : "Quente"}</span>;
  if (t === "fria") return <span className="inline-flex items-center gap-1 text-sky-300"><Snowflake size={13} /> Fria</span>;
  return <span className="inline-flex items-center gap-1 text-amber-300"><ThermometerSun size={13} /> Morna</span>;
}

const botaoIcone = "flex h-9 w-9 items-center justify-center rounded-lg text-brand-300 hover:bg-white/10 hover:text-white transition";
const chip = (ativo: boolean) => cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition", ativo ? "bg-agro-400 text-black" : "bg-white/5 text-brand-300 hover:bg-white/10");

export function AtendimentoClient({ conversas, conexao, convInicial, maquinasProprias, colunasFunil }: {
  conversas: ConvLista[];
  conexao: Conexao;
  convInicial?: string | null;
  maquinasProprias: { marca: string; modelo: string }[];
  colunasFunil: { id: string; titulo: string; papel?: string | null }[];
}) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(convInicial ?? null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [buscaMsg, setBuscaMsg] = useState<string | null>(null);
  const [resultadosBusca, setResultadosBusca] = useState<Mensagem[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, Partial<{ aiActive: boolean; ignored: boolean; contactName: string; clienteId: string | null }>>>({});
  const [menuAberto, setMenuAberto] = useState(false);
  const [cfgAberto, setCfgAberto] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [renomeando, setRenomeando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [syncCliente, setSyncCliente] = useState(false);
  const [novaNegoConv, setNovaNegoConv] = useState<ConvLista | null>(null);
  const [vincularConv, setVincularConv] = useState<ConvLista | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [contexto, setContexto] = useState<ContextoConversa | null>(null);
  const [carregandoContexto, setCarregandoContexto] = useState(false);
  const [topo, setTopo] = useState(0);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoScrollRef = useRef(true);
  const prevSelIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // A tela é fixa: no celular começa logo abaixo da barra do CRM (altura real,
  // medida — muda com a safe-area do iPhone); no desktop começa no topo.
  useEffect(() => {
    const medir = () => {
      const barra = document.getElementById("topbar-mobile");
      const visivel = barra && window.getComputedStyle(barra).display !== "none";
      setTopo(visivel ? barra.getBoundingClientRect().height : 0);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    fetch("/api/whatsapp/settings").then((r) => r.json()).then((d) => setSettings({ auditMode: !!d.auditMode, autoHoraInicio: d.autoHoraInicio ?? 7, autoHoraFim: d.autoHoraFim ?? 20, autoLimiteDia: d.autoLimiteDia ?? 40 })).catch(() => {});
  }, []);

  const curr = useCallback((c: ConvLista) => ({ ...c, ...(flags[c.id] ?? {}) }), [flags]);

  async function patchConv(c: ConvLista, patch: Partial<{ aiActive: boolean; ignored: boolean; contactName: string; clienteId: string | null; syncCliente: boolean }>) {
    const { syncCliente: _s, ...overlay } = patch;
    setFlags((f) => ({ ...f, [c.id]: { ...(f[c.id] ?? {}), ...overlay } }));
    try {
      await fetch(`/api/conversations/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    } catch {}
    router.refresh();
  }

  async function salvarSettings(patch: Partial<Settings>) {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    try {
      await fetch("/api/whatsapp/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    } catch {}
  }

  async function excluirConversa(c: ConvLista) {
    const nome = nomeConv(c, curr(c).contactName);
    if (!window.confirm(`Excluir a conversa com "${nome}"? Todas as mensagens serão apagadas do CRM.`)) return;
    setMenuAberto(false);
    const r = await fetch(`/api/conversations/${c.id}`, { method: "DELETE" }).then((res) => res.json()).catch(() => null);
    if (!r?.ok) { window.alert("Não foi possível excluir a conversa."); return; }
    if (selId === c.id) { setSelId(null); setMensagens([]); }
    router.refresh();
  }

  async function draftAction(messageId: string, action: "send" | "discard", body?: string) {
    if (!selId) return;
    const r = await fetch(`/api/conversations/${selId}/drafts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, action, body }),
    }).then((res) => res.json()).catch(() => null);
    if (!r?.ok) { if (action === "send") window.alert(r?.erro ?? "Não foi possível enviar."); return; }
    if (action === "discard") setMensagens((p) => p.filter((m) => m.id !== messageId));
    else if (r.message) setMensagens((p) => p.map((m) => (m.id === messageId ? r.message : m)));
    router.refresh();
  }

  function editarDraft(m: Mensagem) {
    setTexto(m.body);
    draftAction(m.id, "discard");
    textareaRef.current?.focus();
  }

  function usarResposta(textoResposta: string) {
    setTexto(textoResposta);
    textareaRef.current?.focus();
    if (selId) registrarUsoRespostaAction(selId).catch(() => {});
  }

  function htmlParaTexto(html: string): string {
    const comQuebras = html.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n");
    const doc = new DOMParser().parseFromString(comQuebras, "text/html");
    return doc.body?.textContent ?? "";
  }

  async function arquivosEscolhidos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setImportando(true);
    setImportMsg("Lendo arquivos…");
    const porNome = new Map<string, ParsedChat>();
    try {
      for (const file of files) {
        const baseZip = nomeDoArquivo(file.name);
        let textos: Array<{ path: string; texto: string }> = [];
        if (/\.zip$/i.test(file.name)) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const entradas = unzipSync(bytes, { filter: (f) => /\.(txt|html?)$/i.test(f.name) });
          textos = Object.entries(entradas).map(([path, data]) => {
            const cru = strFromU8(data);
            return { path, texto: /\.html?$/i.test(path) ? htmlParaTexto(cru) : cru };
          });
        } else if (/\.html?$/i.test(file.name)) {
          textos = [{ path: file.name, texto: htmlParaTexto(await file.text()) }];
        } else if (/\.txt$/i.test(file.name)) {
          textos = [{ path: file.name, texto: await file.text() }];
        }
        for (const { path, texto: t } of textos) {
          const raw = parseWhatsAppLines(t);
          if (!raw.length) continue;
          let nome = nomeDoArquivo(path);
          if (!nome || /^_chat$/i.test(nome)) nome = baseZip;
          const chat = montarChat(nome, raw);
          const ja = porNome.get(nome.toLowerCase());
          if (ja) ja.messages.push(...chat.messages);
          else porNome.set(nome.toLowerCase(), chat);
        }
      }
      const chats = Array.from(porNome.values()).filter((c) => c.messages.length);
      if (!chats.length) { setImportMsg("Nenhuma mensagem reconhecida."); return; }
      let convOk = 0, msgsOk = 0, i = 0;
      for (const chat of chats) {
        i++;
        setImportMsg(`Importando ${i}/${chats.length}…`);
        const r = await fetch("/api/whatsapp/import-file", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chats: [chat] }),
        }).then((res) => res.json()).catch(() => null);
        if (r?.ok) { convOk += r.conversas; msgsOk += r.mensagens; }
      }
      setImportMsg(`${convOk} conversa(s), ${msgsOk} mensagem(ns) importadas`);
    } catch (err) {
      console.error(err);
      setImportMsg("Falha ao ler os arquivos.");
    } finally {
      setImportando(false);
      setTimeout(() => setImportMsg(null), 6000);
      router.refresh();
    }
  }

  // Lista atualiza a cada 30s; as mensagens da conversa aberta chegam por SSE.
  useEffect(() => {
    const iv = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(iv);
  }, [router]);

  const sel = useMemo(() => conversas.find((c) => c.id === selId) ?? null, [conversas, selId]);
  const selAtual = sel ? curr(sel) : null;

  const carregarContexto = useCallback(async (id: string) => {
    setCarregandoContexto(true);
    try { setContexto(await contextoConversaAction(id)); } catch { setContexto(null); } finally { setCarregandoContexto(false); }
  }, []);

  const mergeMsgs = useCallback((novas: Mensagem[]) => {
    setMensagens((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = novas.filter((m) => !ids.has(m.id));
      if (!add.length) return prev;
      return [...prev, ...add].sort((a, b) => +new Date(a.sentAt) - +new Date(b.sentAt));
    });
    // Mensagem nova do cliente ou rascunho novo: o Orientador pode ter reanalisado.
    if (selId && novas.some((m) => m.direction === "IN" || m.isDraft)) setTimeout(() => carregarContexto(selId), 4000);
  }, [selId, carregarContexto]);

  useEffect(() => {
    esRef.current?.close();
    setBuscaMsg(null); setResultadosBusca(null); setMenuAberto(false); setRenomeando(false);
    if (!selId) { setMensagens([]); setContexto(null); return; }
    let vivo = true;
    carregarContexto(selId);
    fetch(`/api/conversations/${selId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        setMensagens(d.messages ?? []);
        setTemMais(!!d.temMais);
        const ultimo = d.messages?.[d.messages.length - 1]?.id ?? "";
        const es = new EventSource(`/api/conversations/${selId}/stream${ultimo ? `?after=${ultimo}` : ""}`);
        es.addEventListener("messages", (e) => { try { mergeMsgs(JSON.parse((e as MessageEvent).data)); } catch {} });
        esRef.current = es;
      })
      .catch(() => {});
    return () => { vivo = false; esRef.current?.close(); };
  }, [selId, mergeMsgs, carregarContexto]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const trocou = prevSelIdRef.current !== selId;
    prevSelIdRef.current = selId;
    if (trocou || autoScrollRef.current) el.scrollTop = el.scrollHeight;
  }, [selId, mensagens.length]);

  async function carregarAnteriores() {
    if (!selId || !mensagens.length || carregandoMais) return;
    setCarregandoMais(true);
    const el = chatRef.current;
    const alturaAntes = el?.scrollHeight ?? 0;
    try {
      const d = await fetch(`/api/conversations/${selId}/messages?before=${mensagens[0].id}`).then((r) => r.json());
      const antigas: Mensagem[] = d.messages ?? [];
      setTemMais(!!d.temMais);
      if (antigas.length) {
        autoScrollRef.current = false;
        setMensagens((p) => [...antigas, ...p]);
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - alturaAntes; });
      }
    } catch {} finally { setCarregandoMais(false); }
  }

  async function buscarNasMensagens(q: string) {
    setBuscaMsg(q);
    if (!selId || !q.trim()) { setResultadosBusca(null); return; }
    const d = await fetch(`/api/conversations/${selId}/messages?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()).catch(() => null);
    setResultadosBusca(d?.messages ?? []);
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || !selId) return;
    setTexto("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setEnviando(true);
    autoScrollRef.current = true;
    const temp: Mensagem = { id: `tmp-${Date.now()}`, direction: "OUT", body: t, senderName: null, operatorDisplayName: "Você", mediaType: null, mediaUrl: null, sentAt: new Date().toISOString(), sendStatus: "QUEUED", isDraft: false };
    setMensagens((p) => [...p, temp]);
    try {
      const r = await fetch(`/api/conversations/${selId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t }) });
      const d = await r.json();
      if (d?.message) setMensagens((p) => p.map((m) => (m.id === temp.id ? d.message : m)));
      if (d?.ok) marcarRespondidoAction(selId).catch(() => {});
    } catch {
      setMensagens((p) => p.map((m) => (m.id === temp.id ? { ...m, sendStatus: "FAILED" } : m)));
    } finally {
      setEnviando(false);
    }
  }

  const naoLidas = conversas.filter((c) => c.naoLida && !curr(c).ignored).length;
  const filtradas = conversas
    .map(curr)
    .filter((c) => (filtro === "ignoradas" ? c.ignored : !c.ignored))
    .filter((c) => {
      if (filtro === "nao_lidas") return c.naoLida;
      if (filtro === "aguardando") return c.aguardando;
      if (filtro === "rascunho") return c.temRascunho;
      if (filtro === "sem_vinculo") return !c.clienteId && !c.isGroup;
      return true;
    })
    .filter((c) => {
      const q = busca.trim().toLowerCase();
      if (!q) return true;
      return nomeConv(c, c.contactName).toLowerCase().includes(q) || c.externalPhone.includes(q.replace(/\D/g, "") || q) || c.previa.toLowerCase().includes(q);
    });

  const modoIA = settings ? (settings.auditMode ? "Rascunho" : "Automática") : "…";
  const negociacaoAberta = contexto?.negociacoes[0] ?? null;

  // Mensagens agrupadas por dia (para os separadores).
  const listaMsgs = resultadosBusca ?? mensagens;
  const grupos: { dia: string; itens: Mensagem[] }[] = [];
  for (const m of listaMsgs) {
    const dia = diaChave(m.sentAt);
    const g = grupos[grupos.length - 1];
    if (g && g.dia === dia) g.itens.push(m); else grupos.push({ dia, itens: [m] });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex bg-brand-950 text-brand-100 md:left-64" style={{ top: topo }}>
      {/* ── Coluna 1: conversas ── */}
      <aside className={cn("w-full shrink-0 flex-col border-r border-brand-800 bg-brand-900 lg:flex lg:w-[340px]", sel ? "hidden" : "flex")}>
        <div className="shrink-0 border-b border-brand-800 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-agro-400 text-black"><MessageCircle size={17} /></div>
              <div className="min-w-0">
                <div className="text-base font-bold leading-tight text-white">WhatsApp</div>
                <Link href="/conexao" className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-brand-300 hover:text-white" title="Conexão do WhatsApp">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", conexao.conectado ? "bg-emerald-400" : "bg-red-400")} />
                  {conexao.conectado ? (conexao.provedor === "evolution" ? "Evolution API" : "Z-API") : conexao.configurado ? "desconectado" : "sem conexão"}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept=".zip,.txt,.html,.htm" multiple onChange={arquivosEscolhidos} className="hidden" />
              <button onClick={() => !importando && fileRef.current?.click()} disabled={importando} title="Importar conversas exportadas do WhatsApp (.zip/.txt)" className={botaoIcone}>
                {importando ? <Loader2 size={17} className="animate-spin" /> : <DownloadCloud size={17} />}
              </button>
              <Link href="/atendimento/relatorio" title="Relatório em PDF das conversas" className={botaoIcone}><FileText size={17} /></Link>
              <div className="relative">
                <button onClick={() => setCfgAberto((v) => !v)} title={`Modo do Cérebro: ${modoIA}`} className={cn("flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-bold transition", settings && !settings.auditMode ? "bg-agro-400 text-black" : "bg-white/5 text-brand-200 hover:bg-white/10")}>
                  <Brain size={15} /> {modoIA}
                </button>
                {cfgAberto && settings && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCfgAberto(false)} />
                    <div className="absolute right-0 top-11 z-20 w-80 rounded-2xl border border-brand-700 bg-brand-900 p-4 text-left shadow-2xl">
                      <div className="mb-1 flex items-center gap-1.5 font-bold text-white"><Brain size={15} className="text-agro-400" /> Cérebro no WhatsApp</div>
                      <p className="mb-3 text-xs text-brand-300">Toda mensagem de cliente é analisada pelo Orientador. O que muda é se a resposta sai sozinha.</p>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-white/5">
                        <input type="radio" name="modo" checked={settings.auditMode} onChange={() => salvarSettings({ auditMode: true })} className="mt-0.5 accent-agro-400" />
                        <span className="text-sm text-brand-100"><b>Rascunho</b> — a IA sugere, você revisa e envia <span className="text-emerald-300">(recomendado)</span></span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-white/5">
                        <input type="radio" name="modo" checked={!settings.auditMode} onChange={() => salvarSettings({ auditMode: false })} className="mt-0.5 accent-agro-400" />
                        <span className="text-sm text-brand-100"><b>Automática</b> — só nas conversas com “Auto” ligado, dentro do horário e do limite abaixo</span>
                      </label>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-brand-300">
                        <label>Das<input type="number" min={0} max={23} value={settings.autoHoraInicio} onChange={(e) => salvarSettings({ autoHoraInicio: Number(e.target.value) })} className="mt-1 w-full rounded-lg bg-brand-800 px-2 py-1 text-sm text-white" />h</label>
                        <label>Até<input type="number" min={1} max={24} value={settings.autoHoraFim} onChange={(e) => salvarSettings({ autoHoraFim: Number(e.target.value) })} className="mt-1 w-full rounded-lg bg-brand-800 px-2 py-1 text-sm text-white" />h</label>
                        <label>Máx/dia<input type="number" min={0} max={1000} value={settings.autoLimiteDia} onChange={(e) => salvarSettings({ autoLimiteDia: Number(e.target.value) })} className="mt-1 w-full rounded-lg bg-brand-800 px-2 py-1 text-sm text-white" /></label>
                      </div>
                      <p className="mt-2 text-[11px] text-brand-400">Fora do horário ou acima do limite, a resposta vira rascunho.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {importMsg && <p className="mt-2 text-[11px] text-agro-300">{importMsg}</p>}
          <div className="relative mt-3">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conversa, telefone ou trecho"
              style={{ paddingLeft: 40, paddingRight: 32 }}
              className="w-full rounded-xl bg-brand-800 py-2 text-sm text-white placeholder:text-brand-400 outline-none ring-1 ring-transparent focus:ring-agro-400/60" />
            {busca && <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-white" aria-label="Limpar"><X size={14} /></button>}
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)} className={chip(filtro === f.id)} style={{ minHeight: 28 }}>
                {f.label}{f.id === "nao_lidas" && naoLidas > 0 ? ` · ${naoLidas}` : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtradas.length === 0 ? (
            <p className="p-6 text-center text-sm text-brand-400">Nenhuma conversa neste filtro.</p>
          ) : filtradas.map((c) => (
            <button key={c.id} onClick={() => setSelId(c.id)}
              className={cn("flex w-full items-center gap-3 border-b border-brand-800/70 px-4 py-3 text-left transition", selId === c.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]")}>
              <Avatar nome={nomeConv(c, c.contactName)} isGroup={c.isGroup} photo={c.contactPhotoUrl} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", c.naoLida ? "font-bold text-white" : "font-semibold text-brand-100")}>{nomeConv(c, c.contactName)}</span>
                  <span className={cn("shrink-0 text-[11px]", c.naoLida ? "font-bold text-agro-400" : "text-brand-400")}>{quandoCurto(c.lastMessageAt)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] text-brand-400">{c.previa || "—"}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {c.temRascunho && <span title="Rascunho da IA aguardando" className="rounded-full bg-agro-400/20 px-1.5 text-[10px] font-bold text-agro-300">IA</span>}
                    {c.aguardando && <span title="Cliente aguardando sua resposta" className="h-2 w-2 rounded-full bg-orange-400" />}
                    {!c.clienteId && !c.isGroup && <span title="Sem cadastro no CRM" className="text-amber-400"><AlertTriangle size={12} /></span>}
                    {c.naoLida && <span className="h-2.5 w-2.5 rounded-full bg-agro-400" />}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Coluna 2: chat ── */}
      <section className={cn("min-w-0 flex-1 flex-col", sel ? "flex" : "hidden lg:flex")}>
        {!selAtual || !sel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-brand-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-900"><MessageCircle size={30} strokeWidth={1.5} /></div>
            <p className="text-sm">Escolha uma conversa à esquerda.</p>
            {naoLidas > 0 && <button onClick={() => setFiltro("nao_lidas")} className="rounded-full bg-agro-400 px-3 py-1 text-xs font-bold text-black">{naoLidas} não lida(s)</button>}
          </div>
        ) : (
          <>
            {/* Cabeçalho do chat */}
            <div className="flex shrink-0 items-center gap-3 border-b border-brand-800 bg-brand-900 px-3 py-2.5 sm:px-4">
              <button onClick={() => setSelId(null)} className={cn(botaoIcone, "lg:hidden")} aria-label="Voltar"><ArrowLeft size={20} /></button>
              <Avatar nome={nomeConv(sel, selAtual.contactName)} isGroup={sel.isGroup} photo={sel.contactPhotoUrl} size={38} />
              <div className="min-w-0 flex-1">
                {renomeando ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { patchConv(sel, { contactName: novoNome.trim(), syncCliente }); setRenomeando(false); } if (e.key === "Escape") setRenomeando(false); }}
                        className="min-w-0 flex-1 rounded-lg bg-brand-800 px-2 py-1 text-sm font-bold text-white outline-none" style={{ maxWidth: 240 }} />
                      <button onClick={() => { patchConv(sel, { contactName: novoNome.trim(), syncCliente }); setRenomeando(false); }} className={botaoIcone}><Check size={16} /></button>
                      <button onClick={() => setRenomeando(false)} className={botaoIcone}><X size={16} /></button>
                    </div>
                    {selAtual.clienteId && (
                      <label className="flex items-center gap-1.5 text-[11px] text-brand-300"><input type="checkbox" checked={syncCliente} onChange={(e) => setSyncCliente(e.target.checked)} className="accent-agro-400" /> Atualizar também o cadastro</label>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="truncate text-sm font-bold text-white">{nomeConv(sel, selAtual.contactName)}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-brand-300">
                      <span className="truncate">{sel.isGroup ? "Grupo" : telefoneBonito(sel.externalPhone)}</span>
                      {selAtual.clienteId ? (
                        <Link href={`/clientes/${selAtual.clienteId}`} className="inline-flex items-center gap-1 text-agro-300 hover:underline"><User size={11} /> cadastro</Link>
                      ) : !sel.isGroup ? (
                        <button onClick={() => setVincularConv(sel)} className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 text-amber-300 hover:bg-amber-400/25"><Link2 size={11} /> vincular ao CRM</button>
                      ) : null}
                      {contexto?.cliente?.aguardandoResposta && <span className="rounded bg-orange-400/15 px-1.5 text-orange-300">aguardando você</span>}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => setBuscaMsg((v) => (v == null ? "" : null))} title="Buscar nas mensagens" className={cn(botaoIcone, buscaMsg != null && "bg-white/10 text-white")}><Search size={17} /></button>
              {settings && !settings.auditMode && selAtual.clienteId && (
                <button onClick={() => patchConv(sel, { aiActive: !selAtual.aiActive })} title="Resposta automática nesta conversa"
                  className={cn("flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition", selAtual.aiActive ? "bg-agro-400 text-black" : "bg-white/5 text-brand-200 hover:bg-white/10")}>
                  <Sparkles size={14} /> Auto {selAtual.aiActive ? "on" : "off"}
                </button>
              )}
              <button onClick={() => setPainelAberto((v) => !v)} title="Painel do Orientador" className={cn(botaoIcone, "xl:hidden", painelAberto && "bg-white/10 text-white")}><PanelRightOpen size={18} /></button>
              <div className="relative">
                <button onClick={() => setMenuAberto((v) => !v)} className={botaoIcone} aria-label="Mais opções"><MoreVertical size={18} /></button>
                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                    <div className="absolute right-0 top-11 z-20 w-64 rounded-2xl border border-brand-700 bg-brand-900 p-1.5 text-sm shadow-2xl">
                      {[
                        { icone: <Link2 size={15} className="text-sky-300" />, rotulo: selAtual.clienteId ? "Trocar cliente vinculado" : "Vincular a um cliente", acao: () => { setVincularConv(sel); setMenuAberto(false); } },
                        { icone: <Pencil size={15} className="text-brand-300" />, rotulo: "Editar nome do contato", acao: () => { setNovoNome(nomeConv(sel, selAtual.contactName)); setSyncCliente(false); setRenomeando(true); setMenuAberto(false); } },
                        { icone: <Handshake size={15} className="text-agro-300" />, rotulo: "Criar negociação no funil", acao: () => { setMenuAberto(false); if (!selAtual.clienteId) { setVincularConv(sel); return; } setNovaNegoConv(sel); } },
                        { icone: <CheckCircle2 size={15} className="text-emerald-300" />, rotulo: "Marcar como respondido", acao: () => { setMenuAberto(false); startTransition(async () => { await marcarRespondidoAction(sel.id); carregarContexto(sel.id); router.refresh(); }); } },
                        { icone: selAtual.ignored ? <Eye size={15} className="text-brand-300" /> : <EyeOff size={15} className="text-brand-300" />, rotulo: selAtual.ignored ? "Restaurar conversa" : "Ignorar conversa", acao: () => { setMenuAberto(false); setFlags((f) => ({ ...f, [sel.id]: { ...(f[sel.id] ?? {}), ignored: !selAtual.ignored } })); startTransition(async () => { await ignorarConversaAction(sel.id, !selAtual.ignored); router.refresh(); }); } },
                        { icone: <FileText size={15} className="text-amber-300" />, rotulo: "Relatório em PDF desta conversa", href: `/atendimento/relatorio?conversa=${sel.id}` },
                        { icone: <Trash2 size={15} className="text-red-400" />, rotulo: "Excluir conversa", acao: () => excluirConversa(sel), perigo: true },
                      ].map((item) => item.href ? (
                        <Link key={item.rotulo} href={item.href} onClick={() => setMenuAberto(false)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-brand-100 hover:bg-white/10">{item.icone} {item.rotulo}</Link>
                      ) : (
                        <button key={item.rotulo} onClick={item.acao} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10", item.perigo ? "text-red-300" : "text-brand-100")} style={{ minHeight: 36 }}>{item.icone} {item.rotulo}</button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Busca nas mensagens */}
            {buscaMsg != null && (
              <div className="flex shrink-0 items-center gap-2 border-b border-brand-800 bg-brand-900/70 px-3 py-2">
                <Search size={14} className="text-brand-400" />
                <input autoFocus value={buscaMsg} onChange={(e) => buscarNasMensagens(e.target.value)} placeholder="Buscar nesta conversa (ex.: B95C, entrada, quinta)"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-brand-400 outline-none" />
                {resultadosBusca && <span className="text-[11px] text-brand-400">{resultadosBusca.length} resultado(s)</span>}
                <button onClick={() => { setBuscaMsg(null); setResultadosBusca(null); }} className={botaoIcone} aria-label="Fechar busca"><X size={15} /></button>
              </div>
            )}

            {/* Faixa do Orientador (telas sem o painel lateral) */}
            {contexto?.orientador && (
              <button onClick={() => setPainelAberto(true)} className="flex shrink-0 items-center gap-2 border-b border-brand-800 bg-brand-900/50 px-4 py-1.5 text-left text-xs xl:hidden">
                <Compass size={13} className="shrink-0 text-agro-400" />
                <Temperatura t={contexto.orientador.temperatura} />
                <span className="text-brand-200">{contexto.orientador.estagioVenda}</span>
                {contexto.orientador.probabilidadeFechamento != null && <span className="font-bold text-agro-300">{contexto.orientador.probabilidadeFechamento}%</span>}
                {contexto.orientador.proximaAcao && <span className="truncate text-brand-400">— {contexto.orientador.proximaAcao}</span>}
              </button>
            )}

            {/* Mensagens */}
            <div ref={chatRef} onScroll={() => { const el = chatRef.current; if (el) autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
              {!resultadosBusca && temMais && (
                <div className="mb-3 flex justify-center">
                  <button onClick={carregarAnteriores} disabled={carregandoMais} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-brand-300 hover:bg-white/10" style={{ minHeight: 28 }}>
                    {carregandoMais ? <Loader2 size={12} className="animate-spin" /> : <ChevronUp size={12} />} Carregar mensagens anteriores
                  </button>
                </div>
              )}
              {resultadosBusca && resultadosBusca.length === 0 && <p className="py-8 text-center text-sm text-brand-400">Nada encontrado para “{buscaMsg}”.</p>}
              {grupos.map((g) => (
                <div key={g.dia}>
                  <div className="my-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-brand-500"><span className="h-px flex-1 bg-brand-800" />{g.dia}<span className="h-px flex-1 bg-brand-800" /></div>
                  {g.itens.map((m) => {
                    if (m.isDraft) {
                      return (
                        <div key={m.id} className="mb-2 flex justify-end">
                          <div className="w-full max-w-[85%] rounded-2xl rounded-tr-sm border border-dashed border-agro-400/60 bg-agro-400/10 p-3 text-sm sm:max-w-[70%]">
                            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-agro-300"><Brain size={12} /> {m.operatorDisplayName?.includes("Cadência") ? m.operatorDisplayName : "Sugestão do Orientador"} · revise antes de enviar</div>
                            <p className="whitespace-pre-wrap break-words text-brand-50">{m.body}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button onClick={() => draftAction(m.id, "send")} disabled={!conexao.conectado} className="inline-flex items-center gap-1 rounded-full bg-agro-400 px-3 py-1 text-xs font-bold text-black hover:bg-agro-300 disabled:opacity-40" style={{ minHeight: 30 }}><Send size={12} /> Enviar</button>
                              <button onClick={() => editarDraft(m)} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15" style={{ minHeight: 30 }}>Editar</button>
                              <button onClick={() => draftAction(m.id, "discard")} className="rounded-full px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10" style={{ minHeight: 30 }}>Descartar</button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const meu = m.direction === "OUT";
                    return (
                      <div key={m.id} className={cn("mb-1.5 flex", meu ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]", meu ? "rounded-tr-sm bg-agro-400/15 text-agro-50 ring-1 ring-agro-400/20" : "rounded-tl-sm bg-brand-800 text-brand-50")}>
                          {!meu && sel.isGroup && m.senderName && <div className="text-[11px] font-bold text-agro-300">{m.senderName}</div>}
                          {meu && m.operatorDisplayName && m.operatorDisplayName !== "Você" && <div className="text-[10px] font-semibold text-agro-300/80">{m.operatorDisplayName}</div>}
                          {m.mediaType === "image" && m.mediaUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.mediaUrl} alt="" className="mb-1 max-h-60 rounded-lg" />
                          )}
                          <span className="whitespace-pre-wrap break-words">{m.body}</span>
                          <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10px] text-brand-400">
                            {hora(m.sentAt)}
                            {meu && (m.sendStatus === "READ" ? <CheckCheck size={13} className="text-sky-400" /> : m.sendStatus === "DELIVERED" ? <CheckCheck size={13} /> : m.sendStatus === "FAILED" ? <span className="font-bold text-red-400" title="Falha no envio">!</span> : <Check size={13} />)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Caixa de texto */}
            <div className="shrink-0 border-t border-brand-800 bg-brand-900 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
              {contexto?.orientador?.melhorResposta && !texto && (
                <button onClick={() => usarResposta(contexto.orientador!.melhorResposta!)} className="mb-2 flex w-full items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-left text-xs text-brand-300 hover:bg-white/[0.07]">
                  <Sparkles size={13} className="mt-0.5 shrink-0 text-agro-400" />
                  <span className="line-clamp-2"><b className="text-agro-300">Usar resposta do Orientador:</b> {contexto.orientador.melhorResposta}</span>
                </button>
              )}
              <div className="flex items-end gap-2">
                <textarea ref={textareaRef} value={texto}
                  onChange={(e) => { setTexto(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  rows={1} placeholder={conexao.conectado ? "Escreva a mensagem (Enter envia, Shift+Enter quebra linha)" : "WhatsApp desconectado — conecte em /conexao"}
                  disabled={!conexao.conectado}
                  className="max-h-36 flex-1 resize-none rounded-xl bg-brand-800 px-3 py-2.5 text-sm text-white placeholder:text-brand-400 outline-none ring-1 ring-transparent focus:ring-agro-400/60 disabled:opacity-60" />
                <button onClick={enviar} disabled={enviando || !texto.trim() || !conexao.conectado} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-agro-400 text-black transition hover:bg-agro-300 disabled:opacity-40" aria-label="Enviar">
                  {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Coluna 3: contexto + Orientador ── */}
      {sel && (
        <aside className={cn(
          "w-[320px] shrink-0 flex-col border-l border-brand-800 bg-brand-900 xl:flex",
          painelAberto ? "absolute inset-y-0 right-0 z-30 flex w-full shadow-2xl sm:w-[360px]" : "hidden"
        )}>
          <div className="flex shrink-0 items-center justify-between border-b border-brand-800 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white"><Compass size={16} className="text-agro-400" /> Orientador de Vendas</div>
            <button onClick={() => setPainelAberto(false)} className={cn(botaoIcone, "xl:hidden")} aria-label="Fechar painel"><X size={16} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
            {carregandoContexto && !contexto ? (
              <div className="flex items-center gap-2 text-brand-400"><Loader2 size={14} className="animate-spin" /> Carregando…</div>
            ) : !contexto?.cliente ? (
              <div className="space-y-3 text-brand-300">
                <p>Esta conversa ainda não está ligada a um cliente. Vincule para o Orientador analisar e para a negociação entrar no funil.</p>
                {!sel.isGroup && <button onClick={() => setVincularConv(sel)} className="inline-flex items-center gap-1 rounded-lg bg-agro-400 px-3 py-1.5 text-xs font-bold text-black"><Link2 size={13} /> Vincular a um cliente</button>}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cliente */}
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/clientes/${contexto.cliente.id}`} className="font-bold text-white hover:text-agro-300">{contexto.cliente.nome}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-brand-300">
                        {contexto.cliente.municipio && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {contexto.cliente.municipio}</span>}
                        <span>{contexto.cliente.jaComprou ? "já é cliente" : "potencial"}</span>
                        <span title="Lead score">score {contexto.cliente.leadScore}</span>
                      </div>
                    </div>
                    {contexto.cliente.aguardandoResposta && <span className="rounded-full bg-orange-400/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">aguardando</span>}
                  </div>
                  {contexto.cliente.resumoTexto && <p className="mt-2 line-clamp-4 text-xs text-brand-300">{contexto.cliente.resumoTexto.split("\n").slice(-2).join(" ")}</p>}
                </div>

                {/* Leitura do Orientador */}
                {contexto.orientador ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <Temperatura t={contexto.orientador.temperatura} />
                      <span className="text-brand-200">{contexto.orientador.estagioVenda}</span>
                      {contexto.orientador.probabilidadeFechamento != null && <span className="rounded-full bg-agro-400/15 px-2 py-0.5 font-bold text-agro-300">{contexto.orientador.probabilidadeFechamento}% de fechar</span>}
                      {contexto.orientador.perfilComprador && <span className="text-brand-400">perfil {contexto.orientador.perfilComprador}</span>}
                    </div>
                    {contexto.orientador.resumoNegociacao && <p className="text-xs text-brand-200">{contexto.orientador.resumoNegociacao}</p>}
                    {contexto.orientador.proximaAcao && (
                      <div className="rounded-xl border border-agro-400/30 bg-agro-400/10 p-2.5 text-xs text-agro-50"><b className="text-agro-300">Próxima ação:</b> {contexto.orientador.proximaAcao}</div>
                    )}
                    {contexto.orientador.objecoes.length > 0 && (
                      <div className="text-xs text-brand-300"><b className="text-brand-200">Objeções:</b> {contexto.orientador.objecoes.join(", ")}</div>
                    )}
                    {contexto.orientador.oportunidadesPerdidas.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-4 text-xs text-brand-400">
                        {contexto.orientador.oportunidadesPerdidas.slice(0, 3).map((o) => <li key={o}>{o}</li>)}
                      </ul>
                    )}
                    {contexto.orientador.melhorResposta && (
                      <button onClick={() => usarResposta(contexto.orientador!.melhorResposta!)} className="w-full rounded-xl bg-white/[0.04] p-2.5 text-left text-xs text-brand-200 hover:bg-white/[0.08]">
                        <div className="mb-1 flex items-center gap-1 font-bold text-agro-300"><Sparkles size={12} /> Melhor resposta · clique para usar</div>
                        <p className="line-clamp-4">{contexto.orientador.melhorResposta}</p>
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-brand-400">O Orientador analisa a conversa quando chega a próxima mensagem do cliente.</p>
                )}

                {/* Negociação */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-brand-400"><span>Negociação</span>
                    <button onClick={() => setNovaNegoConv(sel)} className="text-agro-300 hover:underline">+ nova</button>
                  </div>
                  {contexto.negociacoes.length === 0 ? (
                    <p className="text-xs text-brand-400">Nenhuma negociação aberta. Quando houver sinal de compra o ZEUS abre uma; ou crie agora.</p>
                  ) : contexto.negociacoes.map((n) => (
                    <div key={n.id} className="mb-2 rounded-xl bg-white/[0.04] p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{n.maquina ?? "Máquina a definir"}</span>
                        <span className="text-emerald-300">{n.valor ? formatCurrency(n.valor) : "sem valor"}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 text-brand-300">
                        <span>{n.estagio}</span><span>· {n.papel}</span><span>· termômetro {n.termometro}</span>
                        {n.concorrente && <span className="text-red-300">· vs {n.concorrente}</span>}
                      </div>
                      {n.proximaAcao && <div className="mt-1 text-brand-400">{n.proximaAcao}</div>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Link href={`/negociacoes/${n.id}/proposta`} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 font-semibold text-white hover:bg-white/15"><FileText size={11} /> Proposta</Link>
                        <Link href="/negociacoes" className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 font-semibold text-white hover:bg-white/15"><Handshake size={11} /> Funil</Link>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Agenda e cadência */}
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <div className="mb-1 flex items-center gap-1 font-bold text-brand-200"><Calendar size={12} className="text-sky-300" /> Visitas</div>
                    {contexto.visitas.length === 0 && !contexto.cliente.proximaVisita ? (
                      <Link href={`/clientes/${contexto.cliente.id}`} className="text-brand-400 hover:text-agro-300">Nenhuma marcada · agendar no cadastro</Link>
                    ) : (
                      <ul className="space-y-0.5 text-brand-300">
                        {contexto.visitas.map((v) => <li key={v.id}>{new Date(v.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}{v.observacao ? ` · ${v.observacao}` : ""}</li>)}
                        {contexto.cliente.proximaVisita && contexto.visitas.length === 0 && <li>{new Date(contexto.cliente.proximaVisita).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}{contexto.cliente.proximaVisitaNota ? ` · ${contexto.cliente.proximaVisitaNota}` : ""}</li>}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <div className="mb-1 flex items-center gap-1 font-bold text-brand-200"><Repeat size={12} className="text-amber-300" /> Cadência de 7 toques</div>
                    {contexto.cadencia ? (
                      <span className="text-brand-300">Ativa · toque {contexto.cadencia.toqueAtual}/7 · próximo {new Date(contexto.cadencia.proximoToqueEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                    ) : (
                      <Link href={`/clientes/${contexto.cliente.id}`} className="text-brand-400 hover:text-agro-300">Não iniciada · iniciar no cadastro</Link>
                    )}
                  </div>
                </div>

                {contexto.alertas.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-brand-400"><Bell size={11} /> Alertas</div>
                    {contexto.alertas.map((a) => (
                      <div key={a.id} className="mb-1.5 flex items-start justify-between gap-2 rounded-lg bg-orange-400/10 p-2 text-xs text-orange-100">
                        <span>{a.mensagem}</span>
                        <button onClick={() => { setContexto((c) => c ? { ...c, alertas: c.alertas.filter((x) => x.id !== a.id) } : c); resolverAlertaConversaAction(a.id); }} title="Resolvido" className="shrink-0 text-orange-300 hover:text-white"><CheckCircle2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                  <Link href={`/clientes/${contexto.cliente.id}`} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-white hover:bg-white/15"><User size={12} /> Cadastro</Link>
                  {negociacaoAberta && <Link href={`/negociacoes/${negociacaoAberta.id}/proposta`} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold text-white hover:bg-white/15"><Wallet size={12} /> Calculadora</Link>}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {novaNegoConv && (
        <FormNovaNegociacao
          titulo="Nova Negociação"
          clienteIdFixo={novaNegoConv.clienteId ?? contexto?.cliente?.id ?? ""}
          clienteNomeFixo={contexto?.cliente?.nome ?? novaNegoConv.contactName ?? novaNegoConv.externalPhone}
          colunas={colunasFunil}
          maquinasProprias={maquinasProprias}
          onFechar={() => setNovaNegoConv(null)}
          onSucesso={() => { router.refresh(); if (selId) carregarContexto(selId); }}
        />
      )}
      {vincularConv && (
        <VincularContatoModal conv={vincularConv} onClose={() => setVincularConv(null)}
          onVinculado={(clienteId) => { patchConv(vincularConv, { clienteId }); setVincularConv(null); if (selId) setTimeout(() => carregarContexto(selId), 800); }} />
      )}
    </div>
  );
}

// ── Modal Vincular Contato ────────────────────────────────────────────────────
function VincularContatoModal({ conv, onClose, onVinculado }: {
  conv: ConvLista;
  onClose: () => void;
  onVinculado: (clienteId: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setCarregando(true);
    fetch(`/api/clientes/busca?q=${encodeURIComponent(busca || conv.externalPhone)}`)
      .then((r) => r.json()).then((d) => setClientes(d.clientes ?? [])).catch(() => {}).finally(() => setCarregando(false));
  }, [busca, conv.externalPhone]);

  async function vincular(clienteId: string) {
    setSalvando(true);
    try {
      await fetch(`/api/conversations/${conv.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clienteId }) });
      onVinculado(clienteId);
    } catch {
      window.alert("Erro ao vincular contato.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-brand-700 bg-brand-900 text-brand-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-brand-800 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-white"><Link2 size={16} className="text-agro-400" /> Vincular a um cliente</h3>
            <p className="mt-0.5 text-xs text-brand-400">{telefoneBonito(conv.externalPhone)}</p>
          </div>
          <button onClick={onClose} className={botaoIcone}><X size={18} /></button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-brand-300">Escolha o cliente do CRM desta conversa. O Orientador passa a usar o cadastro nas respostas e a negociação entra no funil.</p>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" autoFocus
            className="w-full rounded-xl bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-400 outline-none focus:ring-1 focus:ring-agro-400/60" />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {carregando ? (
              <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-brand-400" /></div>
            ) : clientes.length === 0 ? (
              <p className="py-4 text-center text-sm text-brand-400">Nenhum cliente encontrado</p>
            ) : clientes.map((c) => (
              <button key={c.id} onClick={() => vincular(c.id)} disabled={salvando}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 disabled:opacity-50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-agro-400/20 text-sm font-bold text-agro-300">{c.nome.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{c.nome}</div>
                  {c.telefone && <div className="text-xs text-brand-400">{telefoneBonito(c.telefone)}</div>}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-brand-800 pt-2">
            <p className="text-xs text-brand-400">Não encontrou? <Link href={`/clientes?q=${encodeURIComponent(conv.externalPhone.replace(/\D/g, ""))}`} className="text-agro-300 hover:underline">Abrir Clientes</Link> e cadastrar com este telefone (o ZEUS vincula sozinho na próxima mensagem).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
