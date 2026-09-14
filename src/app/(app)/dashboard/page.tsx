import { db } from "@/lib/db";
import { diasDesde, saudacaoBrasilia, formatCurrency, diaSemanaBrasilia, inicioDoDiaBrasilia } from "@/lib/utils";
import { criarCategorizadorColunas } from "@/lib/pipeline";
import { FraseMotivacional } from "@/components/MotivacaoWidget";
import { TickerMercado } from "@/components/TickerMercado";
import { NoticiasSetor } from "@/components/NoticiasSetor";
import { obterCotacoes } from "@/lib/mercado";
import { obterNoticias } from "@/lib/noticias";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { Painel, Anel, Delta, Chip, CalendarioVisitas } from "@/components/dashboard-ui";
import { GraficoEvolucao, GraficoTicketPorAno, GraficoDonut, GraficoBarrasHorizontais } from "@/components/DashboardVendas";
import { MapaVendasWrapper } from "@/components/MapaVendasWrapper";
import { carregarVendasFaturadas, resumoVendas } from "@/lib/vendas-dashboard";
import { lerParametros } from "@/lib/parametros";
import { calcularRitmoMetas } from "@/lib/metas";
import { contarClientesConversados } from "@/lib/actions";
import { PERIODOS_ORIENTADOR, type PeriodoOrientador } from "@/lib/orientador-periodos";
import { T } from "@/lib/dash-tema";
import Link from "next/link";
import {
  Target, Clock, Bell, Snowflake, ArrowRight, Calendar, Trophy, MapPin, Wallet, Receipt, Handshake, Landmark, ListTodo, TrendingUp, Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: { ano?: string } }) {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const anoSel = searchParams.ano && /^\d{4}$/.test(searchParams.ano) ? Number(searchParams.ano) : anoAtual;
  const inicioAno = new Date(anoAtual, 0, 1);
  // Limites de dia e semana no fuso de Brasília (o servidor roda em UTC).
  const inicioDia = inicioDoDiaBrasilia(hoje);
  const fimDia = new Date(inicioDoDiaBrasilia(hoje, 1).getTime() - 1);

  // Semana de segunda a domingo (para os quadros que zeram toda segunda-feira)
  const diaSemanaAtual = diaSemanaBrasilia(hoje); // 0=domingo ... 6=sábado
  const deltaSegunda = diaSemanaAtual === 0 ? 6 : diaSemanaAtual - 1;
  const inicioSemanaSegunda = inicioDoDiaBrasilia(hoje, -deltaSegunda);
  const fimSemanaDomingo = inicioDoDiaBrasilia(hoje, -deltaSegunda + 7);

  // Janela de segunda a sábado (para o quadro "Novos Negócios", que zera todo domingo)
  const ehDomingoHoje = diaSemanaAtual === 0;
  const fimSemanaSabado = new Date(inicioDoDiaBrasilia(hoje, -deltaSegunda + 6).getTime() - 1);

  const DIAS_SEM_CONTATO = 30;
  const corteSemContato = new Date(hoje);
  corteSemContato.setDate(corteSemContato.getDate() - DIAS_SEM_CONTATO);

  // Calendário do mês corrente
  const inicioMesCal = new Date(anoAtual, hoje.getMonth(), 1);
  const fimMesCal = new Date(anoAtual, hoje.getMonth() + 1, 1);

  const [
    negociacoes, futuros, demandasHoje,
    visitasSemanaAgendadas, negociosCriadosSemana,
    total30DiasSemContato, colunasFunil,
    vendasFaturadas, visitasMes, clientesProximaVisitaMes, conversados, cotacoes, noticias,
  ] = await Promise.all([
    db.negociacao.findMany({ where: { status: "aberta" }, include: { cliente: true } }),
    db.cliente.findMany({
      where: { interesseFuturo: true },
      orderBy: { interesseFuturoData: "asc" },
      take: 12,
      select: { id: true, nome: true, interesseFuturoData: true, interesseFuturoNota: true },
    }),
    db.tarefaKanban.count({ where: { dueDate: { gte: inicioDia, lte: fimDia } } }).catch(() => 0),
    // Só visitas confirmadas como realizadas (✓ em Visitas) contam para a meta.
    db.visita.count({ where: { status: "realizada", data: { gte: inicioSemanaSegunda, lt: fimSemanaDomingo } } }),
    ehDomingoHoje ? Promise.resolve([]) : db.negociacao.findMany({
      where: { criadoEm: { gte: inicioSemanaSegunda, lte: fimSemanaSabado } },
      select: { estagio: true },
    }),
    // A lista completa mora na Central de alertas (grupo "30+ dias sem contato").
    db.cliente.count({ where: { ultimoContato: { lt: corteSemContato }, status: { not: "nao_cliente" } } }),
    db.colunaFunil.findMany({ select: { titulo: true, papel: true, probabilidade: true } }),
    carregarVendasFaturadas(),
    // Agenda do mês: visitas registradas + próximas visitas anotadas no cliente.
    db.visita.findMany({
      where: { data: { gte: inicioMesCal, lt: fimMesCal } },
      orderBy: { data: "asc" },
      select: { id: true, data: true, cidade: true, observacao: true, cliente: { select: { id: true, nome: true, municipio: { select: { nome: true } } } } },
    }),
    db.cliente.findMany({
      where: { proximaVisita: { gte: inicioMesCal, lt: fimMesCal } },
      orderBy: { proximaVisita: "asc" },
      select: { id: true, nome: true, proximaVisita: true, proximaVisitaNota: true, municipio: { select: { nome: true } } },
    }),
    contarClientesConversados(),
    obterCotacoes(),
    obterNoticias(),
  ]);

  const { metaAnualVendas: META_ANUAL_VENDAS, metaVisitasSemana, metaNegociosSemana } = await lerParametros();
  const ritmo = await calcularRitmoMetas(hoje).catch(() => null);
  const resumo = resumoVendas(vendasFaturadas, anoSel, META_ANUAL_VENDAS);
  const categorizarColunaPorTitulo = criarCategorizadorColunas(colunasFunil);

  const novosNegociosSemana = negociosCriadosSemana.filter((n) => {
    const cat = categorizarColunaPorTitulo(n.estagio);
    return cat === "em_negociacao" || cat === "banco";
  }).length;

  const em30Dias = new Date(hoje);
  em30Dias.setDate(em30Dias.getDate() + 30);
  const futurosNaHora = futuros.filter((f) => f.interesseFuturoData && f.interesseFuturoData <= em30Dias);

  const saudacao = saudacaoBrasilia(hoje);
  const emNegociacaoCount = negociacoes.filter((n) => categorizarColunaPorTitulo(n.estagio) === "em_negociacao").length;
  const emBancoCount = negociacoes.filter((n) => categorizarColunaPorTitulo(n.estagio) === "banco").length;

  const vendasAno = resumo.kpis.vendas;
  const faltamVendas = Math.max(0, META_ANUAL_VENDAS - vendasAno);
  const mesesRestantesAno = Math.max(1, 12 - hoje.getMonth());
  const mediaNecessariaPorMes = (faltamVendas / mesesRestantesAno).toFixed(1);
  const diaDoAno = Math.ceil((hoje.getTime() - inicioAno.getTime()) / 86400000);
  const diasRestantesAno = 365 - diaDoAno;
  const ritmoMensal = vendasAno > 0 ? (vendasAno / (anoSel === anoAtual ? hoje.getMonth() + 1 : 12)).toFixed(1) : "0";

  // Agenda do mês: um item por visita (registrada ou anotada no cliente),
  // agrupado por dia, para preencher o espaço abaixo do calendário.
  type ItemAgenda = { chave: string; data: Date; clienteId: string; nome: string; local: string | null; obs: string | null; prevista: boolean };
  const itensAgenda: ItemAgenda[] = [
    ...visitasMes.map((v) => ({ chave: `v:${v.id}`, data: v.data, clienteId: v.cliente.id, nome: v.cliente.nome, local: v.cidade ?? v.cliente.municipio?.nome ?? null, obs: v.observacao, prevista: false })),
    ...clientesProximaVisitaMes.filter((c) => c.proximaVisita).map((c) => ({ chave: `p:${c.id}`, data: c.proximaVisita!, clienteId: c.id, nome: c.nome, local: c.municipio?.nome ?? null, obs: c.proximaVisitaNota, prevista: true })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime());
  const agendaPorDia = new Map<number, ItemAgenda[]>();
  for (const it of itensAgenda) {
    const d = it.data.getDate();
    agendaPorDia.set(d, [...(agendaPorDia.get(d) ?? []), it]);
  }
  const diasComVisita = new Map<number, number>();
  for (const [d, itens] of agendaPorDia) diasComVisita.set(d, itens.length);
  const diaHoje = hoje.getDate();

  const cidadesTop = resumo.pontosMapa.slice(0, 8).map((p) => ({ nome: p.nome, qtd: p.vendas }));

  const termometro = [
    { rotulo: "Em negociação", valor: emNegociacaoCount, cor: T.violeta, icone: Handshake, href: "/negociacoes" },
    { rotulo: "Em banco", valor: emBancoCount, cor: T.ciano, icone: Landmark, href: "/negociacoes" },
    { rotulo: "30+ dias sem contato", valor: total30DiasSemContato, cor: T.amarelo, icone: Snowflake, href: "/alertas?grupo=semcontato" },
    { rotulo: "Demandas de hoje", valor: demandasHoje, cor: T.verde, icone: ListTodo, href: "/pipeline" },
  ];
  const maxTermometro = Math.max(1, ...termometro.map((p) => p.valor));

  const periodosConversados = Object.entries(PERIODOS_ORIENTADOR) as [PeriodoOrientador, (typeof PERIODOS_ORIENTADOR)[PeriodoOrientador]][];
  const coresConversados = [T.rosa, T.violeta, T.ciano, T.verde, T.amarelo, T.laranja];

  return (
    <div style={{ background: T.fundo, minHeight: "100%", color: T.texto }} className="-m-4 space-y-4 p-4 md:-m-8 md:p-6">
      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Dashboard <span style={{ color: T.rosa }}>·</span> <span className="font-semibold" style={{ color: T.texto2 }}>{saudacao}</span></h1>
          <p className="mt-0.5 text-xs" style={{ color: T.mudo }}>
            {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} · {anoAtual}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.mudo }}>Ano</span>
          {resumo.anosDisponiveis.slice(0, 4).map((a) => (
            <Chip key={a} ativo={a === anoSel} href={a === anoAtual ? "/dashboard" : `/dashboard?ano=${a}`}>{a}</Chip>
          ))}
          <BotaoAtualizar />
        </div>
      </div>

      <TickerMercado inicial={{ cotacoes, noticias: noticias.itens }} />

      {/* ── Linha 1: anéis + faturamento + termômetro comercial ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Painel className="flex flex-col items-center text-center">
          <Anel id="meta" valor={vendasAno} max={META_ANUAL_VENDAS} cor1={T.rosa} cor2={T.violeta}>
            <span className="text-2xl font-black leading-none">{vendasAno}</span>
            <span className="text-[10px]" style={{ color: T.mudo }}>/{META_ANUAL_VENDAS}</span>
          </Anel>
          <p className="mt-2 text-[11px] font-black uppercase tracking-widest" style={{ color: T.texto2 }}>Vendas {anoSel}</p>
          <p className="text-[11px]" style={{ color: T.mudo }}>{resumo.kpis.atingimento}% da meta · faltam {faltamVendas}</p>
        </Painel>

        <Painel className="flex flex-col items-center text-center">
          <Anel id="visitas" valor={visitasSemanaAgendadas} max={metaVisitasSemana} cor1={T.ciano} cor2={T.verde}>
            <span className="text-2xl font-black leading-none">{visitasSemanaAgendadas}</span>
            <span className="text-[10px]" style={{ color: T.mudo }}>/{metaVisitasSemana}</span>
          </Anel>
          <p className="mt-2 text-[11px] font-black uppercase tracking-widest" style={{ color: T.texto2 }}>Visitas na semana</p>
          <p className="text-[11px]" style={{ color: T.mudo }}>realizadas (✓) · zera toda segunda</p>
        </Painel>

        <Painel className="flex flex-col items-center text-center">
          <Anel id="negocios" valor={novosNegociosSemana} max={metaNegociosSemana} cor1={T.amarelo} cor2={T.rosa}>
            <span className="text-2xl font-black leading-none">{novosNegociosSemana}</span>
            <span className="text-[10px]" style={{ color: T.mudo }}>/{metaNegociosSemana}</span>
          </Anel>
          <p className="mt-2 text-[11px] font-black uppercase tracking-widest" style={{ color: T.texto2 }}>Novos negócios</p>
          <p className="text-[11px]" style={{ color: T.mudo }}>na semana (seg–sáb)</p>
        </Painel>

        <Painel className="col-span-2 md:col-span-3 xl:col-span-1" destaque>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest" style={{ color: T.texto2 }}>
            <Wallet size={14} style={{ color: T.verde }} /> Faturamento {anoSel}
          </div>
          <p className="mt-1 text-2xl font-black leading-tight" style={{ background: `linear-gradient(90deg, ${T.verde}, ${T.ciano})`, WebkitBackgroundClip: "text", color: "transparent" }}>
            {formatCurrency(resumo.kpis.faturamento)}
          </p>
          <Delta valor={resumo.kpis.faturamentoDelta} />
          <div className="mt-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest" style={{ color: T.texto2 }}>
            <Receipt size={14} style={{ color: T.amarelo }} /> Ticket médio
          </div>
          <p className="mt-1 text-xl font-black leading-tight" style={{ background: `linear-gradient(90deg, ${T.amarelo}, ${T.rosa})`, WebkitBackgroundClip: "text", color: "transparent" }}>
            {formatCurrency(resumo.kpis.ticket)}
          </p>
          <Delta valor={resumo.kpis.ticketDelta} />
        </Painel>

        <Painel className="col-span-2 md:col-span-3 xl:col-span-2" titulo="Termômetro comercial" subtitulo="o que está na mesa agora">
          <ul className="space-y-2.5">
            {termometro.map((p) => (
              <li key={p.rotulo}>
                <Link href={p.href} className="flex items-center gap-2 text-xs">
                  <p.icone size={13} style={{ color: p.cor, flexShrink: 0 }} />
                  <span className="w-36 shrink-0 truncate" style={{ color: T.texto2 }}>{p.rotulo}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: T.sobre2 }}>
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (p.valor / maxTermometro) * 100)}%`, background: `linear-gradient(90deg, ${p.cor}, ${p.cor}88)`, boxShadow: `0 0 8px ${p.cor}66` }} />
                  </span>
                  <span className="w-7 text-right font-black" style={{ color: p.cor }}>{p.valor}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Painel>
      </div>

      {/* ── Ritmo para bater a meta (metas e cotas) ── */}
      {ritmo && anoSel === anoAtual && (
        <Painel
          titulo="Ritmo para bater a meta"
          subtitulo={`o que precisa acontecer por semana · taxas dos últimos 12 meses: ${Math.round(ritmo.taxaConversao * 100)}% de conversão, ${ritmo.visitasPorVenda.toFixed(1)} visitas por venda`}
          destaque
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {[
              { rotulo: "Situação", valor: ritmo.situacao === "adiantado" ? "Adiantado" : ritmo.situacao === "atrasado" ? "Atrasado" : "No ritmo", sub: `${ritmo.vendasAno} de ${ritmo.esperadoAteHoje.toFixed(1)} esperadas até hoje`, cor: ritmo.situacao === "atrasado" ? T.rosa : ritmo.situacao === "adiantado" ? T.verde : T.ciano },
              { rotulo: "Mês", valor: `${ritmo.vendasMes}/${Math.ceil(ritmo.metaMes)}`, sub: `faltam ${ritmo.faltamMes} · ${Math.ceil(ritmo.semanasRestantesMes)} sem.`, cor: T.amarelo },
              { rotulo: "Trimestre", valor: `${ritmo.vendasTrimestre}/${Math.ceil(ritmo.metaTrimestre)}`, sub: "máquinas faturadas", cor: T.violeta },
              { rotulo: "Vendas/semana", valor: ritmo.vendasPorSemanaNecessarias.toFixed(1), sub: "necessárias até dez", cor: T.rosa },
              { rotulo: "Visitas/semana", valor: `${ritmo.visitasSemana}/${Math.ceil(ritmo.visitasPorSemanaNecessarias)}`, sub: "feitas / necessárias", cor: T.ciano },
              { rotulo: "Negociações/semana", valor: `${ritmo.negociacoesSemana}/${Math.ceil(ritmo.negociacoesPorSemanaNecessarias)}`, sub: "novas / necessárias", cor: T.verde },
            ].map((k) => (
              <div key={k.rotulo} className="rounded-xl p-3" style={{ background: T.sobre, border: `1px solid ${T.borda}` }}>
                <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.mudo }}>{k.rotulo}</div>
                <div className="mt-1 text-xl font-black leading-none" style={{ color: k.cor }}>{k.valor}</div>
                <div className="mt-1 text-[11px]" style={{ color: T.texto2 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: T.texto2 }}>
            {ritmo.resumo} No ritmo atual, o ano fecha com <b style={{ color: T.texto }}>{ritmo.previsaoAno}</b> máquina(s).
          </p>
        </Painel>
      )}

      {/* ── Clientes conversados no WhatsApp (mesma régua do Orientador) ── */}
      <Painel titulo="Clientes conversados no WhatsApp" subtitulo="clientes cadastrados com conversa em cada janela · clique para abrir no Orientador de Vendas">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {periodosConversados.map(([k, p], i) => (
            <Link key={k} href={`/orientador?periodo=${k}`} className="rounded-xl p-3 text-center transition hover:brightness-110" style={{ background: T.sobre, border: `1px solid ${T.borda}` }}>
              <div className="flex items-center justify-center gap-1 text-2xl font-black" style={{ color: coresConversados[i] }}>
                <Users size={16} /> {conversados[k]}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold" style={{ color: T.texto2 }}>{p.label}</div>
            </Link>
          ))}
        </div>
      </Painel>

      {/* ── Linha 2: evolução + ticket por ano ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Painel className="lg:col-span-2" titulo="Evolução de vendas" subtitulo={`faturamento por mês em ${anoSel} · linha cheia = vendas · tracejado = meta mensal (${resumo.metaMensal.toFixed(1)})`}>
          <GraficoEvolucao dados={resumo.porMes} metaMensal={resumo.metaMensal} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: T.mudo }}>
            <span><TrendingUp size={11} className="mr-1 inline" style={{ color: T.verde }} />Ritmo: <b style={{ color: T.texto }}>{ritmoMensal}</b> vendas/mês</span>
            <span>Necessário até dez: <b style={{ color: T.texto }}>{mediaNecessariaPorMes}</b>/mês</span>
            <span>{diasRestantesAno} dias restantes no ano</span>
          </div>
        </Painel>
        <Painel titulo="Ticket médio por ano" subtitulo="valor médio por máquina faturada">
          <GraficoTicketPorAno dados={resumo.ticketPorAno} />
        </Painel>
      </div>

      {/* ── Linha 3: mapa do ES + linhas/cidades ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Painel className="lg:col-span-2" titulo="Vendas por cidade — Espírito Santo" subtitulo="cifrão = cidade com máquina faturada (município do cadastro do cliente); atualiza sozinho">
          <MapaVendasWrapper pontosIniciais={resumo.pontosMapa} pontosTudoIniciais={resumo.pontosMapaTudo} ano={anoSel} />
        </Painel>
        <div className="grid grid-cols-1 gap-3">
          <Painel titulo="Vendas por linha" subtitulo={`New Holland × Dynapac em ${anoSel}`}>
            <GraficoDonut dados={resumo.porMarca} />
          </Painel>
          <Painel titulo="Cidades que mais compram" subtitulo={`máquinas faturadas em ${anoSel}`}>
            <GraficoBarrasHorizontais dados={cidadesTop} />
          </Painel>
        </div>
      </div>

      {/* ── Linha 4: ranking + modelos + calendário ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Painel className="lg:col-span-2" titulo="Ranking de clientes" subtitulo={`quem mais faturou em ${anoSel}`}>
          {resumo.topClientes.length === 0 ? (
            <p className="text-xs" style={{ color: T.mudo }}>Nenhuma venda faturada em {anoSel} ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-widest" style={{ color: T.mudo }}>
                    <th className="pb-2 pr-2">#</th><th className="pb-2 pr-2">Cliente</th><th className="pb-2 pr-2 text-right">Faturamento</th><th className="pb-2 pr-2 text-right">Qtd</th><th className="pb-2 text-right">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {resumo.topClientes.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: `1px solid ${T.borda}` }}>
                      <td className="py-2 pr-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black"
                          style={{ background: i < 3 ? `linear-gradient(135deg, ${[T.amarelo, T.ciano, T.laranja][i]}, ${T.rosa})` : T.sobre2, color: i < 3 ? "#111" : T.texto2 }}>
                          {i < 3 ? <Trophy size={12} /> : i + 1}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <Link href={`/clientes/${c.id}`} className="font-semibold hover:underline">{c.nome}</Link>
                        {c.cidade && <span className="ml-1 text-[11px]" style={{ color: T.mudo }}><MapPin size={10} className="mr-0.5 inline" />{c.cidade}</span>}
                      </td>
                      <td className="py-2 pr-2 text-right font-black" style={{ color: T.verde }}>{formatCurrency(c.faturamento)}</td>
                      <td className="py-2 pr-2 text-right" style={{ color: T.texto2 }}>{c.qtd}</td>
                      <td className="py-2 text-right" style={{ color: T.texto2 }}>{formatCurrency(c.ticket)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4">
            <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: T.texto2 }}>Modelos mais vendidos</h3>
            <GraficoBarrasHorizontais dados={resumo.porModelo} />
          </div>
        </Painel>
        <Painel titulo="Agenda de visitas" subtitulo={itensAgenda.length ? `${itensAgenda.length} visita(s) no mês · quem e quando` : "dias marcados têm visita"}>
          <CalendarioVisitas ano={anoAtual} mes={hoje.getMonth()} diasComVisita={diasComVisita} hoje={diaHoje} />
          {itensAgenda.length === 0 ? (
            <p className="mt-3 text-xs" style={{ color: T.mudo }}>Nenhuma visita marcada neste mês. Agende em <Link href="/visitas" className="underline">Visitas</Link>.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {Array.from(agendaPorDia.entries()).map(([dia, itens]) => {
                const passado = dia < diaHoje;
                const ehHoje = dia === diaHoje;
                const rotuloDia = itens[0].data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
                return (
                  <div key={dia} className="rounded-xl p-2" style={{ background: T.sobre, opacity: passado ? 0.55 : 1, border: ehHoje ? `1px solid ${T.ciano}` : `1px solid transparent` }}>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest" style={{ color: ehHoje ? T.ciano : T.texto2 }}>
                      <span className="capitalize">{ehHoje ? "Hoje · " : ""}{rotuloDia}</span>
                      <span style={{ color: T.mudo }}>{itens.length} visita{itens.length > 1 ? "s" : ""}</span>
                    </div>
                    <ul className="space-y-1">
                      {itens.map((it, i) => (
                        <li key={it.chave} className="flex items-start gap-2 text-xs">
                          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black" style={{ background: it.prevista ? T.sobre2 : `linear-gradient(135deg, ${T.rosa}, ${T.violeta})`, color: it.prevista ? T.texto2 : "#111" }}>{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <Link href={`/clientes/${it.clienteId}`} className="block truncate font-semibold hover:underline">{it.nome}</Link>
                            <div className="truncate text-[11px]" style={{ color: T.mudo }}>
                              {[it.data.getHours() || it.data.getMinutes() ? it.data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null, it.local, it.obs, it.prevista ? "prevista" : null].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Painel>
      </div>

      <FraseMotivacional />

      <NoticiasSetor />

      {/* ── Operacional (Top 5, 30+ dias sem contato e negócios sem visita
            moraram aqui; agora ficam na Central de alertas) ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {futurosNaHora.length > 0 && (
          <Painel titulo="Chegou a hora — interesse futuro">
            <Lista>
              {futurosNaHora.map((f) => (
                <Linha key={f.id} href={"/clientes/" + f.id} esquerda={<Bell size={16} style={{ color: T.violeta }} />}
                  titulo={f.nome} sub={f.interesseFuturoNota ?? "Interesse futuro"}
                  direita={f.interesseFuturoData ? new Date(f.interesseFuturoData).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Em breve"} />
              ))}
            </Lista>
          </Painel>
        )}

        <Painel titulo="Pendências do dia" subtitulo="top 5 para atacar, 30+ dias sem contato e negócios sem visita">
          <p className="text-sm" style={{ color: T.texto2 }}>
            Essas listas agora vivem na <Link href="/alertas" className="font-bold underline" style={{ color: T.ciano }}>Central de alertas</Link>, junto com tudo o que pede a sua ação.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/alertas?grupo=atacar" className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: T.sobre2, color: T.texto }}>Top 5 para atacar</Link>
            <Link href="/alertas?grupo=semcontato" className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: T.sobre2, color: T.texto }}>30+ dias sem contato</Link>
            <Link href="/alertas?grupo=visitar" className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: T.sobre2, color: T.texto }}>Negócios sem visita</Link>
          </div>
        </Painel>
      </div>
    </div>
  );
}

// ── Componentes internos ───────────────────────────────────────────────────────

function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-1.5">{children}</ul>;
}

function Linha({ href, esquerda, titulo, sub, direita }: { href: string; esquerda: React.ReactNode; titulo: string; sub?: string; direita?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 transition active:opacity-70" style={{ background: T.sobre }}>
        <span className="shrink-0">{esquerda}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{titulo}</p>
          {sub && <p className="truncate text-xs" style={{ color: T.mudo }}>{sub}</p>}
        </div>
        {direita ? <span className="text-xs font-bold" style={{ color: T.texto2 }}>{direita}</span> : <ArrowRight size={14} style={{ color: T.mudo }} />}
      </Link>
    </li>
  );
}
