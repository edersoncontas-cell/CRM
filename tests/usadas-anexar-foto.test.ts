// Máquinas Usadas (23/10, print dele): "a opção de anexar foto não está
// aparecendo, a única opção é tirar foto". Era o `capture="environment"` no
// campo de arquivo: no celular ele abre direto a câmera e some com a galeria.
// Aqui o campo só ANEXA (galeria/arquivos).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/components/MaquinasUsadasClient.tsx", "utf8");

describe("foto da máquina usada: anexar, não só tirar", () => {
  it("o campo de arquivo não força a câmera (sem capture) e aceita imagem", () => {
    const campos = fonte.match(/<input[^>]*type="file"[^>]*>/g) ?? [];
    expect(campos).toHaveLength(1);
    expect(campos[0]).toContain('accept="image/*"');
    expect(campos[0]).not.toMatch(/capture/);
  });

  it("o botão diz 'Anexar foto' e não oferece 'Tirar foto'", () => {
    expect(fonte).toContain("Anexar foto");
    expect(fonte).not.toMatch(/\/>\s*Tirar/); // rótulo de botão (o comentário do código pode citar o caso)
  });

  it("nenhum outro campo de foto do CRM força a câmera", () => {
    // Quem anexa foto em outra tela (conversa, mensagem em massa) já escolhia da galeria.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const achados = execSync(`grep -rn 'capture=' src --include=*.tsx || true`).toString().trim();
    expect(achados).toBe("");
  });
});
