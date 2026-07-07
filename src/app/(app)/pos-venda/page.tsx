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
        subtitulo="Clientes que já compraram, ordenados por quem está há mais tempo sem contato — ligue, visite, ofereça manutenção ou peça indicação antes que esfrie."
      />
      <PosVendaClient clientes={clientes} />
    </div>
  );
}
