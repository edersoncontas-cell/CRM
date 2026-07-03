"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Paperclip, X, Loader2, Brain, User, Wrench, ShieldAlert, Plus } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; arquivos?: string[] };
type FerramentaAtiva = { name: string; label: string; status: "start" | "done" };

function renderMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3 class='text-sm font-bold text-white mt-3 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-sm font-bold text-white mt-3 mb-1'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-base font-bold text-white mt-3 mb-1'>$1</h1>")
    .replace(/^---$/gm, "<hr class='border-zinc-700 my-2'/>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^• (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^\d+\. (.+)$/gm, "<li class='ml-4 list-decimal'>$1</li>")
    .replace(/`([^`]+)`/g, "<code class='bg-zinc-800 px-1 rounded text-xs font-mono text-yellow-300'>$1</code>")
    .replace(/\n/g, "<br/>");
}

export function CerebroChat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [ferramentas, setFerramentas] = useState<FerramentaAtiva[]>([]);
  const [confirmacaoPendente, setConfirmacaoPendente] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Carrega a última sessão do servidor ao abrir (histórico persistido — Fase 3).
  useEffect(() => {
    fetch("/api/cerebro/sessao")
      .then((r) => r.json())
      .then((d) => {
        setSessionId(d.sessionId);
        setMsgs(Array.isArray(d.mensagens) ? d.mensagens : []);
      })
      .catch(() => {})
      .finally(() => setCarregandoSessao(false));
  }, []);

  async function novaConversa() {
    if (carregando) return;
    setCarregandoSessao(true);
    try {
      const r = await fetch("/api/cerebro/sessao", { method: "POST" }).then((res) => res.json());
      setSessionId(r.sessionId);
      setMsgs([]);
      setFerramentas([]);
      setConfirmacaoPendente(null);
    } catch {}
    setCarregandoSessao(false);
  }

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  const scrollBottom = useCallback(() => {
    const el = containerRef.current;
    if (el && autoScrollRef.current) el.scrollTop = el.scrollHeight;
  }, []);

  function scrollBottomForced() {
    autoScrollRef.current = true;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function addArquivos(files: FileList | null) {
    if (!files) return;
    setArquivos((prev) => [...prev, ...Array.from(files)]);
  }

  const enviar = useCallback(async (textoForcado?: string) => {
    const texto = (textoForcado ?? input).trim();
    if ((!texto && arquivos.length === 0) || !sessionId) return;
    setCarregando(true);
    setConfirmacaoPendente(null);
    setFerramentas([]);
    const nomesArqs = arquivos.map((f) => f.name);

    setMsgs((prev) => [...prev, { role: "user", content: texto, arquivos: nomesArqs.length ? nomesArqs : undefined }]);

    setInput("");
    const arquivosParaEnviar = [...arquivos];
    setArquivos([]);
    scrollBottomForced();

    const fd = new FormData();
    fd.set("sessionId", sessionId);
    fd.set("mensagem", texto);
    for (const f of arquivosParaEnviar) fd.append("arquivo", f);

    await new Promise((r) => setTimeout(r, 10));

    let resposta = "";
    setMsgs((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/cerebro", { method: "POST", body: fd });
      if (!res.body) throw new Error("Sem resposta do servidor");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              resposta += parsed.text;
              setMsgs((prev) => {
                const copia = [...prev];
                copia[copia.length - 1] = { role: "assistant", content: resposta };
                return copia;
              });
              scrollBottom();
            }
            if (parsed.tool) {
              const t = parsed.tool as FerramentaAtiva;
              setFerramentas((prev) => {
                if (t.status === "start") return [...prev.filter((f) => f.name !== t.name), t];
                return prev.filter((f) => f.name !== t.name);
              });
            }
            if (parsed.confirm) {
              setConfirmacaoPendente(String(parsed.confirm.mensagem ?? "Confirma esta ação?"));
            }
            if (parsed.erro) {
              let msgErro = String(parsed.erro);
              if (msgErro.includes("credit balance is too low")) {
                msgErro = "⚠️ Saldo de créditos Anthropic insuficiente. Acesse console.anthropic.com e adicione créditos.";
              } else if (msgErro.includes("invalid_api_key") || msgErro.includes("authentication")) {
                msgErro = "⚠️ Chave Anthropic inválida. Verifique a variável ANTHROPIC_API_KEY no Vercel.";
              } else if (msgErro.includes("rate_limit")) {
                msgErro = "⚠️ Limite de requisições atingido. Aguarde e tente novamente.";
              } else {
                msgErro = "❌ Erro da IA: " + msgErro;
              }
              setMsgs((prev) => {
                const copia = [...prev];
                copia[copia.length - 1] = { role: "assistant", content: msgErro };
                return copia;
              });
              scrollBottom();
            }
          } catch { /* linha malformada */ }
        }
      }
      if (!resposta) {
        setMsgs((prev) => {
          const copia = [...prev];
          if (copia[copia.length - 1].content === "") {
            copia[copia.length - 1] = { role: "assistant", content: "⚠️ Nenhuma resposta recebida. Verifique a configuração da API Anthropic." };
          }
          return copia;
        });
      }
    } catch (e) {
      setMsgs((prev) => {
        const copia = [...prev];
        copia[copia.length - 1] = { role: "assistant", content: "❌ Erro de conexão: " + String(e) };
        return copia;
      });
    } finally {
      setCarregando(false);
      setFerramentas([]);
      scrollBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, arquivos, scrollBottom, sessionId]);

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{ background: "#18181b", border: "1px solid #27272a", minHeight: "70dvh" }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addArquivos(e.dataTransfer.files); }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Brain size={18} style={{ color: "#BFDE4D" }} />
        <span className="text-sm font-bold text-white">Chat com o Cérebro</span>
        <span className="ml-auto hidden sm:inline text-[10px] text-zinc-600">Arraste arquivos · PDF · imagens · textos</span>
        <button
          onClick={novaConversa}
          disabled={carregando || carregandoSessao}
          title="Nova conversa"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
        >
          <Plus size={13} /> Nova conversa
        </button>
      </div>
      <div ref={containerRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
        {msgs.length === 0 && !dragOver && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Brain size={40} className="mb-4" style={{ color: "rgba(191,222,77,0.3)" }} />
            <p className="text-sm text-zinc-500 max-w-xs">
              Fale comigo. Posso analisar dados, criar/editar clientes, comparar negociações, ler arquivos e muito mais.
            </p>
          </div>
        )}
        {dragOver && (
          <div className="flex items-center justify-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: "#BFDE4D" }}>
            <p className="text-sm font-semibold" style={{ color: "#BFDE4D" }}>Solte os arquivos aqui</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center" style={{ background: "rgba(191,222,77,0.15)", border: "1px solid rgba(191,222,77,0.3)" }}>
                <Brain size={16} style={{ color: "#BFDE4D" }} />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "rounded-tr-sm whitespace-pre-wrap" : "rounded-tl-sm"}`}
              style={m.role === "user"
                ? { background: "rgba(26,99,245,0.25)", color: "#e2e8f0", border: "1px solid rgba(26,99,245,0.4)" }
                : { background: "#09090b", color: "#d4d4d8", border: "1px solid #27272a" }
              }
            >
              {m.arquivos && m.arquivos.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {m.arquivos.map((nome) => (
                    <span key={nome} className="rounded px-2 py-0.5 text-[10px] font-mono" style={{ background: "rgba(191,222,77,0.1)", color: "#BFDE4D" }}>
                      📎 {nome}
                    </span>
                  ))}
                </div>
              )}
              {m.role === "assistant" && m.content ? (
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
              ) : m.role === "user" ? (
                m.content
              ) : (
                m.role === "assistant" && carregando && i === msgs.length - 1
                  ? (
                    <span className="flex flex-col gap-1 text-zinc-500">
                      {ferramentas.length > 0 ? (
                        ferramentas.map((f) => (
                          <span key={f.name} className="flex items-center gap-1.5" style={{ color: "#BFDE4D" }}>
                            <Wrench size={13} className="animate-pulse" /> {f.label}
                          </span>
                        ))
                      ) : (
                        <span className="flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Pensando…</span>
                      )}
                    </span>
                  )
                  : null
              )}
            </div>
            {m.role === "user" && (
              <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-brand-800">
                <User size={16} className="text-white" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {confirmacaoPendente && (
        <div className="mx-3 mb-2 rounded-xl border p-3 text-xs" style={{ borderColor: "rgba(248,113,113,0.4)", background: "rgba(248,113,113,0.08)" }}>
          <div className="mb-2 flex items-start gap-1.5 text-red-300">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" /> {confirmacaoPendente}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => enviar("Sim, confirmo. Pode executar.")}
              disabled={carregando}
              className="rounded-lg bg-red-500/20 px-3 py-1.5 font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
            >
              Sim, confirmar
            </button>
            <button
              onClick={() => setConfirmacaoPendente(null)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-400 hover:bg-zinc-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {arquivos.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-zinc-800">
          {arquivos.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ background: "rgba(191,222,77,0.1)", color: "#BFDE4D" }}>
              <Paperclip size={11} /> {f.name}
              <button onClick={() => setArquivos((prev) => prev.filter((_, j) => j !== i))} className="ml-1 text-zinc-500 hover:text-red-400">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="border-t border-zinc-800 p-3 flex items-end gap-2">
        <input ref={fileRef} type="file" multiple className="hidden"
          accept="application/pdf,image/*,text/*,.txt,.html,.md,.csv,.doc,.docx,.xls,.xlsx"
          onChange={(e) => addArquivos(e.target.files)}
        />
        <button onClick={() => fileRef.current?.click()} className="shrink-0 rounded-xl p-2.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition" title="Anexar arquivo">
          <Paperclip size={18} />
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder={carregandoSessao ? "Carregando conversa…" : "Pergunte qualquer coisa, peça análises, crie, edite, exclua…"}
          disabled={carregando || carregandoSessao || !sessionId}
          rows={1}
          className="flex-1 resize-none bg-transparent py-2 text-sm text-white outline-none placeholder:text-zinc-600 max-h-32"
        />
        <button
          onClick={() => enviar()}
          disabled={carregando || carregandoSessao || !sessionId || (!input.trim() && arquivos.length === 0)}
          className="shrink-0 rounded-xl p-2.5 font-bold transition disabled:opacity-40"
          style={{ background: "rgba(191,222,77,0.15)", color: "#BFDE4D" }}
        >
          {carregando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
