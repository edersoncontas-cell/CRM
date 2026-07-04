// Next Best Action (FASE 5 do Projeto Zeus, item 2): sugestão heurística
// determinística usada como fallback sem IA e como base do briefing diário
// (que já paga por UMA chamada de IA para reescrever o texto — não precisa
// de uma chamada extra por cliente). A versão com IA (mais específica, cita
// máquina/concorrente/prazo reais da conversa) fica em `lib/ai/index.ts`
// (`sugerirProximaAcaoIA`), que usa esta função como fallback.

export type SinaisProximaAcao = {
  nome: string;
  aguardandoResposta: boolean;
  diasSemContato: number | null;
  concorrenteMencionado: string | null;
  temVisitaAgendada: boolean;
  estagio: string | null;
};

export function sugerirProximaAcaoHeuristica(s: SinaisProximaAcao): { acao: string; motivo: string } {
  if (s.aguardandoResposta) {
    return { acao: `Responder ${s.nome} no WhatsApp`, motivo: "Cliente está aguardando retorno." };
  }
  if (s.temVisitaAgendada) {
    return { acao: `Confirmar a visita com ${s.nome}`, motivo: "Há uma visita agendada — confirmar presença e preparar proposta." };
  }
  if (s.concorrenteMencionado) {
    return {
      acao: `Ligar para ${s.nome} e reforçar diferenciais frente a ${s.concorrenteMencionado}`,
      motivo: `Concorrente ${s.concorrenteMencionado} foi mencionado na conversa.`,
    };
  }
  if ((s.diasSemContato ?? 0) >= 10) {
    return { acao: `Retomar contato com ${s.nome}`, motivo: `${s.diasSemContato} dias sem contato — risco de esfriar.` };
  }
  if (s.estagio === "proposta_bcnh" || s.estagio === "proposta_aprovada") {
    return { acao: `Cobrar retorno da proposta com ${s.nome}`, motivo: "Proposta em estágio avançado do funil." };
  }
  return { acao: `Ligar para ${s.nome} e alinhar os próximos passos`, motivo: "Negociação em andamento sem ação definida." };
}
