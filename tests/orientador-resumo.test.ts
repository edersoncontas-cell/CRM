// "Para os contatos que eu selecionar que não é cliente, o orientador deixará
// apenas um resumo do contexto de toda conversa."
//
// O que estes testes protegem:
//
// 1) A porta. Se `soResumo` pegasse mais gente do que deve — "potencial", por
//    exemplo, que é o padrão de todo mundo que chega — o Orientador emudeceria
//    no CRM inteiro. É a falha mais cara possível aqui, e a mais silenciosa:
//    ninguém repara que o painel parou de orientar, só que ele "piorou".
//
// 2) A limpeza da leitura antiga. Um contato pode ter sido analisado como
//    negociação ANTES de ser marcado como não-cliente. Se a análise gravada
//    mantivesse estágio "Proposta" e 70% de chance, essa leitura velha
//    continuaria viva em qualquer lista que leia OrientadorAnalise sem olhar o
//    status do cadastro.
//
// 3) O prompt. O modelo é treinado a ajudar e termina tudo com "sugiro retomar
//    o contato" — exatamente o que o vendedor pediu para sumir desses
//    contatos.

import { describe, it, expect } from "vitest";
import {
  soResumo, STATUS_NAO_CLIENTE, limparResumo, montarPromptResumoContato,
  analiseSoResumo, LIMITE_RESUMO,
} from "@/lib/zeus/orientador-resumo";

describe("quem entra no modo só-resumo", () => {
  it("só o contato marcado na mão como não é cliente", () => {
    expect(soResumo("nao_cliente")).toBe(true);
    expect(soResumo(STATUS_NAO_CLIENTE)).toBe(true);
  });

  it("cliente e potencial continuam recebendo o Orientador inteiro", () => {
    expect(soResumo("cliente")).toBe(false);
    expect(soResumo("potencial")).toBe(false);
  });

  it("cadastro sem status é tratado como gente normal, não como não-cliente", () => {
    expect(soResumo(null)).toBe(false);
    expect(soResumo(undefined)).toBe(false);
    expect(soResumo("")).toBe(false);
    expect(soResumo("   ")).toBe(false);
  });

  it("caixa e espaço sobrando não confundem", () => {
    expect(soResumo("NAO_CLIENTE")).toBe(true);
    expect(soResumo("  nao_cliente  ")).toBe(true);
  });

  it("status parecido não vale — tem de ser o valor exato do formulário", () => {
    expect(soResumo("nao")).toBe(false);
    expect(soResumo("não é cliente")).toBe(false);
    expect(soResumo("nao_cliente_ainda")).toBe(false);
  });
});

describe("o texto que chega ao card", () => {
  it("cerca de markdown sai", () => {
    expect(limparResumo("```\nFalou sobre o guincho.\n```")).toBe("Falou sobre o guincho.");
    expect(limparResumo("```md\nFalou sobre o guincho.\n```")).toBe("Falou sobre o guincho.");
  });

  it("rótulo colado na frente sai", () => {
    expect(limparResumo("Resumo: é o contador da empresa.")).toBe("é o contador da empresa.");
    expect(limparResumo("Resumo da conversa — pediu a nota fiscal.")).toBe("pediu a nota fiscal.");
  });

  it("aspas em volta do texto inteiro saem", () => {
    expect(limparResumo('"Mandou um vídeo de uma retro."')).toBe("Mandou um vídeo de uma retro.");
  });

  it("aspas no meio do texto ficam — não é cerca, é fala", () => {
    expect(limparResumo('Ele disse "passo lá amanhã" e sumiu.')).toBe('Ele disse "passo lá amanhã" e sumiu.');
  });

  it("linha em branco a mais vira uma só", () => {
    expect(limparResumo("Primeira parte.\n\n\n\nSegunda parte.")).toBe("Primeira parte.\n\nSegunda parte.");
  });

  it("texto gigante é cortado no limite", () => {
    expect(limparResumo("a".repeat(5000)).length).toBe(LIMITE_RESUMO);
  });

  it("resposta vazia não quebra", () => {
    expect(limparResumo("")).toBe("");
    expect(limparResumo(null)).toBe("");
    expect(limparResumo(undefined)).toBe("");
    expect(limparResumo("   \n  ")).toBe("");
  });
});

