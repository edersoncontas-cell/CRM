// "quando vou registrar uma nova visita e clico para selecionar uma data
//  futura, o pop up de selecionar a data e hora ficam por trás da janela atual
//  que aparece, ele precisa aparecer na frente pra selecionar e confirmar"
//
// O seletor de data/hora é aberto de DENTRO de um modal, e os modais do CRM
// estão em z-[100]. A folha do seletor estava em z-50: abria atrás da janela
// que a chamou, e a data ficava impossível de escolher.
//
// Este teste lê o código-fonte porque o defeito é de CAMADA, não de lógica:
// não há função para chamar, e um teste de tela não pegaria a regressão de
// alguém baixar o número de novo sem olhar os modais.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** O z-index do primeiro `fixed inset-0` de um arquivo (a camada do overlay). */
function zDoOverlay(fonte: string): number | null {
  const m = fonte.match(/fixed inset-0 z-(\[(\d+)\]|(\d+))/);
  if (!m) return null;
  return Number(m[2] ?? m[3]);
}

const SELETOR = "src/components/WheelDatePicker.tsx";
// As janelas de onde o seletor é aberto.
const MODAIS = [
  "src/components/NovaVisitaForm.tsx",
  "src/components/NovoCompromissoCalendario.tsx",
  "src/components/FormNovaNegociacao.tsx",
];

describe("o seletor de data/hora abre NA FRENTE da janela que o chamou", () => {
  const zSeletor = zDoOverlay(ler(SELETOR));

  it("a folha do seletor tem uma camada própria", () => {
    expect(zSeletor).not.toBeNull();
  });

  for (const modal of MODAIS) {
    it(`fica acima de ${modal.split("/").pop()}`, () => {
      const zModal = zDoOverlay(ler(modal));
      // Modal sem overlay próprio (renderiza dentro de outro) não restringe nada.
      if (zModal == null) return;
      expect(zSeletor!).toBeGreaterThan(zModal);
    });
  }

  it("e acima de QUALQUER overlay de componente — é ele quem abre por último", () => {
    // Varre todos os componentes: o seletor não pode empatar nem perder para
    // nenhuma janela, porque qualquer uma delas pode vir a abri-lo.
    for (const nome of readdirSync(join(process.cwd(), "src/components"))) {
      if (!nome.endsWith(".tsx") || nome === "WheelDatePicker.tsx") continue;
      const fonte = ler(`src/components/${nome}`);
      const z = zDoOverlay(fonte);
      // Celebração (confete) é decorativa e não recebe clique: pode ficar por
      // cima sem atrapalhar ninguém.
      if (z == null || fonte.includes("pointer-events-none fixed inset-0")) continue;
      expect(zSeletor!, `${nome} está em z-${z}, acima ou igual ao seletor`).toBeGreaterThanOrEqual(z);
    }
  });
});
