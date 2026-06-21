"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Send, ArrowLeft, Check, CheckCheck, User, Smile, Paperclip, MoreVertical, MessageCircle, Users,
  DownloadCloud, Loader2,
} from "lucide-react";

export type ConvLista = {
  id: string;
  externalPhone: string;
  contactName: string | null;
  isGroup: boolean;
  groupName: string | null;
  ignored: boolean;
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
function nomeConv(c: { contactName: string | null; groupName: string | null; isGroup: boolean; externalPhone: string }) {
  return (c.isGroup ? c.groupName : c.contactName) || c.contactName || c.externalPhone;
}

// Avatar com foto do WhatsApp; cai para iniciais/ícone se não houver foto ou se falhar.
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

export function AtendimentoClient({ conversas, zapiAtiva }: { conversas: ConvLista[]; zapiAtiva: boolean }) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"tudo" | "ignoradas">("tudo");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Importa as conversas recentes do WhatsApp (Z-API) em lotes, direto desta tela.
  async function importar() {
    if (importando) return;
    if (!confirm("Importar suas conversas recentes do WhatsApp? Pode levar 1-2 minutos.")) return;
    setImportando(true);
    setImportMsg("Importando…");
    let page = 1, chats = 0, msgs = 0, more = true, guard = 0;
    while (more && guard < 40) {
      guard++;
      const r = await fetch("/api/whatsapp/import-history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, pageSize: 5, messagesPerChat: 150 }),
      }).then((res) => res.json()).catch(() => null);
      if (!r?.ok) { setImportMsg("Falha (Z-API desconectada?)"); setImportando(false); setTimeout(() => setImportMsg(null), 4000); return; }
      chats += r.chatsProcessed; msgs += r.messagesImported; more = r.hasMore; page = r.nextPage;
      setImportMsg(more ? `${chats} conversas…` : `✅ ${chats} conversas, ${msgs} msgs`);
    }
    setImportando(false);
    setTimeout(() => setImportMsg(null), 5000);
    router.refresh();
  }

  // Re-sincroniza a lista lateral a cada 15s (leve).
  useEffect(() => {
    const iv = setInterval(() => router.refresh(), 15000);
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

  // Ao abrir uma conversa: carrega mensagens + abre SSE.
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

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens.length]);

  async function enviar() {
    const t = texto.trim();
    if (!t || !selId) return;
    setTexto("");
    setEnviando(true);
    // otimista
    const temp: Mensagem = { id: `tmp-${Date.now()}`, direction: "OUT", body: t, senderName: null, operatorDisplayName: "Você", mediaType: null, mediaUrl: null, sentAt: new Date().toISOString(), sendStatus: "QUEUED", isDraft: false };
    setMensagens((p) => [...p, temp]);
    try {
      const r = await fetch(`/api/conversations/${selId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t }) });
      const d = await r.json();
      if (d?.message) {
        setMensagens((p) => p.map((m) => (m.id === temp.id ? d.message : m)));
      }
    } catch {
      setMensagens((p) => p.map((m) => (m.id === temp.id ? { ...m, sendStatus: "FAILED" } : m)));
    } finally {
      setEnviando(false);
    }
  }

  const filtradas = conversas
    .filter((c) => (aba === "ignoradas" ? c.ignored : !c.ignored))
    .filter((c) => {
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return nomeConv(c).toLowerCase().includes(q) || c.externalPhone.includes(q) || c.previa.toLowerCase().includes(q);
    });

  return (
    <div className="-m-4 flex h-[calc(100vh-1px)] sm:-m-6 md:-m-8" style={{ background: "#f0f2f5" }}>
      {/* ── Lista ── */}
      <aside className={`flex w-full flex-col border-r lg:w-80 ${sel ? "hidden lg:flex" : "flex"}`} style={{ borderColor: "#d1d7db", background: "#fff" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "#008069" }}>
          <span className="flex items-center gap-2 font-semibold text-white"><MessageCircle size={18} /> Atendimento</span>
          <div className="flex items-center gap-2">
            {!zapiAtiva && <span className="rounded-full bg-yellow-400/90 px-2 py-0.5 text-[10px] font-bold text-black">offline</span>}
            <button
              onClick={importar}
              disabled={importando}
              title="Importar conversas do WhatsApp"
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25 disabled:opacity-60"
            >
              {importando ? <Loader2 size={13} className="animate-spin" /> : <DownloadCloud size={13} />}
              <span className="hidden sm:inline">{importMsg ?? "Importar"}</span>
            </button>
          </div>
        </div>
        <div className="p-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#667781" }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar"
              className="w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none" style={{ background: "#f0f2f5" }} />
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
        <div className="flex-1 overflow-y-auto">
          {filtradas.length === 0 ? (
            <p className="p-6 text-center text-sm" style={{ color: "#667781" }}>Nenhuma conversa.</p>
          ) : filtradas.map((c) => (
            <button key={c.id} onClick={() => setSelId(c.id)}
              className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left ${selId === c.id ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"}`}
              style={{ borderColor: "#f0f2f5" }}>
              <Avatar nome={nomeConv(c)} isGroup={c.isGroup} photo={c.contactPhotoUrl} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-semibold" style={{ color: "#111b21" }}>{nomeConv(c)}</span>
                  <span className="shrink-0 text-[11px]" style={{ color: c.naoLida ? "#00a884" : "#667781" }}>{hora(c.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-[13px]" style={{ color: "#667781" }}>{c.previa || "—"}</span>
                  {c.naoLida && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "#00a884" }} />}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Painel ── */}
      <section className={`flex flex-1 flex-col ${sel ? "flex" : "hidden lg:flex"}`}>
        {!sel ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ background: "#f0f2f5", color: "#667781" }}>
            <MessageCircle size={56} strokeWidth={1} />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: "#008069" }}>
              <button onClick={() => setSelId(null)} className="rounded-full p-1 text-white/90 hover:bg-white/10 lg:hidden"><ArrowLeft size={20} /></button>
              <Avatar nome={nomeConv(sel)} isGroup={sel.isGroup} photo={sel.contactPhotoUrl} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">{nomeConv(sel)}</div>
                <div className="text-[11px] text-white/70">{sel.isGroup ? "Grupo" : sel.externalPhone}</div>
              </div>
              {sel.clienteId && (
                <Link href={`/clientes/${sel.clienteId}`} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/90 hover:bg-white/10">
                  <User size={13} /> Ficha
                </Link>
              )}
              <MoreVertical size={18} className="text-white/80" />
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-10" style={{ background: "#efeae2" }}>
              {mensagens.map((m) => {
                const meu = m.direction === "OUT";
                return (
                  <div key={m.id} className={`mb-1.5 flex ${meu ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm" style={{ background: meu ? "#d9fdd3" : "#ffffff", color: "#111b21" }}>
                      {!meu && sel.isGroup && m.senderName && <div className="text-[11px] font-bold" style={{ color: "#00a884" }}>{m.senderName}</div>}
                      {m.mediaType === "image" && m.mediaUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.mediaUrl} alt="" className="mb-1 max-h-60 rounded-md" />
                      )}
                      <span className="whitespace-pre-wrap break-words">{m.body}</span>
                      <span className="ml-2 inline-flex items-center gap-0.5 align-bottom text-[10px]" style={{ color: "#667781" }}>
                        {hora(m.sentAt)}
                        {meu && (m.sendStatus === "READ"
                          ? <CheckCheck size={13} className="text-[#53bdeb]" />
                          : m.sendStatus === "DELIVERED"
                          ? <CheckCheck size={13} />
                          : m.sendStatus === "FAILED"
                          ? <span className="text-red-500">!</span>
                          : <Check size={13} />)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={fimRef} />
            </div>

            {/* Input */}
            <div className="flex items-end gap-2 px-3 py-2.5" style={{ background: "#f0f2f5" }}>
              <Smile size={22} className="mb-1.5 shrink-0" style={{ color: "#667781" }} />
              <Paperclip size={20} className="mb-1.5 shrink-0" style={{ color: "#667781" }} />
              <textarea
                value={texto}
                onChange={(e) => { setTexto(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                rows={1}
                placeholder={zapiAtiva ? "Digite uma mensagem" : "WhatsApp desconectado"}
                className="max-h-28 flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "#fff" }}
              />
              <button onClick={enviar} disabled={enviando || !texto.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50" style={{ background: "#008069" }}>
                <Send size={18} />
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
