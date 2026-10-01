// DESCONECTAR O WHATSAPP PARA LER O QR DE NOVO.
//
// "Estou tentando desconectar o WhatsApp para escanear o QR code novamente e
// não está indo" (01/10, logo depois do recebimento parar). O botão mandava UM
// pedido de logout à Evolution e acreditava nele. Só que a Evolution responde
// "logged out" antes de desconectar de fato (ela não espera), e com a sessão
// presa — o caso de quando o recebimento para — o pedido não tem efeito: a
// instância continua "open", a tela continua verde, e nada diz por quê.
//
// Agora: pede o logout e CONFERE o estado até ele sair de "open". Não saiu,
// reinicia a instância (a sessão presa volta a obedecer) e pede de novo. Se
// nem assim, devolve "presa" — a tela mostra o motivo e as duas saídas que
// sempre funcionam: desconectar o aparelho pelo celular, ou refazer a
// instância do zero.
//
// Módulo puro (as operações vêm de fora) para ser testado com uma Evolution de
// mentira — aqui não há rede para a de verdade.

export type EstadoInstancia = "open" | "connecting" | "close" | "inexistente" | string;

export type OpsDesconexao = {
  /** Estado da instância; null quando a Evolution não respondeu. */
  estado: () => Promise<EstadoInstancia | null>;
  logout: () => Promise<void>;
  reiniciar: () => Promise<void>;
  esperar: (ms: number) => Promise<void>;
  agora: () => number;
};

export type ResultadoDesconexao = {
  ok: boolean;
  /** Já não estava conectado: é só ler o QR. */
  jaEstava?: boolean;
  /** A Evolution continua dizendo "conectado" depois de tudo. */
  presa?: boolean;
  erro?: string;
  passos: string[];
};

/** Tempo total que a desconexão pode levar (a ação do servidor tem 60 s). */
export const PRAZO_DESCONEXAO_MS = 40_000;
const INTERVALO_MS = 1_500;
const ESPERA_SAIR_MS = 8_000;
const ESPERA_VOLTAR_MS = 10_000;

const fora = (s: EstadoInstancia | null) => s !== null && s !== "open";
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function desconectarEvolution(ops: OpsDesconexao): Promise<ResultadoDesconexao> {
  const fim = ops.agora() + PRAZO_DESCONEXAO_MS;
  const passos: string[] = [];
  let ultimoErro: string | undefined;
  let ultimo: EstadoInstancia | null = await ops.estado();
  if (fora(ultimo)) return { ok: true, jaEstava: true, passos: [`já estava "${ultimo}"`] };

  // Consulta até a condição valer ou o tempo acabar; devolve o último estado.
  const aguardar = async (cond: (s: EstadoInstancia | null) => boolean, ms: number) => {
    const ate = Math.min(fim, ops.agora() + ms);
    for (;;) {
      ultimo = await ops.estado();
      if (cond(ultimo) || ops.agora() >= ate) return ultimo;
      await ops.esperar(INTERVALO_MS);
    }
  };
  const pedirLogout = async (rotulo: string) => {
    try { await ops.logout(); passos.push(rotulo); } catch (e) { ultimoErro = msg(e); passos.push(`${rotulo} falhou`); }
  };

  // 1. O caminho normal: pede e confere.
  await pedirLogout("logout");
  if (fora(await aguardar(fora, ESPERA_SAIR_MS))) return { ok: true, passos };

  // 2. Continua "open": reinicia a instância e pede de novo.
  if (ops.agora() < fim) {
    try { await ops.reiniciar(); passos.push("reiniciou"); } catch (e) { ultimoErro = msg(e); passos.push("reiniciar falhou"); }
    // Ela volta "open" (sessão válida, agora obedecendo) ou fica sem par.
    const depois = await aguardar((s) => s === "open", ESPERA_VOLTAR_MS);
    if (depois === "open" && ops.agora() < fim) {
      await pedirLogout("logout de novo");
      if (fora(await aguardar(fora, ESPERA_SAIR_MS))) return { ok: true, passos };
    } else if (fora(depois)) {
      return { ok: true, passos };
    }
  }

  if (ultimo === "open") {
    return {
      ok: false, presa: true, passos,
      erro: `A Evolution continua dizendo que o número está conectado, mesmo depois de reiniciar e pedir para sair duas vezes${ultimoErro ? ` (${ultimoErro})` : ""}.`,
    };
  }
  return { ok: false, passos, erro: ultimoErro ?? "A Evolution não respondeu à consulta do estado da conexão." };
}
