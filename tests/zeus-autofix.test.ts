// Autoconserto: o ZEUS detecta uma falha, o CRM abre uma issue no GitHub e o
// Claude entra para corrigir e abrir um PR.
//
// O que estes testes protegem, em ordem de gravidade:
//
// 1. VAZAMENTO. O corpo da issue é montado a partir de mensagem de erro e
//    stack trace, onde cabe de tudo: chave de API, token, string de conexão do
//    banco, telefone e e-mail de cliente. A issue vai para o GitHub. Nada
//    disso pode viajar junto.
// 2. ENXURRADA. O mesmo defeito, com ids diferentes a cada ocorrência, tem de
//    virar UM chamado — senão um erro em laço abre centenas de issues e
//    centenas de PRs conflitantes.

import { describe, it, expect } from "vitest";
import { redigir, assinaturaFalha, tituloDoChamado, corpoDoChamado } from "@/lib/zeus/autofix";

describe("limpeza do que vai para o GitHub", () => {
  it("apaga chave de API", () => {
    expect(redigir("falhou com sk-abc123DEF456ghi789JKL")).not.toContain("abc123DEF456ghi789JKL");
    expect(redigir("key=AIzaSyD-1234567890abcdefghijklmnop")).not.toContain("AIzaSyD-1234567890abcdefghijklmnop");
    expect(redigir("ghp_1234567890abcdefghijklmnopqrstuvwx")).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwx");
  });

  it("apaga token em cabeçalho e senha em string de conexão", () => {
    expect(redigir("Authorization: Bearer meu-token-secreto")).not.toContain("meu-token-secreto");
    expect(redigir('{"apiKey":"valor-secreto"}').includes("valor-secreto")).toBe(false);
    const conexao = redigir("postgresql://usuario:senha123@servidor:5432/crm");
    expect(conexao).not.toContain("senha123");
    expect(conexao).not.toContain("usuario");
  });

  it("apaga telefone e e-mail de cliente", () => {
    expect(redigir("conversa com 28999990001@c.us")).not.toContain("28999990001");
    expect(redigir("cliente (28) 99999-0001 reclamou")).not.toContain("99999-0001");
    expect(redigir("avisar cliente@empresa.com.br")).not.toContain("cliente@empresa.com.br");
  });

  it("não apaga o que interessa para consertar", () => {
    const t = redigir("TypeError: Cannot read properties of null (reading 'municipio') em alimentarNegociacao");
    expect(t).toContain("TypeError");
    expect(t).toContain("municipio");
    expect(t).toContain("alimentarNegociacao");
  });

  it("texto limpo passa inteiro", () => {
    expect(redigir("falha ao ler a coluna notaVendedor")).toBe("falha ao ler a coluna notaVendedor");
  });
});

describe("assinatura da falha", () => {
  it("o mesmo defeito com ids diferentes vira UMA assinatura", () => {
    const a = assinaturaFalha("Erro em orientador do cliente cmu9pfk390002k60oucad1f5h: coluna ausente");
    const b = assinaturaFalha("Erro em orientador do cliente cmxab12340009k60ouzzz9q2w: coluna ausente");
    expect(a).toBe(b);
  });

  it("número que muda não cria falha nova", () => {
    expect(assinaturaFalha("Falha no Gemini (429)")).toBe(assinaturaFalha("Falha no Gemini (503)"));
  });

  it("defeitos diferentes continuam diferentes", () => {
    expect(assinaturaFalha("Erro ao gravar negociação")).not.toBe(assinaturaFalha("Erro ao ler município"));
  });
});

describe("chamado montado", () => {
  const falha = {
    titulo: "Erro em processarOrientador: Cannot read properties of null",
    severidade: "alta",
    contexto: "processarOrientador",
    mensagem: "Cannot read properties of null (reading 'valor')",
    stack: "at aplicarFatos (orientador.ts:190)\nGEMINI_API_KEY=AIzaSyD-1234567890abcdefghijklmnop",
    ocorrencias: 3,
  };

  it("o título identifica a falha e marca que veio do ZEUS", () => {
    const t = tituloDoChamado(falha);
    expect(t.startsWith("[ZEUS]")).toBe(true);
    expect(t).toContain("processarOrientador");
  });

  it("o corpo leva o que o Claude precisa", () => {
    const c = corpoDoChamado(falha);
    expect(c).toContain("processarOrientador");
    expect(c).toContain("Cannot read properties of null");
    expect(c).toContain("Pull Request");
    expect(c).toContain("Não publique direto na produção");
  });

  it("o corpo carrega a assinatura, que é como o duplicado é evitado", () => {
    expect(corpoDoChamado(falha)).toContain(`\`${assinaturaFalha(falha.titulo)}\``);
  });

  it("A CHAVE NÃO VAI JUNTO, nem escondida no stack", () => {
    const c = corpoDoChamado(falha);
    expect(c).not.toContain("AIzaSyD-1234567890abcdefghijklmnop");
    expect(c).toContain("chave Google removida");
  });

  it("falha sem stack não quebra a montagem", () => {
    const c = corpoDoChamado({ titulo: "Erro solto", severidade: "media" });
    expect(c).toContain("Erro solto");
    expect(c).toContain("Pull Request");
  });
});
