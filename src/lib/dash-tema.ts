import type { ModoTema } from "@/lib/tema";

// Tema visual do Dashboard. Centralizado aqui para a página, os gráficos, o
// letreiro e o mapa usarem exatamente a mesma paleta. Para trocar o tema do
// Dashboard inteiro basta mudar ATIVO (as chaves "rosa", "ciano" etc. são os
// papéis de destaque: rosa = destaque principal, ciano = secundário...).

export type TemaDash = {
  fundo: string;        // gradiente do fundo da página
  fundoSolido: string;  // cor sólida equivalente (mapa, fallback)
  card: string;
  card2: string;        // card em destaque / tooltip
  borda: string;
  texto: string;
  texto2: string;
  mudo: string;
  rosa: string;         // destaque principal (valores, linha de vendas, chip do ano)
  ciano: string;        // destaque secundário
  violeta: string;      // séries / anéis
  verde: string;
  amarelo: string;
  laranja: string;
  vermelho: string;
  sobre: string;        // sobreposição leve (fundo de linhas/atalhos)
  sobre2: string;       // sobreposição média (trilhos de barra, anel vazio)
  sobre3: string;       // sobreposição forte (dia de hoje no calendário)
  sobreEscuro: string;  // fundo escurecido (seletor sobre o mapa)
  sombra: string;       // sombra dos cards
};

export const TEMAS = {
  // Referência escolhida pelo usuário: roxo profundo + cores neon.
  roxo: {
    fundo: "linear-gradient(160deg, #1c0c38 0%, #130827 55%, #0e0620 100%)",
    fundoSolido: "#130827",
    card: "#1d1038",
    card2: "#241442",
    borda: "#34225c",
    texto: "#ffffff",
    texto2: "#b8a7d9",
    mudo: "#7d6ba3",
    rosa: "#ff3ea5",
    ciano: "#2ee6ff",
    violeta: "#9d6bff",
    verde: "#3dffa0",
    amarelo: "#ffd23f",
    laranja: "#ff9f43",
    vermelho: "#ff5c7a",
    sobre: "rgba(255,255,255,0.04)",
    sobre2: "rgba(255,255,255,0.08)",
    sobre3: "rgba(255,255,255,0.10)",
    sobreEscuro: "rgba(0,0,0,0.35)",
    sombra: "0 10px 30px rgba(0,0,0,0.25)",
  },
  // Grafite + amarelo New Holland: combina com o menu lateral e com a marca.
  grafite: {
    fundo: "linear-gradient(160deg, #141820 0%, #0f1319 55%, #0b0e13 100%)",
    fundoSolido: "#0f1319",
    card: "#181d26",
    card2: "#1f2530",
    borda: "#2b333f",
    texto: "#f8fafc",
    texto2: "#a7b0bd",
    mudo: "#6b7583",
    rosa: "#ffb81c",
    ciano: "#38bdf8",
    violeta: "#a78bfa",
    verde: "#34d399",
    amarelo: "#fde047",
    laranja: "#fb923c",
    vermelho: "#f87171",
    sobre: "rgba(255,255,255,0.04)",
    sobre2: "rgba(255,255,255,0.08)",
    sobre3: "rgba(255,255,255,0.10)",
    sobreEscuro: "rgba(0,0,0,0.35)",
    sombra: "0 10px 30px rgba(0,0,0,0.30)",
  },
  // Azul-marinho corporativo: sóbrio, destaque em âmbar e ciano.
  marinho: {
    fundo: "linear-gradient(160deg, #0d1a33 0%, #0a1428 55%, #070f1f 100%)",
    fundoSolido: "#0a1428",
    card: "#111f3d",
    card2: "#162749",
    borda: "#22365f",
    texto: "#f1f5f9",
    texto2: "#a5b4cf",
    mudo: "#64748b",
    rosa: "#fbbf24",
    ciano: "#22d3ee",
    violeta: "#818cf8",
    verde: "#4ade80",
    amarelo: "#fde68a",
    laranja: "#fb923c",
    vermelho: "#fb7185",
    sobre: "rgba(255,255,255,0.04)",
    sobre2: "rgba(255,255,255,0.08)",
    sobre3: "rgba(255,255,255,0.10)",
    sobreEscuro: "rgba(0,0,0,0.35)",
    sombra: "0 10px 30px rgba(0,0,0,0.30)",
  },
  // Claro: fundo cinza-gelo, cards brancos, cores mais profundas para contraste.
  claro: {
    fundo: "linear-gradient(160deg, #f5f7fb 0%, #eef2f8 60%, #e9edf4 100%)",
    fundoSolido: "#f0f3f8",
    card: "#ffffff",
    card2: "#f8fafc",
    borda: "#e2e8f0",
    texto: "#0f172a",
    texto2: "#475569",
    mudo: "#94a3b8",
    rosa: "#db2777",
    ciano: "#0891b2",
    violeta: "#6d28d9",
    verde: "#059669",
    amarelo: "#d97706",
    laranja: "#ea580c",
    vermelho: "#dc2626",
    sobre: "rgba(15,23,42,0.035)",
    sobre2: "rgba(15,23,42,0.08)",
    sobre3: "rgba(15,23,42,0.10)",
    sobreEscuro: "rgba(255,255,255,0.75)",
    sombra: "0 6px 20px rgba(15,23,42,0.06)",
  },
} as const satisfies Record<string, TemaDash>;

export type NomeTema = keyof typeof TEMAS;

/** O tema do Dashboard para o modo escolhido pelo vendedor. */
export function temaDash(modo: ModoTema): TemaDash {
  return modo === "claro" ? TEMAS.claro : TEMAS.grafite;
}

/**
 * As cores das séries dos gráficos, derivadas do tema.
 *
 * É função, e não constante, porque a paleta agora muda com o tema. Como
 * constante, ela congelaria as cores do escuro e as fatias do donut sairiam
 * neon dentro do tema claro.
 */
export function coresSerie(T: TemaDash): string[] {
  return [T.violeta, T.ciano, T.verde, T.rosa, T.amarelo, T.laranja,
    modoClaro(T) ? "#2563eb" : "#60a5fa",
    modoClaro(T) ? "#65a30d" : "#a3e635",
    T.vermelho,
    modoClaro(T) ? "#9333ea" : "#c084fc"];
}

/** O tema claro é o único com card branco — serve de chave sem passar o modo. */
function modoClaro(T: TemaDash): boolean {
  return T.card === "#ffffff";
}
