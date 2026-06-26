import { db } from "@/lib/db";
import { Card, Badge } from "@/components/ui";
import { formatCurrency, formatDate, iniciais, diasDesde } from "@/lib/utils";
import { EditarClienteForm } from "@/components/EditarClienteForm";
import { VisitasCliente } from "@/components/VisitasCliente";
import { AgendarVisitaDialog } from "@/components/AgendarVisitaDialog";
import { ResumoClienteForm } from "@/components/ResumoClienteForm";
import { garantirRegioes } from "@/lib/regioes";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Bot, Clock, MessageCircle, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClienteDetalhe({ params }: { params: { id: string } }) {
  await garantirRegioes();

  const [cliente, municipios, maquinas] = await Promise.all([
    db.cliente.findUnique({
      where: { id: params.id },
      include: {
        municipio: true,
        indicadoPor: true,
        indicados: true,
        visitas: { orderBy: { data: "desc" } },
        negociacoes: { orderBy: { criadoEm: "desc" } },
      },
    }),
    db.municipio.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, foraDeArea: true } }),
    db.maquina.findMany({ select: { id: true, marca: true, modelo: true, categoria: true }, orderBy: [{ marca: "asc" }, { modelo: "asc" }] }),
  ]);
  if (!cliente) notFound();

  // Busca frota e conversa WA via raw query (tabelas novas)
  type FrotaRow = { id: string; marca: string; modelo: string };
  type ConvRow = { id: string };
  const [frotaRows, waConv] = await Promise.all([
    db.$queryRawUnsafe<FrotaRow[]>(`SELECT id, marca, modelo FROM "ClienteMaquina" WHERE "clienteId" = $1 ORDER BY "criadoEm" ASC`, cliente.id).catch(() => [] as FrotaRow[]),
    db.whatsAppConversation.findFirst({ where: { clienteId: cliente.id }, select: { id: true } }).catch(() => null as ConvRow | null),
  ]);

  const status = (cliente as { status?: string }).status ?? (cliente.jaComprou ? "cliente" : "potencial");
  const diasSemContato = cliente.ultimoContato ? diasDesde(cliente.ultimoContato) : null;

  const statusBadge =
    status === "cliente" ? { label: "✓ Cliente", tom: "green" as const } :
    status === "nao_cliente" ? { label: "Não é cliente", tom: "red" as const } :
    { label: "Potencial", tom: "yellow" as const };

  // Dados do resumo (campos novos podem ser undefined)
  const resumo = {
    maquinas: (cliente as { resumoMaquinas?: string }).resumoMaquinas ?? null,
    valor: (cliente as { resumoValor?: number }).resumoValor ?? null,
    entrada: (cliente as { resumoEntrada?: number }).resumoEntrada ?? null,
    condicao: (cliente as { resumoCondicao?: string }).resumoCondicao ?? null,
    texto: (cliente as { resumoTexto?: string }).resumoTexto ?? null,
    proximaVisita: (cliente as { proximaVisita?: Date }).proximaVisita ?? null,
    proximaVisitaNota: (cliente as { proximaVisitaNota?: string }).proximaVisitaNota ?? null,
  };

  const waHref = waConv ? `/atendimento?conversa=${waConv.id}` : `/atendimento`;

  return (
    <div>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Voltar
      </Link>

      {/* Header do cliente */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
          {iniciais(cliente.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{cliente.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {cliente.telefone && (
              <span className="flex items-center gap-1"><Phone size={14} /> {cliente.telefone}</span>
            )}
            {cliente.email && (
              <span className="flex items-center gap-1"><Mail size={14} /> {cliente.email}</span>
            )}
            {cliente.municipio && (
              <span className="flex items-center gap-1"><MapPin size={14} /> {cliente.municipio.nome}</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tom={statusBadge.tom}>{statusBadge.label}</Badge>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              {cliente.ultimoContato ? `último contato há ${diasSemContato}d` : "sem contato registrado"}
            </span>
            {cliente.aguardandoResposta && <Badge tom="red">aguardando seu retorno</Badge>}
            {cliente.interesseFuturo && (
              <Badge tom="yellow">
                ⏳ interesse futuro{cliente.interesseFuturoNota ? ` — ${cliente.interesseFuturoNota}` : ""}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <AgendarVisitaDialog
            clienteId={cliente.id}
            clienteNome={cliente.nome}
            clienteTelefone={cliente.telefone}
          />
          <Link
            href={waHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-sm font-semibold text-agro-400 hover:bg-brand-800"
          >
            <MessageCircle size={14} /> WhatsApp
          </Link>
          <EditarClienteForm
            cliente={{
              id: cliente.id,
              nome: cliente.nome,
              telefone: cliente.telefone,
              email: cliente.email,
              municipioId: cliente.municipioId,
              status,
              interesseFuturo: cliente.interesseFuturo,
              interesseFuturoData: cliente.interesseFuturoData
                ? cliente.interesseFuturoData.toISOString().slice(0, 10)
                : null,
              interesseFuturoNota: cliente.interesseFuturoNota,
            }}
            municipios={municipios}
            maquinas={maquinas}
            frotaAtual={frotaRows}
          />
        </div>
      </div>

      {/* Card indicações */}
      {(cliente.indicadoPor || cliente.indicados.length > 0) && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {cliente.indicadoPor && (
              <span className="text-slate-700">🤝 Indicado por <b>{cliente.indicadoPor.nome}</b></span>
            )}
            {cliente.indicados.length > 0 && (
              <span className="text-slate-700">⭐ Já indicou <b>{cliente.indicados.length}</b> cliente(s)</span>
            )}
          </div>
        </Card>
      )}

      {/* Perfil IA */}
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

      {/* Próxima visita */}
      {resumo.proximaVisita && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            📅 Próxima visita: <span className="font-normal">{formatDate(resumo.proximaVisita)}</span>
            {resumo.proximaVisitaNota && <span className="font-normal text-amber-700">— {resumo.proximaVisitaNota}</span>}
          </div>
        </Card>
      )}

      {/* Frota */}
      {frotaRows.length > 0 && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
            <Truck size={17} className="text-brand-600" /> Frota do cliente
          </div>
          <div className="flex flex-wrap gap-2">
            {frotaRows.map((f) => (
              <span key={f.id} className="rounded-lg bg-brand-50 border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700">
                {f.marca} — {f.modelo}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Visitas */}
      <div className="mb-6">
        <VisitasCliente
          clienteId={cliente.id}
          visitas={cliente.visitas.map((v) => ({
            id: v.id,
            data: v.data.toISOString(),
            observacao: v.observacao,
          }))}
        />
      </div>

      {/* Resumo do Cliente (substitui Negociações) */}
      <ResumoClienteForm
        clienteId={cliente.id}
        resumo={resumo}
        temConversa={!!waConv}
        negociacoes={cliente.negociacoes.map((n) => ({
          id: n.id,
          maquinaModelo: n.maquinaModelo,
          valor: n.valor,
          condicaoPagamento: n.condicaoPagamento,
          concorrenteMencionado: n.concorrenteMencionado,
          estagio: n.estagio,
          status: n.status,
          termometro: n.termometro,
          ultimoContato: n.ultimoContato?.toISOString() ?? null,
          motivoPerda: n.motivoPerda,
        }))}
      />
    </div>
  );
}
