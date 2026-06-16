import { PageHeader } from "@/components/ui";
import { Simulador } from "@/components/Simulador";

export const dynamic = "force-dynamic";

export default function SimuladorPage() {
  return (
    <div>
      <PageHeader
        titulo="Simulador"
        subtitulo="Calcule financiamento (Moderfrota/Finame/Pronaf) e consórcio na hora"
      />
      <Simulador />
      <p className="mt-4 text-xs text-slate-400">
        As taxas são valores de referência e podem ser ajustadas conforme a negociação com o banco.
      </p>
    </div>
  );
}
