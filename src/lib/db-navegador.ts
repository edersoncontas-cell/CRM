// O "banco" no pacote do NAVEGADOR — que não é banco nenhum.
//
// POR QUE EXISTE
// Dezenas de componentes de tela alcançam lib/db.ts sem querer: importam uma
// constante ou um tipo de um arquivo que, lá no fundo da corrente, toca o
// banco. O empacotador então leva lib/db.ts para dentro do JavaScript que roda
// no celular dele. Lá o Prisma não funciona, e o que acontecia era a tela
// inteira cair no "Algo deu errado nesta página" — foi assim que o funil
// quebrou na conferência.
//
// O QUE ELE FAZ
// Importar é INERTE: nenhuma conexão, nenhum Prisma, nada que estoure só por
// estar na corrente. Isso é o que devolve a tela ao ar.
// USAR é ERRO, e erro que APARECE: qualquer `db.alguma.coisa` no navegador
// estoura com um recado claro. Consulta ao banco é coisa de servidor; se
// alguma tela tentar, é defeito de código e tem que doer na hora — o silêncio
// aqui seria o CRM fingindo que gravou.
//
// O QUE ELE NÃO É
// Não é conserto do desenho. O certo é a tela não alcançar lib/db.ts; isso são
// 64 correntes para separar, uma a uma, e fica registrado como dívida. Isto
// aqui é a rede que impede o tombo enquanto a dívida não é paga — e, de
// quebra, tira o Prisma inteiro do pacote que ele baixa no celular.

const AVISO =
  "Consulta ao banco não roda no navegador. Alguma tela está usando lib/db.ts " +
  "direto — o certo é buscar por uma ação de servidor.";

export const db = new Proxy(
  {},
  {
    get(_alvo, campo) {
      // "then" e símbolos são sondados por await/React/empacotador sem
      // intenção de consultar nada. Estourar neles derrubaria a tela pelo
      // motivo errado.
      if (campo === "then" || typeof campo === "symbol") return undefined;
      throw new Error(`${AVISO} (db.${String(campo)})`);
    },
  },
) as never;
