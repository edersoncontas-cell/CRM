import { PageHeader } from "@/components/ui";
import { RelatorioConversasClient } from "@/components/RelatorioConversasClient";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RelatorioConversasPage({ searchParams }: { searchParams: { conversa?: string } }) {
  await garantirManutencaoSeNecessario();

  const conversaId = searchParams.conversa ?? null;
  const conv = conversaId
    ? await db.whatsAppConversation.findUnique({ where: { id: conversaId }, select: { contactName: true, externalPhone: true } })
    : null;

  return (
    <div>
      <PageHeader
        titulo="Relatório de conversas"
        subtitulo="PDF com nome do cliente, telefone, resumo do que foi conversado e o tempo de cada conversa do WhatsApp no período."
      />
      <RelatorioConversasClient
        conversaId={conv ? conversaId : null}
        conversaNome={conv ? conv.contactName ?? conv.externalPhone : null}
      />
    </div>
  );
}
