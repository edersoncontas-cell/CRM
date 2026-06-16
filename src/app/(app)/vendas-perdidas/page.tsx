import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TrendingDown } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VendasPerdidasPage() {
  const perdidas = await db.negociacao.findMany({
    where: { status: "perdida" },
    include: { cliente: { include: { municipio: true } } },
    orderBy: { atualizadoEm: "desc" },
  });

  const valorPerdido = perdidas.reduce((s, n) => s + (n.valor ?? 0), 0);

  // Agrupa motivos
  const motivos = new Map<string, number>();
  for (const p of perdidas) {
    const m = p.motivoPerda ?? "Não informado";
    motivos.set(m, (motivos.get(m) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        titulo="Vendas perdidas"
        subtitulo="Aprenda com cada perda para vender mais na próxima"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-red-100 p-2 text-red-600"><TrendingDown /></div>
          <div>
            <div className="text-xs text-slate-500">Total perdidas</div>
            <div className="text-xl font-bold text-slate-800">{perdidas.length}</div>
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Valor não convertido</div>
          <div className="text-xl font-bold text-red-600">{formatCurrency(valorPerdido)}</div>
        </Card>
        <Card>
          <div className="mb-1 text-xs text-slate-500">Principais motivos</div>
          <div className="flex flex-wrap gap-1">
            {[...motivos.entries()].map(([m, n]) => (
              <Badge key={m} tom="red">{m} ({n})</Badge>
            ))}
            {motivos.size === 0 && <span className="text-sm text-slate-400">—</span>}
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        {perdidas.length === 0 && (
          <Card><p className="text-sm text-slate-400">Nenhuma venda perdida registrada. Continue assim! 💪</p></Card>
        )}
        {perdidas.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/clientes/${p.clienteId}`} className="font-semibold text-slate-800 hover:text-brand-600">
                  {p.cliente.nome}
                </Link>
                <p className="text-xs text-slate-500">
                  {p.cliente.municipio?.nome ?? "—"} · {p.maquinaModelo ?? "máquina"} · {formatCurrency(p.valor)}
                </p>
              </div>
              <div className="text-right">
                <Badge tom="red">{p.motivoPerda ?? "Não informado"}</Badge>
                <p className="mt-1 text-xs text-slate-400">{formatDate(p.atualizadoEm)}</p>
              </div>
            </div>
            {p.concorrenteMencionado && (
              <p className="mt-2 text-xs text-amber-600">Perdida para: {p.concorrenteMencionado}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
