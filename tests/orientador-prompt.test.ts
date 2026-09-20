// O vendedor preenchia "O que o Orientador precisa saber" (o que combinou por
// telefone, o que viu na visita) e a leitura do painel não mudava.
//
// O texto CHEGAVA ao modelo — o bug não era esse. Ele ia para o fim de um
// system prompt de ~12 mil caracteres, depois da persona, do método, do
// contexto do cliente, da Academia, do estilo e das lições, enquanto a
// mensagem do usuário abria com "HISTÓRICO COMPLETO DA CONVERSA" e
// "ÚLTIMAS MENSAGENS (foco aqui)". A lista de fontes do system nem citava a
// nota. Resultado prático: o modelo analisava a conversa e ignorava o que o
// vendedor tinha acabado de escrever.
//
// Estes testes travam a posição: a nota abre a MENSAGEM DO USUÁRIO, antes do
// histórico, e o system a nomeia entre as fontes e nas regras críticas.

import { describe, it, expect } from "vitest";
import { montarPromptOrientador, montarPromptCoaching, CABECALHO_NOTA_VENDEDOR } from "@/lib/zeus/orientador-prompt";

const base = {
  historico: "[01/09 10:00] Cliente: bom dia, quanto custa uma retro?",
  ultimasMensagens: "Cliente: bom dia, quanto custa uma retro?",
  contextoCliente: "Nome: Construtora Litoral",
  contextoAcademia: "## Academia",
  resumoEtapas: "## Etapas da venda",
};

const NOTA = "Falei por telefone: ele quer a B110 com entrada de 30% e banco já aprovado.";

describe("nota do vendedor no prompt do Orientador", () => {
  it("o texto da nota chega ao modelo", () => {
    const { user } = montarPromptOrientador({ ...base, notaVendedor: NOTA });
    expect(user).toContain(NOTA);
  });

  it("a nota vem ANTES do histórico — era essa a correção", () => {
    const { user } = montarPromptOrientador({ ...base, notaVendedor: NOTA });
    const posNota = user.indexOf(NOTA);
    const posHistorico = user.indexOf("=== HISTÓRICO COMPLETO DA CONVERSA ===");
    expect(posNota).toBeGreaterThanOrEqual(0);
    expect(posHistorico).toBeGreaterThanOrEqual(0);
    expect(posNota).toBeLessThan(posHistorico);
  });

  it("a nota abre a mensagem, não fica enterrada no meio", () => {
    const { user } = montarPromptOrientador({ ...base, notaVendedor: NOTA });
    expect(user.startsWith(CABECALHO_NOTA_VENDEDOR)).toBe(true);
  });

  it("a nota NÃO vai para o system — era lá que ela se perdia", () => {
    const { system } = montarPromptOrientador({ ...base, notaVendedor: NOTA });
    expect(system).not.toContain(NOTA);
  });

  it("o system nomeia a nota entre as fontes a analisar", () => {
    const { system } = montarPromptOrientador({ ...base, notaVendedor: NOTA });
    expect(system).toContain("o que o VENDEDOR informou fora do WhatsApp");
  });

  it("o system manda a nota ganhar da conversa quando contradizer", () => {
    const { system } = montarPromptOrientador({ ...base, notaVendedor: NOTA });
    expect(system).toContain("ESSE BLOCO GANHA");
  });

  it("sem nota, a mensagem continua começando pelo histórico", () => {
    const { user } = montarPromptOrientador({ ...base, notaVendedor: null });
    expect(user.startsWith("=== HISTÓRICO COMPLETO DA CONVERSA ===")).toBe(true);
    expect(user).not.toContain(CABECALHO_NOTA_VENDEDOR);
  });

  it("nota só com espaço conta como sem nota", () => {
    const { user } = montarPromptOrientador({ ...base, notaVendedor: "   \n  " });
    expect(user).not.toContain(CABECALHO_NOTA_VENDEDOR);
  });

  it("o histórico e as últimas mensagens continuam inteiros", () => {
    const { user } = montarPromptOrientador({ ...base, notaVendedor: NOTA });
    expect(user).toContain(base.historico);
    expect(user).toContain("=== ÚLTIMAS MENSAGENS (foco aqui) ===");
    expect(user).toContain(base.ultimasMensagens);
  });

  it("o contexto do cliente, a Academia e as etapas seguem no system", () => {
    const { system } = montarPromptOrientador({ ...base, notaVendedor: NOTA });
    expect(system).toContain(base.contextoCliente);
    expect(system).toContain(base.contextoAcademia);
    expect(system).toContain(base.resumoEtapas);
  });

  it("estilo e lições entram só quando existem", () => {
    const sem = montarPromptOrientador(base).system;
    expect(sem).not.toContain("Estilo de comunicação do vendedor");
    const com = montarPromptOrientador({ ...base, estilo: "fala curto e direto", licoes: ["fecha mais em visita"] }).system;
    expect(com).toContain("fala curto e direto");
    expect(com).toContain("fecha mais em visita");
  });
});

