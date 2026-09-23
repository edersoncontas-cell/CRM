// SUBSTITUTO de node:async_hooks para o pacote do NAVEGADOR.
//
// Por que existe: lib/tenant.ts usa AsyncLocalStorage para guardar quem está
// usando o CRM, e lib/db.ts lê esse contexto. Hoje 64 componentes de tela
// alcançam lib/db.ts sem querer — eles importam uma constante de um arquivo
// que, lá no fundo da corrente, toca o banco. Funcionava porque o @prisma/client
// tem a própria versão de navegador; "node:async_hooks" não tem nenhuma, e o
// empacotador parava o build inteiro.
//
// O que ele NÃO faz: fingir que o isolamento existe no navegador. Contexto de
// requisição é coisa de servidor; se alguém chamar isto de dentro do navegador,
// é erro de código, e o erro APARECE. O silêncio aqui seria "sem filtro" —
// exatamente o padrão que machuca (regra 3 do CLAUDE.md).
//
// O construtor é inerte de propósito: ele roda no carregamento do módulo em
// toda tela dessas 64, e explodir ali derrubaria telas que nunca vão usar isto.

const AVISO =
  "AsyncLocalStorage não existe no navegador: o contexto do usuário é do servidor. " +
  "Alguma tela está chamando lib/tenant.ts direto — isso é erro de código.";

export class AsyncLocalStorage<T> {
  run<R>(_valor: T, _fn: () => R): R {
    throw new Error(AVISO);
  }

  getStore(): T | undefined {
    throw new Error(AVISO);
  }

  exit<R>(_fn: () => R): R {
    throw new Error(AVISO);
  }
}
