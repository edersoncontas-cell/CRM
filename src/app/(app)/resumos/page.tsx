import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { ResumosClient, type ConversaResumo, type ColunaOpcao } from "@/components/ResumosClient";
import { ESTAGIOS } from "@/lib/pipeline";
import { garantirColunasDemanda } from "@/lib/demandas";

export const dynamic = "force-dynamic";

export default async function ResumosPage() {
  await garantirColunasDemanda();

  const [clientes, colunasDemanda] = await Promise.all([
    db.cliente.findMany({
      where: { conversas: { some: {} } },
      select: {
        id: true,
        nome: true,
        municipio: { select: { nome: true } },
        aguardandoResposta: true,
        _count: { select: { conversas: true } },
        conversas: {
          orderBy: { criadoEm: "desc" },
          take: 1,
          select: { conteudo: true, criadoEm: true },
        },
      },
    }),
    db.colunaDemanda.findMany({ orderBy: { ordem: "asc" } }),
  ]);

  const conversas: ConversaResumo[] = clientes
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      municipio: c.municipio?.nome ?? null,
      aguardando: c.aguardandoResposta,
      totalMensagens: c._count.conversas,
      previa: c.conversas[0]?.conteudo ?? "",
      ultimoContato: (c.conversas[0]?.criadoEm ?? new Date(0)).toISOString(),
    }))
    .sort((a, b) => +new Date(b.ultimoContato) - +new Date(a.ultimoContato));

  // Opções de coluna para "criar card": demandas (Trello) + funil de negociação.
  const colunas: ColunaOpcao[] = [
    ...colunasDemanda.map((c) => ({ id: c.id, titulo: c.titulo, tipo: "demanda" as const })),
    ...ESTAGIOS.map((e) => ({ id: e.id, titulo: e.titulo, tipo: "negociacao" as const })),
  ];

  return (
    <div>
      <PageHeader
        titulo="Resumos das conversas"
        subtitulo="A IA resume cada conversa do WhatsApp — revise, complete e crie um card ou agende"
      />
      {conversas.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-slate-400">
            Nenhuma conversa ainda. Quando um cliente te chamar no WhatsApp, ela aparece aqui. 💬
          </p>
        </Card>
      ) : (
        <ResumosClient conversas={conversas} colunas={colunas} />
      )}
    </div>
  );
}
