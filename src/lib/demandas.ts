// Demandas: a lista única de tarefas do vendedor. Junta o que ele anota à
// mão com o que o CRM gera sozinho (toque de ligação/visita da cadência,
// marco de pós-venda vencido, próxima ação do Orientador aceita, tarefa do
// Cérebro), tudo com prazo, prioridade, cliente e cidade. Sem colunas de
// Kanban: a organização é por prazo (atrasadas, hoje, esta semana, depois).

import { db } from "@/lib/db";
import { inicioDoDiaBrasilia } from "@/lib/utils";

export type ItemChecklist = { t: string; d: boolean };
export type Prioridade = "alta" | "normal" | "baixa";
export type OrigemDemanda = "manual" | "orientador" | "cadencia" | "posvenda" | "cerebro" | "zeus";

export const COLUNA_ABERTA = "demandas";
export const COLUNA_CONCLUIDA = "demandas_concluida";

export const ROTULO_ORIGEM: Record<string, string> = {
  manual: "Você",
  audio: "Por áudio",
  orientador: "Orientador",
  cadencia: "Cadência",
  posvenda: "Pós-venda",
  cerebro: "Cérebro",
  zeus: "ZEUS",
};

export function lerChecklist(raw: string | null | undefined): ItemChecklist[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((i) => i && typeof i.t === "string").map((i) => ({ t: String(i.t), d: !!i.d }));
  } catch {
    return [];
  }
}

export type DemandaDTO = {
  id: string;
  titulo: string;
  descricao: string | null;
  checklist: ItemChecklist[];
  clienteId: string | null;
  clienteNome: string | null;
  cidade: string | null;
  dueDate: string | null;
  prioridade: Prioridade;
  origem: string;
  concluida: boolean;
  concluidaEm: string | null;
  criadoEm: string;
  ordem: number;
};

export type GrupoDemandas = { id: "atrasadas" | "hoje" | "semana" | "depois" | "sem_prazo" | "concluidas"; titulo: string; itens: DemandaDTO[] };

export async function listarDemandas(): Promise<{ grupos: GrupoDemandas[]; abertas: number; atrasadas: number; hoje: number }> {
  const tarefas = await db.tarefaKanban.findMany({
    orderBy: [{ ordem: "asc" }, { dueDate: "asc" }, { criadoEm: "desc" }],
    include: { cliente: { select: { nome: true } } },
    take: 400,
  });
  const inicioHoje = inicioDoDiaBrasilia();
  const amanha = inicioDoDiaBrasilia(new Date(), 1);
  const fimSemana = inicioDoDiaBrasilia(new Date(), 7);
  const seteDiasAtras = new Date(Date.now() - 7 * 86400000);

  const dto = (t: (typeof tarefas)[number]): DemandaDTO => ({
    id: t.id, titulo: t.titulo, descricao: t.descricao, checklist: lerChecklist(t.checklist),
    clienteId: t.clienteId, clienteNome: t.cliente?.nome ?? null, cidade: t.cidade,
    dueDate: t.dueDate?.toISOString() ?? null,
    prioridade: (["alta", "normal", "baixa"].includes(t.prioridade) ? t.prioridade : "normal") as Prioridade,
    origem: t.origem, concluida: t.coluna === COLUNA_CONCLUIDA, concluidaEm: t.concluidaEm?.toISOString() ?? null,
    criadoEm: t.criadoEm.toISOString(), ordem: t.ordem,
  });

  const grupos: GrupoDemandas[] = [
    { id: "atrasadas", titulo: "Atrasadas", itens: [] },
    { id: "hoje", titulo: "Hoje", itens: [] },
    { id: "semana", titulo: "Próximos 7 dias", itens: [] },
    { id: "depois", titulo: "Depois", itens: [] },
    { id: "sem_prazo", titulo: "Sem prazo", itens: [] },
    { id: "concluidas", titulo: "Concluídas (últimos 7 dias)", itens: [] },
  ];
  const peso: Record<Prioridade, number> = { alta: 0, normal: 1, baixa: 2 };
  for (const t of tarefas) {
    const d = dto(t);
    if (d.concluida) {
      if (t.concluidaEm && t.concluidaEm >= seteDiasAtras) grupos[5].itens.push(d);
      continue;
    }
    if (!t.dueDate) grupos[4].itens.push(d);
    else if (t.dueDate < inicioHoje) grupos[0].itens.push(d);
    else if (t.dueDate < amanha) grupos[1].itens.push(d);
    else if (t.dueDate < fimSemana) grupos[2].itens.push(d);
    else grupos[3].itens.push(d);
  }
  // Ordem manual primeiro (quem arrastou manda); novas (ordem 0) entram no
  // topo; empate por prioridade e prazo.
  for (const g of grupos) g.itens.sort((a, b) => a.ordem - b.ordem || peso[a.prioridade] - peso[b.prioridade] || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
  const abertas = grupos.slice(0, 5).reduce((s, g) => s + g.itens.length, 0);
  return { grupos, abertas, atrasadas: grupos[0].itens.length, hoje: grupos[1].itens.length };
}

// Cria uma demanda automática só se não existir uma aberta com a mesma chave
// (ex.: "cadencia:<clienteId>:3" ou "posvenda:<clienteId>:marco_30d").
export async function garantirDemandaAutomatica(args: {
  chave: string; titulo: string; descricao?: string | null; clienteId?: string | null; cidade?: string | null;
  dueDate?: Date | null; prioridade?: Prioridade; origem: OrigemDemanda;
}): Promise<{ criada: boolean; id: string }> {
  const existente = await db.tarefaKanban.findFirst({ where: { chave: args.chave, coluna: COLUNA_ABERTA }, select: { id: true } });
  if (existente) return { criada: false, id: existente.id };
  const t = await db.tarefaKanban.create({
    data: {
      titulo: args.titulo.slice(0, 160), descricao: args.descricao ?? null, clienteId: args.clienteId ?? null, cidade: args.cidade ?? null,
      dueDate: args.dueDate ?? null, prioridade: args.prioridade ?? "normal", origem: args.origem, chave: args.chave, coluna: COLUNA_ABERTA,
    },
  });
  return { criada: true, id: t.id };
}
