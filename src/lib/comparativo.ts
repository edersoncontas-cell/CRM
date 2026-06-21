// Comparativo de máquinas: casa a minha máquina (New Holland/Dynapac) com
// concorrentes da MESMA categoria e faixa de peso operacional, e monta os
// argumentos prontos (battlecard) de por que a minha ganha.

export interface MaquinaComparavel {
  id: string;
  marca: string;
  modelo: string;
  categoria: string;
  proprio: boolean;
  pesoOperacional: number | null;
  potencia: number | null;
  descricao: string | null;
  pontosFortes: string | null;
  diferenciais: string | null;
  consumoLitrosHora?: number | null;
}

export const CATEGORIAS: Record<string, string> = {
  miniescavadeira: "Mini escavadeira",
  escavadeira: "Escavadeira hidráulica",
  retroescavadeira: "Retroescavadeira",
  minicarregadeira: "Minicarregadeira",
  pacarregadeira: "Pá carregadeira",
  motoniveladora: "Motoniveladora",
  tratoresteira: "Trator de esteira",
  rolo_solo: "Rolo de solo",
  rolo_tandem: "Rolo tandem (asfalto)",
  rolo_pneumatico: "Rolo pneumático",
  paver: "Vibroacabadora",
  leve: "Equipamento leve",
};

// Encontra concorrentes na mesma categoria, dentro de ±20% do peso operacional.
export function concorrentesSimilares(
  minha: MaquinaComparavel,
  todas: MaquinaComparavel[]
): MaquinaComparavel[] {
  const peso = minha.pesoOperacional ?? 0;
  const tolerancia = Math.max(peso * 0.2, 1500);
  return todas
    .filter((m) => !m.proprio && m.categoria === minha.categoria)
    .filter((m) => {
      if (!peso || !m.pesoOperacional) return true; // sem peso: mostra mesmo assim
      return Math.abs(m.pesoOperacional - peso) <= tolerancia;
    })
    .sort((a, b) => {
      const da = Math.abs((a.pesoOperacional ?? peso) - peso);
      const dbb = Math.abs((b.pesoOperacional ?? peso) - peso);
      return da - dbb;
    });
}

// Vantagens por marca concorrente (templates prontos, editáveis).
const VANTAGENS_POR_MARCA: Record<string, string> = {
  Caterpillar:
    "Investimento inicial e parcela mais acessíveis que a Cat, com Finame facilitado, mantendo robustez e a rede de assistência/peças New Holland.",
  Komatsu:
    "Custo de aquisição mais competitivo e disponibilidade de peças/serviço na região, com produtividade equivalente.",
  Volvo:
    "Melhor custo-benefício e parcela menor, com a tradição New Holland no Brasil e revenda forte.",
  JCB:
    "Tradição e liderança histórica da New Holland em retroescavadeiras no Brasil, motor FPT econômico e a maior rede de peças do segmento.",
  Case:
    "Mesma robustez de mercado, com a rede e o pós-venda New Holland e versões pensadas para o cliente brasileiro.",
  XCMG:
    "Marca consolidada há décadas no Brasil: melhor valor de revenda, rede de pós-venda madura e menor risco de disponibilidade de peças que as chinesas.",
  Sany:
    "Tradição, revenda e suporte consolidados no Brasil reduzem o risco frente à concorrente chinesa, com custo operacional comprovado.",
  SDLG:
    "Confiabilidade e revenda superiores à entrada chinesa, com a estrutura de assistência New Holland.",
  LiuGong:
    "Melhor revenda e rede de peças no Brasil, com durabilidade comprovada.",
  Hyundai:
    "Suporte local e revenda mais sólidos, com produtividade equivalente e parcela competitiva.",
  Develon:
    "Rede de assistência consolidada e melhor revenda, com desempenho equivalente.",
  "John Deere":
    "Foco total em construção e a rede New Holland dedicada ao segmento, com custo operacional competitivo.",
  Liebherr:
    "Custo de aquisição e parcela muito mais acessíveis, com robustez e suporte para o dia a dia da obra.",
  Bobcat:
    "Custo-benefício superior e rede de peças mais ampla na região.",
  Kubota:
    "Maior robustez para serviço pesado e rede de assistência mais ampla.",
  Randon:
    "Motor FPT e a tradição New Holland em retroescavadeiras, com melhor revenda.",
  Shantui:
    "Revenda e suporte consolidados no Brasil reduzem o risco frente à marca chinesa.",
  // Concorrentes de compactação (Dynapac ganha)
  Hamm:
    "Dynapac entrega compactação inteligente com telemetria e acabamento premium, fabricação nacional e a maior base instalada de rolos no Brasil — peças e suporte na hora.",
  Bomag:
    "Tecnologia sueca de compactação da Dynapac com fabricação nacional, melhor disponibilidade de peças e liderança de mercado no Brasil.",
  Ammann:
    "Dynapac oferece tecnologia de compactação e telemetria de ponta, com suporte local superior e revenda mais forte.",
  Müller:
    "Dynapac agrega compactação inteligente, telemetria Dyn@Link e acabamento premium no asfalto, com tecnologia sueca.",
};

export function vantagemContra(minha: MaquinaComparavel, conc: MaquinaComparavel): string {
  const base =
    VANTAGENS_POR_MARCA[conc.marca] ??
    "Melhor custo-benefício, revenda e rede de assistência, com a confiabilidade da nossa marca.";
  const forte = minha.pontosFortes ? ` Destaques da ${minha.modelo}: ${minha.pontosFortes}` : "";
  return base + forte;
}

// Diferença de peso/potência formatada (para a tabela comparativa).
export function delta(minhaVal: number | null, concVal: number | null): string {
  if (minhaVal == null || concVal == null) return "—";
  const d = minhaVal - concVal;
  if (d === 0) return "igual";
  return d > 0 ? `+${d.toLocaleString("pt-BR")}` : d.toLocaleString("pt-BR");
}
