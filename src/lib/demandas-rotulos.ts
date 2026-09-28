// Rótulos das Demandas que a TELA usa (componente de navegador).
//
// Moram fora de lib/demandas.ts de propósito: aquele arquivo abre o banco
// (Prisma), e importar um valor dele num componente "use client" levava o
// Prisma para o navegador — a tela Demandas caía inteira em "Algo deu errado
// nesta página" (PrismaClient is unable to run in this browser environment).
// Componente de navegador importa daqui; lib/demandas.ts repassa o mesmo nome.

export const ROTULO_ORIGEM: Record<string, string> = {
  manual: "Você",
  audio: "Por áudio",
  orientador: "Orientador",
  posvenda: "Pós-venda",
  cerebro: "Cérebro",
  zeus: "ZEUS",
};
