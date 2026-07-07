import { PageHeader } from "@/components/ui";
import { listarClientesPosVenda } from "@/lib/actions";
import { PosVendaClient } from "@/components/PosVendaClient";

export const dynamic = "force-dynamic";

export default async function PosVendaPage() {
  const clientes = await listarClientesPosVenda();

  return (
    <div>
      <PageHeader
        titulo="Pós-venda"
        subtitulo="Clientes com negociação faturada, cruzados com o último contato (WhatsApp ou manual) e os marcos de acompanhamento de 30/60/180/365 dias — quem tem marco pendente aparece primeiro."
      />
      <PosVendaClient clientes={clientes} />
    </div>
  );
}
