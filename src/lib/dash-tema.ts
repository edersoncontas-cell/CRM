// Tema visual do Dashboard (referência escolhida pelo usuário: fundo roxo
// profundo + cores neon). Centralizado aqui para a página, os gráficos e o
// mapa usarem exatamente a mesma paleta.
export const T = {
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
} as const;

export const CORES_SERIE = [T.violeta, T.ciano, T.verde, T.rosa, T.amarelo, T.laranja, "#60a5fa", "#a3e635", T.vermelho, "#c084fc"];
