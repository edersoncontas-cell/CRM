import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { ConversaAnaliser } from "@/components/ConversaAnaliser";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { iaHabilitada, provedorIANome } from "@/lib/ai";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { Bot, Calendar, Save } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConversasPage() {
  const [conversas, clientes] = await Promise.all([
    db.conversa.findMany({
      orderBy: { criadoEm: "desc" },
      include: { analise: true, cliente: { include: { municipio: true } } },
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
          <div className="flex items-center gap-2">
            <BotaoAtualizar />
            <Badge tom={iaHabilitada() ? "green" : "yellow"}>
              {iaHabilitada() ? `IA ${provedorIANome()} ativa` : "Modo heurístico (sem chave)"}
            </Badge>
          </div>
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
                  {(() => {
                    const salvos: string[] = [];
                    if (c.cliente) salvos.push(`Cliente: ${c.cliente.nome}`);
                    if (c.cliente?.municipio) salvos.push(`Município: ${c.cliente.municipio.nome}`);
                    if (c.cliente?.telefone) salvos.push(`Telefone: ${c.cliente.telefone}`);
                    if (c.analise?.maquina) salvos.push(`Máquina: ${c.analise.maquina}`);
                    if (c.analise?.valor) salvos.push(`Valor: ${formatCurrency(c.analise.valor)}`);
                    if (c.analise?.condicaoPagamento) salvos.push(`Pagamento: ${c.analise.condicaoPagamento}`);
                    if (c.analise?.concorrente) salvos.push(`Concorrente: ${c.analise.concorrente}`);
                    if (c.analise?.dataVisita) salvos.push("Visita agendada");
                    if (salvos.length === 0) return null;
                    return (
                      <div className="mt-2 rounded-md border border-agro-200 bg-agro-50 p-2">
                        <div className="mb-1 flex items-center gap-1 text-xs font-bold text-agro-700">
                          <Save size={12} /> Salvo no CRM
                        </div>
                        <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                          {salvos.map((s) => (
                            <li key={s}>✓ {s}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
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
