import { PrismaClient } from "@prisma/client";

// O CLIENTE DO BANCO — com um endereço de reserva.
//
// O Neon dá dois endereços para o mesmo banco: o com "-pooler" (o que o CRM
// usa, DATABASE_URL) e o direto (DATABASE_URL_UNPOOLED). Eles são servidos por
// caminhos diferentes, e um pode cair com o outro de pé. Foi assim que o CRM
// ficou um dia inteiro fora do ar: "Can't reach database server at
// ep-...-pooler..." — e o direto, que ninguém tentou, talvez respondesse.
//
// Agora, quando o principal não conecta, o CRM prova o direto e, se ele
// responder, passa a usar o direto. Ninguém precisa mexer em nada. E de tempos
// em tempos ele tenta voltar ao principal — o pooler existe por um motivo (ele
// segura o número de conexões), então o direto é a reserva, não o normal.

type Cru = PrismaClient;

function criar(url?: string): Cru {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: Cru };

const principal: Cru = globalForPrisma.prisma ?? criar();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = principal;

let reserva: Cru | null = null;
let ativo: Cru = principal;
let ultimaTentativaDeVoltar = 0;
const INTERVALO_VOLTAR_MS = 60_000;

/** Verdadeiro quando o erro é "não consegui nem chegar no banco" — não erro de consulta. */
export function ehFalhaDeConexao(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const nome = (e as { name?: string }).name ?? "";
  const codigo = (e as { errorCode?: string; code?: string }).errorCode ?? (e as { code?: string }).code ?? "";
  const msg = String((e as { message?: string }).message ?? "");
  return (
    nome === "PrismaClientInitializationError" ||
    codigo === "P1001" || codigo === "P1002" || codigo === "P1017" ||
    /can't reach database server|connection (refused|reset|terminated)|timed out/i.test(msg)
  );
}

/** Qual endereço está em uso agora — para a tela e o diagnóstico dizerem. */
export function enderecoAtivo(): "principal" | "reserva" {
  return ativo === principal ? "principal" : "reserva";
}

/**
 * O principal caiu: prova o direto e, se responder, passa a usar ele.
 * Devolve true quando há um caminho vivo (já era a reserva, ou acabou de virar).
 */
export async function tentarReserva(): Promise<boolean> {
  if (ativo !== principal) return true;
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) return false;
  reserva ??= criar(url);
  try {
    await reserva.$queryRawUnsafe("SELECT 1");
    ativo = reserva;
    console.warn("[db] endereço principal fora; usando o endereço direto (reserva).");
    return true;
  } catch {
    return false;
  }
}

/**
 * Na reserva há um tempo: tenta voltar ao principal, no máximo uma vez por
 * minuto. Silencioso — se o principal continua fora, segue na reserva.
 */
export async function tentarVoltarAoPrincipal(): Promise<void> {
  if (ativo === principal) return;
  const agora = Date.now();
  if (agora - ultimaTentativaDeVoltar < INTERVALO_VOLTAR_MS) return;
  ultimaTentativaDeVoltar = agora;
  try {
    await principal.$queryRawUnsafe("SELECT 1");
    ativo = principal;
    console.warn("[db] endereço principal voltou; de volta a ele.");
  } catch {
    /* segue na reserva */
  }
}

// Reexecuta a MESMA operação na reserva. Só o que o CRM usa de fato: operações
// de modelo (db.cliente.count(...)) e as raw "Unsafe" (args = [sql, ...valores],
// conferido contra o Prisma 5.22). O resto relança — a próxima requisição já
// nasce na reserva.
async function repetirNaReserva(model: string | undefined, operation: string, args: unknown): Promise<unknown> {
  const alvo = ativo as unknown as Record<string, unknown>;
  if (model) {
    const delegado = alvo[model.charAt(0).toLowerCase() + model.slice(1)] as Record<string, (a: unknown) => unknown>;
    return delegado[operation](args);
  }
  if ((operation === "$queryRawUnsafe" || operation === "$executeRawUnsafe") && Array.isArray(args)) {
    return (alvo[operation] as (...a: unknown[]) => unknown)(...args);
  }
  throw new Error("sem reserva para esta operação");
}

// O principal com o desvio embutido: falhou por CONEXÃO, prova a reserva e
// repete ali. Falhou por outro motivo (consulta errada, dado inválido), o erro
// sobe igual — isto não é rede de esconder erro.
const principalComDesvio = principal.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      try {
        return await query(args);
      } catch (e) {
        if (!ehFalhaDeConexao(e) || !(await tentarReserva())) throw e;
        try {
          return await repetirNaReserva(model, operation, args);
        } catch (e2) {
          throw e2 instanceof Error && e2.message === "sem reserva para esta operação" ? e : e2;
        }
      }
    },
  },
});

// O que o CRM importa. Cada acesso (db.cliente, db.$queryRawUnsafe...) vai para
// o endereço ATIVO naquele instante: enquanto é o principal, passa pelo desvio
// acima; depois de trocar, vai direto à reserva. Tipado como PrismaClient
// porque é isso que o CRM inteiro já espera — a superfície é a mesma.
export const db = new Proxy(principal, {
  get(_alvo, prop) {
    const origem = ativo === principal ? (principalComDesvio as unknown as Cru) : ativo;
    const valor = (origem as unknown as Record<string | symbol, unknown>)[prop];
    return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(origem) : valor;
  },
}) as PrismaClient;
