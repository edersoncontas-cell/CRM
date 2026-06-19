"use client";

import { useEffect, useState } from "react";
import { GRUPOS, lerMenuOcultos, salvarMenuOcultos } from "@/lib/menu";
import { Eye, EyeOff, LayoutList } from "lucide-react";

// Lista todos os itens do menu lateral com um interruptor para mostrar/ocultar.
// Por padrão todos ficam visíveis; ao desligar um, ele some do menu na hora e
// volta ao religar. "Configurações" é fixo (não pode ser ocultado).
export function VisibilidadeMenu() {
  const [ocultos, setOcultos] = useState<string[]>([]);

  useEffect(() => { setOcultos(lerMenuOcultos()); }, []);

  function alternar(href: string) {
    setOcultos((prev) => {
      const novo = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      salvarMenuOcultos(novo);
      return novo;
    });
  }

  const totalVisiveis = GRUPOS.flatMap((g) => g.links).filter((l) => l.fixo || !ocultos.includes(l.href)).length;
  const total = GRUPOS.flatMap((g) => g.links).length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
        <LayoutList size={18} className="text-brand-600" /> Itens do menu lateral
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
          {totalVisiveis}/{total} visíveis
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Marque o que você quer ver no menu à esquerda. O que desligar some na hora e
        volta ao religar (essa preferência fica salva neste aparelho).
      </p>

      <div className="space-y-5">
        {GRUPOS.map((grupo) => (
          <div key={grupo.label}>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {grupo.label}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {grupo.links.map(({ href, label, icon: Icon, fixo }) => {
                const visivel = fixo || !ocultos.includes(href);
                return (
                  <button
                    key={href}
                    onClick={() => !fixo && alternar(href)}
                    disabled={fixo}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                      visivel
                        ? "border-brand-200 bg-brand-50/50"
                        : "border-slate-200 bg-slate-50 opacity-70"
                    } ${fixo ? "cursor-default" : "hover:border-brand-300"}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon size={16} className={visivel ? "text-brand-600" : "text-slate-400"} />
                      <span className={`truncate text-sm font-medium ${visivel ? "text-slate-800" : "text-slate-500"}`}>
                        {label}
                      </span>
                      {fixo && <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">fixo</span>}
                    </span>
                    {/* Interruptor */}
                    <span
                      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
                        visivel ? "bg-brand-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className="absolute top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white transition-all"
                        style={{ left: visivel ? "18px" : "2px" }}
                      >
                        {visivel ? <Eye size={9} className="text-brand-600" /> : <EyeOff size={9} className="text-slate-400" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
