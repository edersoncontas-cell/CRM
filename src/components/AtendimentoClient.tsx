"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Send, ArrowLeft, Check, CheckCheck, User, Smile, Paperclip, MoreVertical, MessageCircle, Users,
  DownloadCloud, Loader2, Bot, Bell, BellOff, Tag, Sparkles, Trash2, FileJson2,
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
  // Overlay local dos ajustes da conversa (Agnes/ignorar/categoria) p/ refletir na hora.
  const [flags, setFlags] = useState<Record<string, { aiActive: boolean; ignored: boolean; category: string | null }>>({});
  const [menuAberto, setMenuAberto] = useState(false);
  const [cfgAberto, setCfgAberto] = useState(false);
  const [auditMode, setAuditMode] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Carrega o modo da Agnes (rascunho x automático).
  useEffect(() => {
    fetch("/api/whatsapp/settings").then((r) => r.json()).then((d) => setAuditMode(d.auditMode)).catch(() => {});
  }, []);

  // Estado efetivo dos ajustes (overlay local sobre o que veio do servidor).
  const curr = useCallback(
    (c: ConvLista) => flags[c.id] ?? { aiActive: c.aiActive, ignored: c.ignored, category: c.category },
    [flags],
  );

  async function patchConv(c: ConvLista, patch: Partial<{ aiActive: boolean; ignored: boolean; category: string }>) {
    const base = curr(c);
    setFlags((f) => ({ ...f, [c.id]: { ...base, ...patch } }));
    try {
      await fetch(`/api/conversations/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    } catch {}
    router.refresh();
  }

  // Exclui a conversa (e suas mensagens). Pede confirmação antes.
  async function excluirConversa(c: ConvLista) {
    const nome = c.contactName || c.groupName || c.externalPhone || "esta conversa";
    if (!window.confirm(`Excluir a conversa com "${nome}"?\n\nTodas as mensagens serão apagadas. Esta ação não pode ser desfeita.`)) return;
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

  async function setAudit(v: boolean) {
    setAuditMode(v);
    try {
      await fetch("/api/whatsapp/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditMode: v }) });
    } catch {}
  }

  // Ação sobre rascunho da Agnes: enviar (aprovar) ou descartar.
  async function draftAction(messageId: string, action: "send" | "discard") {
    if (!selId) return;
    const r = await fetch(`/api/conversations/${selId}/drafts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, action }),
    }).then((res) => res.json()).catch(() => null);
    if (!r?.ok) return;
    if (action === "discard") setMensagens((p) => p.filter((m) => m.id !== messageId));
    else if (r.message) setMensagens((p) => p.map((m) => (m.id === messageId ? r.message : m)));
  }

  // Editar rascunho: joga o texto no campo de digitação e remove o rascunho.
  function editarDraft(m: Mensagem) {
    setTexto(m.body);
    draftAction(m.id, "discard");
  }

  // Converte HTML (export em página) para texto, preservando quebras de linha.
  function htmlParaTexto(html: string): string {
    const comQuebras = html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n");
    const doc = new DOMParser().parseFromString(comQuebras, "text/html");
    return doc.body?.textContent ?? "";
  }

  // Clique em "Importar" → abre o seletor de arquivos (.zip exportado do WhatsApp).
  function abrirSeletor() {
    if (importando) return;
    fileRef.current?.click();
  }

  // Lê os .zip escolhidos, descompacta e parseia no navegador, depois envia o texto.
  async function arquivosEscolhidos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite re-selecionar os mesmos arquivos depois
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
        setImportMsg("Nenhuma mensagem reconhecida nos arquivos.");
        setImportando(false);
        setTimeout(() => setImportMsg(null), 5000);
        return;
      }

      // Envia uma conversa por vez para mostrar progresso e evitar payload gigante.
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
      setImportMsg("Falha ao ler os arquivos (zip inválido?)");
    } finally {
      setImportando(false);
      setTimeout(() => setImportMsg(null), 6000);
      router.refresh();
    }
  }

  // Importa um arquivo JSON (index_clientes.json ou conversas_por_cliente.json)
  // Envia em lotes de 50 para não estourar o timeout do servidor.
  async function importarJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportando(true);
    setImportMsg("Lendo arquivo…");
    try {
      const texto = await file.text();
      const dados = JSON.parse(texto);
      const lista: unknown[] = Array.isArray(dados) ? dados : Array.isArray(dados?.clientes) ? dados.clientes : [];
      if (!lista.length) { setImportMsg("Arquivo vazio ou formato inválido."); return; }
      const LOTE = 50;
      let criados = 0, atualizados = 0, mensagens = 0, erros = 0;
      for (let i = 0; i < lista.length; i += LOTE) {
        const lote = lista.slice(i, i + LOTE);
        setImportMsg(`Importando ${Math.min(i + LOTE, lista.length)}/${lista.length}…`);
        const r = await fetch("/api/whatsapp/import-json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lote),
        }).then((res) => res.json()).catch(() => null);
        if (r?.ok) {
          criados += r.criados ?? 0;
          atualizados += r.atualizados ?? 0;
          mensagens += r.mensagens ?? 0;
          erros += r.erros ?? 0;
        }
      }
      setImportMsg(`✅ ${criados} criados · ${atualizados} atualizados · ${mensagens} msgs${erros ? ` · ${erros} erros` : ""}`);
    } catch {
      setImportMsg("Arquivo inválido (não é JSON).");
    } finally {
      setImportando(false);
      setTimeout(() => setImportMsg(null), 8000);
      router.refresh();
    }
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
    .filter((c) => (aba === "ignoradas" ? curr(c).ignored : !curr(c).ignored))
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
            <input ref={fileRef} type="file" accept=".zip,.txt,.html,.htm" multiple onChange={arquivosEscolhidos} className="hidden" />
            <input ref={jsonRef} type="file" accept=".json" onChange={importarJSON} className="hidden" />
            {/* Importar .zip do WhatsApp */}
            <button
              onClick={abrirSeletor}
              disabled={importando}
              title="Importar conversas exportadas do WhatsApp (.zip)"
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25 disabled:opacity-60"
            >
              {importando ? <Loader2 size={13} className="animate-spin" /> : <DownloadCloud size={13} />}
              <span className="hidden sm:inline">{importMsg ?? "Importar"}</span>
            </button>
            {/* Importar JSON (index_clientes / conversas_por_cliente) */}
            <button
              onClick={() => jsonRef.current?.click()}
              disabled={importando}
              title="Importar contatos do WhatsApp via JSON (index_clientes.json / conversas_por_cliente.json)"
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25 disabled:opacity-60"
            >
              <FileJson2 size={13} />
              <span className="hidden sm:inline">JSON</span>
            </button>
            {/* Configuração da Agnes (IA) */}
            <div className="relative">
              <button onClick={() => setCfgAberto((v) => !v)} title="Configurar a Agnes (IA)"
                className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-white hover:bg-white/25">
                <Bot size={15} />
              </button>
              {cfgAberto && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setCfgAberto(false)} />
                  <div className="absolute right-0 top-9 z-20 w-72 rounded-xl bg-white p-3 text-left shadow-xl" style={{ color: "#111b21" }}>
                    <div className="mb-1 flex items-center gap-1.5 font-bold"><Sparkles size={15} className="text-amber-500" /> Agnes (IA)</div>
                    <p className="mb-2 text-xs text-slate-500">Quando você ativa a Agnes numa conversa (botão 🤖 no topo do chat), ela responde sozinha. Escolha como:</p>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-slate-50">
                      <input type="radio" name="audit" checked={auditMode === true} onChange={() => setAudit(true)} className="mt-0.5" />
                      <span className="text-sm"><b>Sugerir rascunho</b> para você revisar e enviar <span className="text-emerald-600">(recomendado)</span></span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-slate-50">
                      <input type="radio" name="audit" checked={auditMode === false} onChange={() => setAudit(false)} className="mt-0.5" />
                      <span className="text-sm"><b>Responder automático</b>, sem revisão</span>
                    </label>
                  </div>
                </>
              )}
            </div>
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
              {/* Liga/desliga a Agnes nesta conversa */}
              <button
                onClick={() => patchConv(sel, { aiActive: !curr(sel).aiActive })}
                title={curr(sel).aiActive ? "Agnes ativa — clique para desligar" : "Ativar a Agnes nesta conversa"}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
                style={curr(sel).aiActive ? { background: "#fff", color: "#008069" } : { background: "rgba(255,255,255,0.15)", color: "#fff" }}
              >
                <Bot size={14} /> {curr(sel).aiActive ? "Agnes ON" : "Agnes"}
              </button>
              {/* Menu da conversa */}
              <div className="relative">
                <button onClick={() => setMenuAberto((v) => !v)} className="rounded-full p-1 text-white/80 hover:bg-white/10">
                  <MoreVertical size={18} />
                </button>
                {menuAberto && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                    <div className="absolute right-0 top-9 z-20 w-56 rounded-xl bg-white p-1 text-sm shadow-xl" style={{ color: "#111b21" }}>
                      <button onClick={() => { patchConv(sel, { ignored: !curr(sel).ignored }); setMenuAberto(false); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-100">
                        {curr(sel).ignored ? <Bell size={15} /> : <BellOff size={15} />}
                        {curr(sel).ignored ? "Reativar conversa" : "Ignorar conversa"}
                      </button>
                      <div className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Categoria</div>
                      {["CLIENTE", "LEAD", "OUTRO"].map((cat) => (
                        <button key={cat} onClick={() => { patchConv(sel, { category: cat }); setMenuAberto(false); }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-slate-100">
                          <Tag size={14} /> {cat}
                          {curr(sel).category === cat && <Check size={14} className="ml-auto text-emerald-600" />}
                        </button>
                      ))}
                      <div className="my-1 border-t border-slate-100" />
                      <button onClick={() => excluirConversa(sel)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-red-600 hover:bg-red-50">
                        <Trash2 size={15} /> Excluir conversa
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-10" style={{ background: "#efeae2" }}>
              {mensagens.map((m) => {
                // Rascunho da Agnes: bloco destacado com Enviar / Editar / Descartar.
                if (m.isDraft) {
                  return (
                    <div key={m.id} className="mb-2 flex justify-end">
                      <div className="max-w-[80%] rounded-lg border border-dashed border-amber-400 bg-amber-50 p-2.5 text-sm shadow-sm">
                        <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-amber-700">
                          <Sparkles size={12} /> Sugestão da Agnes — revise antes de enviar
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
