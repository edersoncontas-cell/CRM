// Central de alertas: reúne num lugar só tudo o que pede ação do vendedor e
// hoje ficava espalhado (ou invisível): rascunhos da IA esperando revisão,
// clientes aguardando resposta, alertas comerciais gerados pelo ZEUS, marcos
// de pós-venda vencidos, visitas de hoje/amanhã, demandas com prazo e eventos
// críticos do sistema. Usada pela página /alertas e pelo contador do menu.

import { db } from "@/lib/db";
import { inicioDoDiaBrasilia, formatDateTime } from "@/lib/utils";
import { listarClientesPosVenda } from "@/lib/actions";
import { calcularRitmoMetas } from "@/lib/metas";
import { criarCategorizadorColunas } from "@/lib/pipeline";

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
  clienteNome?: string | null;
  // Cliente ligado ao item (quando há): o "Resolvido" some até o cliente
  // mandar mensagem nova.
  clienteId?: string | null;
};

// Descobre o cliente de um item pelo href (/clientes/<id>) quando o grupo não
// preencheu clienteId explicitamente.
function clienteIdDoItem(i: ItemCentral): string | null {
  const m = i.href.match(/^\/clientes\/([^/?#]+)/);
  return m ? m[1] : null;
}

export type ItemPosVenda = Awaited<ReturnType<typeof listarClientesPosVenda>>[number];

export type GraficosCentral = {
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

  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * HORA);
  const umaHoraAtras = new Date(Date.now() - HORA);

  const [aguardando, alertas, posVenda, visitas, demandas, eventos, ritmo, semContato, negAbertas, colunasFunil, ocultos] = await Promise.all([
    // Só entra na lista depois de 1h sem resposta — antes disso ainda está
    // dentro do tempo normal de resposta, não precisa virar alerta.
    db.cliente.findMany({
      where: { aguardandoResposta: true, OR: [{ ultimoContato: null }, { ultimoContato: { lte: umaHoraAtras } }] },
      orderBy: { ultimoContato: "asc" },
      take: 500,
      select: { id: true, nome: true, ultimoContato: true, telefone: true },
    }),
    db.alerta.findMany({
      where: { resolvido: false, tipo: { not: "aguardando_resposta" } },
      orderBy: [{ severidade: "asc" }, { criadoEm: "desc" }],
      take: 200,
      include: { cliente: { select: { nome: true, telefone: true } } },
    }),
    listarClientesPosVenda().catch(() => []),
    db.visita.findMany({
      where: { data: { gte: hoje, lt: depoisDeAmanha } },
      orderBy: { data: "asc" },
      include: { cliente: { select: { nome: true, telefone: true, municipio: { select: { nome: true } } } } },
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
    // Clientes com 30+ dias sem contato (antes no Dashboard).
    db.cliente.findMany({
      where: { ultimoContato: { lt: trintaDiasAtras }, status: { not: "nao_cliente" } },
      orderBy: { ultimoContato: "asc" },
      take: 400,
      select: { id: true, nome: true, ultimoContato: true, telefone: true, municipio: { select: { nome: true } } },
    }),
    // Negócios em aberto sem visita marcada (antes no Dashboard).
    db.negociacao.findMany({
      where: { status: "aberta", dataVisita: null },
      orderBy: { ultimoContato: "asc" },
      take: 300,
      select: { id: true, estagio: true, maquinaModelo: true, valor: true, proximaAcao: true, ultimoContato: true, clienteId: true, cliente: { select: { nome: true, telefone: true, municipio: { select: { nome: true } } } } },
    }),
    db.colunaFunil.findMany({ select: { titulo: true, papel: true, probabilidade: true } }),
    // Itens que o vendedor marcou como resolvidos. Resolvido é de vez: a
    // chave de cada item carrega a SITUAÇÃO (marco pendente, período sem
    // contato…), então ele só volta se a situação mudar — antes, qualquer
    // mensagem do cliente reabria tudo e "Resolvido" parecia não pegar.
    db.alertaOculto.findMany({ orderBy: { ocultoEm: "desc" }, take: 3000, select: { chave: true } }).catch(() => [] as { chave: string }[]),
  ]);
  const categorizar = criarCategorizadorColunas(colunasFunil);
  const chavesOcultas = new Set(ocultos.map((o) => o.chave));
  const precisamDeVisita = negAbertas.filter((n) => { const cat = categorizar(n.estagio); return cat === "em_negociacao" || cat === "banco"; });
  const diasSem = (d: Date | null) => (d ? Math.floor((Date.now() - d.getTime()) / (24 * HORA)) : null);
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

  const gruposBrutos: GrupoCentral[] = [
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
          telefone: c.telefone,
          clienteNome: c.nome,
          clienteId: c.id,
        };
      }),
    },
    {
      id: "semcontato",
      titulo: "Clientes com 30+ dias sem contato",
      descricao: "Ninguém falou com eles há mais de um mês. Uma mensagem curta já reaquece.",
      itens: semContato.map((c) => {
        const dias = diasSem(c.ultimoContato) ?? 0;
        return {
          // O último contato faz parte da chave: resolvido agora, volta só se
          // passar mais um período sem contato depois de um contato novo.
          id: `semcontato:${c.id}:${c.ultimoContato?.getTime() ?? 0}`,
          titulo: c.nome,
          clienteNome: c.nome,
          detalhe: [`há ${dias} dias sem contato`, c.municipio?.nome].filter(Boolean).join(" · "),
          severidade: dias >= 90 ? ("alta" as const) : dias >= 60 ? ("media" as const) : ("baixa" as const),
          href: `/clientes/${c.id}`,
          hrefLabel: "Abrir cliente",
          quando: c.ultimoContato ? formatDateTime(c.ultimoContato) : null,
          telefone: c.telefone,
        };
      }),
    },
    {
      id: "visitar",
      titulo: "Negócios que precisam de visita",
      descricao: "Negociações em aberto sem visita marcada. Quem é visitado fecha; quem não é, esfria.",
      itens: precisamDeVisita.map((n) => {
        const dias = diasSem(n.ultimoContato);
        return {
          id: `visitar:${n.id}`,
          titulo: n.cliente.nome,
          clienteNome: n.cliente.nome,
          telefone: n.cliente.telefone,
          detalhe: [n.maquinaModelo, n.proximaAcao ?? "Agendar visita", n.cliente.municipio?.nome, dias != null ? `${dias}d sem contato` : null].filter(Boolean).join(" · "),
          severidade: (dias ?? 0) >= 30 ? ("alta" as const) : (dias ?? 0) >= 14 ? ("media" as const) : ("baixa" as const),
          href: `/clientes/${n.clienteId}`,
          hrefLabel: "Abrir cliente",
          quando: n.ultimoContato ? formatDateTime(n.ultimoContato) : null,
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
        clienteNome: a.cliente.nome,
        telefone: a.cliente.telefone,
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
          // A situação faz parte da chave: resolvido este marco, o cliente só
          // volta quando vencer o próximo (ou ficar 90+ dias sem contato).
          id: `posvenda:${p.clienteId}:${p.marcoPendente?.tipo ?? "-"}:${p.entregaTecnica ? "et" : "-"}:${(p.diasSemContato ?? 0) >= 90 ? "frio" : "-"}`,
          titulo: `${p.nome}${p.maquina ? ` · ${p.maquina}` : ""}`,
          clienteNome: p.nome,
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
          clienteNome: v.cliente.nome,
          telefone: v.cliente.telefone,
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
        detalhe: [
          e.tipo === "erro" ? "Erro no servidor." : "Verificação de saúde falhou.",
          e.ocorrencias > 1 ? `repetiu ${e.ocorrencias}x` : null,
        ].filter(Boolean).join(" · "),
        severidade: e.severidade === "critica" ? ("alta" as const) : ("media" as const),
        href: "/zeus",
        hrefLabel: "Abrir ZEUS",
        quando: formatDateTime(e.criadoEm),
      })),
    },
  ];

  // Itens resolvidos pelo vendedor saem da relação (e cada item leva o
  // clienteId para o "Resolvido" saber quando reabrir).
  const grupos: GrupoCentral[] = gruposBrutos.map((g) => ({
    ...g,
    itens: g.itens.filter((i) => !chavesOcultas.has(i.id)).map((i) => ({ ...i, clienteId: i.clienteId ?? clienteIdDoItem(i) })),
  }));
  const todos = grupos.flatMap((g) => g.itens);

  // Contagem de criados/resolvidos por dia nos últimos 14 dias (vira os dois
  // números do topo da Central — os gráficos foram removidos a pedido).
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
    tendencia: Array.from(porDia.entries()).map(([dia, v]) => ({ dia, ...v })),
  };
  return { grupos, total: todos.length, alta: todos.filter((i) => i.severidade === "alta").length, graficos };
}
