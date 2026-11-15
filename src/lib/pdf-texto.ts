// As fontes padrão do PDF (Helvetica/WinAnsi) têm acentos do português mas
// não têm emoji — remove antes de escrever, senão vira lixo no PDF.
// Módulo puro (sem banco): vários geradores de PDF usam.
export const limparParaPdf = (s: string) =>
  s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\*\*/g, "").replace(/\r/g, "");
