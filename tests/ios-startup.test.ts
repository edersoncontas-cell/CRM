import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TELAS_IOS, arquivoSplashIOS, startupImagesIOS } from "../src/lib/ios-startup";

describe("telas de lançamento do iOS", () => {
  it("cada tela da lista tem a imagem gerada em public/", () => {
    for (const t of TELAS_IOS) {
      const arq = join(process.cwd(), "public", arquivoSplashIOS(t));
      expect(existsSync(arq), `falta ${arq} — rode scripts/gerar-splash-ios.py`).toBe(true);
    }
  });

  it("media query casa largura, altura e escala em pixels lógicos, só retrato", () => {
    const [x] = startupImagesIOS();
    expect(x.url).toBe("/splash-ios/1320x2868.png");
    expect(x.media).toBe("screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)");
  });

  it("não há duas telas com o mesmo arquivo", () => {
    const urls = startupImagesIOS().map((s) => s.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
