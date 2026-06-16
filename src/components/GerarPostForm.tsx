"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { gerarPostAction } from "@/lib/marketing-actions";

const TIPOS = [
  { valor: "diario", label: "📅 Dica diária" },
  { valor: "segunda", label: "🚀 Segunda-feira" },
  { valor: "sexta", label: "🎯 Sexta-feira" },
  { valor: "mensal_inicio", label: "📆 Início do mês" },
  { valor: "mensal_fim", label: "⏰ Fim do mês" },
  { valor: "avulso", label: "⚡ Avulso" },
];

const CANAIS = [
  { valor: "ambos", label: "📱 WhatsApp + Instagram" },
  { valor: "whatsapp", label: "💬 WhatsApp" },
  { valor: "instagram", label: "📸 Instagram" },
];

export function GerarPostForm({
  categorias,
  marcas,
}: {
  categorias: string[];
  marcas: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [gerado, setGerado] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await gerarPostAction(fd);
      setGerado(true);
      setTimeout(() => setGerado(false), 3000);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-brand-50 p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo de post</label>
        <select
          name="tipo"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Marca</label>
        <select
          name="marca"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        >
          <option value="">Qualquer</option>
          {marcas.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Categoria</label>
        <select
          name="categoria"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        >
          <option value="">Qualquer</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Canal</label>
        <select
          name="canal"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:outline-none"
        >
          {CANAIS.map((c) => (
            <option key={c.valor} value={c.valor}>{c.label}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:from-fuchsia-700 hover:to-brand-700 disabled:opacity-60"
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Gerando…</>
        ) : gerado ? (
          <><Sparkles size={16} /> Post criado! ✅</>
        ) : (
          <><Sparkles size={16} /> Gerar post com IA</>
        )}
      </button>
    </form>
  );
}
