// Regras puras do vigia da conexão do WhatsApp (sem banco, testável).
//
// A conexão nunca deve cair sozinha. Quando cai (socket do Baileys derrubado,
// Evolution reiniciada, rede oscilando), o CRM religa sozinho e só incomoda o
// vendedor com o QR Code depois de esgotar as tentativas — porque QR é a
// única coisa que ele precisa fazer com o celular na mão.
//
// Escalonamento a cada verificação (o vigia roda de 5 em 5 minutos):
//   1ª e 2ª: "conectar"   — /instance/connect reabre o socket com a credencial
//                           que já existe (não pede QR quando está pareado).
//   3ª e 4ª: "reiniciar"  — /instance/restart recria o socket do zero.
//   5ª em diante: "avisar_qr" — aí sim o pareamento caiu de verdade.

export type EstadoConexao = "aberta" | "conectando" | "fechada" | "sem_instancia";

export type AcaoVigia = "nada" | "esperar" | "conectar" | "reiniciar" | "criar_instancia" | "avisar_qr";

export type MemoriaVigia = {
  ultimoEstado: EstadoConexao | null;
  conectadaDesde: string | null;
  ultimaQueda: string | null;
  ultimaVerificacao: string | null;
  tentativas: number;
  ultimaTentativaEm: string | null;
  reconexoesAutomaticas: number;
  avisouQr: boolean;
  /** Desde quando o SERVIDOR da Evolution não atende (VPS fora) — não é o
   *  WhatsApp que caiu, e QR ou religar não resolvem (02/10). */
  servidorForaDesde: string | null;
  avisouServidorFora: boolean;
};

export const MEMORIA_VAZIA: MemoriaVigia = {
  ultimoEstado: null, conectadaDesde: null, ultimaQueda: null, ultimaVerificacao: null,
  tentativas: 0, ultimaTentativaEm: null, reconexoesAutomaticas: 0, avisouQr: false,
  servidorForaDesde: null, avisouServidorFora: false,
};

/** Servidor fora por menos que isso é soluço (reinício, rede): não avisa. */
export const MINUTOS_ANTES_DO_AVISO_SERVIDOR = 10;

export const TENTATIVAS_ANTES_DO_QR = 4;
const ESPERA_ENTRE_TENTATIVAS_MS = 45_000;

export function decidirAcao(estado: EstadoConexao, memoria: MemoriaVigia, agora: Date, esperaMs = ESPERA_ENTRE_TENTATIVAS_MS): AcaoVigia {
  if (estado === "aberta") return "nada";
  if (estado === "sem_instancia") return "criar_instancia";

  // Handshake em andamento logo depois de uma tentativa: dá um ciclo de folga
  // antes de mexer de novo, senão o vigia atrapalha a própria reconexão.
  if (estado === "conectando" && memoria.tentativas > 0) {
    const desde = memoria.ultimaTentativaEm ? agora.getTime() - new Date(memoria.ultimaTentativaEm).getTime() : Infinity;
    if (desde < esperaMs) return "esperar";
  }

  const desdeUltima = memoria.ultimaTentativaEm ? agora.getTime() - new Date(memoria.ultimaTentativaEm).getTime() : Infinity;
  if (desdeUltima < esperaMs) return "esperar";

  if (memoria.tentativas >= TENTATIVAS_ANTES_DO_QR) return "avisar_qr";
  return memoria.tentativas < 2 ? "conectar" : "reiniciar";
}

export type LeituraVigia = { memoria: MemoriaVigia; reconectou: boolean; caiu: boolean };

