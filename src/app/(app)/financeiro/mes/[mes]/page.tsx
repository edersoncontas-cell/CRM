import { ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import MesDetailClient from "./client";
import { lerParametros } from "@/lib/parametros";

const MESES_LABEL: Record<string, string> = {
  janeiro:"Janeiro",fevereiro:"Fevereiro",marco:"Março",abril:"Abril",maio:"Maio",junho:"Junho",
  julho:"Julho",agosto:"Agosto",setembro:"Setembro",outubro:"Outubro",novembro:"Novembro",dezembro:"Dezembro"
};

export default async function MesDetailPage({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params;
  const mesLabel = MESES_LABEL[mes] ?? mes;

  // Buscar negociações faturadas deste mês
  const todas = await db.negociacao.findMany({
    where: { status: "ganha" },
    include: { cliente: { select: { nome: true } } },
    orderBy: { faturadoEm: "desc" },
  });

  const mesesPT: Record<number, string> = {
    0:"janeiro",1:"fevereiro",2:"marco",3:"abril",4:"maio",5:"junho",
    6:"julho",7:"agosto",8:"setembro",9:"outubro",10:"novembro",11:"dezembro"
  };

  // Filtrar pelo mês correto
  const negsFiltradas = todas.filter((n) => {
    if (n.mesAnoReferencia) {
      return n.mesAnoReferencia.startsWith(mes);
    }
    if (n.faturadoEm) {
      const mNum = new Date(n.faturadoEm).getMonth();
      return mesesPT[mNum] === mes;
    }
    return false;
  });

  const serialized = negsFiltradas.map((n) => ({
    id: n.id,
    clienteNome: n.cliente?.nome ?? "—",
    maquina: n.maquinaModelo ?? undefined,
    marca: n.marca ?? undefined,
    valor: n.valor ? Number(n.valor) : undefined,
    tipoPagamento: n.tipoPagamento ?? undefined,
    faturadoEm: n.faturadoEm?.toISOString() ?? undefined,
    mesAnoReferencia: n.mesAnoReferencia ?? undefined,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link href="/financeiro" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Financeiro
        </Link>
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Receita de {mesLabel}</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">{negsFiltradas.length} negociação(ões) faturada(s)</p>
      </div>
      <MesDetailClient negs={serialized} mes={mes} mesLabel={mesLabel} taxa={(await lerParametros()).taxaComissao} />
    </div>
  );
}
