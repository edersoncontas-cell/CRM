import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";
import { FaturadasTable } from "@/components/FaturadasTable";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const TAXA = 0.005;

export default async function FaturadasPage() {
  const negs = await db.negociacao.findMany({
    where: { status: "ganha" },
    include: { cliente: { include: { municipio: true } } },
    orderBy: { faturadoEm: "desc" },
  });

  const total = negs.reduce((s, n) => s + (n.valor ?? 0), 0);
  const comissaoTotal = total * TAXA;

  const linhas = negs.map((n) => ({
    id: n.id,
    clienteId: n.clienteId,
    clienteNome: n.cliente.nome,
    municipio: n.cliente.municipio?.nome ?? null,
    maquina: n.maquinaModelo,
    tipoPagamento: n.tipoPagamento,
    valor: n.valor,
    faturadoEm: (n.faturadoEm ?? n.atualizadoEm).toISOString(),
    mesAnoReferencia: n.mesAnoReferencia,
    comissaoPaga: n.comissaoPaga,
    comissaoPagaMes: n.comissaoPagaMes,
  }));

  return (
    <div>
      <div className="mb-4">
        <Link href="/financeiro" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Voltar ao Financeiro
        </Link>
      </div>
      <PageHeader titulo="Negociações Faturadas" subtitulo={`${negs.length} faturadas · Total: ${formatCurrency(total)} · Comissão: ${formatCurrency(comissaoTotal)}`} />
      <FaturadasTable linhas={linhas} taxa={TAXA} />
    </div>
  );
}