// Atualiza a memória com o estado lido agora, antes de decidir a ação.
// `servidorFora`: a Evolution nem atendeu (lib/evolution-servidor-regra.ts).
export function memoriaAposLeitura(memoria: MemoriaVigia, estado: EstadoConexao, agora: Date, servidorFora = false): LeituraVigia {
  const iso = agora.toISOString();
  const servidor = servidorFora && estado !== "aberta"
    ? { servidorForaDesde: memoria.servidorForaDesde ?? iso }
    : { servidorForaDesde: null, avisouServidorFora: false };
  const estavaFora = memoria.ultimoEstado !== null && memoria.ultimoEstado !== "aberta";
  const caiu = memoria.ultimoEstado === "aberta" && estado !== "aberta";
  const reconectou = estavaFora && estado === "aberta";

  if (estado === "aberta") {
    return {
      memoria: {
        ...memoria,
        ultimoEstado: "aberta",
        conectadaDesde: memoria.conectadaDesde && memoria.ultimoEstado === "aberta" ? memoria.conectadaDesde : iso,
        ultimaVerificacao: iso,
        tentativas: 0,
        ultimaTentativaEm: null,
        reconexoesAutomaticas: memoria.reconexoesAutomaticas + (reconectou && memoria.tentativas > 0 ? 1 : 0),
        avisouQr: false,
        ...servidor,
      },
      reconectou, caiu: false,
    };
  }

  return {
    memoria: {
      ...memoria,
      ultimoEstado: estado,
      conectadaDesde: null,
      ultimaQueda: caiu ? iso : (memoria.ultimaQueda ?? iso),
      ultimaVerificacao: iso,
      ...servidor,
    },
    reconectou: false, caiu,
  };
}

export function memoriaAposTentativa(memoria: MemoriaVigia, agora: Date): MemoriaVigia {
  return { ...memoria, tentativas: memoria.tentativas + 1, ultimaTentativaEm: agora.toISOString() };
}

// O aviso de QR só vale quando o religamento automático já se esgotou — ou
// quando o vigia não roda há muito tempo (agendador externo parado), para o
// vendedor não ficar sem saber que o WhatsApp está fora do ar.
export function precisaMesmoDeQr(memoria: MemoriaVigia, agora: Date, toleranciaMin = 30): boolean {
  if (memoria.tentativas >= TENTATIVAS_ANTES_DO_QR) return true;
  if (!memoria.ultimaVerificacao) return true;
  return agora.getTime() - new Date(memoria.ultimaVerificacao).getTime() > toleranciaMin * 60_000;
}

// Uma vez por queda do servidor, e só depois de MINUTOS_ANTES_DO_AVISO_SERVIDOR.
export function precisaAvisarServidorFora(memoria: MemoriaVigia, agora: Date, minutos = MINUTOS_ANTES_DO_AVISO_SERVIDOR): boolean {
  if (!memoria.servidorForaDesde || memoria.avisouServidorFora) return false;
  return agora.getTime() - new Date(memoria.servidorForaDesde).getTime() >= minutos * 60_000;
}

function horaBrasilia(iso: string, agora: Date): string {
  const d = new Date(iso);
  const mesmoDia = agora.getTime() - d.getTime() < 20 * 3_600_000;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
    ...(mesmoDia ? {} : { day: "2-digit", month: "2-digit" }),
  });
}

export function descreverConexao(memoria: MemoriaVigia, agora: Date): string {
  const horas = (iso: string) => Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 3_600_000));
  if (memoria.ultimoEstado === "aberta" && memoria.conectadaDesde) {
    const h = horas(memoria.conectadaDesde);
    const base = h < 1 ? "Conectado (há menos de 1 hora)" : `Conectado há ${h}h`;
    return memoria.reconexoesAutomaticas > 0 ? `${base} · religado sozinho ${memoria.reconexoesAutomaticas}x desde que foi pareado` : base;
  }
  if (memoria.servidorForaDesde && memoria.ultimoEstado !== "aberta") {
    const h = horas(memoria.servidorForaDesde);
    return `Servidor da Evolution (sua VPS) sem responder desde ${horaBrasilia(memoria.servidorForaDesde, agora)} (${h < 1 ? "há menos de 1 hora" : `há ${h}h`}) · não é o WhatsApp: QR e religar dependem do servidor. Quando ele voltar, o CRM religa sozinho`;
  }
  if (memoria.ultimaQueda) {
    const h = horas(memoria.ultimaQueda);
    return `Fora do ar ${h < 1 ? "há menos de 1 hora" : `há ${h}h`} · ${memoria.tentativas} tentativa(s) de religar`;
  }
  return "Ainda não verificado.";
}
