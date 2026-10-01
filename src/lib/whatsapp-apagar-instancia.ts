// APAGAR A INSTÂNCIA DA EVOLUTION QUANDO A SESSÃO DELA ESTÁ MORTA.
//
// O print dele (01/10): "Refazer do zero" respondeu
//   apagar → 400 · logout → 500 "Error: Connection Closed" · reiniciou · apagar → 400.
// A instância diz "open" (por isso o CRM mostra "conectado" e nada chega), mas
// o socket de dentro está fechado. Na Evolution 2.x apagar uma instância
// "open" ou "connecting" passa por um logout, e o logout de um socket fechado
// estoura "Connection Closed" — então o apagar é recusado. O CRM reiniciava e
// tentava de novo 2 segundos depois, quando a instância ainda estava
// "connecting" (refazendo o socket) e a recusa se repetia.
//
// O que faltava: depois de reiniciar, ESPERAR a Evolution assentar. Ela termina
// em "open" (socket novo, vivo: aí o logout e o apagar funcionam) ou em
// "close" (precisa de QR: aí apagar nem passa por logout). Só então tenta.
//
// Módulo puro (as operações vêm de fora) para ser testado com uma Evolution de
// mentira — aqui não há rede para a de verdade.

import type { EstadoInstancia } from "@/lib/whatsapp-desconectar";

export type OpsApagar = {
  /** Estado da instância; null quando a Evolution não respondeu. */
  estado: () => Promise<EstadoInstancia | null>;
  /** Pede para apagar. Lança com o motivo quando a Evolution recusa; não lança se a instância já não existia. */
  apagar: () => Promise<void>;
  logout: () => Promise<void>;
  reiniciar: () => Promise<void>;
  esperar: (ms: number) => Promise<void>;
  agora: () => number;
};

export type ResultadoApagar = { ok: boolean; erro?: string; passos: string[] };

/** Tempo total que apagar pode levar (a ação do servidor tem 60 s; criar vem em outra ação). */
export const PRAZO_APAGAR_MS = 45_000;
const INTERVALO_MS = 1_500;
const ESPERA_ASSENTAR_MS = 18_000;
const ESPERA_SAIR_MS = 5_000;
const RODADAS = 2;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function apagarEvolution(ops: OpsApagar): Promise<ResultadoApagar> {
  const fim = ops.agora() + PRAZO_APAGAR_MS;
  const passos: string[] = [];
  let recusa = "";

  // Consulta até a condição valer ou o tempo acabar; devolve o último estado.
  const aguardar = async (cond: (s: EstadoInstancia | null) => boolean, ms: number): Promise<EstadoInstancia | null> => {
    const ate = Math.min(fim, ops.agora() + ms);
    for (;;) {
      const s = await ops.estado();
      if (cond(s) || ops.agora() >= ate) return s;
      await ops.esperar(INTERVALO_MS);
    }
  };
  const tentarApagar = async (rotulo: string): Promise<boolean> => {
    try { await ops.apagar(); passos.push(rotulo); return true; }
    catch (e) { recusa = msg(e); passos.push(`${rotulo} recusado: ${recusa.slice(0, 180)}`); return false; }
  };
  // Apagou de verdade quando a instância some ou deixa de estar "open": criar
  // outra com o nome ainda ocupado devolveria a velha, presa, e sem QR.
  const confirmar = async (): Promise<ResultadoApagar> => {
    const s = await aguardar((x) => x === "inexistente" || (x !== null && x !== "open"), 6_000);
    if (s === "open") {
      passos.push("depois de apagar, a instância continua open");
      return { ok: false, erro: "A Evolution disse que apagou, mas a instância continua conectada.", passos };
    }
    // Sem resposta na conferência: ela aceitou o pedido; criar outra mostra o resto.
    return { ok: true, passos };
  };

  if (await tentarApagar("apagou a instância")) return confirmar();

  for (let rodada = 1; rodada <= RODADAS && ops.agora() < fim; rodada++) {
    try { await ops.reiniciar(); passos.push("reiniciou"); }
    catch (e) { passos.push(`reiniciar falhou: ${msg(e).slice(0, 180)}`); }

    // "connecting" é a Evolution refazendo o socket — não é resposta ainda.
    const assentou = await aguardar((s) => s !== null && s !== "connecting", ESPERA_ASSENTAR_MS);
    passos.push(`depois de reiniciar: ${assentou ?? "sem resposta"}`);
    if (assentou === "inexistente") return { ok: true, passos };

    if (assentou === "open") {
      // Socket novo: agora o logout funciona e o apagar, que passa por ele, também.
      try { await ops.logout(); passos.push("logout"); }
      catch (e) { passos.push(`logout falhou: ${msg(e).slice(0, 180)}`); }
      await aguardar((s) => s !== null && s !== "open", ESPERA_SAIR_MS);
    }
    if (ops.agora() >= fim) break;
    if (await tentarApagar(rodada === 1 ? "apagou de novo" : "apagou na rodada 2")) return confirmar();
  }

  return {
    ok: false,
    erro: `A Evolution recusou apagar a instância${recusa ? `: ${recusa.slice(0, 200)}` : ""}`,
    passos,
  };
}
