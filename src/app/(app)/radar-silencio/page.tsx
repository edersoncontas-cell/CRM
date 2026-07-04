import { db } from "@/lib/db";
import { diasDesde } from "@/lib/utils";
import Link from "next/link";
import { Radar, ArrowRight, Phone } from "lucide-react";

export const dynamic = "force-dynamic";

// Radar de Silêncio (Fase 5.4): linha do tempo de "clientes que sumiram" —
// tiveram contato antes, mas estão silenciosos há 15+ dias — ordenada pelo
// leadScore (o mesmo score recalculado pelo ZEUS a cada tick), do mais frio
// para o menos frio. Serve para reativação de carteira: quem já demonstrou
// interesse (ou já comprou) e esfriou merece um contato antes de virar perda.
const DIAS_SILENCIO = 15;

export default async function RadarSilencioPage() {
  const corte = new Date(Date.now() - DIAS_SILENCIO * 24 * 60 * 60 * 1000);

  const clientes = await db.cliente.findMany({
    where: {
      ultimoContato: { not: null, lt: corte },
      status: { not: "nao_cliente" },
    },
    orderBy: [{ leadScore: "asc" }, { ultimoContato: "asc" }],
    take: 60,
    select: {
      id: true, nome: true, telefone: true, leadScore: true, ultimoContato: true,
      jaComprou: true, municipio: { select: { nome: true } },
      negociacoes: { where: { status: "aberta" }, take: 1, select: { maquinaModelo: true, valor: true } },
    },
  });

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)" }}>
          <Radar size={24} style={{ color: "#60a5fa" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Radar de Silêncio</h1>
          <p className="text-xs text-zinc-500">Clientes que sumiram (15+ dias sem contato) · ordenado do mais frio para o menos frio · reativação de carteira</p>
        </div>
      </div>

      {clientes.length === 0 ? (
        <div className="rounded-2xl p-6 text-center text-sm text-zinc-500" style={{ background: "#18181b", border: "1px solid #27272a" }}>
          Ninguém sumiu — toda a carteira teve contato nos últimos {DIAS_SILENCIO} dias. 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {clientes.map((c) => {
            const dias = diasDesde(c.ultimoContato);
            const neg = c.negociacoes[0];
            return (
              <Link
                key={c.id}
                href={"/clientes/" + c.id}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70"
                style={{ background: "#18181b", border: "1px solid #27272a" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black"
                  style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
                  title="Lead score atual"
                >
                  {c.leadScore}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
                    {c.nome}
                    {c.jaComprou && <span className="text-[10px] font-bold text-green-400">· já é cliente</span>}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {dias}d sem contato{c.municipio ? ` · ${c.municipio.nome}` : ""}
                    {neg ? ` · ${neg.maquinaModelo ?? "negociação aberta"}` : ""}
                  </p>
                </div>
                {c.telefone && (
                  <span className="flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                    <Phone size={12} /> {c.telefone}
                  </span>
                )}
                <ArrowRight size={14} className="text-zinc-600 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
