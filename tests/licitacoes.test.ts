// Licitações de máquina: o filtro é o que decide se o painel presta. Deixar
// passar merenda escolar enche a tela de lixo; barrar retroescavadeira faz
// perder venda. Estes testes travam as duas pontas.

import { describe, it, expect } from "vitest";
import { termosDeMaquina, cidadeAtendida, normalizarItemPncp, MODALIDADES, POR_PAGINA, MAX_PAGINAS, PRAZO_TOTAL_MS,
  esperaDoRetryAfter, USER_AGENT, PAUSA_ENTRE_PAGINAS_MS, TENTATIVAS_429 } from "@/lib/licitacoes";

describe("o que é licitação de máquina", () => {
  it("pega as máquinas que ele vende", () => {
    expect(termosDeMaquina("Aquisição de 01 (uma) retroescavadeira 4x4")).toContain("retroescavadeira");
    expect(termosDeMaquina("AQUISIÇÃO DE PÁ CARREGADEIRA SOBRE RODAS")).toContain("pá carregadeira");
    expect(termosDeMaquina("Compra de motoniveladora nova")).toContain("motoniveladora");
    expect(termosDeMaquina("Rolo compactador vibratório de solo")).toContain("rolo compactador");
    expect(termosDeMaquina("aquisicao de escavadeira hidraulica")).toContain("escavadeira");
  });

  it("ignora o que não é máquina", () => {
    expect(termosDeMaquina("Aquisição de gêneros alimentícios para a merenda escolar")).toEqual([]);
    expect(termosDeMaquina("Contratação de serviços de limpeza urbana")).toEqual([]);
    expect(termosDeMaquina("Material de expediente e papelaria")).toEqual([]);
  });

  it("descarta aluguel, manutenção e peças — não é venda de máquina", () => {
    expect(termosDeMaquina("Locação de retroescavadeira com operador")).toEqual([]);
    expect(termosDeMaquina("Manutenção preventiva de pá carregadeira")).toEqual([]);
    expect(termosDeMaquina("Aquisição de peças para motoniveladora")).toEqual([]);
    expect(termosDeMaquina("Seguro da escavadeira municipal")).toEqual([]);
  });

  it("não repete o termo genérico quando o específico já casou", () => {
    // "escavadeira" está dentro de "retroescavadeira": mostrar os dois no chip
    // ficaria redundante na tela.
    expect(termosDeMaquina("Aquisição de retroescavadeira")).toEqual(["retroescavadeira"]);
  });

  it("acento e caixa não atrapalham", () => {
    expect(termosDeMaquina("AQUISIÇÃO DE MÁQUINA PESADA")).toContain("máquina pesada");
    expect(termosDeMaquina("aquisicao de maquina pesada")).toContain("máquina pesada");
  });
});

describe("só as cidades da área", () => {
  const cidades = ["Alegre", "Cachoeiro de Itapemirim", "Santa Maria de Jetibá", "Afonso Cláudio"];

  it("casa ignorando acento e caixa", () => {
    expect(cidadeAtendida("ALEGRE", cidades)).toBe("Alegre");
    expect(cidadeAtendida("santa maria de jetiba", cidades)).toBe("Santa Maria de Jetibá");
    expect(cidadeAtendida("Afonso Claudio", cidades)).toBe("Afonso Cláudio");
  });

  it("cidade de fora não entra", () => {
    expect(cidadeAtendida("Vitória", cidades)).toBeNull();
    expect(cidadeAtendida("", cidades)).toBeNull();
  });
});

