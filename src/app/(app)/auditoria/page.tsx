import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import {
  Bot, User, Cpu, Search, Filter,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ROTULO_ACAO: Record<string, string> = {
  cliente_criado: "Cliente criado",
  cliente_atualizado: "Cliente atualizado",
  negociacao_criada: "Negociação criada",
  negociacao_atualizada: "Negociação atualizada",
  negociacao_ganha: "Venda fechada",
  negociacao_perdida: "Venda perdida",
  visita_detectada: "Visita detectada",
  conversa_analisada: "Conversa analisada",
  campanha_enviada: "Campanha enviada",
  post_gerado: "Post gerado",
  mensagem_enviada: "Mensagem enviada",
  perfil_atualizado: "Perfil atualizado",
};

const COR_ORIGEM: Record<string, "blue" | "slate" | "yellow"> = {
  ia: "blue",
  usuario: "slate",
  sistema: "yellow",
};

const COR_ACAO: Record<string, string> = {
  negociacao_ganha: "bg-green-50 border-green-200",
  negociacao_perdida: "bg-red-50 border-red-200",
  campanha_enviada: "bg-violet-50 border-violet-200",
  cliente_criado: "bg-brand-50 border-brand-200",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: { origem?: string; acao?: string; pagina?: string };
}) {
  const pagina = Number(searchParams.pagina ?? 1);
  const POR_PAG = 50;

  const where: { origem?: string; acao?: string } = {};
  if (searchParams.origem) where.origem = searchParams.origem;
  if (searchParams.acao) where.acao = searchParams.acao;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * POR_PAG,
      take: POR_PAG,
    }),
    db.auditLog.count({ where }),
  ]);

  const totalPags = Math.ceil(total / POR_PAG);

  // Contadores por origem para o resumo
  const contadores = await db.auditLog.groupBy({
    by: ["origem"],
    _count: { id: true },
  });

  const contIA = contadores.find((c) => c.origem === "ia")?._count.id ?? 0;
  const contUser = contadores.find((c) => c.origem === "usuario")?._count.id ?? 0;
  const contSist = contadores.find((c) => c.origem === "sistema")?._count.id ?? 0;

  return (
    <div>
      <PageHeader
        titulo="Auditoria"
        subtitulo="Rastreio de todas as ações automáticas da IA e do sistema"
      />

      {/* Resumo */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center">
          <Bot size={20} className="mx-auto mb-1 text-blue-500" />
          <div className="text-2xl font-bold text-blue-700">{contIA}</div>
          <div className="text-xs text-blue-500">Ações da IA</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
          <User size={20} className="mx-auto mb-1 text-slate-500" />
          <div className="text-2xl font-bold text-slate-700">{contUser}</div>
          <div className="text-xs text-slate-500">Ações do usuário</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <Cpu size={20} className="mx-auto mb-1 text-amber-500" />
          <div className="text-2xl font-bold text-amber-700">{contSist}</div>
          <div className="text-xs text-amber-500">Ações do sistema</div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
          <Filter size={16} className="text-brand-500" /> Filtrar registros
        </div>
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Origem</label>
            <select name="origem" defaultValue={searchParams.origem ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Todas</option>
              <option value="ia">IA</option>
              <option value="usuario">Usuário</option>
              <option value="sistema">Sistema</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Ação</label>
            <select name="acao" defaultValue={searchParams.acao ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Todas</option>
              {Object.entries(ROTULO_ACAO).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Search size={14} /> Filtrar
          </button>
          {(searchParams.origem || searchParams.acao) && (
            <Link href="/auditoria" className="text-sm text-slate-500 underline">Limpar filtros</Link>
          )}
        </form>
      </Card>

      {/* Lista */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {total} registro(s) {(searchParams.origem || searchParams.acao) ? "(filtrado)" : "no total"}
          </span>
          {totalPags > 1 && (
            <div className="flex items-center gap-2 text-sm">
              {pagina > 1 && (
                <Link href={`?${new URLSearchParams({ ...searchParams, pagina: String(pagina - 1) })}`}
                  className="rounded-lg bg-slate-100 px-3 py-1 hover:bg-slate-200">← Anterior</Link>
              )}
              <span className="text-slate-400">Pág. {pagina}/{totalPags}</span>
              {pagina < totalPags && (
                <Link href={`?${new URLSearchParams({ ...searchParams, pagina: String(pagina + 1) })}`}
                  className="rounded-lg bg-slate-100 px-3 py-1 hover:bg-slate-200">Próxima →</Link>
              )}
            </div>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center">
            <Bot size={32} className="mx-auto mb-3 text-slate-200" />
            <p className="text-sm text-slate-400">Nenhum registro de auditoria ainda.</p>
            <p className="mt-1 text-xs text-slate-300">As ações da IA e do sistema aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => {
              const corCard = COR_ACAO[log.acao] ?? "bg-white border-slate-100";
              let extra: Record<string, unknown> | null = null;
              try { extra = log.extra ? JSON.parse(log.extra) : null; } catch { /* ignore */ }

              return (
                <li key={log.id} className={`flex items-start gap-3 rounded-xl border px-3 py-3 my-1 ${corCard}`}>
                  <div className="mt-0.5 shrink-0">
                    {log.origem === "ia" ? (
                      <Bot size={15} className="text-blue-500" />
                    ) : log.origem === "usuario" ? (
                      <User size={15} className="text-slate-500" />
                    ) : (
                      <Cpu size={15} className="text-amber-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tom={COR_ORIGEM[log.origem] ?? "slate"}>
                        {log.origem === "ia" ? "IA" : log.origem === "usuario" ? "usuário" : "sistema"}
                      </Badge>
                      <span className="text-sm font-semibold text-slate-800">
                        {ROTULO_ACAO[log.acao] ?? log.acao}
                      </span>
                      {log.clienteId && (
                        <Link href={`/clientes/${log.clienteId}`} className="text-xs text-brand-600 hover:underline">
                          ver cliente →
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{log.descricao}</p>
                    {extra && Object.keys(extra).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                        {Object.entries(extra).map(([k, v]) => (
                          <span key={k}><b>{k}:</b> {String(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <time className="ml-auto shrink-0 text-xs text-slate-400">
                    {formatDateTime(log.criadoEm)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
