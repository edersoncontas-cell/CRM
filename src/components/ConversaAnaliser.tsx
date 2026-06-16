"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { analisarConversaAction } from "@/lib/actions";
import { Bot, Loader2 } from "lucide-react";

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
        placeholder="Ex: Bom dia! Fechei a T7 por 450 mil, vai ser financiado. Pode marcar a visita quinta às 14h."
        className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          A IA extrai máquina, valor, pagamento, concorrente e a data da visita.
        </span>
        <BotaoAnalisar />
      </div>
    </form>
  );
}
