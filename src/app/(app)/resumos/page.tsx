import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { ResumosClient, type ConversaResumo, type ColunaOpcao } from "@/components/ResumosClient";
import { ESTAGIOS } from "@/lib/pipeline";
import { garantirColunasDemanda } from "@/lib/demandas";

export const dynamic = "force-dynamic";

export default async function ResumosPage() {
  await garantirColunasDemanda();

  // WhatsAppConversation não tem relação Prisma direta com Cliente (clienteId
  // é só uma coluna) — busca as conversas vinculadas e depois os clientes em lote.
  const [conversasWA, colunasDemanda] = await Promise.all([
    db.whatsAppConversation.findMany({
      where: { clienteId: { not: null }, isGroup: false },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        clienteId: true,
        lastMessageAt: true,
        _count: { select: { messages: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { body: true, direction: true },
        },
      },
    }),
    db.colunaDemanda.findMany({ orderBy: { ordem: "asc" } }),
  ]);

  // Uma linha por cliente — mantém a conversa mais recente quando há mais de uma.
  const conversaPorCliente = new Map<string, (typeof conversasWA)[number]>();
  for (const c of conversasWA) {
    if (!c.clienteId) continue;
    const atual = conversaPorCliente.get(c.clienteId);
    if (!atual || c.lastMessageAt > atual.lastMessageAt) conversaPorCliente.set(c.clienteId, c);
  }

  const clienteIds = [...conversaPorCliente.keys()];
  const clientes = await db.cliente.findMany({
    where: { id: { in: clienteIds } },
    select: { id: true, nome: true, aguardandoResposta: true, municipio: { select: { nome: true } } },
  });
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));

  const conversas: ConversaResumo[] = clienteIds
    .map((clienteId): ConversaResumo | null => {
      const conv = conversaPorCliente.get(clienteId)!;
      const cliente = clientePorId.get(clienteId);
      if (!cliente) return null;
      const ultima = conv.messages[0];
      return {
        id: clienteId,
        conversaId: conv.id,
        nome: cliente.nome,
        municipio: cliente.municipio?.nome ?? null,
        aguardando: cliente.aguardandoResposta,
        totalMensagens: conv._count.messages,
        previa: ultima ? `${ultima.direction === "OUT" ? "Você: " : ""}${ultima.body}` : "",
        ultimoContato: conv.lastMessageAt.toISOString(),
      };
    })
    .filter((c): c is ConversaResumo => c !== null)
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
