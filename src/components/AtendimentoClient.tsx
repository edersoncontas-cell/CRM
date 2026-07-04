"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
Search, Send, ArrowLeft, Check, CheckCheck, User, MoreVertical, MessageCircle, Users,
DownloadCloud, Loader2, Brain, Trash2, Pencil, X, FileText, Handshake, RefreshCw, Link2,
} from "lucide-react";
import { unzipSync, strFromU8 } from "fflate";
import { parseWhatsAppLines, montarChat, nomeDoArquivo, type ParsedChat } from "@/lib/whatsapp-export-parser";

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

function iniciais(s: string) {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}
function nomeConv(
  c: { contactName: string | null; groupName: string | null; isGroup: boolean; externalPhone: string },
  overlayName?: string | null,
) {
  if (overlayName) return overlayName;
  return (c.isGroup ? c.groupName : c.contactName) || c.contactName || c.externalPhone;
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
    <div className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: isGroup ? "#667781" : "#00a884", fontSize: Math.round(size * 0.34) }}>
      {isGroup ? <Users size={Math.round(size * 0.45)} /> : iniciais(nome)}
    </div>
  );
}

export function AtendimentoClient({
  conversas, zapiAtiva, convInicial, maquinasProprias,
}: {
  conversas: ConvLista[];
  zapiAtiva: boolean;
  convInicial?: string | null;
  maquinasProprias: { marca: string; modelo: string }[];
}) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(convInicial ?? null);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"tudo" | "ignoradas">("tudo");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [sincMsg, setSincMsg] = useState<string | null>(null);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, { aiActive: boolean; ignored: boolean; category: string | null; contactName?: string }>>({});
  const [menuAberto, setMenuAberto] = useState(false);
  const [cfgAberto, setCfgAberto] = useState(false);
  const [auditMode, setAuditMode] = useState<boolean | null>(null);
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [novaNegoConv, setNovaNegoConv] = useState<ConvLista | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [syncCliente, setSyncCliente] = useState(false);
  const [vincularConv, setVincularConv] = useState<ConvLista | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const prevSelIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/whatsapp/settings").then((r) => r.json()).then((d) => setAuditMode(d.auditMode)).catch(() => {});
  }, []);

  const curr = useCallback(
    (c: ConvLista) => flags[c.id] ?? { aiActive: c.aiActive, ignored: c.ignored, category: c.category },
    [flags],
  );

  async function patchConv(c: ConvLista, patch: Partial<{ aiActive: boolean; ignored: boolean; category: string; contactName: string; clienteId: string | null; syncCliente: boolean }>) {
    const { syncCliente: _syncCliente, ...overlayPatch } = patch;
    const base = curr(c);
    setFlags((f) => ({ ...f, [c.id]: { ...base, ...overlayPatch } }));
    try {
      await fetch(`/api/conversations/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    } catch {}
    router.refresh();
  }

  function abrirRenomear(c: ConvLista) {
    setNovoNome(nomeConv(c, curr(c).contactName));
    setRenomeandoId(c.id);
    setSyncCliente(false);
    setMenuAberto(false);
  }

  async function salvarNome(c: ConvLista) {
    const nome = novoNome.trim();
    if (!nome || nome === nomeConv(c, curr(c).contactName)) { setRenomeandoId(null); return; }
    await patchConv(c, { contactName: nome, syncCliente });
    setRenomeandoId(null);
  }

  async function excluirConversa(c: ConvLista) {
    const nome = c.contactName || c.groupName || c.externalPhone || "esta conversa";
    if (!window.confirm(`Excluir a conversa com "${nome}"?\n\nTodas as mensagens serão apagadas.`)) return;
    setMenuAberto(false);
    try {
      const r = await fetch(`/api/conversations/${c.id}`, { method: "DELETE" }).then((res) => res.json()).catch(() => null);
      if (!r?.ok) { window.alert("Não foi possível excluir a conversa."); return; }
    } catch {
      window.alert("Não foi possível excluir a conversa.");
      return;
    }
    if (selId === c.id) { setSelId(null); setMensagens([]); }
    router.refresh();
  }

  async function sincronizarConversas() {
    if (sincronizando) return;
    setSincronizando(true);
    setSincMsg("Sincronizando...");
    try {
      const r = await fetch("/api/whatsapp/sincronizar").then((res) => res.json()).catch(() => null);
      if (r?.ok) {
        setSincMsg(r.removidos > 0 ? `✅ ${r.removidos} removida(s)` : "✅ Sincronizado");
      } else {
        setSincMsg("❌ " + (r?.erro ?? "Erro"));
      }
      router.refresh();
    } catch {
      setSincMsg("❌ Erro");
    } finally {
      setSincronizando(false);
      setTimeout(() => setSincMsg(null), 5000);
    }
  }

  async function setAudit(v: boolean) {
    setAuditMode(v);
    try {
      await fetch("/api/whatsapp/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditMode: v }) });
    } catch {}
  }

  async function draftAction(messageId: string, action: "send" | "discard") {
    if (!selId) return;
    const r = await fetch(`/api/conversations/${selId}/drafts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, action }),
    }).then((res) => res.json()).catch(() => null);
    if (!r?.ok) return;
    if (action === "discard") setMensagens((p) => p.filter((m) => m.id !== messageId));
    else if (r.message) setMensagens((p) => p.map((m) => (m.id === messageId ? r.message : m)));
  }

  function editarDraft(m: Mensagem) {
    setTexto(m.body);
    draftAction(m.id, "discard");
  }

  function htmlParaTexto(html: string): string {
    const comQuebras = html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n");
    const doc = new DOMParser().parseFromString(comQuebras, "text/html");
    return doc.body?.textContent ?? "";
  }

  function abrirSeletor() {
    if (importando) return;
    fileRef.current?.click();
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
        for (const { path, texto } of textos) {
          const raw = parseWhatsAppLines(texto);
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
      if (!chats.length) {
        setImportMsg("Nenhuma mensagem reconhecida.");
        setImportando(false);
        setTimeout(() => setImportMsg(null), 5000);
        return;
      }
      let convOk = 0, msgsOk = 0, i = 0;
      for (const chat of chats) {
        i++;
        setImportMsg(`Importando ${i}/${chats.length}…`);
        const r = await fetch("/api/whatsapp/import-file", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chats: [chat] }),
        }).then((res) => res.json()).catch(() => null);
        if (r?.ok) { convOk += r.conversas; msgsOk += r.mensagens; }
      }
      setImportMsg(`✅ ${convOk} conversas, ${msgsOk} msgs`);
    } catch (err) {
      console.error(err);
      setImportMsg("Falha ao ler os arquivos.");
    } finally {
      setImportando(false);
      setTimeout(() => setImportMsg(null), 6000);
      router.refresh();
    }
  }

  useEffect(() => {
    // 30s: só atualiza a LISTA de conversas (novas/renomeadas/etc). As
    // mensagens da conversa aberta já chegam em tempo real via SSE.
    const iv = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(iv);
  }, [router]);

  const sel = conversas.find((c) => c.id === selId) ?? null;

  const mergeMsgs = useCallback((novas: Mensagem[]) => {
    setMensagens((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = novas.filter((m) => !ids.has(m.id));
      if (!add.length) return prev;
      return [...prev, ...add].sort((a, b) => +new Date(a.sentAt) - +new Date(b.sentAt));
    });
  }, []);

  useEffect(() => {
    esRef.current?.close();
    if (!selId) { setMensagens([]); return; }
    let vivo = true;
    fetch(`/api/conversations/${selId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        setMensagens(d.messages ?? []);
        const ultimo = d.messages?.[d.messages.length - 1]?.id ?? "";
        const es = new EventSource(`/api/conversations/${selId}/stream${ultimo ? `?after=${ultimo}` : ""}`);
        es.addEventListener("messages", (e) => {
          try { mergeMsgs(JSON.parse((e as MessageEvent).data)); } catch {}
        });
        esRef.current = es;
      })
      .catch(() => {});
    return () => { vivo = false; esRef.current?.close(); };
  }, [selId, mergeMsgs]);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    // Ao trocar de conversa, força ir para o fim mesmo que a quantidade de
    // mensagens coincida com a da conversa anterior (o efeito não dispararia
    // só pela dependência de mensagens.length nesse caso).
    const trocouConversa = prevSelIdRef.current !== selId;
    prevSelIdRef.current = selId;
    if (trocouConversa || autoScrollRef.current) el.scrollTop = el.scrollHeight;
  }, [selId, mensagens.length]);

  async function enviar() {
    const t = texto.trim();
    if (!t || !selId) return;
    setTexto("");
    setEnviando(true);
    autoScrollRef.current = true;
    const temp: Mensagem = { id: `tmp-${Date.now()}`, direction: "OUT", body: t, senderName: null, operatorDisplayName: "Você", mediaType: null, mediaUrl: null, sentAt: new Date().toISOString(), sendStatus: "QUEUED", isDraft: false };
    setMensagens((p) => [...p, temp]);
    try {
      const r = await fetch(`/api/conversations/${selId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t }) });
      const d = await r.json();
      if (d?.message) setMensagens((p) => p.map((m) => (m.id === temp.id ? d.message : m)));
    } catch {
      setMensagens((p) => p.map((m) => (m.id === temp.id ? { ...m, sendStatus: "FAILED" } : m)));
    } finally {
      setEnviando(false);
    }
  }

  const filtradas = conversas
    .filter((c) => (aba === "ignoradas" ? curr(c).ignored : !curr(c).ignored))
    .filter((c) => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return nomeConv(c, curr(c).contactName).toLowerCase().includes(q) || c.externalPhone.includes(q) || c.previa.toLowerCase().includes(q);
    });

  async function gerarResumoCerebro(conv: ConvLista) {
    if (gerandoResumo) return;
    setGerandoResumo(true);
    setMenuAberto(false);
    try {
      if (!conv.clienteId) {
        router.push(`/clientes?q=${encodeURIComponent(conv.externalPhone)}`);
        return;
      }
      const r = await fetch(`/api/cerebro/resumo/${conv.clienteId}`, { method: 'POST' });
      const d = await r.json();
      if (d?.ok && d?.resumo) {
        window.alert(`✅ Resumo gerado!\n\n${d.resumo.slice(0, 400)}${d.resumo.length > 400 ? '...' : ''}`);
        router.refresh();
      } else {
        window.alert('Sem histórico suficiente. Importe conversas primeiro.');
      }
    } catch (e) {
      window.alert('Erro: ' + String(e));
    } finally {
      setGerandoResumo(false);
    }
  }

  async function abrirModalNegociacao(conv: ConvLista) {
    setMenuAberto(false);
    if (!conv.clienteId) {
      window.alert('Esta conversa não está vinculada a um cliente. Use "Vincular Contato" primeiro.');
      return;
    }
    setNovaNegoConv(conv);
  }

  async function importarHistoricoConversa(conv: ConvLista) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.txt,.html,.htm';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        let chatText = '';
        if (file.name.endsWith('.zip')) {
          const buf = await file.arrayBuffer();
          const unzipped = unzipSync(new Uint8Array(buf));
          const txtKey = Object.keys(unzipped).find(k => k.endsWith('.txt'));
          if (!txtKey) { alert('Arquivo .txt não encontrado no .zip'); return; }
          chatText = strFromU8(unzipped[txtKey]);
        } else {
          chatText = await file.text();
        }
        const parsed = parseWhatsAppLines(chatText);
        const chatMontado = montarChat(file.name, parsed);
        const res = await fetch('/api/cerebro/processar-historico', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conv.id,
            externalPhone: conv.externalPhone,
            clienteId: conv.clienteId,
            historico: chatMontado,
            linhas: parsed,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        alert(`✅ Histórico importado!\n${result.resumo || ''}`);
        router.refresh();
      } catch (err: unknown) {
        alert('Erro: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    input.click();
  }

  return (
    <div
      className="-m-4 flex overflow-hidden sm:-m-6 md:-m-8 h-[calc(100dvh-57px-max(0.75rem,env(safe-area-inset-top)))] md:h-[100dvh]"
      style={{ background: "#111b21" }}
    >
      {/* ── Lista ── */}
      <aside className={`flex w-full flex-col border-r lg:w-80 ${sel ? "hidden lg:flex" : "flex"}`} style={{ borderColor: "#2a3942", background: "#111b21" }}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: "#008069" }}>
          <span className="flex items-center gap-2 font-semibold text-white"><MessageCircle size={18} /> Atendimento</span>
          <div className="flex items-center gap-2">
            {!zapiAtiva && <span className="rounded-full bg-yellow-400/90 px-2 py-0.5 text-[10px] font-bold text-black">offline</span>}
            <input ref={fileRef} type="file" accept=".zip,.txt,.html,.htm" multiple onChange={arquivosEscolhidos} className="hidden" />
            <button onClick={abrirSeletor} disabled={importando} title="Importar conversas"
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25 disabled:opacity-60">
              {importando ? <Loader2 size={13} className="animate-spin" /> : <DownloadCloud size={13} />}
              <span className="hidden sm:inline">{importMsg ?? "Importar"}</span>
            </button>
            <button onClick={sincronizarConversas} disabled={sincronizando} title="Sincronizar"
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25 disabled:opacity-60">
              {sincronizando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              <span className="hidden sm:inline">{sincMsg ?? "Sincronizar"}</span>
            </button>
            <div className="relative">
              <button onClick={() => setCfgAberto((v) => !v)} title="Configurar Cérebro"
                className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-white hover:bg-white/25">
                <Brain size={15} />
              </button>
              {cfgAberto && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCfgAberto(false)} />
                  <div className="absolute right-0 top-9 z-20 w-72 rounded-xl bg-white p-3 text-left shadow-xl" style={{ color: "#111b21" }}>
                    <div className="mb-1 flex items-center gap-1.5 font-bold"><Brain size={15} style={{ color: "#BFDE4D" }} /> Cérebro (IA)</div>
                    <p className="mb-2 text-xs text-slate-500">Modo de resposta do Cérebro:</p>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-slate-50">
                      <input type="radio" name="audit" checked={auditMode === true} onChange={() => setAudit(true)} className="mt-0.5" />
                      <span className="text-sm"><b>Sugerir rascunho</b> para revisar <span className="text-emerald-600">(recomendado)</span></span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-slate-50">
                      <input type="radio" name="audit" checked={auditMode === false} onChange={() => setAudit(false)} className="mt-0.5" />
                      <span className="text-sm"><b>Responder automático</b></span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="p-2 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8696a0" }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar"
              className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none" style={{ background: "#1e2a2a", color: "#e9edef" }} />
          </div>
          <div className="mt-2 flex gap-1 text-xs">
            {(["tudo", "ignoradas"] as const).map((a) => (
              <button key={a} onClick={() => setAba(a)} className="rounded-full px-3 py-1 font-medium"
                style={aba === a ? { background: "#00a884", color: "#fff" } : { background: "#f0f2f5", color: "#667781" }}>
                {a === "tudo" ? "Tudo" : "Ignoradas"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {filtradas.length === 0 ? (
            <p className="p-6 text-center text-sm" style={{ color: "#8696a0" }}>Nenhuma conversa.</p>
          ) : filtradas.map((c) => (
            <button key={c.id} onClick={() => setSelId(c.id)}
              className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left ${selId === c.id ? "bg-[#1e2a2a]" : "hover:bg-[#1e2a2a]/80"}`}
              style={{ borderColor: "#2a3942" }}>
              <Avatar nome={nomeConv(c, curr(c).contactName)} isGroup={c.isGroup} photo={c.contactPhotoUrl} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-semibold" style={{ color: "#e9edef" }}>{nomeConv(c, curr(c).contactName)}</span>
                  <span className="shrink-0 text-[11px]" style={{ color: c.naoLida ? "#00a884" : "#667781" }}>{hora(c.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[13px]" style={{ color: "#667781" }}>{c.previa || "—"}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {!c.clienteId && <span title="Contato não vinculado" style={{ color: "#f59e0b", fontSize: 10 }}>⚠</span>}
                    {c.naoLida && <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#00a884" }} />}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Painel ── */}
      <section className={`flex flex-1 flex-col min-h-0 ${sel ? "flex" : "hidden lg:flex"}`} style={{ overflow: "hidden" }}>
        {!sel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ background: "#111b21", color: "#8696a0" }}>
            <MessageCircle size={56} strokeWidth={1} />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header — fixo no topo, não rola */}
            <div className="flex items-center gap-3 px-4 py-2.5 shrink-0" style={{ background: "#008069", zIndex: 10 }}>
              <button onClick={() => setSelId(null)} className="rounded-full p-1 text-white/90 hover:bg-white/10 lg:hidden"><ArrowLeft size={20} /></button>
              <Avatar nome={nomeConv(sel, curr(sel).contactName)} isGroup={sel.isGroup} photo={sel.contactPhotoUrl} size={36} />
              <div className="min-w-0 flex-1">
                {renomeandoId === sel.id ? (
                  <div>
                    <div className="flex items-center gap-1">
                      <input autoFocus value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") salvarNome(sel); if (e.key === "Escape") setRenomeandoId(null); }}
                        className="min-w-0 flex-1 rounded bg-white/20 px-2 py-0.5 text-sm font-bold text-white outline-none" style={{ maxWidth: 180 }} />
                      <button onClick={() => salvarNome(sel)} className="rounded p-1 text-white/80 hover:bg-white/20"><Check size={14} /></button>
                      <button onClick={() => setRenomeandoId(null)} className="rounded p-1 text-white/60 hover:bg-white/20"><X size={14} /></button>
                    </div>
                    {sel.clienteId && (
                      <label className="mt-1 flex items-center gap-1.5 text-[11px] font-normal text-white/80">
                        <input type="checkbox" checked={syncCliente} onChange={(e) => setSyncCliente(e.target.checked)} />
                        Atualizar também o cadastro
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="truncate text-sm font-bold text-white">{nomeConv(sel, curr(sel).contactName)}</div>
                )}
                <div className="text-[11px] text-white/70 flex items-center gap-1">
                  {sel.isGroup ? "Grupo" : sel.externalPhone}
                  {!sel.clienteId && <span className="ml-1 rounded bg-amber-400/20 px-1 py-0.5 text-[10px] text-amber-300 font-bold">sem vínculo</span>}
                </div>
              </div>
              <button onClick={() => patchConv(sel, { aiActive: !curr(sel).aiActive })} title="Ligar/desligar Cérebro"
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                style={curr(sel).aiActive ? { background: "#BFDE4D", color: "#111" } : { background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                <Brain size={14} /> {curr(sel).aiActive ? "Cérebro ON" : "Cérebro"}
              </button>
              <div className="relative">
                <button onClick={() => setMenuAberto((v) => !v)} className="rounded-full p-1 text-white/80 hover:bg-white/10">
                  <MoreVertical size={18} />
                </button>
                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                    <div className="absolute right-0 top-9 z-20 w-60 rounded-xl p-1 text-sm shadow-xl"
                      style={{ background: "#1e2a2a", color: "#e9edef", border: "1px solid #2a3942" }}>
                      <Link href={sel.clienteId ? `/clientes/${sel.clienteId}` : `/clientes?q=${encodeURIComponent(sel.externalPhone)}`}
                        onClick={() => setMenuAberto(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10">
                        <User size={15} style={{ color: "#00a884" }} /> Acessar cadastro do cliente
                      </Link>
                      <button onClick={() => { setVincularConv(sel); setMenuAberto(false); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10">
                        <Link2 size={15} style={{ color: "#60a5fa" }} /> Vincular Contato
                      </button>
                      <button onClick={() => abrirRenomear(sel)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10">
                        <Pencil size={15} style={{ color: "#aebac1" }} /> Editar nome do contato
                      </button>
                      <div className="my-1 border-t" style={{ borderColor: "#2a3942" }} />
                      <button onClick={() => importarHistoricoConversa(sel)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10">
                        <DownloadCloud size={15} style={{ color: "#aebac1" }} /> Importar histórico
                      </button>
                      <button onClick={() => gerarResumoCerebro(sel)} disabled={gerandoResumo}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10 disabled:opacity-60">
                        <FileText size={15} style={{ color: "#BFDE4D" }} />
                        {gerandoResumo ? "Gerando resumo…" : "Gerar resumo pelo Cérebro"}
                      </button>
                      <button onClick={() => abrirModalNegociacao(sel)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/10">
                        <Handshake size={15} style={{ color: "#60a5fa" }} /> Gerar Negociação
                      </button>
                      <div className="my-1 border-t" style={{ borderColor: "#2a3942" }} />
                      <button onClick={() => excluirConversa(sel)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-red-400 hover:bg-red-500/10">
                        <Trash2 size={15} /> Excluir conversa
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mensagens — rola sozinho, flex-1 com overflow-y-auto */}
            <div ref={chatRef} onScroll={() => {
              const el = chatRef.current;
              if (!el) return;
              autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            }}
              className="flex-1 overflow-y-auto px-4 py-4 sm:px-10 min-h-0" style={{ background: "#0b1014" }}>
              {mensagens.map((m) => {
                if (m.isDraft) {
                  return (
                    <div key={m.id} className="mb-2 flex justify-end">
                      <div className="max-w-[80%] rounded-lg border border-dashed border-amber-400 bg-amber-50 p-2.5 text-sm shadow-sm">
                        <div className="mb-1 flex items-center gap-1 text-[11px] font-bold" style={{ color: "#7a8a00" }}>
                          <Brain size={12} /> Sugestão do Cérebro
                        </div>
                        <p className="whitespace-pre-wrap break-words" style={{ color: "#111b21" }}>{m.body}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button onClick={() => draftAction(m.id, "send")}
                            className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: "#008069" }}>
                            <Send size={12} /> Enviar
                          </button>
                          <button onClick={() => editarDraft(m)}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50">
                            Editar
                          </button>
                          <button onClick={() => draftAction(m.id, "discard")}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                            Descartar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const meu = m.direction === "OUT";
                return (
                  <div key={m.id} className={`mb-1.5 flex ${meu ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm" style={{ background: meu ? "#005c4b" : "#1e2a2a", color: "#e9edef" }}>
                      {!meu && sel.isGroup && m.senderName && <div className="text-[11px] font-bold" style={{ color: "#00a884" }}>{m.senderName}</div>}
                      {m.mediaType === "image" && m.mediaUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.mediaUrl} alt="" className="mb-1 max-h-60 rounded-md" />
                      )}
                      <span className="whitespace-pre-wrap break-words">{m.body}</span>
                      <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10px]" style={{ color: "#8696a0" }}>
                        {hora(m.sentAt)}
                        {meu && (m.sendStatus === "READ"
                          ? <CheckCheck size={13} className="text-[#53bdeb]" />
                          : m.sendStatus === "DELIVERED" ? <CheckCheck size={13} />
                          : m.sendStatus === "FAILED" ? <span className="text-red-500">!</span>
                          : <Check size={13} />)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input — fixo no fundo, não rola */}
            <div className="flex items-end gap-2 px-3 py-2.5 shrink-0" style={{ background: "#1e2a2a" }}>
              <textarea value={texto}
                onChange={(e) => { setTexto(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                rows={1} placeholder={zapiAtiva ? "Digite uma mensagem" : "WhatsApp desconectado"}
                className="max-h-28 flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "#2a3942", color: "#e9edef" }} />
              <button onClick={enviar} disabled={enviando || !texto.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50" style={{ background: "#008069" }}>
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </section>
      {novaNegoConv && <NovaNegoModal conv={novaNegoConv} maquinasProprias={maquinasProprias} onClose={() => setNovaNegoConv(null)} />}
      {vincularConv && <VincularContatoModal conv={vincularConv} onClose={() => setVincularConv(null)} onVinculado={(clienteId) => { patchConv(vincularConv, { clienteId }); setVincularConv(null); }} />}
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
      .then(r => r.json())
      .then(d => setClientes(d.clientes ?? []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [busca, conv.externalPhone]);

  async function vincular(clienteId: string) {
    setSalvando(true);
    try {
      await fetch(`/api/conversations/${conv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId }),
      });
      onVinculado(clienteId);
    } catch {
      window.alert("Erro ao vincular contato.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: "#1e2a2a" }}>
          <div>
            <h3 className="font-bold text-white flex items-center gap-2"><Link2 size={16} /> Vincular Contato</h3>
            <p className="text-xs text-slate-400 mt-0.5">{conv.externalPhone}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500">Escolha o cliente do CRM que corresponde a esta conversa. O Cérebro usará os dados deste cliente para todas as respostas.</p>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {carregando ? (
              <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
            ) : clientes.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">Nenhum cliente encontrado</p>
            ) : clientes.map(c => (
              <button key={c.id} onClick={() => vincular(c.id)} disabled={salvando}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left hover:bg-blue-50 hover:border-blue-200 transition-colors disabled:opacity-50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">{c.nome}</div>
                  {c.telefone && <div className="text-xs text-slate-400">{c.telefone}</div>}
                </div>
              </button>
            ))}
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-slate-400">Não encontrou? <a href="/clientes/novo" className="text-blue-600 hover:underline">Cadastrar novo cliente</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MARCAS E MODELOS ───────────────────────────────────────────────────
// Vêm do banco (máquinas próprias, proprio: true) via prop — nunca mais
// hardcoded (a lista antiga tinha modelos que a New Holland não vende aqui).
const BANCOS_OPCOES = [
  "Banco CNH","Sicoob","Sicredi","Bradesco","Banestes",
  "Banco do Nordeste","Banco do Brasil","Banco Itaú","Outros Bancos",
];

function formatBRL(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return num.toLocaleString("pt-BR");
}

function calcPercentual(valor: number, total: number): string {
  if (!total) return "";
  return ((valor / total) * 100).toFixed(1);
}
function calcValorDePerc(perc: number, total: number): string {
  if (!total) return "";
  return Math.round((perc / 100) * total).toLocaleString("pt-BR");
}

type NovaNegoModalProps = {
  conv: ConvLista;
  maquinasProprias: { marca: string; modelo: string }[];
  onClose: () => void;
};

function NovaNegoModal({ conv, maquinasProprias, onClose }: NovaNegoModalProps) {
  const modelosPorMarca = (m: string) => maquinasProprias.filter((x) => x.marca === m).map((x) => x.modelo);
  const router = useRouter();
  const [marca, setMarca] = useState<"New Holland" | "Dynapac" | "">("");
  const [tipoPagamento, setTipoPagamento] = useState("");
  const [valorStr, setValorStr] = useState("");
  const [entradaValorStr, setEntradaValorStr] = useState("");
  const [entradaPercStr, setEntradaPercStr] = useState("");
  const [pagamentoNaEntrega, setPagamentoNaEntrega] = useState(false);
  const [crdQtd, setCrdQtd] = useState("");
  const [saving, setSaving] = useState(false);

  const valorNum = parseFloat(valorStr.replace(/\./g, "").replace(",", ".")) || 0;

  function onEntradaValorChange(v: string) {
    const digits = v.replace(/\D/g, "");
    const num = parseInt(digits || "0", 10);
    setEntradaValorStr(num.toLocaleString("pt-BR"));
    if (valorNum) setEntradaPercStr(calcPercentual(num, valorNum));
  }
  function onEntradaPercChange(v: string) {
    const perc = parseFloat(v.replace(",", ".")) || 0;
    setEntradaPercStr(v);
    if (valorNum) setEntradaValorStr(calcValorDePerc(perc, valorNum));
  }

  const crdSaldo = valorNum - (parseFloat(entradaValorStr.replace(/\./g, "").replace(",", ".")) || 0);
  const crdQtdNum = parseInt(crdQtd) || 1;
  const crdParcelaCalc = crdQtd ? (crdSaldo / crdQtdNum).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("clienteId", conv.clienteId ?? "");
    fd.set("valor", valorStr.replace(/\./g, "").replace(",", "."));
    fd.set("entradaValor", entradaValorStr.replace(/\./g, "").replace(",", "."));
    fd.set("entradaPercentual", entradaPercStr.replace(",", "."));
    fd.set("pagamentoNaEntrega", pagamentoNaEntrega ? "true" : "false");
    if (crdQtd) {
      fd.set("crdSaldoParcelasQtd", crdQtd);
      fd.set("crdParcelaValor", crdSaldo.toFixed(2));
    }
    try {
      const { criarNegociacaoCompleta } = await import("@/lib/actions");
      const res = await criarNegociacaoCompleta(fd);
      if (res && typeof res === "object" && "ok" in res && !res.ok) {
        window.alert("Erro: " + (res as any).erro);
      } else {
        router.refresh();
        onClose();
      }
    } catch (err) {
      window.alert("Erro: " + String(err));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  const selectCls = inputCls;
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">Nova Negociação</h3>
            <p className="text-xs text-slate-400 mt-0.5">{conv.contactName || conv.externalPhone}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-all"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelCls}>Marca</span>
              <select name="marca" value={marca} onChange={e => setMarca(e.target.value as any)} className={selectCls}>
                <option value="">— Selecionar —</option>
                <option value="New Holland">New Holland</option>
                <option value="Dynapac">Dynapac</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Máquina</span>
              <select name="maquinaModelo" className={selectCls} disabled={!marca}>
                <option value="">{marca ? "— Selecionar —" : "Selecione a marca"}</option>
                {(marca ? modelosPorMarca(marca) : []).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Valor (R$)</span>
            <input type="text" inputMode="numeric" value={valorStr} onChange={e => setValorStr(formatBRL(e.target.value))} placeholder="0" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Estágio / Coluna</span>
            <select name="estagio" className={selectCls} defaultValue="Primeiro contato">
              <option value="Primeiro contato">Primeiro contato</option>
              <option value="Visitas pendentes">Visitas pendentes</option>
              <option value="Visita realizada">Visita realizada</option>
              <option value="Proposta no BCNH">Proposta no BCNH</option>
              <option value="Vendas Confirmadas">Vendas Confirmadas</option>
              <option value="Faturado">Faturado</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Pagamento</span>
            <select name="tipoPagamento" value={tipoPagamento} onChange={e => setTipoPagamento(e.target.value)} className={selectCls}>
              <option value="">—</option>
              <option value="avista">À vista</option>
              <option value="financiamento">Financiamento</option>
              <option value="consorcio">Consórcio</option>
              <option value="crd_pme">CRD PME</option>
            </select>
          </label>
          {tipoPagamento === "avista" && (
            <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 space-y-3">
              <p className="text-xs font-bold text-sky-700 uppercase">Condição — À Vista</p>
              <label className="block"><span className={labelCls}>Data do pagamento</span>
                <input type="date" name="dataPagamentoAvista" disabled={pagamentoNaEntrega} className={inputCls} />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={pagamentoNaEntrega} onChange={e => setPagamentoNaEntrega(e.target.checked)} />
                <span className="text-sm">Pagamento na entrega</span>
              </label>
            </div>
          )}
          {tipoPagamento === "financiamento" && (
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 space-y-3">
              <p className="text-xs font-bold text-violet-700 uppercase">Condição — Financiamento</p>
              <label className="block"><span className={labelCls}>Banco</span>
                <select name="bancoFinanciamento" className={selectCls}>
                  <option value="">— Selecionar —</option>
                  {BANCOS_OPCOES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={labelCls}>Entrada (R$)</span>
                  <input type="text" inputMode="numeric" value={entradaValorStr} onChange={e => onEntradaValorChange(e.target.value)} placeholder="0" className={inputCls} />
                </label>
                <label className="block"><span className={labelCls}>Entrada (%)</span>
                  <input type="text" inputMode="decimal" value={entradaPercStr} onChange={e => onEntradaPercChange(e.target.value)} placeholder="0" className={inputCls} />
                </label>
              </div>
            </div>
          )}
          {tipoPagamento === "consorcio" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <p className="text-xs font-bold text-amber-700 uppercase">Condição — Consórcio</p>
              <label className="block"><span className={labelCls}>Tipo de Consórcio</span>
                <select name="consorcioTipo" className={selectCls}>
                  <option value="">— Selecionar —</option>
                  <option value="new_holland">New Holland</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={labelCls}>Nº de Cotas</span>
                  <input type="number" name="consorcioCotas" min={1} placeholder="1" className={inputCls} />
                </label>
                <label className="block"><span className={labelCls}>Crédito (R$)</span>
                  <input type="text" inputMode="numeric" name="consorcioCredito" placeholder="0" className={inputCls} />
                </label>
              </div>
            </div>
          )}
          {tipoPagamento === "crd_pme" && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
              <p className="text-xs font-bold text-emerald-700 uppercase">Condição — CRD PME</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={labelCls}>Entrada (R$)</span>
                  <input type="text" inputMode="numeric" value={entradaValorStr} onChange={e => onEntradaValorChange(e.target.value)} placeholder="0" className={inputCls} />
                </label>
                <label className="block"><span className={labelCls}>Entrada (%)</span>
                  <input type="text" inputMode="decimal" value={entradaPercStr} onChange={e => onEntradaPercChange(e.target.value)} placeholder="0" className={inputCls} />
                </label>
              </div>
              <label className="block"><span className={labelCls}>Parcelas (boleto)</span>
                <select value={crdQtd} onChange={e => setCrdQtd(e.target.value)} className={selectCls}>
                  <option value="">— Selecionar —</option>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                </select>
              </label>
              {crdQtd && (
                <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2 text-sm">
                  <span className="text-slate-500">Parcela: </span>
                  <span className="font-bold text-emerald-700">R$ {crdParcelaCalc}</span>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={labelCls}>Data da Visita</span>
              <input type="datetime-local" name="dataVisita" className={inputCls} />
            </label>
            <label className="block"><span className={labelCls}>Concorrente</span>
              <input type="text" name="concorrente" placeholder="Ex: CAT, Komatsu..." className={inputCls} />
            </label>
          </div>
          <label className="block"><span className={labelCls}>Próxima Ação</span>
            <input type="text" name="proximaAcao" placeholder="Ex: Ligar terça para follow-up" className={inputCls} />
          </label>
          <button type="submit" disabled={saving}
            className="w-full rounded-xl bg-slate-900 py-3 font-bold text-emerald-400 hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg">
            {saving ? "Criando..." : "Criar Negociação"}
          </button>
        </form>
      </div>
    </div>
  );
}
