// Central de alertas: reúne num lugar só tudo o que pede ação do vendedor e
// hoje ficava espalhado (ou invisível): rascunhos da IA esperando revisão,
// clientes aguardando resposta, alertas comerciais gerados pelo ZEUS, marcos
// de pós-venda vencidos, visitas de hoje/amanhã, demandas com prazo e eventos
// críticos do sistema. Usada pela página /alertas e pelo contador do menu.

import { db } from "@/lib/db";
import { inicioDoDiaBrasilia, formatDateTime } from "@/lib/utils";
import { listarClientesPosVenda } from "@/lib/actions";
import { calcularRitmoMetas } from "@/lib/metas";

export type SeveridadeAlerta = "alta" | "media" | "baixa";

export type ItemCentral = {
  id: string;
  titulo: string;
  detalhe: string | null;
  severidade: SeveridadeAlerta;
  href: string;
  hrefLabel: string;
  quando: string | null;
  // Só nos alertas comerciais do ZEUS: id na tabela Alerta (botão "Resolvido").
  alertaId?: string;
  // Só no grupo pós-venda: dados completos para o modal de histórico/contato.
  posVenda?: ItemPosVenda;
  telefone?: string | null;
};

export type ItemPosVenda = Awaited<ReturnType<typeof listarClientesPosVenda>>[number];

export type GraficosCentral = {
  porGrupo: { grupo: string; id: string; total: number; alta: number }[];
  porSeveridade: { severidade: SeveridadeAlerta; total: number }[];
  tendencia: { dia: string; criados: number; resolvidos: number }[];
};

export type GrupoCentral = {
  id: string;
  titulo: string;
  descricao: string;
  itens: ItemCentral[];
};

const HORA = 60 * 60 * 1000;

function horasDesde(d: Date | null): number | null {
  return d ? Math.floor((Date.now() - d.getTime()) / HORA) : null;
}

const ROTULO_TIPO_ALERTA: Record<string, string> = {
  esfriando: "Negociação esfriando",
  visita_amanha: "Visita amanhã",
  concorrente: "Concorrente citado",
  aguardando_resposta: "Aguardando resposta",
  cadencia: "Cadência: ligar ou visitar",
};

