import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { iniciais, diasDesde } from "@/lib/utils";
import { NovoClienteForm } from "@/components/NovoClienteForm";
import { ImportarClientes } from "@/components/ImportarClientes";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { ClienteAcoes } from "@/components/ClienteAcoes";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { MapPin, Search } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DIAS_ESQUECIDO = 15;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { municipio?: string; q?: string; naoVisitado?: string; visitado?: string };
}) {
  const filtro = searchParams.municipio;
  const busca = (searchParams.q ?? "").trim();
  const apenasNaoVisitados = searchParams.naoVisitado === "1";
  const apenasVisitados = searchParams.visitado === "1";
  await garantirManutencaoSeNecessario();

  const corteEsquecido = new Date();
  corteEsquecido.setDate(corteEsquecido.getDate() - DIAS_ESQUECIDO);

  const [clientes, municipios, maquinas, totalNaoVisitados, totalVisitados, totalClientes] = await Promise.all([
    db.cliente.findMany({
      where: {
        // Prospects sugeridos pela IA (podem ser nomes inventados quando incertos)
        // ficam só na tela de Roteiro/Prospecção até serem confirmados.
        origem: { not: "prospect_ia" },
        ...(filtro ? { municipioId: filtro } : {}),
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: "insensitive" } },
                { telefone: { contains: busca.replace(/\D/g, "") || busca } },
              ],
            }
          : {}),
        ...(apenasNaoVisitados ? { visitado: false } : {}),
        ...(apenasVisitados ? { visitado: true } : {}),
      },
      include: { municipio: true, negociacoes: { where: { status: "aberta" } } },
      orderBy: { nome: "asc" },
    }),
    db.municipio.findMany({
      include: { _count: { select: { clientes: true } } },
      orderBy: { nome: "asc" },
    }),
    db.maquina.findMany({
      select: { id: true, marca: true, modelo: true, categoria: true },
      orderBy: [{ marca: "asc" }, { modelo: "asc" }],
    }),
    db.cliente.count({ where: { visitado: false, origem: { not: "prospect_ia" } } }),
    db.cliente.count({ where: { visitado: true, origem: { not: "prospect_ia" } } }),
    db.cliente.count({ where: { origem: { not: "prospect_ia" } } }),
  ]);

  const maxClientes = Math.max(1, ...municipios.map((m) => m._count.clientes));

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
      <PageHeader
        titulo="Clientes"
        subtitulo={`${clientes.length} cliente(s)${filtro ? " neste município" : ""}${busca ? ` para "${busca}"` : ""}`}
        acao={
          <div className="flex gap-2">
            <BotaoAtualizar />
            <ImportarClientes />
            <NovoClienteForm municipios={municipios} />
          </div>
        }
      />

      {/* Abas */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={filtro ? `/clientes?municipio=${filtro}` : "/clientes"}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${!apenasNaoVisitados && !apenasVisitados ? "bg-[#BFDE4D] text-black font-bold" : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"}`}
        >
          Todos
          <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${!apenasNaoVisitados && !apenasVisitados ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
            {totalClientes}
          </span>
        </Link>
        <Link
          href={filtro ? `/clientes?municipio=${filtro}&naoVisitado=1` : "/clientes?naoVisitado=1"}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${apenasNaoVisitados ? "bg-amber-500 text-white" : "border border-amber-800/50 text-amber-400 hover:bg-amber-900/20"}`}
        >
          📍 Nunca visitados
          {totalNaoVisitados > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${apenasNaoVisitados ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
              {totalNaoVisitados}
            </span>
          )}
        </Link>
        <Link
          href={filtro ? `/clientes?municipio=${filtro}&visitado=1` : "/clientes?visitado=1"}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${apenasVisitados ? "bg-green-600 text-white" : "border border-green-800/50 text-green-400 hover:bg-green-900/20"}`}
        >
          ✅ Visitados
          {totalVisitados > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${apenasVisitados ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}>
              {totalVisitados}
            </span>
          )}
        </Link>
      </div>

      {/* Busca */}
      <form method="GET" className="mb-5 flex gap-2">
        {filtro && <input type="hidden" name="municipio" value={filtro} />}
        {apenasNaoVisitados && <input type="hidden" name="naoVisitado" value="1" />}
        {apenasVisitados && <input type="hidden" name="visitado" value="1" />}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={busca}
            placeholder="Buscar cliente por nome ou telefone..."
            className="w-full rounded-lg border py-2 !pl-9 pr-3 text-sm outline-none focus:border-[#BFDE4D]" style={{ background: "#18181b", borderColor: "#27272a", color: "#fafafa" }}
          />
        </div>
        <button className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition" style={{ background: "#BFDE4D" }}>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:items-start">
        {/* Mapeamento por município */}
        <div className="rounded-2xl p-4 lg:col-span-1 lg:sticky lg:top-4 lg:self-start" style={{ background: "#18181b", border: "1px solid #27272a", color: "#fafafa" }}>
          <div className="mb-3 flex items-center gap-2 font-semibold text-zinc-100">
            <MapPin size={18} className="text-brand-600" /> Mapeamento
          </div>
          <Link
            href="/clientes"
            className={`mb-2 block rounded px-2 py-1 text-sm ${!filtro ? "bg-[#BFDE4D]/20 font-medium text-[#BFDE4D]" : "text-zinc-400 hover:bg-zinc-800"}`}
          >
            Todos os municípios
          </Link>
          <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1 lg:max-h-[60vh]">
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
        </div>

        {/* Lista de clientes em ordem alfabética */}
        <div className="lg:col-span-3">
          {clientes.length === 0 ? (
            <Card>
              <p className="text-center text-sm text-zinc-500">
                Nenhum cliente ainda. Cadastre o primeiro! 🚜
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {clientes.map((c) => {
                const neg = c.negociacoes[0];
                const dias = neg ? diasDesde(neg.ultimoContato) : null;
                const statusColor = (c as { status?: string }).status === "cliente"
                  ? "text-green-600 bg-green-50"
                  : (c as { status?: string }).status === "nao_cliente"
                  ? "text-red-500 bg-red-50"
                  : "text-amber-600 bg-amber-50";
                const statusLabel = (c as { status?: string }).status === "cliente"
                  ? "✓ cliente"
                  : (c as { status?: string }).status === "nao_cliente"
                  ? "não é cliente"
                  : "potencial";
                return (
                  <div key={c.id} className="relative">
                    <div className="rounded-2xl p-4 transition-all hover:-translate-y-0.5" style={{ background: "#18181b", border: "1px solid #27272a" }}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold" style={{ background: "#BFDE4D22", color: "#BFDE4D" }}>
                          {iniciais(c.nome)}
                        </div>
                        <div className="min-w-0 flex-1 pr-6">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-base font-bold text-white">{c.nome}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {c.municipio?.nome ?? "Sem município"} · {c.telefone ?? "sem telefone"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {neg?.maquinaModelo && <Badge tom="blue">{neg.maquinaModelo}</Badge>}
                            {dias != null && dias >= 7 && (
                              <Badge tom="red">{dias}d sem contato</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/clientes/${c.id}`}
                      aria-label={`Abrir ${c.nome}`}
                      className="absolute inset-0 z-10 rounded-2xl"
                    />
                    <div className="absolute right-3 top-3 z-20">
                      <ClienteAcoes
                        cliente={{
                          id: c.id,
                          nome: c.nome,
                          telefone: c.telefone,
                          email: c.email,
                          endereco: c.endereco,
                          municipioId: c.municipioId,
                          observacoes: c.observacoes,
                          jaComprou: c.jaComprou,
                          visitado: c.visitado,
                          interesseFuturo: c.interesseFuturo,
                          interesseFuturoData: c.interesseFuturoData
                            ? c.interesseFuturoData.toISOString().slice(0, 10)
                            : null,
                          interesseFuturoNota: c.interesseFuturoNota,
                        }}
                        municipios={municipios}
                        maquinas={maquinas}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
