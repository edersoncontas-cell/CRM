import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value?: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatDate(date?: Date | string | null) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date?: Date | string | null) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function diasDesde(date?: Date | string | null): number {
  if (!date) return 0;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

const FUSO_BR = "America/Sao_Paulo";

// Hora do dia (0-23) no horário de Brasília — o servidor roda em UTC, então
// nunca confie em getHours() direto para saudações/lógica de período do dia.
export function horaBrasilia(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO_BR,
      hour: "2-digit",
      hour12: false,
    }).format(date)
  ) % 24;
}

// Dia da semana (0=Dom ... 6=Sáb) no fuso de Brasília.
export function diaSemanaBrasilia(date: Date): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: FUSO_BR, weekday: "short" }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[nome] ?? date.getDay();
}

// Data (YYYY-MM-DD) de um instante no fuso de Brasília.
export function dataIsoBrasilia(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Meia-noite (00:00) de Brasília do dia em que `date` cai, deslocada em
// `deslocamentoDias` dias. O servidor (Vercel) roda em UTC: `setHours(0,0,0,0)`
// devolve 00:00 UTC = 21:00 do dia ANTERIOR em Brasília, então "hoje",
// "amanhã" e "esta semana" ficavam errados entre 21h e meia-noite. O Brasil não
// tem horário de verão desde 2019, por isso o deslocamento -03:00 é fixo.
export function inicioDoDiaBrasilia(date: Date = new Date(), deslocamentoDias = 0): Date {
  const base = new Date(`${dataIsoBrasilia(date)}T00:00:00-03:00`);
  if (deslocamentoDias) base.setUTCDate(base.getUTCDate() + deslocamentoDias);
  return base;
}

// Mês/ano atual (YYYY-MM) no fuso de Brasília — usado para marcar comissões pagas.
export function mesAnoAtualBrasilia(date: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR, year: "numeric", month: "2-digit" });
  const partes = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}`;
}

// Dia do mês (1-31) correspondente ao 5º dia útil (seg-sex, sem considerar feriados).
function diaDoQuintoDiaUtil(ano: number, mesIndex0: number): number {
  let dia = 1;
  let uteis = 0;
  while (uteis < 5) {
    const diaSemana = new Date(ano, mesIndex0, dia).getDay();
    if (diaSemana !== 0 && diaSemana !== 6) uteis++;
    if (uteis === 5) break;
    dia++;
  }
  return dia;
}

// True se, no horário de Brasília, hoje já é o 5º dia útil do mês corrente ou depois.
// Não considera feriados nacionais/locais — apenas fins de semana.
export function apos5DiaUtilBrasilia(date: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_BR, year: "numeric", month: "2-digit", day: "2-digit" });
  const partes = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const ano = Number(partes.year);
  const mes = Number(partes.month) - 1;
  const dia = Number(partes.day);
  return dia >= diaDoQuintoDiaUtil(ano, mes);
}

// Saudação correta conforme o período do dia em Brasília.
export function saudacaoBrasilia(date: Date = new Date()): "Bom dia" | "Boa tarde" | "Boa noite" {
  const h = horaBrasilia(date);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Data/hora atual de Brasília por extenso, para dar contexto à IA
// (ex.: "terça-feira, 17 de junho de 2026, 13:43"). Serve de base/calendário.
export function agoraBrasiliaExtenso(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_BR,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// Contatos que NÃO são clientes (contabilidade, bancos, financeiras, hotéis…)
// nunca entram no CRM: nem pelo WhatsApp, nem por importação, nem pelo Google
// Contatos — e os que já existirem são apagados com todo o histórico (ver
// lib/contatos-bloqueados.ts). O CRM é exclusivo para COMPRADORES de máquina.
// Comparação sem acento e sem caixa: "Contábil", "CONTABEIS" e "contabil" batem.
//   TERMOS: valem dentro de qualquer palavra ("contab" pega contabilidade,
//           contábil, contábeis).
//   PALAVRAS: só como palavra inteira ("banco" não pega "Bancorbrás").
// Valores de fábrica — o filtro de verdade mora no banco (Configuracao) e é
// editável em Configurações → WhatsApp/Clientes; ver lib/filtro-contatos.ts.
// Isto aqui é só a semente usada na primeira vez, antes de existir override.
export const TERMOS_BLOQUEIO_PADRAO = ["contab", "contador", "financeir", "escritorio", "bradesco", "sicoob", "sicredi", "banestes", "hotel", "pousada", "restaurante"];
export const PALAVRAS_BLOQUEIO_PADRAO = ["banco", "cnh", "bcnh", "pme"];

export const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Termo que bloqueia o nome, ou null se o nome é aceito — pura (sem banco),
// recebe as listas prontas. Quem decide QUAIS listas usar é lib/filtro-contatos.ts.
// Termo com menos de 3 letras é ignorado: "a" ou "sa" na lista (um deslize
// no card ou no assistente) bloquearia — e APAGARIA — todo contato que chega.
const TAMANHO_MINIMO_TERMO = 3;
// Contato marcado pelo vendedor na agenda do celular: nome terminado em "*"
// (ex.: "Compadre Zé *"). É a marca manual de "isto não é cliente" — vale
// mais que qualquer lista e tira o contato do CRM inteiro: não vira cliente,
// não entra na lista de contatos, não recebe nem gera mensagem, não aparece
// em relatório e não abre negociação. Tirar o asterisco no celular desfaz o
// bloqueio na sincronização seguinte.
export const MOTIVO_ASTERISCO = "asterisco no nome (*)";

// Motivo gravado quando é o vendedor que manda excluir, pela lista de
// Clientes. Separado dos motivos automáticos porque a regra é outra: aqui não
// há termo nem asterisco a reavaliar — alguém decidiu, e a decisão vale até
// ser desfeita à mão, em Configurações. Mora aqui (e não no módulo que grava)
// para a tela poder mostrar o rótulo sem arrastar o banco para o navegador.
export const MOTIVO_EXCLUIDO_MANUAL = "excluído por você";

export function nomeMarcadoComAsterisco(nome: string | null | undefined): boolean {
  return /\*+\s*$/.test((nome ?? "").trim());
}

// Quebra um nome (ou um termo da lista) nas palavras que o formam, já sem
// acento e sem pontuação: "NEW HOLLAND - Suporte" → ["new","holland","suporte"].
const palavrasDe = (s: string): string[] => semAcento(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * O termo aparece no nome como PALAVRA INTEIRA — inclusive quando o termo tem
 * mais de uma palavra.
 *
 * Era aqui que "new holland" morria. A regra antiga perguntava se alguma
 * palavra do nome era IGUAL ao termo inteiro; como nenhuma palavra contém
 * espaço, qualquer termo com duas palavras na caixa "Palavras inteiras" nunca
 * batia em nada — ficava na tela dando a impressão de estar filtrando, e o
 * contato passava direto. "new holland", "banco do brasil", "posto ipiranga":
 * todos silenciosamente inúteis.
 *
 * Agora procura a SEQUÊNCIA de palavras. "new holland" pega "New Holland
 * Vitória" e "NEW HOLLAND - Suporte", e continua não pegando "Newholland" nem
 * "Renew Hollander" — que é o sentido de palavra inteira.
 */
function contemSequencia(partes: string[], alvo: string[]): boolean {
  if (!alvo.length || alvo.length > partes.length) return false;
  for (let i = 0; i + alvo.length <= partes.length; i++) {
    let bate = true;
    for (let j = 0; j < alvo.length; j++) {
      if (partes[i + j] !== alvo[j]) { bate = false; break; }
    }
    if (bate) return true;
  }
  return false;
}

export function motivoBloqueioComListas(nome: string, termos: string[], palavras: string[]): string | null {
  if (nomeMarcadoComAsterisco(nome)) return MOTIVO_ASTERISCO;
  // Espaços repetidos viram um só dos dois lados: "NEW  HOLLAND" (dois
  // espaços, e isso acontece em nome copiado da agenda) tem que bater com o
  // termo "new holland" igual ao nome escrito normalmente.
  const n = semAcento(nome).replace(/\s+/g, " ");
  const termo = termos.find((t) => {
    const alvo = semAcento(t).trim().replace(/\s+/g, " ");
    return alvo.length >= TAMANHO_MINIMO_TERMO && n.includes(alvo);
  });
  if (termo) return termo;
  const partes = palavrasDe(nome);
  const palavra = palavras.find((p) => {
    const alvo = palavrasDe(p);
    // O tamanho mínimo é medido nas letras do termo, sem os separadores: "a b"
    // tem 3 caracteres mas só 2 letras, e continua sendo curto demais para
    // apagar contato.
    if (alvo.join("").length < TAMANHO_MINIMO_TERMO) return false;
    return contemSequencia(partes, alvo);
  });
  return palavra ?? null;
}

export function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Remove o código do país (+55/55) de um telefone brasileiro, deixando só
// DDD+número — mesma regra usada em atualizarCliente() ao salvar, aqui usada
// para EXIBIR o valor já correto antes de salvar (ex.: pré-preencher um campo).
export function semCodigoPais(telefone: string): string {
  return telefone.replace(/^(\+55|55)(?=\d{10,11}$)/, "");
}
