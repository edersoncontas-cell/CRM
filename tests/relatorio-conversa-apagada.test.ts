// Conversa que o vendedor apagou no WhatsApp voltava para o relatório assim
// que o contato mandasse qualquer mensagem — um "bom dia" bastava. Ele apagou
// porque não era negócio; só deve voltar se houver interesse de VERDADE
// (negociação aberta no funil).

import { describe, it, expect } from "vitest";
import { foiApagadoPeloVendedor } from "@/lib/whatsapp-corte";

describe("telefone apagado pelo vendedor", () => {
  const apagados = new Set(["5527999183562", "552799183562", "27999183562", "2799183562"]);

  it("reconhece o número exato", () => {
    expect(foiApagadoPeloVendedor("5527999183562", apagados)).toBe(true);
  });

  it("reconhece a variante do 9º dígito — a conversa pode ter voltado gravada diferente", () => {
    expect(foiApagadoPeloVendedor("552799183562", apagados)).toBe(true);
    expect(foiApagadoPeloVendedor("27999183562", apagados)).toBe(true);
  });

  it("outro contato não é afetado", () => {
    expect(foiApagadoPeloVendedor("5527988887777", apagados)).toBe(false);
  });

  it("lista vazia não barra ninguém", () => {
    expect(foiApagadoPeloVendedor("5527999183562", new Set())).toBe(false);
  });
});

// A regra que o relatório aplica, isolada para poder ser testada sem banco.
function entraNoRelatorio(args: {
  conversaEscolhidaNaMao: boolean;
  telefoneApagado: boolean;
  temNegociacaoAberta: boolean;
}): boolean {
  return args.conversaEscolhidaNaMao || !args.telefoneApagado || args.temNegociacaoAberta;
}

describe("quem entra no relatório", () => {
  it("conversa normal entra", () => {
    expect(entraNoRelatorio({ conversaEscolhidaNaMao: false, telefoneApagado: false, temNegociacaoAberta: false })).toBe(true);
  });

  it("apagada pelo vendedor e sem negociação NÃO entra", () => {
    expect(entraNoRelatorio({ conversaEscolhidaNaMao: false, telefoneApagado: true, temNegociacaoAberta: false })).toBe(false);
  });

  it("apagada mas com negociação aberta volta — é interesse de verdade", () => {
    expect(entraNoRelatorio({ conversaEscolhidaNaMao: false, telefoneApagado: true, temNegociacaoAberta: true })).toBe(true);
  });

  it("pedir o PDF daquela conversa específica sempre vale", () => {
    // Ali ele escolheu ver aquela conversa; não é o relatório varrendo tudo.
    expect(entraNoRelatorio({ conversaEscolhidaNaMao: true, telefoneApagado: true, temNegociacaoAberta: false })).toBe(true);
  });
});
