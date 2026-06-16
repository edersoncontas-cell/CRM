import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calcularFinanciamento, anualParaMensal, LINHAS_CREDITO } from "@/lib/finance";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { Tractor } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PropostaPage({ params }: { params: { id: string } }) {
  const neg = await db.negociacao.findUnique({
    where: { id: params.id },
    include: { cliente: { include: { municipio: true } } },
  });
  if (!neg) notFound();

  const valor = neg.valor ?? 0;
  const entrada = Math.round(valor * 0.2);
  const linha = LINHAS_CREDITO[0];
  const fin = valor
    ? calcularFinanciamento(valor, entrada, anualParaMensal(linha.taxaAnual), 60)
    : null;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-slate-800 print:p-0">
      <div className="mb-6 flex items-center justify-between border-b-2 border-brand-600 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-600 p-2 text-white">
            <Tractor size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-800">Proposta Comercial</h1>
            <p className="text-sm text-slate-500">Máquinas New Holland · Sul do ES</p>
          </div>
        </div>
        <div className="text-right text-sm text-slate-500">
          <div>Data: {formatDate(new Date())}</div>
          <div>Proposta nº {neg.id.slice(-6).toUpperCase()}</div>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Cliente</h2>
        <p className="text-lg font-semibold">{neg.cliente.nome}</p>
        <p className="text-sm text-slate-500">
          {neg.cliente.municipio?.nome ?? ""} {neg.cliente.telefone ? `· ${neg.cliente.telefone}` : ""}
        </p>
      </section>

      <section className="mb-6 rounded-xl bg-slate-50 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Máquina</h2>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-brand-800">{neg.maquinaModelo ?? "Máquina a definir"}</p>
            <p className="text-sm text-slate-500">New Holland</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Valor</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(neg.valor)}</p>
          </div>
        </div>
      </section>

      {fin && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Condição sugerida — {linha.nome}
          </h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b"><td className="py-2 text-slate-500">Entrada (20%)</td><td className="py-2 text-right font-medium">{formatCurrency(entrada)}</td></tr>
              <tr className="border-b"><td className="py-2 text-slate-500">Valor financiado</td><td className="py-2 text-right font-medium">{formatCurrency(fin.valorFinanciado)}</td></tr>
              <tr className="border-b"><td className="py-2 text-slate-500">Prazo</td><td className="py-2 text-right font-medium">60 meses</td></tr>
              <tr className="border-b bg-brand-50"><td className="py-2 font-semibold text-brand-800">Parcela mensal</td><td className="py-2 text-right text-lg font-bold text-brand-800">{formatCurrency(fin.parcela)}</td></tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">
            Taxa de referência {linha.taxaAnual}% a.a. ({linha.descricao}). Sujeito à aprovação de crédito.
          </p>
        </section>
      )}

      <section className="mb-8 text-sm text-slate-500">
        <p>✓ Garantia de fábrica New Holland</p>
        <p>✓ Assistência técnica e peças na região</p>
        <p>✓ Proposta válida por 7 dias</p>
      </section>

      <div className="border-t pt-6 text-center text-sm text-slate-400 print:hidden">
        <BotaoImprimir />
      </div>
    </div>
  );
}
