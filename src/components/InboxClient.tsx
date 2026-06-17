"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { enviarResposta, marcarRespondido } from "@/lib/actions";
import { iniciais, diasDesde, cn } from "@/lib/utils";
import {
  Send, Sparkles, Check, CheckCheck, Mic, User, ArrowLeft, Phone,
  MapPin, Search, Smile, Paperclip, MoreVertical,
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

function horaMsg(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelData(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(ontem.getDate() - 1);
  const mesmaData = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (mesmaData(d, hoje)) return "Hoje";
  if (mesmaData(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

function previewData(iso: string) {
  const dias = diasDesde(iso);
  if (dias === 0) return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  if (dias === 1) return "ontem";
  if (dias < 7) return `${dias}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

export function InboxClient({ contatos: contatosInit, zapiAtiva }: { contatos: Contato[]; zapiAtiva: boolean }) {
  const [selId, setSelId] = useState<string | null>(contatosInit[0]?.id ?? null);
  const [busca, setBusca] = useState("");
  const [contatos, setContatos] = useState<Contato[]>(contatosInit);

  const filtrados = busca.trim()
    ? contatos.filter((c) =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.telefone ?? "").includes(busca)
      )
    : contatos;

  const sel = contatos.find((c) => c.id === selId) ?? null;

  // Polling global: check for new messages in selected chat every 4s
  const updateMensagens = useCallback((clienteId: string, novas: Mensagem[], aguardando: boolean) => {
    setContatos((prev) =>
      prev.map((c) => {
        if (c.id !== clienteId) return c;
        const existingIds = new Set(c.mensagens.map((m) => m.id));
        const added = novas.filter((m) => !existingIds.has(m.id));
        if (added.length === 0 && c.aguardando === aguardando) return c;
        const todasMensagens = [...c.mensagens, ...added];
        const ultima = todasMensagens[todasMensagens.length - 1];
        return {
          ...c,
          mensagens: todasMensagens,
          aguardando,
          previa: ultima?.conteudo ?? c.previa,
          ultimoContato: ultima?.criadoEm ?? c.ultimoContato,
        };
      })
    );
  }, []);

  useEffect(() => {
    if (!selId) return;
    const clienteId = selId;
    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      const contato = contatos.find((c) => c.id === clienteId);
      if (!contato) return;
      const lastMsg = contato.mensagens[contato.mensagens.length - 1];
      const after = lastMsg?.criadoEm ?? new Date(0).toISOString();
      try {
        const res = await fetch(`/api/inbox?clienteId=${clienteId}&after=${encodeURIComponent(after)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && (data.mensagens.length > 0 || data.aguardando !== contato.aguardando)) {
          updateMensagens(clienteId, data.mensagens, data.aguardando);
        }
      } catch {}
    }
    const iv = setInterval(poll, 4000);
    poll();
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, updateMensagens]);

  if (contatosInit.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#25D366]/30 bg-[#111b21] text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#202c33]">
          <Send size={24} className="text-[#25D366]" />
        </div>
        <p className="font-semibold text-[#e9edef]">Nenhuma conversa ainda</p>
        <p className="text-sm text-[#8696a0]">
          Quando um cliente te mandar mensagem, ela aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex overflow-hidden rounded-xl shadow-xl"
      style={{ height: "calc(100vh - 200px)", minHeight: 520, background: "#111b21" }}
    >
      {/* Sidebar de contatos — WhatsApp Web style */}
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-[#222d34] sm:w-[360px]",
          sel ? "hidden sm:flex" : "flex"
        )}
        style={{ background: "#111b21" }}
      >
        {/* Header sidebar */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "#202c33" }}>
          <span className="text-base font-semibold text-[#e9edef]">WhatsApp</span>
          <div className="flex items-center gap-3 text-[#8696a0]">
            {!zapiAtiva && (
              <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                não conectado
              </span>
            )}
            <MoreVertical size={18} className="cursor-pointer hover:text-[#e9edef]" />
          </div>
        </div>

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
          {filtrados.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelId(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors",
                selId === c.id ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
              )}
              style={{ borderColor: "#222d34" }}
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20 text-sm font-bold text-[#25D366]">
                {iniciais(c.nome)}
                {c.aguardando && (
                  <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#111b21] bg-[#25D366]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-semibold text-[#e9edef]">{c.nome}</span>
                  <span className={cn("shrink-0 text-[11px]", c.aguardando ? "text-[#25D366]" : "text-[#8696a0]")}>
                    {previewData(c.ultimoContato)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-[13px] text-[#8696a0]">{c.previa || "—"}</p>
                  {c.aguardando && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1 text-[11px] font-bold text-black">
                      {c.mensagens.filter((m) => m.remetente === "cliente").length > 0
                        ? c.mensagens.filter((m) => m.remetente === "cliente").length
                        : "!"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {filtrados.length === 0 && (
            <p className="p-6 text-center text-sm text-[#8696a0]">Nenhuma conversa encontrada.</p>
          )}
        </div>
      </aside>

      {/* Área da conversa */}
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
                    ? { ...c, mensagens: [...c.mensagens, nova], previa: nova.conteudo, ultimoContato: nova.criadoEm }
                    : c
                )
              );
            }}
          />
        ) : (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
            style={{ background: "#222e35" }}
          >
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
  );
}

function Conversa({
  contato,
  zapiAtiva,
  onVoltar,
  onMensagemEnviada,
}: {
  contato: Contato;
  zapiAtiva: boolean;
  onVoltar: () => void;
  onMensagemEnviada: (m: Mensagem) => void;
}) {
  const [texto, setTexto] = useState(contato.rascunho ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();
  const [baixando, startBaixar] = useTransition();
  const [mostrarRascunho, setMostrarRascunho] = useState(!!contato.rascunho);
  const fimRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [contato.mensagens.length]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [contato.id]);

  function enviar() {
    setErro(null);
    const t = texto.trim();
    if (!t) return;
    const agora = new Date().toISOString();
    const tempId = `temp-${Date.now()}`;
    // Otimista: adiciona a mensagem imediatamente na UI
    onMensagemEnviada({ id: tempId, conteudo: t, remetente: "vendedor", tipo: "texto", criadoEm: agora });
    setTexto("");
    startEnviar(async () => {
      const r = await enviarResposta(contato.id, t);
      if (!r.ok) setErro(r.erro ?? "Falha ao enviar.");
    });
  }

  // Agrupa mensagens por data para exibir separadores
  const grupos: { data: string; msgs: Mensagem[] }[] = [];
  for (const m of contato.mensagens) {
    const d = labelData(m.criadoEm);
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || ultimo.data !== d) {
      grupos.push({ data: d, msgs: [m] });
    } else {
      ultimo.msgs.push(m);
    }
  }

  return (
    <>
      {/* Header da conversa */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: "#202c33" }}
      >
        <button
          onClick={onVoltar}
          className="rounded-full p-1 text-[#8696a0] hover:bg-[#2a3942] sm:hidden"
        >
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

      {/* Área de mensagens */}
      <div
        className="flex-1 overflow-y-auto px-6 py-4"
        style={{
          background: "#0b141a",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {grupos.map((grupo) => (
          <div key={grupo.data}>
            {/* Separador de data */}
            <div className="my-3 flex items-center justify-center">
              <span className="rounded-lg px-3 py-1 text-[11px] font-medium text-[#e9edef]"
                style={{ background: "#182229" }}>
                {grupo.data}
              </span>
            </div>

            {grupo.msgs.map((m) => {
              const meu = m.remetente === "vendedor";
              return (
                <div key={m.id} className={cn("mb-1 flex", meu ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "relative max-w-[65%] rounded-lg px-3 py-2 text-sm shadow",
                      meu ? "rounded-tr-sm" : "rounded-tl-sm"
                    )}
                    style={{ background: meu ? "#005c4b" : "#202c33" }}
                  >
                    {/* Triângulo do balão */}
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
                      <div className="mb-1 flex items-center gap-1 text-xs text-[#25D366]">
                        <Mic size={11} /> áudio transcrito
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words text-[#e9edef]">{m.conteudo}</p>
                    <div className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", meu ? "text-[#8696a0]" : "text-[#8696a0]")}>
                      <span>{horaMsg(m.criadoEm)}</span>
                      {meu && (
                        m.id.startsWith("temp-")
                          ? <Check size={12} className="text-[#8696a0]" />
                          : <CheckCheck size={12} className="text-[#53bdeb]" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      {/* Rascunho da IA */}
      {mostrarRascunho && contato.rascunho && (
        <div className="flex items-start gap-2 px-4 py-2" style={{ background: "#182229" }}>
          <Sparkles size={14} className="mt-0.5 shrink-0 text-[#25D366]" />
          <p className="flex-1 text-[13px] italic text-[#8696a0]">{contato.rascunho}</p>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => { setTexto(contato.rascunho ?? ""); setMostrarRascunho(false); textareaRef.current?.focus(); }}
              className="rounded-lg bg-[#25D366] px-3 py-1 text-xs font-semibold text-black hover:bg-[#1da851]"
            >
              Usar
            </button>
            <button
              onClick={() => setMostrarRascunho(false)}
              className="text-xs text-[#8696a0] hover:text-[#e9edef]"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Input de mensagem */}
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
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
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

      {/* Erros e ação de marcar respondido */}
      {(erro || contato.aguardando) && (
        <div className="flex items-center justify-between px-4 py-1.5" style={{ background: "#182229" }}>
          {erro && (
            <span className="text-xs text-red-400">
              {erro}{!zapiAtiva && " — Conecte o WhatsApp em Configurações."}
            </span>
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
