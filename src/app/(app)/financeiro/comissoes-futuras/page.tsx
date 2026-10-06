import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { lerParametros } from "@/lib/parametros";
import { comissoesFuturas, ROTULO_PAGAMENTO_COMISSAO, type SituacaoComissao } from "@/lib/comissoes-futuras";

export const dynamic = "force-dynamic";

// Toda venda faturada com a comissão ainda pendente, de qualquer forma de
// pagamento (lib/comissoes-futuras.ts). Antes só entrava CRD PME — e a tela
// mostrava 0 com faturadas pendentes (print dele, 06/10).

const COR_PAGAMENTO: Record<string, string> = {
  crd_pme: "bg-amber-100 text-amber-700",
  financiamento: "bg-blue-100 text-blue-700",
  consorcio: "bg-violet-100 text-violet-700",
};

function Situacao({ s }: { s: SituacaoComissao }) {
  if (s.tipo === "aguardando") {
    return (
      <div>
        <span className="font-semibold text-slate-700">Pendente</span>
        {s.diasPendente != null && <div className="text-xs text-slate-400">faturada há {s.diasPendente} dia{s.diasPendente === 1 ? "" : "s"}</div>}
      </div>
    );
  }
  if (s.tipo === "crd_aguarda_75") {
    return (
      <div>
        <span className="font-bold text-amber-700">Previsão {formatDate(s.previsao)}</span>
        <div className="text-xs text-slate-400">quando 75% estiver pago · {s.meses} mês(es) após o faturamento</div>
      </div>
    );
  }
  if (s.tipo === "crd_75_atingido") {
    return (
      <div>
        <span className="font-bold text-emerald-700">75% pago desde {formatDate(s.previsao)}</span>
        <div className="text-xs text-slate-400">a comissão já pode ser cobrada</div>
      </div>
    );
  }
  return <span className="text-xs text-slate-500">CRD PME sem valor ou data de faturamento</span>;
}

export default async function ComissoesFuturasPage() {
  const TAXA = (await lerParametros()).taxaComissao;
  const negs = await db.negociacao.findMany({
    // Faturada (ganha) e com a comissão ainda não marcada como paga —
    // a mesma marca "Pendente / Paga" de Negociações Faturadas.
    where: { status: "ganha", comissaoPaga: false },
    include: { cliente: { include: { municipio: true } } },
  });

  const dados = comissoesFuturas(negs, TAXA);
  const totalComissao = dados.reduce((s, d) => s + d.comissao, 0);
  const pagamento = (t: string | null) => (t ? ROTULO_PAGAMENTO_COMISSAO[t] ?? t : "—");

  return (
    <div>
      <div className="mb-4">
        <Link href="/financeiro" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Voltar ao Financeiro
        </Link>
      </div>
      <PageHeader
        titulo="Comissões Futuras"
        subtitulo={`${dados.length} venda${dados.length === 1 ? "" : "s"} faturada${dados.length === 1 ? "" : "s"} com a comissão pendente · Total: ${formatCurrency(totalComissao)}`}
      />
      <p className="-mt-4 mb-4 text-xs text-slate-400">
        Sai daqui quando a comissão é marcada como paga em{" "}
        <Link href="/financeiro/faturadas" className="text-brand-600 hover:underline">Negociações Faturadas</Link>.
      </p>

      {dados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          Nenhuma comissão pendente — todas as vendas faturadas estão com a comissão marcada como paga.
        </div>
      ) : (
        <>
          {/* Celular: um cartão por venda. */}
          <ul className="space-y-2 sm:hidden">
            {dados.map((d) => (
              <li key={d.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/clientes/${d.clienteId}`} className="block truncate font-semibold text-slate-800 hover:text-brand-600">{d.cliente.nome}</Link>
                    <div className="truncate text-xs text-slate-500">
                      {d.maquinaModelo ?? "Sem modelo"} · {formatCurrency(d.valor ?? 0)}
                      {d.cliente.municipio?.nome ? ` · ${d.cliente.municipio.nome}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-bold text-amber-700">+{formatCurrency(d.comissao)}</div>
                </div>
                <div className="mt-2 flex items-start justify-between gap-2 text-sm">
                  <Situacao s={d.situacao} />
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${COR_PAGAMENTO[d.tipoPagamento ?? ""] ?? "bg-slate-100 text-slate-600"}`}>{pagamento(d.tipoPagamento)}</span>
                    <div className="mt-1">faturada {formatDate(d.faturadoEm ?? d.atualizadoEm)}</div>
                  </div>
                </div>
              </li>
            ))}
            <li className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 font-bold">
              <span className="text-slate-700">Total</span>
              <span className="text-amber-700">+{formatCurrency(totalComissao)}</span>
            </li>
          </ul>

          {/* PC: tabela. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm sm:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Máquina</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Pagamento</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Valor máquina</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Faturado em</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"><Clock size={12} className="mr-1 inline" />Situação</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dados.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${d.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">{d.cliente.nome}</Link>
                      {d.cliente.municipio?.nome && <div className="text-xs text-slate-400">{d.cliente.municipio.nome}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{d.maquinaModelo ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${COR_PAGAMENTO[d.tipoPagamento ?? ""] ?? "bg-slate-100 text-slate-600"}`}>{pagamento(d.tipoPagamento)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(d.valor ?? 0)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(d.faturadoEm ?? d.atualizadoEm)}</td>
                    <td className="px-4 py-3"><Situacao s={d.situacao} /></td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">+{formatCurrency(d.comissao)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={6} className="px-4 py-3 font-bold text-slate-700">Total de comissões futuras</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">+{formatCurrency(totalComissao)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
