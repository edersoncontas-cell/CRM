import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { CalculadoraCustoHora } from "@/components/CalculadoraCustoHora";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Calculadora avulsa de custo por hora e TCO — a mesma conta da proposta,
// sem precisar de negociação aberta (para usar na visita, no balcão, no
// telefone). Para gerar a proposta em PDF, abra pela negociação no funil.
export default async function CalculadoraPage() {
  const abertas = await db.negociacao.findMany({
    where: { status: "aberta" },
    orderBy: { atualizadoEm: "desc" },
    take: 30,
    select: { id: true, maquinaModelo: true, cliente: { select: { nome: true } } },
  });
  return (
    <div>
      <PageHeader
        titulo="Calculadora de custo por hora e TCO"
        subtitulo="Máquina atual × máquina nova × concorrente, com os números do cliente. Para transformar em proposta de uma página, abra a calculadora pela negociação no funil."
      />
      {abertas.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
          <span className="font-semibold text-slate-700">Ir para a proposta de uma negociação aberta:</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {abertas.map((n) => (
              <Link key={n.id} href={`/negociacoes/${n.id}/proposta`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-agro-400/30">
                {n.cliente.nome}{n.maquinaModelo ? ` · ${n.maquinaModelo}` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}
      <CalculadoraCustoHora />
    </div>
  );
}
