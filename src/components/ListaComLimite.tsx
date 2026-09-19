"use client";

// Padrão do CRM para qualquer lista dentro de um card: nunca deixar a lista
// crescer sem fim e estufar a página (isso também fazia os cards vizinhos, no
// mesmo grid, esticarem para acompanhar o mais alto). Mostra um número fixo
// de itens e revela o resto sob pedido, com "ver mais" — e "ver menos" para
// recolher de volta.
//
// Estrutural (sem tema): o card decide as cores. Cada item vem pronto de
// renderItem (com sua própria marcação/estilo); o componente só entrega o
// <li> e o botão.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function ListaComLimite<T>({
  itens,
  chave,
  renderItem,
  limite = 5,
  passo,
  classNameLista,
  classNameBotao = "mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800",
  rotuloVerMais,
  rotuloVerMenos = "Ver menos",
}: {
  itens: T[];
  chave: (item: T, indice: number) => React.Key;
  renderItem: (item: T, indice: number) => React.ReactNode;
  /** Quantos itens aparecem de início. */
  limite?: number;
  /** Quantos itens a mais cada clique em "ver mais" revela (padrão: o próprio limite). */
  passo?: number;
  classNameLista?: string;
  classNameBotao?: string;
  rotuloVerMais?: (restantes: number) => string;
  rotuloVerMenos?: string;
}) {
  const [mostrar, setMostrar] = useState(limite);
  if (itens.length === 0) return null;

  const visiveis = itens.slice(0, mostrar);
  const restantes = itens.length - visiveis.length;
  const passoReal = passo ?? limite;
  const podeRecolher = restantes <= 0 && mostrar > limite;

  return (
    <>
      <ul className={classNameLista}>
        {visiveis.map((item, i) => (
          <li key={chave(item, i)}>{renderItem(item, i)}</li>
        ))}
      </ul>
      {restantes > 0 && (
        <button type="button" onClick={() => setMostrar((m) => Math.min(itens.length, m + passoReal))} className={classNameBotao}>
          <ChevronDown size={13} /> {rotuloVerMais ? rotuloVerMais(restantes) : `Ver mais (${restantes})`}
        </button>
      )}
      {podeRecolher && (
        <button type="button" onClick={() => setMostrar(limite)} className={classNameBotao}>
          <ChevronUp size={13} /> {rotuloVerMenos}
        </button>
      )}
    </>
  );
}