describe("leitura do item do PNCP", () => {
  it("lê os campos principais", () => {
    const item = normalizarItemPncp({
      objetoCompra: "Aquisição de retroescavadeira",
      numeroControlePNCP: "12345678000190-1-000001/2026",
      valorTotalEstimado: 650000,
      modalidadeNome: "Pregão Eletrônico",
      dataEncerramentoProposta: "2026-10-15T13:00:00",
      unidadeOrgao: { municipioNome: "Alegre", nomeUnidade: "Prefeitura Municipal de Alegre" },
    });
    expect(item).not.toBeNull();
    expect(item!.cidade).toBe("Alegre");
    expect(item!.orgao).toBe("Prefeitura Municipal de Alegre");
    expect(item!.valor).toBe(650000);
    expect(item!.modalidade).toBe("Pregão Eletrônico");
    expect(item!.link).toContain("pncp.gov.br");
  });

  it("aguenta nome de campo diferente entre versões do portal", () => {
    const item = normalizarItemPncp({
      objeto: "Aquisição de pá carregadeira",
      orgaoEntidade: { razaoSocial: "Município de Alegre", nomeMunicipio: "Alegre" },
    });
    expect(item).not.toBeNull();
    expect(item!.objeto).toContain("carregadeira");
    expect(item!.cidade).toBe("Alegre");
  });

  it("item sem objeto é descartado em vez de virar linha vazia", () => {
    expect(normalizarItemPncp({ unidadeOrgao: { municipioNome: "Alegre" } })).toBeNull();
  });

  it("valor zerado não vira R$ 0 na tela", () => {
    const item = normalizarItemPncp({ objetoCompra: "Aquisição de escavadeira", valorTotalEstimado: 0 });
    expect(item!.valor).toBeNull();
  });
});

// ── POR QUE O PAINEL NÃO RODAVA DIREITO ─────────────────────────────────────
//
// "pq a parte de licitações não está rodando direito?"
//
// Três defeitos somados, e todos empurravam para o mesmo lugar: painel vazio.
//
//   1. A busca pedia tamanhoPagina=200. O PNCP limita a 50 e recusa com 400 —
//      em TODAS as modalidades. Nenhum edital chegava a ser lido.
//   2. Mesmo passando, lia só a PÁGINA 1. O ES tem milhares de contratações
//      abertas; máquina é um punhado no meio. Filtrar 50 sorteados de milhares
//      e concluir "não há edital de máquina" não é resposta, é palpite.
//   3. O descarte derrubava o edital se a palavra aparecesse em QUALQUER
//      lugar. Quase todo edital de COMPRA de máquina cita garantia, manutenção
//      ou peças de reposição nas condições — então as compras mais bem
//      especificadas, as que mais interessam, eram jogadas fora.
describe("o descarte olha a posição, não a mera presença", () => {
  it("compra que MENCIONA manutenção depois da máquina continua sendo compra", () => {
    // Era este o falso negativo: o edital é de aquisição, a manutenção é uma
    // condição do contrato.
    expect(termosDeMaquina("Aquisição de retroescavadeira 4x4 com manutenção por 12 meses"))
      .toContain("retroescavadeira");
    expect(termosDeMaquina("Aquisição de pá carregadeira com garantia e peças de reposição"))
      .toContain("pá carregadeira");
    expect(termosDeMaquina("Aquisição de motoniveladora nova, incluso seguro e treinamento"))
      .toContain("motoniveladora");
  });

  it("e o que vem ANTES da máquina continua derrubando", () => {
    // As quatro do teste original, que não podem afrouxar.
    expect(termosDeMaquina("Locação de retroescavadeira com operador")).toEqual([]);
    expect(termosDeMaquina("Manutenção preventiva de pá carregadeira")).toEqual([]);
    expect(termosDeMaquina("Aquisição de peças para motoniveladora")).toEqual([]);
    expect(termosDeMaquina("Seguro da escavadeira municipal")).toEqual([]);
    expect(termosDeMaquina("Contratação de empresa para manutenção de escavadeira hidráulica")).toEqual([]);
  });

  it("sem máquina nenhuma, nada entra — o descarte nem precisa opinar", () => {
    expect(termosDeMaquina("Locação de veículos para a secretaria")).toEqual([]);
  });
});