export async function listarCentralAlertas(): Promise<{ grupos: GrupoCentral[]; total: number; alta: number; graficos: GraficosCentral }> {
  const hoje = inicioDoDiaBrasilia();
  const amanha = inicioDoDiaBrasilia(new Date(), 1);
  const depoisDeAmanha = inicioDoDiaBrasilia(new Date(), 2);
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * HORA);

  const [rascunhos, aguardando, alertas, posVenda, visitas, demandas, eventos, ritmo] = await Promise.all([
    db.whatsAppMessage.findMany({
      where: { isDraft: true, draftStatus: "PENDING" },
      orderBy: { sentAt: "desc" },
      take: 50,
      select: { id: true, body: true, sentAt: true, conversation: { select: { id: true, contactName: true, externalPhone: true, clienteId: true } } },
    }),
    db.cliente.findMany({
      where: { aguardandoResposta: true },
      orderBy: { ultimoContato: "asc" },
      take: 50,
      select: { id: true, nome: true, ultimoContato: true },
    }),
    db.alerta.findMany({
      where: { resolvido: false, tipo: { not: "aguardando_resposta" } },
      orderBy: [{ severidade: "asc" }, { criadoEm: "desc" }],
      take: 80,
      include: { cliente: { select: { nome: true } } },
    }),
    listarClientesPosVenda().catch(() => []),
    db.visita.findMany({
      where: { data: { gte: hoje, lt: depoisDeAmanha } },
      orderBy: { data: "asc" },
      include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } },
    }),
    db.tarefaKanban.findMany({
      where: { dueDate: { lt: amanha }, coluna: { not: "demandas_concluida" } },
      orderBy: { dueDate: "asc" },
      take: 50,
      include: { cliente: { select: { nome: true } } },
    }),
    db.zeusEvent.findMany({
      where: { resolvido: false, tipo: { in: ["health", "erro"] }, severidade: { in: ["alta", "critica"] }, criadoEm: { gte: seteDiasAtras } },
      orderBy: { criadoEm: "desc" },
      take: 20,
    }),
    calcularRitmoMetas().catch(() => null),
  ]);
  const catorzeDias = new Date(Date.now() - 14 * 24 * HORA);
  const [alertasRecentes, telefones] = await Promise.all([
    db.alerta.findMany({ where: { criadoEm: { gte: catorzeDias } }, select: { criadoEm: true, resolvido: true } }),
    db.cliente.findMany({ where: { id: { in: posVenda.map((p) => p.clienteId) } }, select: { id: true, telefone: true } }),
  ]);
  const telefonePorCliente = new Map(telefones.map((t) => [t.id, t.telefone]));

  // Conversa de cada cliente aguardando resposta (para o link ir direto ao chat).
  const convsAguardando = aguardando.length
    ? await db.whatsAppConversation.findMany({
        where: { clienteId: { in: aguardando.map((c) => c.id) }, isGroup: false },
        orderBy: { lastMessageAt: "desc" },
        select: { id: true, clienteId: true },
      })
    : [];
  const convPorCliente = new Map<string, string>();
  for (const c of convsAguardando) if (c.clienteId && !convPorCliente.has(c.clienteId)) convPorCliente.set(c.clienteId, c.id);

  const grupos: GrupoCentral[] = [
    {
      id: "rascunhos",
      titulo: "Rascunhos da IA aguardando sua revisão",
      descricao: "Respostas e follow-ups que o Cérebro preparou. Nada é enviado sem você aprovar.",
      itens: rascunhos.map((r) => ({
        id: `rascunho:${r.id}`,
        titulo: r.conversation.contactName ?? r.conversation.externalPhone,
        detalhe: r.body.length > 140 ? r.body.slice(0, 140) + "…" : r.body,
        severidade: "media" as const,
        href: `/atendimento?conversa=${r.conversation.id}`,
        hrefLabel: "Revisar no WhatsApp",
        quando: formatDateTime(r.sentAt),
      })),
    },
    {
      id: "aguardando",
      titulo: "Clientes aguardando a sua resposta",
      descricao: "A última mensagem é do cliente. Quanto mais tempo passa, mais frio fica.",
      itens: aguardando.map((c) => {
        const h = horasDesde(c.ultimoContato);
        const conv = convPorCliente.get(c.id);
        return {
          id: `aguardando:${c.id}`,
          titulo: c.nome,
          detalhe: h == null ? "Sem horário do último contato." : h < 1 ? "Há menos de 1 hora." : h < 24 ? `Há ${h} h sem resposta.` : `Há ${Math.floor(h / 24)} dia(s) sem resposta.`,
          severidade: (h ?? 0) >= 24 ? ("alta" as const) : (h ?? 0) >= 4 ? ("media" as const) : ("baixa" as const),
          href: conv ? `/atendimento?conversa=${conv}` : `/clientes/${c.id}`,
          hrefLabel: conv ? "Responder" : "Abrir cliente",
          quando: c.ultimoContato ? formatDateTime(c.ultimoContato) : null,
        };
      }),
    },
    {
      id: "comerciais",
      titulo: "Alertas comerciais do ZEUS",
      descricao: "Negociação esfriando, visita amanhã, concorrente citado, toque de ligação ou visita da cadência. Marque como resolvido depois de agir.",
      itens: alertas.map((a) => ({
        id: `alerta:${a.id}`,
        alertaId: a.id,
        titulo: `${ROTULO_TIPO_ALERTA[a.tipo] ?? a.tipo}: ${a.cliente.nome}`,
        detalhe: a.mensagem,
        severidade: a.severidade === "alta" ? ("alta" as const) : a.severidade === "media" ? ("media" as const) : ("baixa" as const),
        href: `/clientes/${a.clienteId}`,
        hrefLabel: "Abrir cliente",
        quando: formatDateTime(a.criadoEm),
      })),
    },
    {
      id: "posvenda",
      titulo: "Pós-venda",
      descricao: "Quem já comprou e precisa de atenção: marco de 30/60/180/365 dias vencido ou 90+ dias sem contato. Registre o contato ou mande a mensagem daqui.",
      itens: posVenda
        .filter((p) => p.marcoPendente || (p.diasSemContato ?? 0) >= 90 || !p.entregaTecnica)
        .slice(0, 80)
        .map((p) => ({
          id: `posvenda:${p.clienteId}`,
          titulo: `${p.nome}${p.maquina ? ` · ${p.maquina}` : ""}`,
          detalhe: [
            p.marcoPendente ? `Marco de ${p.marcoPendente.label} pendente` : null,
            !p.entregaTecnica ? "Entrega técnica não registrada" : null,
            p.diasSemContato != null ? `${p.diasSemContato} dia(s) sem contato` : null,
            p.dataCompra ? `faturado em ${new Date(p.dataCompra).toLocaleDateString("pt-BR")}` : null,
            p.municipio,
          ].filter(Boolean).join(" · "),
          severidade: (p.diasSemContato ?? 0) >= 120 ? ("alta" as const) : p.marcoPendente ? ("media" as const) : ("baixa" as const),
          href: `/clientes/${p.clienteId}`,
          hrefLabel: "Abrir cliente",
          quando: null,
          posVenda: p,
          telefone: telefonePorCliente.get(p.clienteId) ?? null,
        })),
    },
    {
      id: "visitas",
      titulo: "Visitas de hoje e de amanhã",
      descricao: "Confirme a presença e prepare a proposta antes de sair.",
      itens: visitas.map((v) => {
        const ehHoje = v.data < amanha;
        return {
          id: `visita:${v.id}`,
          titulo: `${ehHoje ? "Hoje" : "Amanhã"}: ${v.cliente.nome}`,
          detalhe: [v.cliente.municipio?.nome, v.observacao].filter(Boolean).join(" · ") || null,
          severidade: ehHoje ? ("alta" as const) : ("media" as const),
          href: `/clientes/${v.clienteId}`,
          hrefLabel: "Abrir cliente",
          quando: formatDateTime(v.data),
        };
      }),
    },
    {
      id: "demandas",
      titulo: "Demandas vencidas ou para hoje",
      descricao: "Tarefas do quadro de Demandas com prazo até hoje que ainda não foram concluídas.",
      itens: demandas.map((d) => {
        const vencida = !!d.dueDate && d.dueDate < hoje;
        return {
          id: `demanda:${d.id}`,
          titulo: d.titulo,
          detalhe: [vencida ? "Prazo vencido" : "Vence hoje", d.cliente?.nome, d.cidade].filter(Boolean).join(" · "),
          severidade: vencida ? ("alta" as const) : ("media" as const),
          href: "/pipeline",
          hrefLabel: "Abrir demandas",
          quando: d.dueDate ? formatDateTime(d.dueDate) : null,
        };
      }),
    },
    {
      id: "meta",
      titulo: "Meta do ano",
      descricao: "Ritmo necessário por semana para bater a meta. Aparece só quando está atrasado.",
      itens: ritmo && ritmo.situacao === "atrasado" && ritmo.faltamAno > 0
        ? [{
            id: "meta:ano",
            titulo: `Meta atrasada: ${ritmo.vendasAno} de ${ritmo.esperadoAteHoje.toFixed(1)} esperadas até hoje`,
            detalhe: ritmo.resumo,
            severidade: "media" as const,
            href: "/dashboard",
            hrefLabel: "Ver ritmo",
            quando: null,
          }]
        : [],
    },
    {
      id: "sistema",
      titulo: "Sistema",
      descricao: "Problemas que o ZEUS detectou e que podem parar o WhatsApp ou a IA.",
      itens: eventos.map((e) => ({
        id: `zeus:${e.id}`,
        titulo: e.titulo,
        detalhe: e.tipo === "erro" ? "Erro repetido no servidor." : "Verificação de saúde falhou.",
        severidade: e.severidade === "critica" ? ("alta" as const) : ("media" as const),
        href: "/zeus",
        hrefLabel: "Abrir ZEUS",
        quando: formatDateTime(e.criadoEm),
      })),
    },
  ];

  const todos = grupos.flatMap((g) => g.itens);

  // Gráficos: por grupo, por severidade e tendência de 14 dias dos alertas do ZEUS.
  const porDia = new Map<string, { criados: number; resolvidos: number }>();
  for (let i = 13; i >= 0; i--) porDia.set(new Date(Date.now() - i * 24 * HORA).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }), { criados: 0, resolvidos: 0 });
  for (const a of alertasRecentes) {
    const k = a.criadoEm.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const p = porDia.get(k);
    if (!p) continue;
    p.criados++;
    if (a.resolvido) p.resolvidos++;
  }
  const graficos: GraficosCentral = {
    porGrupo: grupos.filter((g) => g.itens.length).map((g) => ({ grupo: g.titulo, id: g.id, total: g.itens.length, alta: g.itens.filter((i) => i.severidade === "alta").length })),
    porSeveridade: (["alta", "media", "baixa"] as SeveridadeAlerta[]).map((sev) => ({ severidade: sev, total: todos.filter((i) => i.severidade === sev).length })),
    tendencia: Array.from(porDia.entries()).map(([dia, v]) => ({ dia, ...v })),
  };
  return { grupos, total: todos.length, alta: todos.filter((i) => i.severidade === "alta").length, graficos };
}
