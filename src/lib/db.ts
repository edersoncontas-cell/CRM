import { PrismaClient } from "@prisma/client";
import { donoDoFiltro } from "@/lib/tenant";
import { estruturaJaExiste, garantirEstruturaMultiusuario } from "@/lib/multiusuario-estrutura";

// O CLIENTE DO BANCO, com o isolamento por vendedor JÁ EMBUTIDO.
//
// Ver o porquê em lib/tenant.ts. O resumo: são 494 consultas de leitura em 119
// arquivos, e uma esquecida não dá erro — mostra o cliente de outro vendedor.
// Então o filtro não é escrito na consulta: ele entra aqui, no caminho de
// todas elas.
//
// Os modelos abaixo são os que guardam o trabalho do vendedor E são
// consultados direto. O que pendura neles (proposta, análise do Orientador,
// cadência) vem filtrado junto quando acessado pelo pai.
const MODELOS_DO_VENDEDOR = new Set([
  "Cliente", "Negociacao", "Visita", "WhatsAppConversation",
  "WhatsAppMessage", "TarefaKanban", "Evento", "EnvioProgramado",
]);

// Operações de LEITURA e de escrita em massa: todas precisam do recorte.
// A escrita em massa entra na lista porque um updateMany/deleteMany sem
// filtro mexeria na carteira alheia — pior que ler.
const OPERACOES_FILTRADAS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy", "updateMany", "deleteMany",
]);

function base() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// A COLUNA DE DONO TEM QUE EXISTIR ANTES DA PRIMEIRA CONSULTA.
//
// Assim que vendedorId entrou no schema, toda consulta aos 8 modelos passou a
// pedir essa coluna — mesmo sem ninguém logado. No banco dele a coluna só
// nasceria quando a manutenção rodasse, e a manutenção roda dentro de uma
// requisição, em paralelo com as consultas da página. Quem chegasse primeiro
// decidia. Chegou a consulta: "Algo deu errado nesta página", e foi assim que
// o CRM parou de funcionar depois do deploy.
//
// Aqui não há corrida para perder: a primeira consulta de cada processo espera
// a estrutura, e as seguintes pegam a promessa já resolvida (um await em
// promessa pronta, sem ida ao banco). Falhou, a promessa é esquecida e a
// próxima consulta tenta de novo — em vez de o processo inteiro ficar
// condenado por um tropeço de rede.
let estrutura: Promise<void> | null = null;

function garantirEstrutura(base: PrismaClient): Promise<void> {
  if (estrutura) return estrutura;
  const tentativa = (async () => {
    if (await estruturaJaExiste(base)) return;
    await garantirEstruturaMultiusuario(base);
  })();
  estrutura = tentativa;
  tentativa.catch(() => {
    if (estrutura === tentativa) estrutura = null;
  });
  return tentativa;
}

function comIsolamento(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Antes de qualquer coisa: a estrutura. Vale mesmo sem ninguém
          // logado — o Prisma pede a coluna de dono em toda consulta a estes
          // modelos, logado ou não.
          if (model && MODELOS_DO_VENDEDOR.has(model)) await garantirEstrutura(base);

          const dono = donoDoFiltro();
          if (!dono || !model || !MODELOS_DO_VENDEDOR.has(model) || !OPERACOES_FILTRADAS.has(operation)) {
            return query(args);
          }

          // findUnique só aceita campo ÚNICO no where — ele ignora o AND e
          // devolveria a linha do outro vendedor. A prova contra o banco
          // pegou: "João espiando o cliente do Edy por id → VAZOU". Por isso
          // vira findFirst, que aceita o recorte. O resultado é o mesmo
          // quando a linha é do dono, e nulo quando não é.
          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            const a0 = (args ?? {}) as { where?: Record<string, unknown> };
            // Usa o cliente BASE (sem a extensão): assim não há filtro duplo
            // e, principalmente, não se referencia `db` dentro da própria
            // definição dele — o que colapsaria a inferência de tipo do
            // Prisma no app inteiro.
            const cliente = (base as unknown as Record<string, Record<string, (x: unknown) => unknown>>)[
              model.charAt(0).toLowerCase() + model.slice(1)
            ];
            return cliente[operation === "findUnique" ? "findFirst" : "findFirstOrThrow"]({
              ...a0,
              where: a0.where ? { AND: [a0.where, { vendedorId: dono }] } : { vendedorId: dono },
            });
          }
          const a = (args ?? {}) as { where?: Record<string, unknown> };
          // O filtro entra como item de um AND, nunca no mesmo objeto do
          // where que veio: dois filtros irmãos se sobrescrevem em silêncio,
          // e a armadilha do OR do Prisma já custou caro neste código.
          const where = a.where ? { AND: [a.where, { vendedorId: dono }] } : { vendedorId: dono };
          return query({ ...a, where } as typeof args);
        },
      },
    },
  });
}

type ClienteIsolado = ReturnType<typeof comIsolamento>;

const globalForPrisma = globalThis as unknown as { prisma?: ClienteIsolado };

export const db: ClienteIsolado = globalForPrisma.prisma ?? comIsolamento(base());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
