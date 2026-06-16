import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { diasDesde, formatDateTime } from "@/lib/utils";
import { Route, MapPin, Calendar } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RoteiroPage() {
  // Clientes com negociação aberta, agrupados por município (rota sugerida).
  const negs = await db.negociacao.findMany({
    where: { status: "aberta" },
    include: { cliente: { include: { municipio: true } } },
    orderBy: { ultimoContato: "asc" },
  });

  const grupos = new Map<string, typeof negs>();
  for (const n of negs) {
    const muni = n.cliente.municipio?.nome ?? "Sem município";
    if (!grupos.has(muni)) grupos.set(muni, []);
    grupos.get(muni)!.push(n);
  }
  // ordena municípios por quantidade de pendências (mais denso primeiro = menos estrada)
  const ordenados = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div>
      <PageHeader
        titulo="Roteiro de visitas"
        subtitulo="Clientes agrupados por município para você otimizar a rota e gastar menos estrada"
      />

      {ordenados.length === 0 ? (
        <Card><p className="text-sm text-slate-400">Sem negociações abertas para roteirizar.</p></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ordenados.map(([muni, lista]) => (
            <Card key={muni}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-700">
                  <MapPin size={18} className="text-brand-600" /> {muni}
                </div>
                <Badge tom="blue">{lista.length} parada(s)</Badge>
              </div>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(muni + ", ES")}`}
                target="_blank"
                className="mb-3 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
              >
                <Route size={13} /> Abrir no Google Maps
              </a>
              <ul className="space-y-2">
                {lista.map((n) => (
                  <li key={n.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <Link href={`/clientes/${n.clienteId}`} className="text-sm font-medium text-slate-700 hover:text-brand-600">
                        {n.cliente.nome}
                      </Link>
                      {n.cliente.visitado ? <Badge tom="green">visitado</Badge> : <Badge tom="yellow">visitar</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">
                      {n.maquinaModelo ?? "máquina a definir"} · {diasDesde(n.ultimoContato)}d sem contato
                    </p>
                    {n.dataVisita && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-brand-700">
                        <Calendar size={12} /> Visita: {formatDateTime(n.dataVisita)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
