"use client";

// Campo de busca de clientes com filtragem automática (sem precisar clicar em
// "Buscar"): a cada tecla, aguarda um instante e atualiza a URL (?q=...),
// que já é o parâmetro que a página server-side usa para filtrar.

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

export function BuscaClientesInstantanea({ valorInicial }: { valorInicial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [valor, setValor] = useState(valorInicial);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValor(valorInicial), [valorInicial]);

  function atualizarUrl(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q); else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  function onChange(v: string) {
    setValor(v);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => atualizarUrl(v), 350);
  }

  return (
    <div className="mb-5 flex gap-2">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar cliente por nome ou telefone..."
          className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:border-[#BFDE4D]"
          style={{ background: "#18181b", borderColor: "#27272a", color: "#fafafa" }}
        />
      </div>
      {valor && (
        <button
          onClick={() => onChange("")}
          className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
        >
          <X size={14} /> Limpar
        </button>
      )}
    </div>
  );
}
