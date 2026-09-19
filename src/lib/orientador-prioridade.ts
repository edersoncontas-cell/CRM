// Ordem de ataque do Orientador de Vendas: quem o vendedor tem de chamar
// PRIMEIRO. Módulo PURO (sem banco, sem IA) — a página só aplica.
//
// Antes os cards vinham por data da última mensagem, o que colocava um "bom
// dia" de hoje na frente de um cliente quente que está esperando proposta há
// dois dias. A conta abaixo junta o que realmente importa: temperatura,
// probabilidade, quem está devendo resposta e há quanto tempo.

export type ItemOrientador = {
  clienteId: string;
  temperatura: string | null;
  probabilidadeFechamento: number | null;
  ultimaMensagemEm: string;          // ISO
  ultimaFoiDoCliente?: boolean;      // true = a bola está com o vendedor
  atualizadoEm: string | null;       // ISO da leitura da IA (null = nunca lida)
  alertaNivel?: "vermelho" | "amarelo" | "verde" | null;
};

export const PESO_TEMPERATURA: Record<string, number> = {
  muito_quente: 40,
  quente: 30,
  morna: 15,
  fria: 5,
};

export function horasDesde(iso: string, agora = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (agora - t) / 3_600_000);
}

// 0–100. Quanto maior, mais urgente.
export function pontuarPrioridade(i: ItemOrientador, agora = Date.now()): number {
  const temperatura = PESO_TEMPERATURA[i.temperatura ?? ""] ?? 10;
  const probabilidade = ((i.probabilidadeFechamento ?? 40) / 100) * 25;

  // Esperando o vendedor: urgência cresce rápido nas primeiras 24h e satura.
  const horas = horasDesde(i.ultimaMensagemEm, agora);
  const espera = i.ultimaFoiDoCliente ? Math.min(20, (horas / 24) * 20) : Math.min(8, (horas / 72) * 8);

  // Alerta vermelho do coaching: algo pode estourar agora.
  const alerta = i.alertaNivel === "vermelho" ? 12 : i.alertaNivel === "amarelo" ? 6 : 0;

  // Sem leitura da IA: sobe um pouco para o vendedor mandar analisar.
  const semLeitura = i.atualizadoEm ? 0 : 5;

  return Math.round(Math.min(100, temperatura + probabilidade + espera + alerta + semLeitura));
}

export function ordenarPorPrioridade<T extends ItemOrientador>(itens: T[], agora = Date.now()): T[] {
  return [...itens].sort((a, b) => {
    const d = pontuarPrioridade(b, agora) - pontuarPrioridade(a, agora);
    if (d !== 0) return d;
    // Empate: quem falou por último primeiro.
    return new Date(b.ultimaMensagemEm).getTime() - new Date(a.ultimaMensagemEm).getTime();
  });
}

// Leitura velha demais para confiar? (a conversa andou depois dela)
export function leituraDesatualizada(i: ItemOrientador): boolean {
  if (!i.atualizadoEm) return true;
  return new Date(i.ultimaMensagemEm).getTime() > new Date(i.atualizadoEm).getTime() + 60_000;
}

export type FiltroOrientador = "todos" | "quentes" | "esperando" | "sem_leitura";

export const FILTROS: { id: FiltroOrientador; nome: string; ajuda: string }[] = [
  { id: "todos", nome: "Todos", ajuda: "Todo mundo com conversa no período, na ordem de atacar." },
  { id: "quentes", nome: "Quentes", ajuda: "Temperatura quente ou muito quente: é onde está a venda." },
  { id: "esperando", nome: "Esperando você", ajuda: "A última mensagem foi do cliente — a bola está com você." },
  { id: "sem_leitura", nome: "Sem leitura", ajuda: "A IA ainda não leu, ou a conversa andou depois da leitura." },
];

export function aplicarFiltro<T extends ItemOrientador>(itens: T[], filtro: FiltroOrientador): T[] {
  if (filtro === "quentes") return itens.filter((i) => i.temperatura === "quente" || i.temperatura === "muito_quente");
  if (filtro === "esperando") return itens.filter((i) => i.ultimaFoiDoCliente);
  if (filtro === "sem_leitura") return itens.filter((i) => leituraDesatualizada(i));
  return itens;
}

// Rótulo curto do tempo desde a leitura ("lido agora", "lido há 3 dias").
export function idadeDaLeitura(atualizadoEm: string | null, agora = Date.now()): string {
  if (!atualizadoEm) return "sem leitura da IA";
  const h = horasDesde(atualizadoEm, agora);
  if (h < 1) return "lido agora";
  if (h < 24) return `lido há ${Math.round(h)}h`;
  const d = Math.round(h / 24);
  return `lido há ${d} dia${d > 1 ? "s" : ""}`;
}
