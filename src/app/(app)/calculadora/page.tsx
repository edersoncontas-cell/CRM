import { PageHeader } from "@/components/ui";
import { CalculadoraCustoHora } from "@/components/CalculadoraCustoHora";

export const dynamic = "force-dynamic";

// Calculadora avulsa de economia de combustível (New Holland × concorrente),
// para usar na visita, no balcão, no telefone. A conta completa de custo por
// hora e TCO continua na proposta, aberta pela negociação no funil.
export default function CalculadoraPage() {
  return (
    <div>
      <PageHeader
        titulo="Calculadora de combustível"
        subtitulo="Quanto o cliente economiza em diesel com a New Holland em vez do concorrente, com os números dele. Para a proposta completa (custo por hora e TCO), abra pela negociação no funil."
      />
      <CalculadoraCustoHora />
    </div>
  );
}
