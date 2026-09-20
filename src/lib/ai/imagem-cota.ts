// Controle da cota gratuita de imagem do Gemini.
//
// Por que existe: a criação de arte roda na CAMADA GRATUITA da API do Gemini,
// que tem dois tetos — um por minuto e um por dia. Quando o teto do dia
// estoura, o CRM continuava batendo na porta: cada clique em "Criar a arte"
// tentava o modelo 1, tomava 429, tentava o modelo 2, tomava 429. O vendedor
// então clicava de novo. Nenhuma dessas tentativas tinha chance de dar certo,
// e a tela só sabia dizer "espere um minuto".
//
// Aqui o CRM passa a lembrar que aquele modelo acabou, por quanto tempo, e a
// dizer na tela QUANDO a arte volta. Dois ganhos: para de gastar chamada à
// toa e para de prometer o que não vai acontecer.
//
// IMPORTANTE: cada modelo do Gemini tem a SUA cota. Por isso a marcação é por
// modelo, e não global — quando o 3.1 acaba, o 2.5 ainda pode ter a dele, e é
// isso que mantém a arte funcionando de graça por mais tempo.

/** Quando aquele modelo volta. Memória do processo, some no restart — e tudo bem: no pior caso ele tenta uma vez e remarca. */
const esgotados = new Map<string, number>();

/**
 * A cota DIÁRIA gratuita do Google vira à meia-noite do Pacífico (PT), não à
 * meia-noite daqui. Dizer "volta amanhã" para quem está em Brasília seria
 * errado por várias horas — em boa parte do dia a virada do Pacífico cai
 * ainda hoje, no fim da tarde/começo da noite brasileira.
 */
export function proximaViradaDiariaGoogle(agora: Date = new Date()): Date {
  // Meia-noite no Pacífico, convertida para instante absoluto.
  const emPT = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(agora);
  const p = (t: string) => Number(emPT.find((x) => x.type === t)?.value ?? 0);
  // Quanto falta, em ms, para o fim do dia do Pacífico.
  const decorridoMs = (p("hour") % 24) * 3600_000 + p("minute") * 60_000 + p("second") * 1000;
  return new Date(agora.getTime() + (86_400_000 - decorridoMs));
}

/** Marca o modelo como sem cota até o horário indicado. */
export function marcarEsgotado(modelo: string, ate: Date): void {
  const atual = esgotados.get(modelo);
  // Nunca encurta uma espera já marcada: se o dia acabou, um limite por
  // minuto que chegue depois não pode fazer o CRM tentar de novo em 30s.
  if (!atual || ate.getTime() > atual) esgotados.set(modelo, ate.getTime());
}

/** Até quando este modelo está fora, ou null se está liberado. */
export function esgotadoAte(modelo: string, agora: Date = new Date()): Date | null {
  const ate = esgotados.get(modelo);
  if (!ate) return null;
  if (ate <= agora.getTime()) { esgotados.delete(modelo); return null; }
  return new Date(ate);
}

/** Só os modelos que vale a pena tentar agora. */
export function modelosDisponiveis(modelos: string[], agora: Date = new Date()): string[] {
  return modelos.filter((m) => !esgotadoAte(m, agora));
}

/** Quando o primeiro deles volta — para a tela dizer a hora certa. */
export function primeiraLiberacao(modelos: string[], agora: Date = new Date()): Date | null {
  const datas = modelos.map((m) => esgotadoAte(m, agora)).filter((d): d is Date => d !== null);
  if (!datas.length) return null;
  return new Date(Math.min(...datas.map((d) => d.getTime())));
}

/** Só para os testes: limpa a memória entre casos. */
export function zerarCota(): void {
  esgotados.clear();
}

/** "hoje às 21h" / "amanhã às 04h" — no fuso de Brasília, que é onde ele está. */
export function quandoVolta(quando: Date, agora: Date = new Date()): string {
  const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
  }).format(quando);
  const minutos = Math.round((quando.getTime() - agora.getTime()) / 60_000);
  if (minutos <= 1) return "em instantes";
  if (minutos < 60) return `em ${minutos} minutos`;
  return `${dia(quando) === dia(agora) ? "hoje" : "amanhã"} às ${hora}`;
}
