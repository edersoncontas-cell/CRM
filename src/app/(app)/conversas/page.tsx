import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ConversaAnaliser } from "@/components/ConversaAnaliser";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { iaHabilitada } from "@/lib/ai";
import { Bot, Calendar } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConversasPage() {
  const [conversas, clientes] = await Promise.all([
    db.conversa.findMany({
      orderBy: { criadoEm: "desc" },
      include: { analise: true, cliente: true },
      take: 30,
    }),
    db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Conversas + IA"
        subtitulo="Cole conversas (texto ou transcrição) e deixe o cérebro de IA extrair os dados"
        acao={
          <Badge tom={iaHabilitada() ? "green" : "yellow"}>
            {iaHabilitada() ? "IA Anthropic ativa" : "Modo heurístico (sem chave)"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <ConversaAnaliser clientes={clientes} />
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold text-slate-700">Últimas análises</h2>
          {conversas.length === 0 && (
            <Card><p className="text-sm text-slate-400">Nenhuma conversa analisada ainda.</p></Card>
          )}
          {conversas.map((c) => (
            <Card key={c.id}>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {c.cliente ? (
                    <Link href={`/clientes/${c.clienteId}`} className="font-medium text-brand-600 hover:underline">
                      {c.cliente.nome}
                    </Link>
                  ) : (
                    "Sem cliente vinculado"
                  )}
                </span>
                <span>{formatDateTime(c.criadoEm)}</span>
              </div>
              <p className="mb-2 text-sm text-slate-700">&ldquo;{c.conteudo}&rdquo;</p>
              {c.analise && (
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <Bot size={14} className="text-brand-600" />
                    <Badge tom={c.analise.fonte === "ia" ? "blue" : "slate"}>
                      {c.analise.fonte === "ia" ? "IA" : "heurística"}
                    </Badge>
                    {c.analise.maquina && <Badge tom="blue">{c.analise.maquina}</Badge>}
                    {c.analise.valor && <Badge tom="green">{formatCurrency(c.analise.valor)}</Badge>}
                    {c.analise.condicaoPagamento && <Badge tom="slate">{c.analise.condicaoPagamento}</Badge>}
                    {c.analise.concorrente && <Badge tom="red">⚔ {c.analise.concorrente}</Badge>}
                    {c.analise.ehProspectReal && <Badge tom="green">prospect real</Badge>}
                  </div>
                  <p className="text-slate-600">{c.analise.resumo}</p>
                  {c.analise.dataVisita && (
                    <p className="mt-1 flex items-center gap-1 text-brand-700">
                      <Calendar size={13} /> Visita detectada: {formatDateTime(c.analise.dataVisita)}
                    </p>
                  )}
                  {c.analise.rascunhoResposta && (
                    <div className="mt-2 border-l-2 border-brand-300 pl-2 text-slate-500">
                      <b>Rascunho de resposta:</b> {c.analise.rascunhoResposta}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
