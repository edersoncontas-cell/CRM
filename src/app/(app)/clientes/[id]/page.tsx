import { db } from "@/lib/db";
import { Card, Badge, Termometro } from "@/components/ui";
import { formatCurrency, formatDateTime, iniciais, diasDesde } from "@/lib/utils";
import { ConversaAnaliser } from "@/components/ConversaAnaliser";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, MapPin, Bot } from "lucide-react";

export const dynamic = "force-dynamic";

const COND_LABEL: Record<string, string> = {
  avista: "À vista", consorcio: "Consórcio", financiamento: "Financiamento", outro: "Outro",
};

export default async function ClienteDetalhe({ params }: { params: { id: string } }) {
  const cliente = await db.cliente.findUnique({
    where: { id: params.id },
    include: {
      municipio: true,
      negociacoes: { orderBy: { criadoEm: "desc" } },
      conversas: {
        orderBy: { criadoEm: "desc" },
        include: { analise: true },
        take: 10,
      },
    },
  });
  if (!cliente) notFound();

  return (
    <div>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
          {iniciais(cliente.nome)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{cliente.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {cliente.telefone && (
              <span className="flex items-center gap-1"><Phone size={14} /> {cliente.telefone}</span>
            )}
            {cliente.municipio && (
              <span className="flex items-center gap-1"><MapPin size={14} /> {cliente.municipio.nome}</span>
            )}
            {cliente.jaComprou ? <Badge tom="green">já comprou</Badge> : <Badge tom="slate">prospect</Badge>}
            {cliente.visitado ? <Badge tom="blue">visitado</Badge> : <Badge tom="yellow">não visitado</Badge>}
          </div>
        </div>
      </div>

      {cliente.perfilIA && (
        <Card className="mb-6 border-brand-200 bg-brand-50">
          <div className="flex items-start gap-2">
            <Bot size={18} className="mt-0.5 text-brand-600" />
            <div>
              <div className="text-sm font-semibold text-brand-800">Perfil pela IA</div>
              <p className="text-sm text-slate-600">{cliente.perfilIA}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Negociações */}
        <div>
          <h2 className="mb-3 font-semibold text-slate-700">Negociações</h2>
          <div className="space-y-3">
            {cliente.negociacoes.length === 0 && (
              <Card><p className="text-sm text-slate-400">Sem negociações.</p></Card>
            )}
            {cliente.negociacoes.map((n) => (
              <Card key={n.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {n.maquinaModelo ?? "Máquina a definir"}
                  </span>
                  {n.status === "perdida" ? (
                    <Badge tom="red">perdida</Badge>
                  ) : n.status === "ganha" ? (
                    <Badge tom="green">ganha</Badge>
                  ) : (
                    <Badge tom="blue">{n.estagio}</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>Valor: <b>{formatCurrency(n.valor)}</b></div>
                  <div>Pagamento: {n.condicaoPagamento ? COND_LABEL[n.condicaoPagamento] : "—"}</div>
                  <div>Concorrente: {n.concorrenteMencionado ?? "—"}</div>
                  <div>Último contato: {n.ultimoContato ? `${diasDesde(n.ultimoContato)}d atrás` : "—"}</div>
                  {n.dataVisita && <div className="col-span-2">Visita: {formatDateTime(n.dataVisita)}</div>}
                  {n.motivoPerda && <div className="col-span-2 text-red-600">Motivo da perda: {n.motivoPerda}</div>}
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-xs text-slate-400">Termômetro do negócio</div>
                  <Termometro valor={n.termometro} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Conversas + IA */}
        <div>
          <h2 className="mb-3 font-semibold text-slate-700">Conversas analisadas pela IA</h2>
          <ConversaAnaliser clienteId={cliente.id} />
          <div className="mt-4 space-y-3">
            {cliente.conversas.length === 0 && (
              <Card><p className="text-sm text-slate-400">Cole uma conversa acima para a IA analisar.</p></Card>
            )}
            {cliente.conversas.map((c) => (
              <Card key={c.id}>
                <p className="mb-2 text-sm text-slate-700">&ldquo;{c.conteudo}&rdquo;</p>
                {c.analise && (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <Bot size={14} className="text-brand-600" />
                      <span className="font-semibold text-brand-700">Análise</span>
                      <Badge tom={c.analise.fonte === "ia" ? "blue" : "slate"}>
                        {c.analise.fonte === "ia" ? "IA" : "heurística"}
                      </Badge>
                      <Badge tom={c.analise.sentimento === "positivo" ? "green" : c.analise.sentimento === "negativo" ? "red" : "slate"}>
                        {c.analise.sentimento}
                      </Badge>
                    </div>
                    <p className="text-slate-600">{c.analise.resumo}</p>
                    {c.analise.rascunhoResposta && (
                      <div className="mt-2 border-l-2 border-brand-300 pl-2 text-slate-500">
                        <b>Rascunho:</b> {c.analise.rascunhoResposta}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
