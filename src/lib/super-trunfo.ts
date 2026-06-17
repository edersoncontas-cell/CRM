import { CATEGORIAS } from "@/lib/comparativo";

export type MaqTrunfo = {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  proprio: boolean;
  pesoOperacional: number | null;
  potencia: number | null;
  especificacoes: string | null;
  pontosFortes: string | null;
};

export type CategoriaTrunfo = {
  categoria: string;
  label: string;
  minhas: MaqTrunfo[];
  concorrentes: MaqTrunfo[];
};

// Monta o "deck" do Super Trunfo: por categoria, as minhas máquinas (linha
// amarela) seguidas dos concorrentes, todos ordenados por peso operacional.
export function montarDeck(maquinas: MaqTrunfo[]): CategoriaTrunfo[] {
  const porCat = new Map<string, MaqTrunfo[]>();
  for (const m of maquinas) {
    if (!porCat.has(m.categoria)) porCat.set(m.categoria, []);
    porCat.get(m.categoria)!.push(m);
  }

  const ordenaPeso = (a: MaqTrunfo, b: MaqTrunfo) =>
    (a.pesoOperacional ?? 0) - (b.pesoOperacional ?? 0);

  const decks: CategoriaTrunfo[] = [];
  for (const [categoria, lista] of porCat) {
    const minhas = lista.filter((m) => m.proprio).sort(ordenaPeso);
    if (minhas.length === 0) continue; // só categorias onde eu vendo
    const concorrentes = lista.filter((m) => !m.proprio).sort(ordenaPeso);
    decks.push({
      categoria,
      label: CATEGORIAS[categoria] ?? categoria,
      minhas,
      concorrentes,
    });
  }

  // Ordem fixa e profissional das categorias
  const ORDEM = [
    "miniescavadeira", "escavadeira", "retroescavadeira", "minicarregadeira",
    "pacarregadeira", "motoniveladora", "tratoresteira",
    "rolo_solo", "rolo_tandem", "rolo_pneumatico", "paver", "leve",
  ];
  return decks.sort((a, b) => {
    const ia = ORDEM.indexOf(a.categoria);
    const ib = ORDEM.indexOf(b.categoria);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// Extrai os "atributos" de uma ficha (linhas "Rótulo: valor") para montar a
// tabela comparativa em forma de super trunfo.
export function parseFicha(especificacoes: string | null): { rotulo: string; valor: string }[] {
  if (!especificacoes) return [];
  return especificacoes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      if (i === -1) return { rotulo: l, valor: "" };
      return { rotulo: l.slice(0, i).trim(), valor: l.slice(i + 1).trim() };
    });
}