// ── O COACHING EM PEDIDO SEPARADO ───────────────────────────────────────────
//
// "Quero que o orientador da conversa do wadson fico no mesmo padrão dos
//  outros"
//
// O contrato compacto não produz coaching — é a maior parte do JSON, e foi o
// que se cortou para caber nos 6.000 tokens por minuto da camada gratuita.
// Quando o Gemini falha e o Groq atende, aquela conversa nasce sem
// personalidade, sem roteiro e sem nota de condução: ao lado das outras,
// parece quebrada. E é, para quem usa.
//
// Inflar o pedido não resolve — aí nada passa. Partir em DOIS resolve, e é o
// que estes testes travam: o segundo pedido tem de ser pequeno o bastante
// para caber sozinho no provedor apertado.
describe("o pedido só do coaching", () => {
  const { system, user } = montarPromptCoaching({
    estado: {
      resumo: "Quer a E145C por R$ 610.000 financiada.",
      estagio: "Proposta",
      maquina: "New Holland E145C",
      valor: 610000,
      pagamento: "financiamento",
      entradaPercentual: 10,
    },
    ultimasMensagens: "CLIENTE: consegue 600?",
    contextoCliente: "Wadson Pires Ratinho — Guaçuí",
    notaVendedor: "Entrada 10%",
  });

  it("pede o contrato do coaching, e só ele", () => {
    expect(system).toContain('"personalidade"');
    expect(system).toContain('"conducao"');
    expect(system).toContain('"roteiro"');
    expect(system).toContain('"tratamentoObjecoes"');
    // Não é para reescrever o que a primeira chamada já apurou.
    expect(system).toMatch(/não reescreva o resumo/i);
  });

  it("leva o ESTADO, não a conversa inteira — é daí que vem o tamanho", () => {
    expect(user).toContain("ESTADO DA NEGOCIAÇÃO");
    expect(user).toContain("New Holland E145C");
    expect(user).toContain("consegue 600?");
  });

  it("a nota do vendedor abre a mensagem, antes do estado", () => {
    expect(user.indexOf("Entrada 10%")).toBeLessThan(user.indexOf("ESTADO DA NEGOCIAÇÃO"));
  });

  it("as regras contra invenção continuam valendo", () => {
    expect(system).toMatch(/NUNCA invente/);
    expect(system).toMatch(/ESCAVADEIRA/);
    expect(system).toMatch(/Nome de empresa é rótulo/);
  });

  it("CABE sozinho no menor modelo gratuito do Groq", () => {
    // 6.000 tokens por minuto é o teto, e a saída reserva 1.200. O pedido
    // inteiro tem de caber no que sobra — senão este segundo pedido nasceria
    // com o mesmo defeito que ele existe para corrigir.
    const tokensEntrada = (system.length + user.length) / 4;
    expect(tokensEntrada + 1_200).toBeLessThanOrEqual(6_000);
  });
});
