// Telas de lançamento do iOS (app instalado na tela de início).
//
// Sem uma imagem própria, o iOS abre o app mostrando o ÍCONE grande sobre o
// background_color do manifest até a primeira pintura — a logo "em tela cheia"
// antes do splash. Com uma imagem para cada tamanho de tela, ele mostra a
// imagem: aqui é só o fundo escuro do SplashIA, sem logo, para a abertura já
// começar no visual do splash e o emblema surgir na animação dele.
//
// O iOS só usa a imagem se o tamanho em pixels bater exatamente com a tela,
// por isso a lista por aparelho. Os arquivos ficam em public/splash-ios/ e são
// gerados por scripts/gerar-splash-ios.py a partir desta mesma lista.

export type TelaIOS = { largura: number; altura: number; escala: 2 | 3 };

export const TELAS_IOS: TelaIOS[] = [
  // iPhone
  { largura: 440, altura: 956, escala: 3 },
  { largura: 430, altura: 932, escala: 3 },
  { largura: 428, altura: 926, escala: 3 },
  { largura: 414, altura: 896, escala: 3 },
  { largura: 414, altura: 896, escala: 2 },
  { largura: 414, altura: 736, escala: 3 },
  { largura: 402, altura: 874, escala: 3 },
  { largura: 393, altura: 852, escala: 3 },
  { largura: 390, altura: 844, escala: 3 },
  { largura: 375, altura: 812, escala: 3 },
  { largura: 375, altura: 667, escala: 2 },
  // iPad
  { largura: 1024, altura: 1366, escala: 2 },
  { largura: 834, altura: 1194, escala: 2 },
  { largura: 834, altura: 1112, escala: 2 },
  { largura: 820, altura: 1180, escala: 2 },
  { largura: 810, altura: 1080, escala: 2 },
  { largura: 768, altura: 1024, escala: 2 },
];

export function arquivoSplashIOS(t: TelaIOS): string {
  return `/splash-ios/${t.largura * t.escala}x${t.altura * t.escala}.png`;
}

export function startupImagesIOS(): { url: string; media: string }[] {
  return TELAS_IOS.map((t) => ({
    url: arquivoSplashIOS(t),
    media: `screen and (device-width: ${t.largura}px) and (device-height: ${t.altura}px) and (-webkit-device-pixel-ratio: ${t.escala}) and (orientation: portrait)`,
  }));
}