describe("o prompt do resumo", () => {
  const { system, user } = montarPromptResumoContato({
    nomeContato: "Seu Zé do guincho",
    historico: "[01/02/2026 09:00] Cliente: bom dia, sou o Zé do guincho",
  });

  it("manda ler a conversa inteira, não só o fim", () => {
    expect(system).toMatch(/da primeira mensagem à última/i);
  });

  it("proíbe conselho de venda, próxima ação e cobrança de retorno", () => {
    expect(system).toMatch(/NÃO dê conselho de venda/i);
    expect(system).toMatch(/NÃO sugira próxima ação/i);
    expect(system).toMatch(/NÃO cobre retorno/i);
  });

  it("proíbe inventar", () => {
    expect(system).toMatch(/NÃO invente/i);
  });

  it("o nome e a conversa chegam ao modelo", () => {
    expect(user).toContain("Seu Zé do guincho");
    expect(user).toContain("Zé do guincho");
    expect(user).toContain("09:00");
  });

  it("contato sem nome não vira 'undefined' no prompt", () => {
    const r = montarPromptResumoContato({ nomeContato: "", historico: "oi" });
    expect(r.user).not.toContain("undefined");
    expect(r.user).toContain("sem nome");
  });

  it("conversa vazia não vira 'undefined' no prompt", () => {
    const r = montarPromptResumoContato({ nomeContato: "Zé", historico: "" });
    expect(r.user).not.toContain("undefined");
    expect(r.user).toContain("(sem mensagens)");
  });
});

describe("o que fica gravado para um não-cliente", () => {
  const a = analiseSoResumo("É o contador da BWB. Pediu a nota fiscal da última venda.");

  it("o resumo é o conteúdo, já limpo", () => {
    expect(a.resumoNegociacao).toBe("É o contador da BWB. Pediu a nota fiscal da última venda.");
    expect(analiseSoResumo("Resumo: é o contador.").resumoNegociacao).toBe("é o contador.");
  });

  it("NADA de leitura de venda sobra: sem próxima ação, sem chance de fechar", () => {
    expect(a.proximaAcao).toBe("");
    expect(a.probabilidadeFechamento).toBe(0);
    expect(a.temperatura).toBe("fria");
    expect(a.objecoes).toEqual([]);
    expect(a.oportunidadesPerdidas).toEqual([]);
    expect(a.combinados).toEqual([]);
    expect(a.pendencias).toEqual([]);
    expect(a.perfilComprador).toBe(null);
  });

  it("nenhum alerta é criado — o CRM não cobra retorno de quem não é cliente", () => {
    expect(a.alertas).toEqual([]);
  });

  it("nenhum fato vai para a ficha da negociação", () => {
    expect(a.fatos.maquinaModelo).toBe(null);
    expect(a.fatos.valor).toBe(null);
    expect(a.fatos.condicaoPagamento).toBe(null);
    expect(a.fatos.municipio).toBe(null);
  });

  it("nenhum pedido pendente fica proposto na tela", () => {
    expect(a.pedidos).toEqual([]);
  });

  it("o coaching vai vazio, e não com a leitura antiga de quando era negociação", () => {
    // coachingVazio() é o "nada lido" do CRM: roteiro, objeções e alerta
    // zerados, e a nota da condução no neutro (5), que é como o resto do
    // sistema já representa ausência de leitura. O que importa aqui é que
    // nenhum conteúdo da análise anterior sobreviva.
    expect(a.coaching.roteiro).toEqual([]);
    expect(a.coaching.tratamentoObjecoes).toEqual([]);
    expect(a.coaching.perguntasAgora).toEqual([]);
    expect(a.coaching.informacoesFaltando).toEqual([]);
    expect(a.coaching.sinaisCompra).toEqual([]);
    expect(a.coaching.sinaisRisco).toEqual([]);
    expect(a.coaching.conducao.acertos).toEqual([]);
    expect(a.coaching.conducao.correcoes).toEqual([]);
    expect(a.coaching.alertaAgora).toBe(null);
    expect(a.coaching.personalidade.estilo).toBe(null);
  });

  it("a explicação diz o porquê, para ninguém achar que a IA falhou", () => {
    expect(a.probabilidadeExplicacao).toMatch(/não é cliente/i);
  });

  it("resumo vazio não inventa texto", () => {
    expect(analiseSoResumo("").resumoNegociacao).toBe("");
  });
});
