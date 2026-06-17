"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { enviarResposta, marcarRespondido } from "@/lib/actions";
import { formatDateTime, iniciais, diasDesde, cn } from "@/lib/utils";
import { Send, Sparkles, Check, Mic, User, ArrowLeft, Phone, MapPin, Search } from "lucide-react";

export type Mensagem = {
  id: string;
  conteudo: string;
  remetente: string; // cliente | vendedor
  tipo: string; // texto | audio
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

export function InboxClient({
  contatos,
  zapiAtiva,
}: {
  contatos: Contato[];
  zapiAtiva: boolean;
}) {
  const [selId, setSelId] = useState<string | null>(contatos[0]?.id ?? null);
  const [busca, setBusca] = useState("");

  const filtrados = busca.trim()
    ? contatos.filter((c) =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (c.telefone ?? "").includes(busca)
      )
    : contatos;

  const sel = contatos.find((c) => c.id === selId) ?? null;

  if (contatos.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-8 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Send size={24} />
        </div>
        <p className="font-semibold text-slate-600">Nenhuma conversa ainda</p>
        <p className="mt-1 text-sm text-slate-400">
          Quando um cliente te mandar mensagem no WhatsApp, ela aparece aqui automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Lista de contatos */}
      <aside
        className={cn(
          "w-full shrink-0 flex-col border-r border-slate-100 sm:flex sm:w-80",
          sel ? "hidden sm:flex" : "flex"
        )}
      >
        <div className="border-b border-slate-100 p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full rounded-lg bg-slate-100 py-2 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-agro-200"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtrados.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelId(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-slate-50 px-3 py-3 text-left hover:bg-slate-50",
                selId === c.id && "bg-agro-50"
              )}
            >
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {iniciais(c.nome)}
                {c.aguardando && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{c.nome}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {diasDesde(c.ultimoContato) === 0 ? "hoje" : `${diasDesde(c.ultimoContato)}d`}
                  </span>
                </div>
                <p className="truncate text-xs text-slate-400">{c.previa || "—"}</p>
              </div>
            </button>
          ))}
          {filtrados.length === 0 && (
            <p className="p-4 text-center text-sm text-slate-400">Nada encontrado.</p>
          )}
        </div>
      </aside>

      {/* Conversa */}
      <section className={cn("flex-1 flex-col bg-slate-50", sel ? "flex" : "hidden sm:flex")}>
        {sel ? (
          <Conversa
            key={sel.id}
            contato={sel}
            zapiAtiva={zapiAtiva}
            onVoltar={() => setSelId(null)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-400">
            Selecione uma conversa para começar.
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
}: {
  contato: Contato;
  zapiAtiva: boolean;
  onVoltar: () => void;
}) {
  const [texto, setTexto] = useState(contato.rascunho ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();
  const [baixando, startBaixar] = useTransition();
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "auto" });
  }, [contato.id, contato.mensagens.length]);

  function enviar() {
    setErro(null);
    const t = texto.trim();
    if (!t) return;
    startEnviar(async () => {
      const r = await enviarResposta(contato.id, t);
      if (r.ok) setTexto("");
      else setErro(r.erro ?? "Falha ao enviar.");
    });
  }

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button onClick={onVoltar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 sm:hidden">
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
          {iniciais(contato.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-800">{contato.nome}</div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {contato.telefone && (
              <span className="flex items-center gap-1"><Phone size={11} /> {contato.telefone}</span>
            )}
            {contato.municipio && (
              <span className="flex items-center gap-1"><MapPin size={11} /> {contato.municipio}</span>
            )}
          </div>
        </div>
        <Link
          href={`/clientes/${contato.id}`}
          className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
        >
          <User size={13} /> Ficha
        </Link>
      </div>

      {/* Mensagens */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {contato.mensagens.map((m) => {
          const meu = m.remetente === "vendedor";
          return (
            <div key={m.id} className={cn("flex", meu ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  meu
                    ? "rounded-br-sm bg-agro-200 text-slate-900"
                    : "rounded-bl-sm bg-white text-slate-700"
                )}
              >
                {m.tipo === "audio" && (
                  <div className="mb-1 flex items-center gap-1 text-xs text-brand-600">
                    <Mic size={12} /> áudio transcrito
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
                <div className={cn("mt-1 text-right text-[10px]", meu ? "text-slate-500" : "text-slate-400")}>
                  {formatDateTime(m.criadoEm)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>

      {/* Caixa de resposta */}
      <div className="border-t border-slate-200 bg-white p-3">
        {contato.rascunho && (
          <button
            type="button"
            onClick={() => setTexto(contato.rascunho ?? "")}
            className="mb-2 flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
          >
            <Sparkles size={12} /> Usar rascunho da IA
          </button>
        )}
        {erro && (
          <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {erro}
            {!zapiAtiva && " Conecte o WhatsApp em Configurações."}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={2}
            placeholder={zapiAtiva ? "Escreva uma mensagem... (Enter envia)" : "WhatsApp não conectado"}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-agro-500 focus:ring-2 focus:ring-agro-200"
          />
          <div className="flex flex-col gap-1.5">
            <button
              onClick={enviar}
              disabled={enviando || !texto.trim() || !zapiAtiva}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-agro-400 transition hover:bg-brand-800 disabled:opacity-40"
              title="Enviar pelo WhatsApp"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        {contato.aguardando && (
          <button
            onClick={() => startBaixar(() => marcarRespondido(contato.id))}
            disabled={baixando}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-600"
          >
            <Check size={12} /> Marcar como respondido (sem enviar)
          </button>
        )}
      </div>
    </>
  );
}
