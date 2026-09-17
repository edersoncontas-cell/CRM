"use client";

// Campo de cidade que FILTRA de verdade enquanto o vendedor digita.
//
// Antes isto era um <input list> com <datalist>: o navegador decide sozinho se
// filtra e como filtra — digitar "S" na lista de São Paulo continuava
// mostrando "Águas da Prata" no topo. Aqui a lista é nossa, ignora acento e
// maiúscula, e quem começa com o que foi digitado aparece primeiro. Continua
// aceitando nome digitado à mão (cidade que não está na lista, ou lista que
// não carregou).

import { useEffect, useId, useRef, useState } from "react";
import { filtrarCidades } from "@/lib/filtrar-cidades";
import { cn } from "@/lib/utils";

export function CampoCidade({
  valor,
  aoMudar,
  opcoes,
  placeholder,
  desabilitado = false,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  opcoes: string[];
  placeholder?: string;
  desabilitado?: boolean;
  className?: string;
}) {
  const idLista = useId();
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(-1);
  const caixa = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  const sugestoes = filtrarCidades(opcoes, valor);

  // Clicou fora (inclusive em outro campo do pop-up): fecha a lista.
  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent | TouchEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
    };
  }, [aberto]);

  useEffect(() => {
    if (destaque < 0) return;
    lista.current?.children[destaque]?.scrollIntoView({ block: "nearest" });
  }, [destaque]);

  function escolher(nome: string) {
    aoMudar(nome);
    setAberto(false);
    setDestaque(-1);
  }

  function teclado(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setAberto(false);
      setDestaque(-1);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!aberto) {
        setAberto(true);
        setDestaque(0);
        return;
      }
      if (sugestoes.length === 0) return;
      const passo = e.key === "ArrowDown" ? 1 : -1;
      setDestaque((d) => (d + passo + sugestoes.length) % sugestoes.length);
      return;
    }
    if (e.key === "Enter" && aberto && destaque >= 0 && sugestoes[destaque]) {
      e.preventDefault();
      escolher(sugestoes[destaque]);
    }
  }

  const semResultado = aberto && !desabilitado && valor.trim() !== "" && sugestoes.length === 0 && opcoes.length > 0;

  return (
    <div ref={caixa} className="relative">
      <input
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value);
          setAberto(true);
          setDestaque(-1);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={teclado}
        placeholder={placeholder}
        disabled={desabilitado}
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        className={className}
      />
      {aberto && !desabilitado && sugestoes.length > 0 && (
        <ul
          id={idLista}
          ref={lista}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {sugestoes.map((nome, i) => (
            <li key={nome}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(nome)}
                onMouseEnter={() => setDestaque(i)}
                className={cn(
                  "block w-full px-3 py-1.5 text-left text-sm",
                  i === destaque ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"
                )}
              >
                {nome}
              </button>
            </li>
          ))}
        </ul>
      )}
      {semResultado && (
        <p className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 shadow-xl">
          Nenhuma cidade com “{valor}”. Pode deixar escrito assim mesmo.
        </p>
      )}
    </div>
  );
}
