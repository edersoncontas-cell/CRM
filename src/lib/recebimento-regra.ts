// O WHATSAPP ESTÁ ENTREGANDO AS MENSAGENS NESTE BANCO?
//
// "O atendimento não está atualizando" (01/10, logo depois da volta para o
// Neon). A tela não tinha como dizer se o recebimento parou: a bolinha verde
// diz só que o número está pareado na Evolution — não que as mensagens chegam
// ao CRM. Webhook apontado para outro endereço, chave recusada, erro ao gravar:
// tudo isso deixava a lista parada e a bolinha verde.
//
// O webhook anota cada chamada (lib/zapi-diag.ts). Esta regra lê a anotação
// e diz, no topo do Atendimento, se o recebimento está andando.

import { diaBrasilia, horaBrasilia } from "@/lib/sem-sinal-regra";

/** Horas de expediente sem nenhuma chamada do WhatsApp para a tela avisar. */
export const HORAS_UTEIS_SEM_NADA = 3;

// Expediente em Brasília (UTC−3 o ano todo): 07:00–20:00 = 10:00–23:00 UTC.
const INICIO_UTC = 10;
const FIM_UTC = 23;

/** Minutos entre os dois instantes que caem no expediente (07h–20h de Brasília). */
export function minutosUteisEntre(desde: number, ate: number): number {
  if (!(ate > desde)) return 0;
  let total = 0;
  const dia = new Date(desde);
  dia.setUTCHours(0, 0, 0, 0);
  // Teto de 60 dias: além disso o aviso já está dado de qualquer jeito.
  for (let i = 0; i < 60 && dia.getTime() < ate; i++) {
    const ini = dia.getTime() + INICIO_UTC * 3_600_000;
    const fim = dia.getTime() + FIM_UTC * 3_600_000;
    total += Math.max(0, Math.min(fim, ate) - Math.max(ini, desde));
    dia.setUTCDate(dia.getUTCDate() + 1);
  }
  return Math.floor(total / 60_000);
}

/**
 * Quando foi, do jeito que se fala: "hoje às 14:32", "ontem às 20:30",
 * "23/09 às 11:05 (há 8 dias)". `curto` cabe no topo da lista, que no PC é
 * uma coluna estreita: "14:32", "ontem", "23/09".
 */
export function quando(t: number, agora: number): { frase: string; curto: string } {
  const hora = horaBrasilia(new Date(t));
  const d = diaBrasilia(t), hoje = diaBrasilia(agora);
  if (d === hoje) return { frase: `hoje às ${hora}`, curto: hora };
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / 86_400_000);
  if (dias === 1) return { frase: `ontem às ${hora}`, curto: "ontem" };
  const ddmm = `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return { frase: `${ddmm} às ${hora}${dias > 1 ? ` (há ${dias} dias)` : ""}`, curto: ddmm };
}

export type SituacaoRecebimento = {
  nivel: "ok" | "atencao" | "falha";
  /** Embaixo da conexão, no topo da lista: "recebida 14:32", "nada desde 23/09". */
  curto: string;
  /** A mesma coisa por extenso (dica ao passar o dedo/mouse). */
  extenso: string;
  /** Faixa no topo da lista; null quando está tudo andando. */
  aviso: string | null;
};

export function situacaoRecebimento(a: {
  configurado: boolean;
  conectado: boolean;
  ultimaChamada: string | null;
  ultimoStatus: string | null;
  agora: number;
}): SituacaoRecebimento | null {
  // Sem WhatsApp configurado ou desconectado, o topo já diz isso — e a tela
  // de Conexão é que resolve. Aqui é o caso traiçoeiro: pareado e parado.
  if (!a.configurado || !a.conectado) return null;

  const t = a.ultimaChamada ? Date.parse(a.ultimaChamada) : NaN;
  if (!Number.isFinite(t)) {
    return {
      nivel: "atencao",
      curto: "nada recebido",
      extenso: "Nenhuma mensagem do WhatsApp chegou a este banco ainda",
      aviso: "Nenhuma mensagem do WhatsApp chegou a este banco ainda. Se você já recebeu mensagens no celular depois de conectar, o recebimento não está chegando ao CRM.",
    };
  }
  const q = quando(t, a.agora);
  const status = a.ultimoStatus ?? "";

  if (status === "chave-recusada") {
    return {
      nivel: "falha",
      curto: "chave recusada",
      extenso: `Última entrega recusada (${q.frase})`,
      aviso: `A última mensagem que o WhatsApp tentou entregar (${q.frase}) foi recusada pelo CRM: a chave não confere, e ela não entrou aqui.`,
    };
  }
  if (status.startsWith("erro")) {
    const motivo = status.replace(/^erro:?\s*/, "").trim();
    return {
      nivel: "falha",
      curto: "erro ao gravar",
      extenso: `Última mensagem deu erro ao ser gravada (${q.frase})`,
      aviso: `A última mensagem que chegou (${q.frase}) deu erro ao ser gravada${motivo ? ` — ${motivo}` : ""}. Ela não aparece aqui.`,
    };
  }

  const horas = Math.floor(minutosUteisEntre(t, a.agora) / 60);
  if (horas >= HORAS_UTEIS_SEM_NADA) {
    return {
      nivel: "atencao",
      curto: `nada desde ${q.curto}`,
      extenso: `Nenhuma mensagem do WhatsApp desde ${q.frase}`,
      aviso: `Nenhuma mensagem chega do WhatsApp desde ${q.frase}. Se você recebeu mensagens no celular nesse tempo, o recebimento parou.`,
    };
  }
  return { nivel: "ok", curto: `recebida ${q.curto}`, extenso: `Última mensagem do WhatsApp recebida ${q.frase}`, aviso: null };
}
