import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { contarFatosVendedor, MESES_JANELA } from "@/lib/orientador-vendedor-dados";
import { analisarVendedor, passagens, planoDeEstudo, DIAS_PARADA, type Gravidade } from "@/lib/orientador-vendedor";
import { PlanoDeEstudo } from "@/components/PlanoDeEstudo";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { formatCurrency } from "@/lib/utils";
import { UserRound, AlertTriangle, TriangleAlert, CheckCircle2, ArrowRight, Filter } from "lucide-react";

export const dynamic = "force-dynamic";

// COMO VOCÊ VENDE — o Orientador virado para o vendedor.
//
// O Orientador de Vendas olha o CLIENTE: o que responder para aquele cara,
// qual a próxima ação. Esta tela olha para o outro lado do balcão. Por isso
// ela não fica junto: são perguntas diferentes, e misturar as duas faria a
// triagem da manhã ("por quem começo hoje?") competir com uma leitura que se
// faz uma vez por mês, com calma.
//
// A regra que manda aqui: TODO conselho vem com o número que o sustenta, do
// lado. "Você perde por preço" ele discute; "6 das suas 10 perdas foram por
// preço" ele não tem como discutir. Sem o número, viraria horóscopo.
export default async function ComoVoceVendePage() {
  await garantirManutencaoSeNecessario();
  const fatos = await contarFatosVendedor();
  const d = analisarVendedor(fatos);
  const fases = passagens(fatos);
  const plano = planoDeEstudo(d);

  return (
    <div>
      <PageHeader
        titulo="Como você vende"
        subtitulo={`A leitura do seu jeito de vender nos últimos ${MESES_JANELA} meses — onde você trava, o que mais te derruba e o que estudar por causa disso. Tudo sai dos seus números, não de achismo.`}
      />

      {/* ── O perfil ── */}
      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-slate-900 p-2.5 text-agro-400"><UserRound size={20} /></div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Seu perfil hoje</div>
            <h2 className="mt-0.5 text-lg font-bold leading-tight text-slate-900">{d.perfil.titulo}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{d.perfil.descricao}</p>
          </div>
        </div>
      </Card>

      {d.poucosDados ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            Ainda não há negociação encerrada suficiente nos últimos {MESES_JANELA} meses para um diagnóstico honesto.
            Registre as vendas e as perdas (com o motivo) e volte aqui.
          </p>
        </Card>
      ) : (
        <>
          {/* ── Onde você perde no funil ── */}
          <Card className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Onde você perde no funil</h2>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              De cada 100 que entram, quantas passam de cada fase. A conta é de passagem: quem está em Negociação já conta
              como tendo passado por Proposta.
            </p>
            {fases.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Poucas negociações no período para medir passagem de fase.</p>
            ) : (
              <ul className="space-y-3">
                {fases.map((p) => {
                  const ehGargalo = d.gargalo?.de === p.de && d.gargalo?.para === p.para;
                  const pct = Math.round(p.taxa * 100);
                  return (
                    <li key={`${p.de}-${p.para}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                          {p.de} <ArrowRight size={12} className="text-slate-400" /> {p.para}
                          {ehGargalo && (
                            <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                              seu gargalo
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-slate-700">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${ehGargalo ? "bg-red-500" : "bg-slate-400"}`}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">sobre {p.base} negociação(ões)</div>
                    </li>
                  );
                })}
              </ul>
            )}
            {d.taxaGeral !== null && (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <b className="text-slate-800">{Math.round(d.taxaGeral * 100)}%</b> de tudo que entra no seu funil termina faturado
                ({fatos.faturadas} de {fatos.criadas} em {MESES_JANELA} meses).
                {fatos.valorPerdido > 0 && <> Escaparam {formatCurrency(fatos.valorPerdido)} em {fatos.perdidas} perda(s).</>}
              </p>
            )}
          </Card>

          {/* ── Os sinais ── */}
          <Card className="mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">O que os seus números dizem</h2>
            <p className="mb-3 mt-1 text-xs text-slate-500">Do mais urgente para o que já vai bem. Cada leitura vem com o fato que a sustenta.</p>
            <ul className="space-y-2.5">
              {d.sinais.map((s) => (
                <li key={s.id} className={`rounded-xl border p-3 ${CORES[s.gravidade].caixa}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 shrink-0 ${CORES[s.gravidade].icone}`}>{ICONE[s.gravidade]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-800">{s.titulo}</div>
                      <div className={`mt-0.5 text-xs font-semibold tabular-nums ${CORES[s.gravidade].fato}`}>{s.fato}</div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{s.leitura}</p>
                      {s.id === "sem_motivo" && (
                        <Link href="/vendas-perdidas" className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:underline">
                          <Filter size={11} /> Preencher os motivos agora
                        </Link>
                      )}
                      {s.id === "paradas" && (
                        <Link href="/negociacoes" className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:underline">
                          <Filter size={11} /> Ver as negociações paradas há mais de {DIAS_PARADA} dias
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* ── O plano ── */}
          <PlanoDeEstudo modulos={plano.modulos} etapas={plano.etapas} />
        </>
      )}
    </div>
  );
}

const CORES: Record<Gravidade, { caixa: string; icone: string; fato: string }> = {
  critico: { caixa: "border-red-200 bg-red-50", icone: "text-red-600", fato: "text-red-700" },
  atencao: { caixa: "border-amber-200 bg-amber-50", icone: "text-amber-600", fato: "text-amber-800" },
  bom: { caixa: "border-emerald-200 bg-emerald-50", icone: "text-emerald-600", fato: "text-emerald-700" },
};

const ICONE: Record<Gravidade, React.ReactNode> = {
  critico: <AlertTriangle size={15} />,
  atencao: <TriangleAlert size={15} />,
  bom: <CheckCircle2 size={15} />,
};
