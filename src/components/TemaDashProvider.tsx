"use client";

import { createContext, useContext } from "react";
import type { TemaDash } from "@/lib/dash-tema";

// A paleta do Dashboard para os componentes de CLIENTE (gráficos, mapa,
// letreiro). Eles não podem ler o cookie, então a página — que é de servidor —
// entrega a paleta por aqui.
//
// A alternativa seria passar a cor em cada gráfico como propriedade, mas são
// quatro gráficos, o mapa e o letreiro, cada um usando de 11 a 26 cores: a
// lista de propriedades ficaria maior que o componente.
const Ctx = createContext<TemaDash | null>(null);

export function TemaDashProvider({ valor, children }: { valor: TemaDash; children: React.ReactNode }) {
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTemaDash(): TemaDash {
  const t = useContext(Ctx);
  if (!t) throw new Error("useTemaDash fora do TemaDashProvider");
  return t;
}
