import { db } from "@/lib/db";
import { diasDesde, saudacaoBrasilia, formatCurrency } from "@/lib/utils";
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
import { carregarVendasFaturadas, resumoVendas, META_ANUAL_VENDAS } from "@/lib/vendas-dashboard";
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
  const inicioDia = new Date(hoje); inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(hoje); fimDia.setHours(23, 59, 59, 999);

  // Semana de segunda a domingo (para os quadros que zeram toda segunda-feira)
  const diaSemanaAtual = hoje.getDay(); // 0=domingo ... 6=sábado
  const deltaSegunda = diaSemanaAtual === 0 ? 6 : diaSemanaAtual - 1;
  const inicioSemanaSegunda = new Date(hoje); inicioSemanaSegunda.setDate(hoje.getDate() - deltaSegunda); inicioSemanaSegunda.setHours(0, 0, 0, 0);
  const fimSemanaDomingo = new Date(inicioSemanaSegunda); fimSemanaDomingo.setDate(inicioSemanaSegunda.getDate() + 7);

  // Janela de segunda a sábado (para o quadro "Novos Negócios", que zera todo domingo)
  const ehDomingoHoje = diaSemanaAtual === 0;
  const fimSemanaSabado = new Date(inicioSemanaSegunda); fimSemanaSabado.setDate(inicioSemanaSegunda.getDate() + 6); fimSemanaSabado.setHours(23, 59, 59, 999);

  const DIAS_SEM_CONTATO = 30;
  const corteSemContato = new Date(hoje);
  corteSemContato.setDate(corteSemContato.getDate() - DIAS_SEM_CONTATO);

  // Calendário do mês corrente
  const inicioMesCal = new Date(anoAtual, hoje.getMonth(), 1);
  const fimMesCal = new Date(anoAtual, hoje.getMonth() + 1, 1);

  const [
    negociacoes, futuros, demandasHoje, proximasVisitas,
    visitasSemanaAgendadas, negociosCriadosSemana,
    clientes30DiasSemContato, colunasFunil,
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
    db.cliente.findMany({
      where: { proximaVisita: { gte: hoje, lte: new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000) } },
      select: { id: true, nome: true, proximaVisita: true, proximaVisitaNota: true, municipio: { select: { nome: true } } },
      orderBy: { proximaVisita: "asc" },
      take: 5,
    }),
    db.visita.count({ where: { data: { gte: inicioSemanaSegunda, lt: fimSemanaDomingo } } }),
    ehDomingoHoje ? Promise.resolve([]) : db.negociacao.findMany({
      where: { criadoEm: { gte: inicioSemanaSegunda, lte: fimSemanaSabado } },
      select: { estagio: true },
    }),
    db.cliente.findMany({
      where: { ultimoContato: { lt: corteSemContato } },
      orderBy: { ultimoContato: "asc" },
      take: 8,
      select: { id: true, nome: true, ultimoContato: true },
    }),
    db.colunaFunil.findMany({ select: { titulo: true } }),
    carregarVendasFaturadas(),
    db.visita.findMany({ where: { data: { gte: inicioMesCal, lt: fimMesCal } }, select: { data: true } }),
    db.cliente.findMany({ where: { proximaVisita: { gte: inicioMesCal, lt: fimMesCal } }, select: { proximaVisita: true } }),
    contarClientesConversados(),
    obterCotacoes(),
    obterNoticias(),
  ]);

  const resumo = resumoVendas(vendasFaturadas, anoSel);
  const categorizarColunaPorTitulo = criarCategorizadorColunas(colunasFunil);

  const novosNegociosSemana = negociosCriadosSemana.filter((n) => {
    const cat = categorizarColunaPorTitulo(n.estagio);
    return cat === "em_negociacao" || cat === "banco";
  }).length;

  const topAtacar = await db.cliente.findMany({
    where: { aguardandoResposta: true, status: { not: "nao_cliente" } },
    orderBy: { leadScore: "desc" },
    take: 5,
    select: {
      id: true, nome: true, leadScore: true, aguardandoResposta: true,
      municipio: { select: { nome: true } },
      negociacoes: { where: { status: "aberta" }, orderBy: { termometro: "desc" }, take: 1, select: { maquinaModelo: true, valor: true, proximaAcao: true } },
    },
  });

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

  const precisamDeVisita = negociacoes
    .filter((n) => {
      const cat = categorizarColunaPorTitulo(n.estagio);
      return (cat === "em_negociacao" || cat === "banco") && !n.dataVisita;
    })
    .sort((a, b) => (a.ultimoContato?.getTime() ?? 0) - (b.ultimoContato?.getTime() ?? 0))
    .slice(0, 6);

  const diasComVisita = new Map<number, number>();
  for (const v of visitasMes) diasComVisita.set(v.data.getDate(), (diasComVisita.get(v.data.getDate()) ?? 0) + 1);
  for (const c of clientesProximaVisitaMes) {
    if (!c.proximaVisita) continue;
    const d = c.proximaVisita.getDate();
    diasComVisita.set(d, (diasComVisita.get(d) ?? 0) + 1);
  }

  const cidadesTop = resumo.pontosMapa.slice(0, 8).map((p) => ({ nome: p.nome, qtd: p.vendas }));

  const termometro = [
    { rotulo: "Em negociação", valor: emNegociacaoCount, cor: T.violeta, icone: Handshake, href: "/negociacoes" },
    { rotulo: "Em banco", valor: emBancoCount, cor: T.ciano, icone: Landmark, href: "/negociacoes" },
    { rotulo: "30+ dias sem contato", valor: clientes30DiasSemContato.length, cor: T.amarelo, icone: Snowflake, href: "/clientes" },
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
          <Anel id="visitas" valor={visitasSemanaAgendadas} max={20} cor1={T.ciano} cor2={T.verde}>
            <span className="text-2xl font-black leading-none">{visitasSemanaAgendadas}</span>
            <span className="text-[10px]" style={{ color: T.mudo }}>/20</span>
          </Anel>
          <p className="mt-2 text-[11px] font-black uppercase tracking-widest" style={{ color: T.texto2 }}>Visitas na semana</p>
          <p className="text-[11px]" style={{ color: T.mudo }}>zera toda segunda</p>
        </Painel>

        <Painel className="flex flex-col items-center text-center">
          <Anel id="negocios" valor={novosNegociosSemana} max={5} cor1={T.amarelo} cor2={T.rosa}>
            <span className="text-2xl font-black leading-none">{novosNegociosSemana}</span>
            <span className="text-[10px]" style={{ color: T.mudo }}>/5</span>
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
                  <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(4, (p.valor / maxTermometro) * 100)}%`, background: `linear-gradient(90deg, ${p.cor}, ${p.cor}88)`, boxShadow: `0 0 8px ${p.cor}66` }} />
                  </span>
                  <span className="w-7 text-right font-black" style={{ color: p.cor }}>{p.valor}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Painel>
      </div>

      {/* ── Clientes conversados no WhatsApp (mesma régua do Orientador) ── */}
      <Painel titulo="Clientes conversados no WhatsApp" subtitulo="clientes cadastrados com conversa em cada janela · clique para abrir no Orientador de Vendas">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {periodosConversados.map(([k, p], i) => (
            <Link key={k} href={`/orientador?periodo=${k}`} className="rounded-xl p-3 text-center transition hover:brightness-110" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.borda}` }}>
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
        <Painel className="lg:col-span-2" titulo="Evolução de vendas" subtitulo={`faturamento por mês em ${anoSel} · linha rosa = vendas · tracejado = meta mensal (${resumo.metaMensal.toFixed(1)})`}>
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
                          style={{ background: i < 3 ? `linear-gradient(135deg, ${[T.amarelo, T.ciano, T.laranja][i]}, ${T.rosa})` : "rgba(255,255,255,0.08)", color: i < 3 ? "#111" : T.texto2 }}>
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
        <Painel titulo="Agenda de visitas" subtitulo="dias marcados têm visita">
          <CalendarioVisitas ano={anoAtual} mes={hoje.getMonth()} diasComVisita={diasComVisita} hoje={hoje.getDate()} />
          {proximasVisitas.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {proximasVisitas.map((v) => (
                <li key={v.id} className="flex items-center gap-2 text-xs">
                  <Calendar size={13} style={{ color: T.ciano, flexShrink: 0 }} />
                  <Link href={`/clientes/${v.id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{v.nome}</Link>
                  <span className="font-black" style={{ color: T.ciano }}>{new Date(v.proximaVisita!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <FraseMotivacional />

      <NoticiasSetor />

      {/* ── Operacional ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {topAtacar.length > 0 && (
          <Painel titulo="Top 5 para atacar hoje" subtitulo="pelo lead score · atendimento em aberto">
            <Lista>
              {topAtacar.map((c) => {
                const neg = c.negociacoes[0];
                return (
                  <Linha key={c.id} href={"/clientes/" + c.id}
                    esquerda={<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black" style={{ background: `linear-gradient(135deg, ${T.rosa}, ${T.violeta})`, color: "#fff" }}>{c.leadScore}</span>}
                    titulo={c.nome}
                    sub={`${neg?.proximaAcao ?? (c.aguardandoResposta ? "Aguardando seu retorno no WhatsApp" : (neg?.maquinaModelo ?? "Definir próxima ação"))}${c.municipio ? ` · ${c.municipio.nome}` : ""}`} />
                );
              })}
            </Lista>
          </Painel>
        )}

        {clientes30DiasSemContato.length > 0 && (
          <Painel titulo="Clientes com 30+ dias sem contato">
            <Lista>
              {clientes30DiasSemContato.map((c) => (
                <Linha key={c.id} href={"/clientes/" + c.id} esquerda={<Snowflake size={16} style={{ color: T.amarelo }} />}
                  titulo={c.nome} sub={c.ultimoContato ? `há ${diasDesde(c.ultimoContato)}d sem contato` : "sem registro de contato"} />
              ))}
            </Lista>
          </Painel>
        )}

        {precisamDeVisita.length > 0 && (
          <Painel titulo="Negócios que precisam de visita">
            <Lista>
              {precisamDeVisita.map((n) => (
                <Linha key={n.id} href="/pipeline" esquerda={<Clock size={16} style={{ color: T.ciano }} />}
                  titulo={n.cliente?.nome ?? "—"} sub={`${n.maquinaModelo ?? "?"} · ${n.proximaAcao ?? "Agendar visita"}`}
                  direita={n.ultimoContato ? `${diasDesde(n.ultimoContato)}d` : ""} />
              ))}
            </Lista>
          </Painel>
        )}

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

        {topAtacar.length === 0 && clientes30DiasSemContato.length === 0 && precisamDeVisita.length === 0 && futurosNaHora.length === 0 && (
          <Painel titulo="Tudo em dia">
            <p className="flex items-center gap-2 text-sm" style={{ color: T.verde }}><Target size={16} /> Nenhuma pendência urgente agora.</p>
          </Painel>
        )}
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
      <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 transition active:opacity-70" style={{ background: "rgba(255,255,255,0.04)" }}>
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
