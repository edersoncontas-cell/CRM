// O LEMBRETE DAS VISITAS DO DIA — quando aparece, quem é a vez, quando cala.
//
//   "Durante os dias da semana, de segunda a sexta, quando tiver visitas
//    agendadas no CRM quero que você crie um pop up toda vez que entrar no CRM
//    (…) O pop up vai começar aparecer ao entrar no crm exatamente no mesmo
//    horário que iniciou a primeira visita do dia, e só vai encerrar quando a
//    última visita do dia agendada foi marcada como visitada."
//
// O vendedor está na rua. Ele não volta ao CRM para registrar visita — ele
// volta para ver um preço, uma ficha técnica. O lembrete existe para
// aproveitar essa volta: se ele abriu o CRM e tem visita do dia sem sinalizar,
// a pergunta vem até ele.
//
// Três decisões moram aqui, e todas são de REGRA, não de tela:
//
//   1. ABRE a partir do horário da primeira visita do dia. Antes disso o
//      vendedor ainda está indo; perguntar "visita feita?" às 7h de uma visita
//      das 9h só ensina a fechar o pop-up sem ler.
//   2. FECHA quando não sobrou nenhuma visita do dia por sinalizar. Não é
//      "quando ele marcou a última": é quando NENHUMA está pendente — o que
//      dá no mesmo, e ainda funciona se ele marcar fora de ordem.
//   3. A VEZ é da mais antiga ainda pendente, mas ele pode pular para outra:
//      "caso tenha atendido algum cliente primeiro". A fila é sugestão, não
//      prisão.
//
// Segunda a sexta porque é a semana de trabalho dele. Visita de sábado
// continua no calendário e no CRM — só não gera lembrete.

export type VisitaDoDia = {
  id: string;
  clienteId: string;
  clienteNome: string;
  /** Início da visita. */
  data: Date;
  /** agendada | realizada | nao_realizada */
  status: string;
  cidade: string | null;
  observacao: string | null;
};

/** Pendente = ainda não sinalizada pelo vendedor. */
export function estaPendente(v: { status: string }): boolean {
  return v.status === "agendada";
}

/** Dia da semana em Brasília: 0 domingo … 6 sábado. */
export function diaDaSemanaBrasilia(d: Date): number {
  const nome = d.toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" });
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nome);
}

/** É dia útil de semana (segunda a sexta)? */
export function ehDiaDeSemana(d: Date): boolean {
  const dia = diaDaSemanaBrasilia(d);
  return dia >= 1 && dia <= 5;
}

/** Ordena por horário: a fila do dia é a ordem em que ele marcou as visitas. */
export function emOrdemDeHorario(visitas: VisitaDoDia[]): VisitaDoDia[] {
  return [...visitas].sort((a, b) => a.data.getTime() - b.data.getTime());
}

/** O horário da primeira visita do dia — é a hora em que o lembrete acorda. */
export function horarioDaPrimeira(visitas: VisitaDoDia[]): Date | null {
  const ordenadas = emOrdemDeHorario(visitas);
  return ordenadas[0]?.data ?? null;
}

export type EstadoLembrete = {
  /** Mostrar o pop-up agora? */
  mostrar: boolean;
  /** A visita da vez (a mais antiga ainda pendente). */
  daVez: VisitaDoDia | null;
  /** Todas as pendentes, em ordem — para ele escolher outra. */
  pendentes: VisitaDoDia[];
  /** Quantas do dia já foram sinalizadas, de quantas. */
  sinalizadas: number;
  total: number;
  /**
   * Por que não está mostrando. Só para diagnóstico e para a tela poder
   * explicar-se; nunca aparece para o vendedor como erro.
   */
  motivo?: "fim_de_semana" | "sem_visitas" | "ainda_cedo" | "tudo_sinalizado";
};

/**
 * O estado do lembrete AGORA.
 *
 * `visitas` são as visitas de HOJE (quem chama já filtrou o dia); `agora` é o
 * instante da checagem. Nunca lança e nunca depende de banco: dá para testar
 * o dia inteiro em milissegundos.
 */
export function estadoDoLembrete(visitas: VisitaDoDia[], agora: Date = new Date()): EstadoLembrete {
  const total = visitas.length;
  const pendentes = emOrdemDeHorario(visitas.filter(estaPendente));
  const base = { daVez: pendentes[0] ?? null, pendentes, sinalizadas: total - pendentes.length, total };

  if (!ehDiaDeSemana(agora)) return { ...base, mostrar: false, motivo: "fim_de_semana" };
  if (!total) return { ...base, mostrar: false, motivo: "sem_visitas" };
  // "só vai encerrar quando a última visita do dia agendada foi marcada":
  // nenhuma pendente = nada a lembrar.
  if (!pendentes.length) return { ...base, mostrar: false, motivo: "tudo_sinalizado" };

  // "vai começar aparecer ao entrar no crm exatamente no mesmo horário que
  // iniciou a primeira visita do dia" — a primeira DO DIA, não a primeira
  // pendente: se ele já marcou a das 9h, a das 10h45 não adia o lembrete para
  // as 10h45; o dia já começou.
  const primeira = horarioDaPrimeira(visitas)!;
  if (agora < primeira) return { ...base, mostrar: false, motivo: "ainda_cedo" };

  return { ...base, mostrar: true };
}

/** A visita escolhida à mão continua tendo de ser uma pendente de hoje. */
export function escolherDaFila(visitas: VisitaDoDia[], id: string): VisitaDoDia | null {
  return visitas.find((v) => v.id === id && estaPendente(v)) ?? null;
}

/** "9h", "10h45" — como ele fala o horário, sem zero à esquerda inútil. */
export function horaCurta(d: Date): string {
  const [h, m] = d
    .toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/**
 * O intervalo do dia de hoje em Brasília, em UTC — para a consulta no banco.
 *
 * O servidor roda em UTC e o vendedor vive em Brasília: perguntar "as visitas
 * de hoje" sem converter traz as da madrugada errada.
 */
export function limitesDoDia(agora: Date = new Date()): { inicio: Date; fim: Date } {
  const iso = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
  // Brasília é UTC-3 o ano todo (o horário de verão acabou em 2019).
  const inicio = new Date(`${iso}T00:00:00.000-03:00`);
  const fim = new Date(`${iso}T23:59:59.999-03:00`);
  return { inicio, fim };
}
