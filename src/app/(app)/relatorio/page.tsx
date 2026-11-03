import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { GRUPOS } from "@/lib/menu";
import { calcularRitmoMetas, type RitmoMetas } from "@/lib/metas";
import { lerParametros } from "@/lib/parametros";
import { ROTULO_ENVIO_MASSA } from "@/lib/piloto-regra";
import { limparErro } from "@/lib/erro-legivel";
import {
  resumirUso, sugerir, sinalMeta, fracaoSemana, fracaoSemanaUtil, fracaoMes, diaHoraBrasilia, somarDias, duracaoPorExtenso,
  type ResumoUso, type Sinal, type MetaParaSugestao, type Sugestao,
} from "@/lib/uso-regra";
import { AlertTriangle, BarChart3, Clock, LogIn, Monitor, Smartphone, Target, Lightbulb, EyeOff, Zap, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

// RELATÓRIO DE USO (03/11).
//
//   "mostrar as sessões que estão sendo usadas, as que não estão, quais eu
//    preciso melhorar, com metas, quantas vezes entrei no CRM no dia, na
//    semana, no mês"
//
// Três perguntas, nesta ordem na tela:
//   1. Quanto eu uso o CRM?            → entradas e tempo (dia, semana, mês)
//   2. Estou batendo as metas?         → as metas que já existem em
//                                        Configurações + dias no CRM na semana
//   3. O que sobra e o que falta?      → telas por uso, com o resultado de cada
//                                        uma, e as sugestões
//
// A contagem começa no dia em que isto foi instalado — não há como saber o
// uso de antes. A tela diz desde quando conta.

const JANELA_DIAS = 60;
const quadroRolagem = "max-h-80 overflow-y-auto pr-1";

const COR_SINAL: Record<Sinal, string> = { verde: "bg-emerald-500", amarelo: "bg-amber-400", vermelho: "bg-red-500" };
const TEXTO_SINAL: Record<Sinal, string> = { verde: "no ritmo", amarelo: "um pouco atrás", vermelho: "abaixo do ritmo" };

const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

export default async function RelatorioPage() {
  const hoje = diaHoraBrasilia(Date.now()).dia;
  const menu = GRUPOS.flatMap((g) => g.links.map((l) => ({ href: l.href, label: l.label, fixo: l.fixo })));
  const desde30 = new Date(Date.now() - 30 * 86_400_000);

  const [uso, ritmo, params, resultados] = await Promise.allSettled([
    (async () => {
      const [linhas, limites] = await Promise.all([
        db.usoTela.findMany({ where: { dia: { gte: somarDias(hoje, -(JANELA_DIAS - 1)) } } }),
        db.usoTela.aggregate({ _min: { dia: true }, _max: { dia: true } }),
      ]);
      const ultimoDia = limites._max.dia;
      const ultimaHora = ultimoDia ? Math.max(-1, ...linhas.filter((l) => l.dia === ultimoDia).map((l) => l.hora)) : -1;
      return { resumo: resumirUso(linhas, hoje, menu, limites._min.dia), ultimoDia, ultimaHora };
    })(),
    calcularRitmoMetas(),
    lerParametros(),
    // O que cada tela PRODUZIU nos últimos 30 dias — uso sem resultado é
    // tela que dá trabalho e não paga; resultado sem uso é tela que o
    // vendedor faz por outro caminho.
    Promise.all([
      db.visita.count({ where: { status: "realizada", data: { gte: desde30 } } }),
      db.negociacao.count({ where: { criadoEm: { gte: desde30 } } }),
      db.whatsAppMessage.count({ where: { operatorDisplayName: ROTULO_ENVIO_MASSA, isDraft: false, sentAt: { gte: desde30 } } }),
      db.cliente.count({ where: { criadoEm: { gte: desde30 } } }),
    ]),
  ]);

  const resultadoPorTela: Record<string, string> = {};
  if (resultados.status === "fulfilled") {
    const [visitas, negociacoes, envios, clientes] = resultados.value;
    resultadoPorTela["/visitas"] = `${visitas} visita(s) realizada(s)`;
    resultadoPorTela["/negociacoes"] = `${negociacoes} negociação(ões) nova(s)`;
    resultadoPorTela["/marketing"] = `${envios} mensagem(ns) de campanha`;
    resultadoPorTela["/clientes"] = `${clientes} cliente(s) novo(s)`;
  }

  const metas: (MetaParaSugestao & { sub: string })[] = [];
  if (uso.status === "fulfilled" && params.status === "fulfilled") {
    const meta = params.value.metaDiasUsoSemana;
    const v = uso.value.resumo.diasComUsoSemana;
    metas.push({ rotulo: "Dias no CRM nesta semana", valor: v, meta, sinal: sinalMeta(v, meta, fracaoSemana(hoje)), href: "/relatorio", sub: "dias com qualquer tela aberta (seg–dom)", dica: "Entrar todo dia, nem que seja para ver os alertas, é o que segura o acompanhamento." });
  }
  if (ritmo.status === "fulfilled") {
    const r: RitmoMetas = ritmo.value;
    const mesMeta = Math.max(1, Math.ceil(r.metaMes));
    metas.push(
      { rotulo: "Visitas realizadas na semana", valor: r.visitasSemana, meta: r.metaVisitasSemana, sinal: sinalMeta(r.visitasSemana, r.metaVisitasSemana, fracaoSemanaUtil(hoje)), href: "/visitas", sub: "confirmadas com o ✓ em Visitas", dica: "Marque as realizadas com o ✓ — visita feita e não marcada não conta." },
      { rotulo: "Negociações novas na semana", valor: r.negociacoesSemana, meta: r.metaNegociosSemana, sinal: sinalMeta(r.negociacoesSemana, r.metaNegociosSemana, fracaoSemanaUtil(hoje)), href: "/negociacoes", sub: "criadas desde segunda", dica: "Cada conversa com interesse de compra vira negociação — é ela que o funil acompanha." },
      { rotulo: "Máquinas faturadas no mês", valor: r.vendasMes, meta: mesMeta, sinal: sinalMeta(r.vendasMes, mesMeta, fracaoMes(hoje)), href: "/dashboard", sub: `meta do ano ÷ 12 (${r.metaAnual} no ano)`, dica: r.resumo },
    );
  }

  const sugestoes: Sugestao[] = uso.status === "fulfilled" ? sugerir(uso.value.resumo, metas) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Relatório de uso"
        subtitulo={
          uso.status === "fulfilled" && uso.value.resumo.inicioContagem
            ? `Contando desde ${diaCurto(uso.value.resumo.inicioContagem)} (${uso.value.resumo.diasDeDados} dia${uso.value.resumo.diasDeDados > 1 ? "s" : ""})${uso.value.ultimoDia ? ` · último registro: ${uso.value.ultimoDia === hoje ? "hoje" : diaCurto(uso.value.ultimoDia)}${uso.value.ultimaHora >= 0 ? ` às ${uso.value.ultimaHora}h` : ""}` : ""}`
            : "Quais telas você usa, quais não, as metas e o que melhorar."
        }
      />

      {uso.status === "rejected" ? (
        <Falha titulo="Não consegui ler a contagem de uso agora." motivo={limparErro(uso.reason)}
          dica="Se o motivo fala de tabela que não existe, a manutenção ainda não criou a do relatório: ela roda sozinha na próxima tela; se não rodar, Configurações → Manutenção mostra o porquê." />
      ) : !uso.value.resumo.inicioContagem ? (
        <Card>
          <div className="flex gap-3">
            <BarChart3 size={20} className="mt-0.5 shrink-0 text-slate-500" />
            <div className="min-w-0 text-sm">
              <div className="font-semibold">A contagem começou agora.</div>
              <p className="mt-1 text-slate-600">
                A partir de hoje o CRM anota cada tela que você abre, quanto tempo fica nela e se é no PC ou no celular — só isso, nada do conteúdo.
                Os primeiros números aparecem aqui em alguns minutos; as sugestões de tela sem uso, com uma semana de dados.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Quanto r={uso.value.resumo} />
      )}

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Target size={16} className="text-slate-500" /> Metas</h2>
          <Link href="/configuracoes" className="text-xs font-semibold text-brand-700 underline">mudar as metas em Configurações</Link>
        </div>
        <p className="mb-3 text-xs text-slate-500">O sinal compara com o que era de esperar até ontem, não com a meta cheia: na quarta, com meta de 20 visitas na semana, o esperado é 8. Verde: em dia · amarelo: até 40% atrás · vermelho: mais que isso.</p>
        {ritmo.status === "rejected" && (
          <p className="mb-2 text-xs text-red-600">Não consegui calcular as metas de venda agora ({limparErro(ritmo.reason).replace(/\.+$/, "")}).</p>
        )}
        {metas.length ? (
          <ul className="divide-y divide-slate-100">
            {metas.map((m) => (
              <li key={m.rotulo} className="flex items-center gap-3 py-2.5">
                <span className={`h-3 w-3 shrink-0 rounded-full ${COR_SINAL[m.sinal]}`} title={TEXTO_SINAL[m.sinal]} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{m.rotulo}</div>
                  <div className="text-[11px] text-slate-500">{m.sub} · {TEXTO_SINAL[m.sinal]}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${COR_SINAL[m.sinal]}`} style={{ width: `${Math.min(100, (m.valor / Math.max(1, m.meta)) * 100)}%` }} />
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm font-bold tabular-nums">{m.valor}<span className="text-xs font-normal text-slate-500">/{m.meta}</span></div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500">Sem metas para mostrar agora.</p>
        )}
      </Card>

      {uso.status === "fulfilled" && uso.value.resumo.inicioContagem && (
        <>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><Lightbulb size={16} className="text-slate-500" /> O que melhorar</h2>
            {sugestoes.length ? (
              <ul className={`space-y-2 ${quadroRolagem}`}>
                {sugestoes.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <IconeSugestao tipo={s.tipo} />
                    <span className="min-w-0 text-slate-700">
                      {s.texto}
                      {s.href && s.href !== "/relatorio" && <> <Link href={s.href} className="whitespace-nowrap text-xs font-semibold text-brand-700 underline">abrir</Link></>}
                      {s.telas && (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {s.telas.map((t) => (
                            <Link key={t.href} href={t.href} className="rounded-md border border-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{t.label}</Link>
                          ))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Nada chamando atenção: as telas do menu estão sendo usadas e as metas estão no ritmo.</p>
            )}
          </Card>

          <Telas r={uso.value.resumo} resultado={resultadoPorTela} resultadosFalharam={resultados.status === "rejected"} />
          <Horarios r={uso.value.resumo} />
        </>
      )}
    </div>
  );
}

function Falha({ titulo, motivo, dica }: { titulo: string; motivo: string; dica: string }) {
  return (
    <Card className="border-red-200">
      <div className="flex gap-3">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
        <div className="min-w-0 text-sm">
          <div className="font-semibold text-red-700">{titulo}</div>
          <p className="mt-1 break-words text-slate-600">Motivo: {motivo.replace(/\.+$/, "")}.</p>
          <p className="mt-1 text-slate-500">{dica}</p>
        </div>
      </div>
    </Card>
  );
}

function IconeSugestao({ tipo }: { tipo: Sugestao["tipo"] }) {
  const cls = "mt-0.5 shrink-0";
  if (tipo === "meta") return <Target size={15} className={`${cls} text-red-600`} />;
  if (tipo === "sair" || tipo === "pouco") return <EyeOff size={15} className={`${cls} text-amber-600`} />;
  if (tipo === "rapido") return <Zap size={15} className={`${cls} text-amber-600`} />;
  return <Clock size={15} className={`${cls} text-slate-400`} />;
}

function Quanto({ r }: { r: ResumoUso }) {
  const blocos = [
    { rotulo: "Hoje", entradas: r.entradas.hoje, tempo: r.tempo.hoje },
    { rotulo: "Esta semana", entradas: r.entradas.semana, tempo: r.tempo.semana },
    { rotulo: "Este mês", entradas: r.entradas.mes, tempo: r.tempo.mes },
  ];
  const ap = r.aparelho30;
  const totalAb = ap.pc.aberturas + ap.celular.aberturas;
  const pctCel = totalAb ? Math.round((ap.celular.aberturas / totalAb) * 100) : 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {blocos.map((b) => (
        <Card key={b.rotulo} className="p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{b.rotulo}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <LogIn size={15} className="self-center text-slate-400" />
            <span className="text-2xl font-bold tabular-nums">{b.entradas}</span>
            <span className="text-xs text-slate-500">entrada{b.entradas === 1 ? "" : "s"} no CRM</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-600"><Clock size={13} className="text-slate-400" /> {duracaoPorExtenso(b.tempo)} de tela</div>
        </Card>
      ))}
      <Card className="p-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">PC × celular (30 dias)</div>
        {totalAb ? (
          <>
            <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-sky-500" style={{ width: `${100 - pctCel}%` }} />
              <div className="h-full bg-amber-400" style={{ width: `${pctCel}%` }} />
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-slate-600">
              <div className="flex items-center gap-1.5"><Monitor size={13} className="shrink-0 text-sky-600" /> <span className="font-semibold">PC {100 - pctCel}%</span> <span className="ml-auto whitespace-nowrap">{duracaoPorExtenso(ap.pc.segundos)}</span></div>
              <div className="flex items-center gap-1.5"><Smartphone size={13} className="shrink-0 text-amber-600" /> <span className="font-semibold">Celular {pctCel}%</span> <span className="ml-auto whitespace-nowrap">{duracaoPorExtenso(ap.celular.segundos)}</span></div>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Nenhuma tela aberta nos últimos 30 dias.</p>
        )}
      </Card>
    </div>
  );
}

function Telas({ r, resultado, resultadosFalharam }: { r: ResumoUso; resultado: Record<string, string>; resultadosFalharam: boolean }) {
  const max = Math.max(1, ...r.telas.map((t) => t.aberturas30));
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-sm font-bold"><BarChart3 size={16} className="text-slate-500" /> Telas — últimos 30 dias</h2>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">
        Da mais aberta para a menos. Tempo conta só com a tela à vista e você mexendo (5 min parado, o relógio para).
        {resultadosFalharam && <span className="text-red-600"> Os resultados de cada tela não carregaram agora.</span>}
      </p>
      <ul className={`divide-y divide-slate-100 ${quadroRolagem}`}>
        {r.telas.map((t) => (
          <li key={t.href} className="py-2">
            <div className="flex items-baseline gap-2">
              <Link href={t.href} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                {t.label}{!t.noMenu && <span className="ml-1 text-[11px] font-normal text-slate-400">(fora do menu)</span>}
              </Link>
              <span className="shrink-0 text-sm font-bold tabular-nums">{t.aberturas30}</span>
              <ChevronRight size={14} className="shrink-0 self-center text-slate-300" />
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${t.aberturas30 ? "bg-brand-500" : ""}`} style={{ width: `${(t.aberturas30 / max) * 100}%` }} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
              {t.aberturas30 ? (
                <>
                  <span>{duracaoPorExtenso(t.segundos30)} no total</span>
                  <span>{duracaoPorExtenso(t.mediaSeg)} por vez</span>
                  <span>em {t.dias30} dia{t.dias30 === 1 ? "" : "s"}</span>
                </>
              ) : (
                <span>{t.ultimoUso ? `última vez em ${diaCurto(t.ultimoUso)}` : "não abriu desde o começo da contagem"}</span>
              )}
              {resultado[t.href] && <span className="font-semibold text-slate-600">resultado: {resultado[t.href]}</span>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Horarios({ r }: { r: ResumoUso }) {
  const maxH = Math.max(1, ...r.porHora30);
  const maxD = Math.max(1, ...r.ultimos14.map((d) => d.entradas));
  const algumaHora = r.porHora30.some((n) => n > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="text-sm font-bold">Entradas por dia — últimos 14 dias</h2>
        <div className="mt-3 flex h-28 items-end gap-1">
          {r.ultimos14.map((d) => (
            <div key={d.dia} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${diaCurto(d.dia)}: ${d.entradas} entrada(s), ${duracaoPorExtenso(d.segundos)}`}>
              <span className="text-[10px] tabular-nums text-slate-500">{d.entradas || ""}</span>
              <div className="w-full rounded-t bg-sky-500" style={{ height: `${(d.entradas / maxD) * 72}px`, minHeight: d.entradas ? 3 : 0 }} />
              <span className="text-[9px] text-slate-400">{d.dia.slice(8, 10)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-sm font-bold">Em que hora você usa — 30 dias</h2>
        {algumaHora ? (
          <div className="mt-3 flex h-28 items-end gap-[2px]">
            {r.porHora30.map((n, h) => (
              <div key={h} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${h}h: ${n} abertura(s)`}>
                <div className="w-full rounded-t bg-amber-400" style={{ height: `${(n / maxH) * 84}px`, minHeight: n ? 3 : 0 }} />
                <span className="text-[9px] text-slate-400">{h % 3 === 0 ? h : ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Sem aberturas nos últimos 30 dias.</p>
        )}
      </Card>
    </div>
  );
}
