"use client";

import { useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { analisarConversaAction } from "@/lib/actions";
import { Bot, Loader2, Mic, MicOff } from "lucide-react";

function BotaoAnalisar() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
      {pending ? "Analisando..." : "Analisar com IA"}
    </button>
  );
}

function BotaoVoz({ onTexto }: { onTexto: (t: string) => void }) {
  const [ouvindo, setOuvindo] = useState(false);
  const recRef = useRef<any>(null);

  function toggle() {
    const SR =
      (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    if (!SR) {
      alert("Seu navegador não suporta ditado por voz. Use o Chrome no celular ou PC.");
      return;
    }
    if (ouvindo) {
      recRef.current?.stop();
      setOuvindo(false);
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (txt) onTexto(txt + " ");
    };
    rec.onend = () => setOuvindo(false);
    rec.start();
    recRef.current = rec;
    setOuvindo(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
        ouvindo ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
      title="Ditar por voz"
    >
      {ouvindo ? <MicOff size={16} /> : <Mic size={16} />}
      {ouvindo ? "Gravando..." : "Falar"}
    </button>
  );
}

export function ConversaAnaliser({
  clienteId,
  clientes,
}: {
  clienteId?: string;
  clientes?: { id: string; nome: string }[];
}) {
  const [texto, setTexto] = useState("");

  return (
    <form
      action={async (fd) => {
        await analisarConversaAction(fd);
        setTexto("");
      }}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {clienteId && <input type="hidden" name="clienteId" value={clienteId} />}
      {clientes && (
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Cliente (opcional)</label>
          <select
            name="clienteId"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          >
            <option value="">— Não vincular / identificar depois —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      )}
      <label className="mb-1 block text-sm font-medium text-slate-700">
        Colar conversa (texto ou transcrição de áudio)
      </label>
      <textarea
        name="conteudo"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Ex: Bom dia! Fechei a escavadeira E175 por 850 mil, financiamento. Visita quinta às 14h."
        className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <BotaoVoz onTexto={(t) => setTexto((prev) => prev + t)} />
        <BotaoAnalisar />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        A IA extrai máquina, valor, pagamento, concorrente e a data da visita. Use o botão “Falar” para ditar.
      </p>
    </form>
  );
}
