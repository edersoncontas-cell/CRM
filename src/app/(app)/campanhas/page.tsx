import { db } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { Send, Users, Filter } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: { municipio?: string; modelo?: string };
}) {
  const [municipios, minhasMaquinas] = await Promise.all([
    db.municipio.findMany({ orderBy: { nome: "asc" } }),
    db.maquina.findMany({ where: { proprio: true }, orderBy: { modelo: "asc" } }),
  ]);

  const { municipio, modelo } = searchParams;

  // Segmentação: clientes do município E/OU com interesse no modelo (negociação).
  // Clientes de regiões fora da minha área nunca entram em campanhas.
  const where: any = { NOT: { municipio: { foraDeArea: true } } };
  if (municipio) where.municipioId = municipio;
  if (modelo) where.negociacoes = { some: { maquinaModelo: { contains: modelo } } };

  const destinatarios =
    municipio || modelo
      ? await db.cliente.findMany({
          where,
          include: { municipio: true, negociacoes: true },
          orderBy: { nome: "asc" },
        })
      : [];

  const nomeMuni = municipios.find((m) => m.id === municipio)?.nome;
  const mensagemSugerida = montarMensagem(nomeMuni, modelo);

  return (
    <div>
      <PageHeader
        titulo="Campanhas segmentadas"
        subtitulo="Direcione mensagens por município ou por máquina de interesse"
      />

      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
          <Filter size={18} className="text-brand-600" /> Segmentar público
        </div>
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Município</label>
            <select name="municipio" defaultValue={municipio} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Todos</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Interesse na máquina</label>
            <select name="modelo" defaultValue={modelo} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Qualquer</option>
              {minhasMaquinas.map((m) => (
                <option key={m.id} value={m.modelo}>{m.marca} {m.modelo}</option>
              ))}
            </select>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Users size={16} /> Buscar público
          </button>
        </form>
      </Card>

      {(municipio || modelo) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold text-slate-700">Destinatários</span>
              <Badge tom="blue">{destinatarios.length} cliente(s)</Badge>
            </div>
            {destinatarios.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum cliente neste segmento.</p>
            ) : (
              <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
                {destinatarios.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-50">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-slate-700 hover:text-brand-600">{c.nome}</Link>
                    <span className="text-xs text-slate-400">{c.municipio?.nome} · {c.telefone ?? "sem tel."}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
              <Send size={18} className="text-agro-600" /> Mensagem sugerida
            </div>
            <textarea
              readOnly
              rows={8}
              value={mensagemSugerida}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
            />
            <p className="mt-2 text-xs text-slate-400">
              Copie e envie pelo WhatsApp. Quando o WhatsApp Business estiver conectado, o envio em massa será automático.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

function montarMensagem(municipio?: string, modelo?: string): string {
  const alvo = modelo ? `a ${modelo}` : "nossas máquinas New Holland e Dynapac";
  const onde = municipio ? ` aqui na região de ${municipio}` : "";
  return `Olá! Tudo bem? 🚜

Passando para falar sobre ${alvo}${onde}. Estamos com condições especiais de financiamento (Finame/BNDES) e consórcio neste mês.

Posso te enviar uma proposta com um comparativo da máquina e agendar uma demonstração técnica? Me chama aqui! 👇`;
}
