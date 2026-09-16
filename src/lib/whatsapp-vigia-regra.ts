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
};

export const MEMORIA_VAZIA: MemoriaVigia = {
  ultimoEstado: null, conectadaDesde: null, ultimaQueda: null, ultimaVerificacao: null,
  tentativas: 0, ultimaTentativaEm: null, reconexoesAutomaticas: 0, avisouQr: false,
};

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
export function memoriaAposLeitura(memoria: MemoriaVigia, estado: EstadoConexao, agora: Date): LeituraVigia {
  const iso = agora.toISOString();
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

export function descreverConexao(memoria: MemoriaVigia, agora: Date): string {
  const horas = (iso: string) => Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 3_600_000));
  if (memoria.ultimoEstado === "aberta" && memoria.conectadaDesde) {
    const h = horas(memoria.conectadaDesde);
    const base = h < 1 ? "Conectado (há menos de 1 hora)" : `Conectado há ${h}h`;
    return memoria.reconexoesAutomaticas > 0 ? `${base} · religado sozinho ${memoria.reconexoesAutomaticas}x desde que foi pareado` : base;
  }
  if (memoria.ultimaQueda) {
    const h = horas(memoria.ultimaQueda);
    return `Fora do ar ${h < 1 ? "há menos de 1 hora" : `há ${h}h`} · ${memoria.tentativas} tentativa(s) de religar`;
  }
  return "Ainda não verificado.";
}
