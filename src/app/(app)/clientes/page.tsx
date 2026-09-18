import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { iniciais, diasDesde, semCodigoPais } from "@/lib/utils";
import { NovoClienteForm } from "@/components/NovoClienteForm";
import { ImportarClientes } from "@/components/ImportarClientes";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { ClienteAcoes } from "@/components/ClienteAcoes";
import { BuscaClientesInstantanea } from "@/components/BuscaClientesInstantanea";
import { BarrasHorizontais } from "@/components/charts";
import { PopupContatoSemNome } from "@/components/PopupContatoSemNome";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { GoogleContatosSync } from "@/components/GoogleContatosSync";
import { googleContatosDisponivel, lerResumoSincronizacaoGoogle } from "@/lib/google-contatos";
import { MapPin, Compass, BarChart3 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DIAS_ESQUECIDO = 15;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { municipio?: string; regiao?: string; q?: string; naoVisitado?: string; visitado?: string; semCidade?: string };
}) {
  const filtro = searchParams.municipio;
  const regiaoFiltro = searchParams.regiao;
  const busca = (searchParams.q ?? "").trim();
  const apenasNaoVisitados = searchParams.naoVisitado === "1";
  const apenasVisitados = searchParams.visitado === "1";
  // Cadastros sem cidade: não entram em nenhuma rota nem na abordagem por
  // cidade — a aba existe para o vendedor completar esses cadastros.
  const apenasSemCidade = searchParams.semCidade === "1";
  await garantirManutencaoSeNecessario();

  const corteEsquecido = new Date();
  corteEsquecido.setDate(corteEsquecido.getDate() - DIAS_ESQUECIDO);

  // Só carrega a lista completa quando o vendedor de fato pediu um recorte
  // (busca, município, região ou uma das abas) — evita mostrar TODOS os
  // clientes de cara, uma lista enorme sem filtro nenhum.
  const mostrarLista = !!busca || !!filtro || !!regiaoFiltro || apenasNaoVisitados || apenasVisitados || apenasSemCidade;

  const [clientes, municipios, maquinas, totalNaoVisitados, totalVisitados, totalClientes, municipiosComVisitas, contatosSemNome, googleConectado, resumoGoogle, totalGoogle, totalSemCidade] = await Promise.all([
    mostrarLista ? db.cliente.findMany({
      where: {
        // Prospects sugeridos pela IA (podem ser nomes inventados quando incertos)
        // ficam só na tela de Roteiro/Prospecção até serem confirmados.
        origem: { not: "prospect_ia" },
        ...(filtro ? { municipioId: filtro } : {}),
        ...(regiaoFiltro ? { municipio: { regiao: regiaoFiltro } } : {}),
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
        ...(apenasSemCidade ? { municipioId: null } : {}),
      },
      include: { municipio: true, negociacoes: { where: { status: "aberta" } } },
      orderBy: { nome: "asc" },
    }) : Promise.resolve([]),
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
    // Município -> quantidade de visitas (para o gráfico de mais/menos visitados)
    db.municipio.findMany({
      where: { foraDeArea: false },
      select: { nome: true, clientes: { select: { visitas: { select: { id: true } } } } },
    }),
    // Contatos do WhatsApp vinculados automaticamente sem nome real (o pipeline
    // cria como "Contato <telefone>" quando a Z-API não manda o nome do contato)
    db.cliente.findMany({
      where: { nome: { startsWith: "Contato ", mode: "insensitive" } },
      select: { id: true, telefone: true },
      orderBy: { criadoEm: "desc" },
      take: 15,
    }),
    // Google Contatos: a lista de clientes espelha a agenda do vendedor.
    googleContatosDisponivel().catch(() => false),
    lerResumoSincronizacaoGoogle(),
    db.cliente.count({ where: { googleContatoId: { not: null } } }),
    db.cliente.count({ where: { municipioId: null, origem: { not: "prospect_ia" } } }),
  ]);

  const maxClientes = Math.max(1, ...municipios.map((m) => m._count.clientes));

  // Regiões: agrupa municípios (Caparaó, Litorânea, Granito, Serrana, Das Santas
  // + "Sul do Espírito Santo" para os que ainda não têm região definida)
  const regioesMap = new Map<string, number>();
  for (const m of municipios) {
    if (m.foraDeArea) continue;
    regioesMap.set(m.regiao, (regioesMap.get(m.regiao) ?? 0) + m._count.clientes);
  }
  const regioes = Array.from(regioesMap.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);

  const visitasPorMunicipio = municipiosComVisitas
    .map((m) => ({ nome: m.nome, total: m.clientes.reduce((s, c) => s + c.visitas.length, 0) }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);
  const maisVisitados = visitasPorMunicipio.slice(0, 6);
  const menosVisitados = visitasPorMunicipio.slice(-6).reverse();

  const filaContatosSemNome = contatosSemNome.map((c) => ({ id: c.id, telefone: semCodigoPais(c.telefone ?? "") }));

  return (
    <div style={{ background: "#09090b", minHeight: "100%" }} className="-m-6 p-6 md:-m-8 md:p-8">
      <PageHeader
        titulo="Clientes"
        subtitulo={mostrarLista
          ? `${clientes.length} cliente(s)${filtro ? " neste município" : ""}${regiaoFiltro ? ` na região ${regiaoFiltro}` : ""}${apenasSemCidade ? " sem cidade no cadastro" : ""}${busca ? ` para "${busca}"` : ""}`
          : `${totalClientes} cliente(s) cadastrado(s) no total`}
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
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${!apenasNaoVisitados && !apenasVisitados && !apenasSemCidade ? "bg-[#BFDE4D] text-black font-bold" : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"}`}
        >
          Todos
          <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${!apenasNaoVisitados && !apenasVisitados && !apenasSemCidade ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
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
        <Link
          href="/clientes?semCidade=1"
          title="Clientes sem cidade no cadastro — não aparecem na abordagem por cidade nem nas rotas"
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${apenasSemCidade ? "bg-sky-600 text-white" : "border border-sky-800/50 text-sky-400 hover:bg-sky-900/20"}`}
        >
          🏙️ Sem cidade
          {totalSemCidade > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${apenasSemCidade ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"}`}>
              {totalSemCidade}
            </span>
          )}
        </Link>
      </div>

      {apenasSemCidade && (
        <p className="mb-4 rounded-xl border border-sky-800/40 bg-sky-900/20 px-3 py-2 text-xs text-sky-200">
          Estes cadastros não têm cidade. Sem cidade o cliente fica de fora da <b>abordagem por cidade</b> (em Visitas) e das rotas por região —
          abra o cadastro pelo ⋯ e escolha o município.
        </p>
      )}

      <GoogleContatosSync conectado={googleConectado} resumo={resumoGoogle} totalGoogle={totalGoogle} />

      {/* Busca — filtra automaticamente enquanto digita */}
      <BuscaClientesInstantanea valorInicial={busca} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:items-start">
        {/* Mapeamento + Regiões — depois da lista no mobile, ao lado no desktop */}
        <div className="order-2 space-y-4 lg:order-1 lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a", color: "#fafafa" }}>
            <div className="mb-3 flex items-center gap-2 font-semibold text-zinc-100">
              <MapPin size={18} className="text-brand-600" /> Mapeamento
            </div>
            <Link
              href="/clientes"
              className={`mb-2 block rounded px-2 py-1 text-sm ${!filtro && !regiaoFiltro ? "bg-[#BFDE4D]/20 font-medium text-[#BFDE4D]" : "text-zinc-400 hover:bg-zinc-800"}`}
            >
              Todos os municípios
            </Link>
            <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1 lg:max-h-[40vh]">
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

          {/* Regiões (rotas de visita) */}
          <div className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a", color: "#fafafa" }}>
            <div className="mb-3 flex items-center gap-2 font-semibold text-zinc-100">
              <Compass size={18} className="text-brand-600" /> Regiões
            </div>
            <div className="space-y-1">
              {regioes.map((r) => (
                <Link
                  key={r.nome}
                  href={`/clientes?regiao=${encodeURIComponent(r.nome)}`}
                  className={`flex items-center justify-between rounded px-2 py-1 text-sm ${regiaoFiltro === r.nome ? "bg-[#BFDE4D]/20 font-medium text-[#BFDE4D]" : "text-zinc-400 hover:bg-zinc-800"}`}
                >
                  <span className="truncate">{r.nome}</span>
                  <span className="ml-2 text-xs font-bold">{r.total}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Municípios mais/menos visitados */}
          {visitasPorMunicipio.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: "#18181b", border: "1px solid #27272a", color: "#fafafa" }}>
              <div className="mb-3 flex items-center gap-2 font-semibold text-zinc-100">
                <BarChart3 size={18} className="text-brand-600" /> Mais visitados
              </div>
              <BarrasHorizontais data={maisVisitados} cor="#4ade80" dark />
              {menosVisitados.length > 0 && (
                <>
                  <div className="mb-3 mt-5 flex items-center gap-2 font-semibold text-zinc-100">
                    <BarChart3 size={18} className="text-brand-600" /> Menos visitados
                  </div>
                  <BarrasHorizontais data={menosVisitados} cor="#f87171" dark />
                </>
              )}
            </div>
          )}
        </div>

        {/* Lista de clientes em ordem alfabética */}
        <div className="order-1 lg:order-2 lg:col-span-3">
          {!mostrarLista ? (
            <Card>
              <p className="text-center text-sm text-zinc-500">
                Busque por nome/telefone, ou selecione um município/região ao lado para ver os clientes. 🔍
              </p>
            </Card>
          ) : clientes.length === 0 ? (
            <Card>
              <p className="text-center text-sm text-zinc-500">
                Nenhum cliente encontrado.
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
                            {c.googleContatoId && <span title="Ligado ao Google Contatos"><Badge tom="slate">Google</Badge></span>}
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
                          dataNascimento: c.dataNascimento ? c.dataNascimento.toISOString().slice(0, 10) : null,
                          dataNascimentoOrigem: c.dataNascimentoOrigem,
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

      <PopupContatoSemNome contatos={filaContatosSemNome} municipios={municipios} />
    </div>
  );
}
