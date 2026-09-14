import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { PropostaClient } from "@/components/PropostaClient";
import { carregarProposta } from "@/lib/proposta-actions";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { isEnabled as whatsappHabilitado } from "@/lib/zapi";

export const dynamic = "force-dynamic";

export default async function PropostaPage({ params }: { params: { id: string } }) {
  await garantirManutencaoSeNecessario();
  const carregado = await carregarProposta(params.id);
  if (!carregado) notFound();

  return (
    <div>
      <Link href="/negociacoes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Funil de negociações
      </Link>
      <PageHeader
        titulo={`Proposta · ${carregado.contexto.clienteNome}`}
        subtitulo={`${carregado.contexto.maquina ?? "Máquina a definir"}${carregado.contexto.clienteMunicipio ? ` · ${carregado.contexto.clienteMunicipio}` : ""}. Calcule o custo por hora com os números do cliente, monte a proposta de uma página e envie pelo WhatsApp.`}
      />
      <PropostaClient
        negociacaoId={params.id}
        dadosIniciais={carregado.dados}
        contexto={carregado.contexto}
        enviadaEm={carregado.enviadaEm}
        whatsapp={whatsappHabilitado() && !!carregado.contexto.clienteTelefone}
      />
    </div>
  );
}
