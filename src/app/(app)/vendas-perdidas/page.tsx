import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { SeletorAno } from "@/components/SeletorAno";
import { anosParaSeletor, anoPlausivel } from "@/lib/anos-seletor";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MOTIVOS_PERDA, rotuloMotivoPerda } from "@/lib/pipeline";
import { TrendingDown, Hash, Calculator, AlertTriangle, ChevronRight } from "lucide-react";
import { PerdasSemMotivo, type PerdaSemMotivo } from "@/components/PerdasSemMotivo";

export const dynamic = "force-dynamic";

// VENDAS PERDIDAS — fora do funil, de propósito.
//
// "a coluna vendas perdida vamos deixar ela em uma sessão separada no crm"
//
// Perdida não é fase de venda: é material de análise. No quadro ela só ocupava
// espaço e puxava o olho para o que não vai acontecer. Aqui o histórico inteiro
// (quanto escapou, por quê, em que máquina) vira coisa que dá para estudar.
//
// A lista fica em quadro que rola por dentro, com altura travada: ele usa o CRM
// no celular, e lista longa dentro de card estica a página até o rodapé sumir.
const quadroRolagem = "min-h-0 max-h-[52vh] overflow-y-auto pr-1";

export default async function VendasPerdidasPage({
  searchParams,
}: {
  searchParams: { ano?: string; motivo?: string };
}) {
  const anoAtual = new Date().getFullYear();
  const anoSelecionado: number | "todos" =
    searchParams.ano === "todos"
      ? "todos"
      : (() => {
          const a = Number(searchParams.ano);
          return anoPlausivel(a, anoAtual) ? a : anoAtual;
        })();

  const todas = await db.negociacao.findMany({
    where: { status: "perdida" },
    orderBy: { atualizadoEm: "desc" },
    include: { cliente: { select: { id: true, nome: true, municipio: { select: { nome: true } } } } },
  });

  const anosDisponiveis = anosParaSeletor(anoAtual, todas.map((n) => n.atualizadoEm));
  const doAno = anoSelecionado === "todos" ? todas : todas.filter((n) => n.atualizadoEm.getFullYear() === anoSelecionado);

  // O motivo é gravado como "id" ou "id: nota livre" — a chave é sempre o id.
  const chaveMotivo = (m: string | null) => (m ?? "").split(":")[0].trim() || "nao_informado";
  const filtradas = searchParams.motivo ? doAno.filter((n) => chaveMotivo(n.motivoPerda) === searchParams.motivo) : doAno;

  const total = doAno.reduce((s, n) => s + (n.valor ?? 0), 0);
  const comValor = doAno.filter((n) => (n.valor ?? 0) > 0);
  const ticket = comValor.length ? Math.round(total / comValor.length) : 0;

  // "se não tiver uma justificativa o sistema tem que acusar quais não
  // tiveram justificativa". Vale tanto para o campo vazio quanto para o que
  // tem só os dois-pontos e a nota, sem a chave do motivo — os dois acabam no
  // ranking como "Não informado" e não ensinam nada.
  const semMotivo: PerdaSemMotivo[] = doAno
    .filter((n) => chaveMotivo(n.motivoPerda) === "nao_informado")
    .map((n) => ({
      id: n.id,
      cliente: n.cliente.nome,
      maquina: n.maquinaModelo,
      valor: n.valor ?? 0,
      quando: n.atualizadoEm.toISOString(),
    }));

  // Quanto escapou por motivo, do que mais dói para o que menos dói.
  const porMotivo = new Map<string, { qtd: number; valor: number }>();
  for (const n of doAno) {
    const k = chaveMotivo(n.motivoPerda);
    const a = porMotivo.get(k) ?? { qtd: 0, valor: 0 };
    porMotivo.set(k, { qtd: a.qtd + 1, valor: a.valor + (n.valor ?? 0) });
  }
  const ranking = [...porMotivo.entries()]
    .map(([id, v]) => ({
      id,
      label: id === "nao_informado" ? "Não informado" : MOTIVOS_PERDA.find((m) => m.id === id)?.label ?? id,
      ...v,
    }))
    .sort((a, b) => b.valor - a.valor || b.qtd - a.qtd);
  const maiorValor = ranking[0]?.valor ?? 0;

  // Em que máquina a gente mais perde.
  const porMaquina = new Map<string, { qtd: number; valor: number }>();
  for (const n of doAno) {
    const k = n.maquinaModelo?.trim() || "Sem máquina definida";
    const a = porMaquina.get(k) ?? { qtd: 0, valor: 0 };
    porMaquina.set(k, { qtd: a.qtd + 1, valor: a.valor + (n.valor ?? 0) });
  }
  const maquinas = [...porMaquina.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.valor - a.valor || b.qtd - a.qtd)
    .slice(0, 6);

  const periodo = anoSelecionado === "todos" ? "em todo o histórico" : `em ${anoSelecionado}`;
  const qs = (m: string | null) => {
    const p = new URLSearchParams();
    if (searchParams.ano) p.set("ano", searchParams.ano);
    if (m) p.set("motivo", m);
    const s = p.toString();
    return s ? `/vendas-perdidas?${s}` : "/vendas-perdidas";
  };

  return (
    <div>
      <PageHeader
        titulo="Vendas Perdidas"
        subtitulo={`O que escapou ${periodo}, e por quê. Saiu do funil porque perdida não é fase de venda — é coisa de estudar.`}
        acao={<SeletorAno basePath="/vendas-perdidas" anoSelecionado={anoSelecionado} anosDisponiveis={anosDisponiveis} />}
      />

      <PerdasSemMotivo perdas={semMotivo} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icone={<TrendingDown size={18} />} rotulo="Valor perdido" valor={formatCurrency(total)} sub={`${doAno.length} negociação(ões)`} tom="perda" />
        <Kpi icone={<Hash size={18} />} rotulo="Negociações" valor={String(doAno.length)} sub={periodo} />
        <Kpi icone={<Calculator size={18} />} rotulo="Ticket médio" valor={formatCurrency(ticket)} sub={`${comValor.length} com valor lançado`} />
        <Kpi
          tom="motivo"
          icone={<AlertTriangle size={18} />}
          rotulo="Mais perde por"
          valor={ranking[0]?.label ?? "—"}
          sub={ranking[0] ? `${formatCurrency(ranking[0].valor)} · ${ranking[0].qtd}×` : "sem registro"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Por que escapou</h2>
          <p className="mb-3 text-xs text-slate-500">Ordenado pelo que mais custou. Toque para ver só essas.</p>
          {ranking.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhuma venda perdida {periodo}.</p>
          ) : (
            <div className={quadroRolagem}>
              <ul className="space-y-2">
                {ranking.map((m) => {
                  const ativo = searchParams.motivo === m.id;
                  return (
                    <li key={m.id}>
                      <Link
                        href={qs(ativo ? null : m.id)}
                        className={`block rounded-xl border px-3 py-2 transition-colors ${ativo ? "border-red-300 bg-red-50" : "border-slate-200 hover:bg-slate-50"}`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-800">{m.label}</span>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700">{formatCurrency(m.valor)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-red-400"
                            style={{ width: `${maiorValor ? Math.max(4, (m.valor / maiorValor) * 100) : 4}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{m.qtd} negociação(ões)</div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">Em que máquina</h2>
          <p className="mb-3 text-xs text-slate-500">Onde o dinheiro escapa com mais frequência.</p>
          {maquinas.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Sem máquina registrada nas perdas {periodo}.</p>
          ) : (
            <div className={quadroRolagem}>
              <ul className="space-y-2">
                {maquinas.map((m) => (
                  <li key={m.nome} className="flex items-baseline justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{m.nome}</span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold tabular-nums text-slate-700">{formatCurrency(m.valor)}</span>
                      <span className="block text-[11px] text-slate-500">{m.qtd}×</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4 flex flex-col">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {searchParams.motivo ? `Perdidas por ${rotuloMotivoPerda(searchParams.motivo)}` : "Todas as perdidas"}
          </h2>
          {searchParams.motivo && (
            <Link href={qs(null)} className="text-xs font-semibold text-red-600 hover:underline">
              tirar o filtro
            </Link>
          )}
        </div>
        {filtradas.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nada aqui {periodo}.</p>
        ) : (
          <div className={quadroRolagem}>
            <ul className="space-y-2">
              {filtradas.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/clientes/${n.cliente.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-800">{n.cliente.nome}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        {n.cliente.municipio?.nome && <span>{n.cliente.municipio.nome}</span>}
                        {n.maquinaModelo && <span className="font-semibold text-slate-600">{n.maquinaModelo}</span>}
                        <span>{formatDate(n.atualizadoEm)}</span>
                      </div>
                      {chaveMotivo(n.motivoPerda) === "nao_informado" ? (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">
                          <AlertTriangle size={10} /> Sem justificativa
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-red-600">{rotuloMotivoPerda(n.motivoPerda)}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700">{formatCurrency(n.valor ?? 0)}</span>
                    <ChevronRight size={15} className="shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  icone,
  rotulo,
  valor,
  sub,
  tom,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  sub?: string;
  tom?: "perda" | "motivo";
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${tom === "perda" ? "border-red-100 bg-red-50" : "border-slate-100 bg-white"}`}>
      <div className={`w-fit rounded-xl p-2 ${tom === "perda" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"}`}>{icone}</div>
      {/* Sem truncate: "Crédito negado ou financiamento não saiu" é um motivo
          real e longo, e cortado com reticências não diz nada. Duas linhas. */}
      <div className={`mt-2 font-bold text-slate-800 ${tom === "motivo" ? "text-sm leading-snug" : "truncate text-lg tabular-nums sm:text-xl"}`}>{valor}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{rotulo}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
