import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { iniciais, diasDesde } from "@/lib/utils";
import { NovoClienteForm } from "@/components/NovoClienteForm";
import { ImportarClientes } from "@/components/ImportarClientes";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { garantirRegioes } from "@/lib/regioes";
import { MapPin, Search } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { municipio?: string; q?: string };
}) {
  const filtro = searchParams.municipio;
  const busca = (searchParams.q ?? "").trim();
  await garantirRegioes();
  const [clientes, municipios] = await Promise.all([
    db.cliente.findMany({
      where: {
        ...(filtro ? { municipioId: filtro } : {}),
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: "insensitive" } },
                { telefone: { contains: busca.replace(/\D/g, "") || busca } },
              ],
            }
          : {}),
      },
      include: { municipio: true, negociacoes: { where: { status: "aberta" } } },
      orderBy: { atualizadoEm: "desc" },
    }),
    db.municipio.findMany({
      include: { _count: { select: { clientes: true } } },
      orderBy: { nome: "asc" },
    }),
  ]);

  const maxClientes = Math.max(1, ...municipios.map((m) => m._count.clientes));

  return (
    <div>
      <PageHeader
        titulo="Clientes"
        subtitulo={`${clientes.length} cliente(s)${filtro ? " neste município" : ""}${busca ? ` para “${busca}”` : ""}`}
        acao={
          <div className="flex gap-2">
            <BotaoAtualizar />
            <ImportarClientes />
            <NovoClienteForm municipios={municipios} />
          </div>
        }
      />

      {/* Busca por nome ou telefone */}
      <form method="GET" className="mb-5 flex gap-2">
        {filtro && <input type="hidden" name="municipio" value={filtro} />}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={busca}
            placeholder="Buscar cliente por nome ou telefone..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
          Buscar
        </button>
        {busca && (
          <Link
            href={filtro ? `/clientes?municipio=${filtro}` : "/clientes"}
            className="flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            Limpar
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Mapa de calor por município */}
        <Card className="lg:col-span-1">
          <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
            <MapPin size={18} className="text-brand-600" /> Mapa de calor
          </div>
          <Link
            href="/clientes"
            className={`mb-2 block rounded px-2 py-1 text-sm ${!filtro ? "bg-brand-50 font-medium text-brand-700" : "text-slate-500 hover:bg-slate-50"}`}
          >
            Todos os municípios
          </Link>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {municipios.map((m) => {
              const intensidade = m._count.clientes / maxClientes;
              return (
                <Link
                  key={m.id}
                  href={`/clientes?municipio=${m.id}`}
                  className={`flex items-center justify-between rounded px-2 py-1 text-sm ${filtro === m.id ? "ring-2 ring-brand-300" : ""}`}
                  style={{
                    backgroundColor: `rgba(26, 99, 245, ${0.06 + intensidade * 0.65})`,
                    color: intensidade > 0.5 ? "white" : undefined,
                  }}
                >
                  <span className="truncate text-sm">{m.nome}</span>
                  <span className="ml-2 text-xs font-bold">{m._count.clientes}</span>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Lista de clientes */}
        <div className="lg:col-span-3">
          {clientes.length === 0 ? (
            <Card>
              <p className="text-center text-sm text-slate-400">
                Nenhum cliente ainda. Cadastre o primeiro! 🚜
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {clientes.map((c) => {
                const neg = c.negociacoes[0];
                const dias = neg ? diasDesde(neg.ultimoContato) : null;
                return (
                  <Link key={c.id} href={`/clientes/${c.id}`}>
                    <Card className="cursor-pointer transition-all hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-700">
                          {iniciais(c.nome)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-base font-bold text-slate-900">{c.nome}</span>
                            {c.jaComprou && <Badge tom="green">✓ cliente</Badge>}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {c.municipio?.nome ?? "Sem município"} · {c.telefone ?? "sem telefone"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {neg?.maquinaModelo && <Badge tom="blue">{neg.maquinaModelo}</Badge>}
                            {c.visitado ? (
                              <Badge tom="emerald">visitado</Badge>
                            ) : (
                              <Badge tom="slate">não visitado</Badge>
                            )}
                            {dias != null && dias >= 7 && (
                              <Badge tom="red">{dias}d sem contato</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