describe("as modalidades olhadas", () => {
  it("inclui as PRESENCIAIS — é onde o interior compra máquina", () => {
    // Dores do Rio Preto, Divino de São Lourenço e Ibitirama ainda rodam
    // pregão presencial. Olhar só o eletrônico deixava esses editais
    // invisíveis: o painel não estava errado, estava cego para eles.
    expect(MODALIDADES.map((m) => m.codigo)).toContain(6);  // pregão eletrônico
    expect(MODALIDADES.map((m) => m.codigo)).toContain(7);  // pregão presencial
    expect(MODALIDADES.map((m) => m.codigo)).toContain(4);  // concorrência eletrônica
    expect(MODALIDADES.map((m) => m.codigo)).toContain(5);  // concorrência presencial
    expect(MODALIDADES.map((m) => m.codigo)).toContain(8);  // dispensa
  });

  it("toda modalidade tem nome — a tela mostra o que cada uma leu", () => {
    for (const m of MODALIDADES) expect(m.nome.length).toBeGreaterThan(3);
  });
});

describe("o tamanho de página respeita o limite do PNCP", () => {
  it("no máximo 50 por página — 200 era recusado com 400", () => {
    expect(POR_PAGINA).toBeLessThanOrEqual(50);
  });

  it("e há teto de páginas e prazo, para o cron de 60 s não ser cortado no meio", () => {
    expect(MAX_PAGINAS).toBeGreaterThan(1);
    expect(PRAZO_TOTAL_MS).toBeLessThan(60_000);
  });
});

// ── O QUE O PORTAL REALMENTE RESPONDEU: 429 ─────────────────────────────────
//
// O diagnóstico que eu tinha acabado de construir deu a resposta, e desmentiu
// a minha hipótese: não foi 400 (pedido grande demais), foi 429 em TODAS as
// cinco modalidades. Ou seja, LIMITE DE ACESSO — o portal barrou o CRM.
//
// E a correção anterior piorava esse lado: paginar dispara muito mais
// requisições, em rajada. Estes testes travam a educação do robô.
describe("quando o portal limita o acesso (429)", () => {
  it("respeita o Retry-After que o portal mandar", () => {
    expect(esperaDoRetryAfter("2", 1)).toBe(2000);
    expect(esperaDoRetryAfter("5", 1)).toBe(5000);
  });

  it("sem Retry-After, a espera cresce a cada tentativa", () => {
    expect(esperaDoRetryAfter(null, 1)).toBe(1000);
    expect(esperaDoRetryAfter(null, 2)).toBe(2000);
    expect(esperaDoRetryAfter(null, 3)).toBe(4000);
  });

  it("nunca espera mais que 8 s — o cron inteiro tem 60", () => {
    // Trocar um erro por um corte no meio da rodada não é melhoria.
    expect(esperaDoRetryAfter("3600", 1)).toBe(8000);
    expect(esperaDoRetryAfter(null, 10)).toBe(8000);
  });

  it("cabeçalho lixo não vira espera maluca", () => {
    expect(esperaDoRetryAfter("amanhã", 1)).toBe(1000);
    expect(esperaDoRetryAfter("-5", 2)).toBe(2000);
    expect(esperaDoRetryAfter("", 1)).toBe(1000);
  });

  it("o robô se identifica e respira entre as páginas", () => {
    // Requisição anônima em rajada é o perfil que portal público barra
    // primeiro — e barrou.
    expect(USER_AGENT).toMatch(/CRM/);
    expect(PAUSA_ENTRE_PAGINAS_MS).toBeGreaterThan(0);
    expect(TENTATIVAS_429).toBeGreaterThan(1);
  });

  it("a pausa entre páginas cabe no orçamento da rodada", () => {
    // No pior caso (5 modalidades × 20 páginas) a soma das PAUSAS sozinha não
    // pode consumir a janela inteira — senão o robô passaria a rodada
    // esperando e leria menos do que lia antes.
    const soPausas = MODALIDADES.length * MAX_PAGINAS * PAUSA_ENTRE_PAGINAS_MS;
    expect(soPausas).toBeLessThan(PRAZO_TOTAL_MS);
  });
});
