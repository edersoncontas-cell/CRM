// Catálogo Dynapac atual (linha comercializada no Brasil), organizado por
// tipo. Substitui a lista antiga do seed, que tinha nomes fora de linha
// ("CA1500", "CA2500", "CC1300"…).
//
// Padrão de nome dos rolos de SOLO (pedido do vendedor): o nome curto da
// fábrica, sem os dois zeros do meio — CA6500 D vira "CA65 D", CA6500 PD vira
// "CA65 PD". D = cilindro liso; PD = cilindro pé-de-carneiro (padfoot).
// Os demais tipos (tandem CC, pneumático CP, vibroacabadora, fresadora…)
// mantêm o nome de fábrica como está.
//
// Módulo PURO (sem banco e sem IA) para poder ser testado e reaproveitado
// pelo seed (prisma/seed.ts), pela rotina de máquinas garantidas e pela
// migração que renomeia o que já estava cadastrado.

export type MaquinaCatalogo = {
  marca: "Dynapac";
  modelo: string;
  categoria: string;
  proprio: true;
  pesoOperacional?: number;
  potencia?: number;
  descricao: string;
  pontosFortes: string;
  diferenciais: string;
};

// ── Regra de nome dos rolos de solo ─────────────────────────────────────────
// "CA6500D" | "CA6500 D" | "ca6500d" → "CA65 D"; "CA2500PD" → "CA25 PD".
// Nome que não seja rolo de solo com quatro dígitos volta como está (só
// arrumando maiúsculas e o espaço antes do sufixo).
export function nomeCurtoRoloSolo(modelo: string): string {
  const bruto = modelo.trim().toUpperCase().replace(/\s+/g, " ");
  const m = bruto.match(/^CA\s?(\d{2})00\s?(PD|D)?$/);
  if (m) return `CA${m[1]}${m[2] ? ` ${m[2]}` : " D"}`;
  const curto = bruto.match(/^CA\s?(\d{2})\s?(PD|D)$/);
  if (curto) return `CA${curto[1]} ${curto[2]}`;
  return bruto;
}

// Modelos antigos do CRM → nome atual. Usado pela migração para renomear o
// que já está cadastrado (preservando fichas e notas) em vez de duplicar.
export const RENOMEAR_DYNAPAC: Record<string, string> = {
  CA1500: "CA15 D",
  CA2500: "CA25 D",
  CA3500: "CA35 D",
  CA4000: "CA40 D",
  CA5000: "CA50 D",
  CA6500: "CA65 D",
  CA1300: "CA13 D",
  CA1300D: "CA13 D",
  CA1500D: "CA15 D",
  CA2500D: "CA25 D",
  CA3500D: "CA35 D",
  CA4000D: "CA40 D",
  CA5000D: "CA50 D",
  CA6500D: "CA65 D",
  CA1500PD: "CA15 PD",
  CA2500PD: "CA25 PD",
  CA3500PD: "CA35 PD",
  CA4000PD: "CA40 PD",
  CA5000PD: "CA50 PD",
  CA6500PD: "CA65 PD",
  // Tandem e pneumático mantêm o nome de fábrica; só ganham o sufixo da
  // geração atual, para o cadastro não ficar com duas linhas da mesma máquina.
  CC1100: "CC1100 VI",
  CC1200: "CC1200 VI",
  CC2200: "CC2200 VI",
  CC4200: "CC4200 VI",
  CC5200: "CC5200 VI",
  CC6200: "CC6200 VI",
};

// Modelos que saíram de linha e não têm equivalente direto — somem do
// catálogo (negociações antigas guardam o nome como texto e não se perdem).
export const DYNAPAC_FORA_DE_LINHA = ["CC1300", "CA150", "CA250"];

const solo = (
  numero: string,
  variante: "D" | "PD",
  peso: number,
  potencia: number,
  descricao: string,
  pontosFortes: string
): MaquinaCatalogo => ({
  marca: "Dynapac",
  modelo: `CA${numero} ${variante}`,
  categoria: "rolo_solo",
  proprio: true,
  pesoOperacional: peso,
  potencia,
  descricao: `${descricao} ${variante === "PD" ? "Cilindro pé-de-carneiro (padfoot), para solo coesivo/argiloso." : "Cilindro liso, para solo granular, brita e base."}`,
  pontosFortes,
  diferenciais: "Tecnologia sueca de compactação, telemetria Dyn@Link e assistência da rede no ES.",
});

// ── ROLOS DE SOLO (CA) ──────────────────────────────────────────────────────
const ROLOS_SOLO: MaquinaCatalogo[] = [
  ...(
    [
      { n: "13", peso: 7100, cv: 75, desc: "Rolo de solo compacto, para obras urbanas, loteamentos e valas.", fortes: "Manobrabilidade em espaço curto; ótimo em camada fina." },
      { n: "15", peso: 7800, cv: 100, desc: "Rolo de solo de 7,8 t da linha Rhino, para loteamento e pavimentação leve.", fortes: "Relação peso/força equilibrada; sobe rampa com folga." },
      { n: "25", peso: 10500, cv: 110, desc: "Rolo de solo de 10,5 t da linha Rhino — o mais vendido do segmento.", fortes: "Maior base instalada do Brasil; peça e assistência em qualquer lugar." },
      { n: "30", peso: 11500, cv: 130, desc: "Rolo de solo de 11,5 t da linha Rhino, para aterro e base de rodovia.", fortes: "Amplitude alta para camada espessa; estabilidade em talude." },
      { n: "35", peso: 12000, cv: 130, desc: "Rolo de solo de 12 t da linha Rhino, para aterro e rocha.", fortes: "Compacta camada espessa sem retrabalho; chassi reforçado." },
      { n: "40", peso: 13400, cv: 162, desc: "Rolo de solo de 13,4 t para obra pesada e terraplenagem contínua.", fortes: "Força de compactação alta com consumo baixo." },
      { n: "50", peso: 16000, cv: 175, desc: "Rolo de solo de 16 t para grandes terraplenagens.", fortes: "Produtividade em grande volume; cabine com boa visibilidade." },
      { n: "65", peso: 20700, cv: 200, desc: "Rolo de solo de 20,7 t para mineração, barragem e enrocamento.", fortes: "Máxima força de compactação da linha; estrutura para serviço severo." },
    ] as const
  ).flatMap(({ n, peso, cv, desc, fortes }) => [
    solo(n, "D", peso, cv, desc, fortes),
    solo(n, "PD", peso, cv, desc, fortes),
  ]),
];

// ── ROLOS DE ASFALTO / TANDEM (CC) ──────────────────────────────────────────
const ROLOS_TANDEM: MaquinaCatalogo[] = [
  { marca: "Dynapac", modelo: "CC900", categoria: "rolo_tandem", proprio: true, pesoOperacional: 2600,
    descricao: "Tandem compacto para tapa-buraco, calçada, ciclovia e reparo urbano.",
    pontosFortes: "Passa onde máquina grande não entra; acabamento bom já na primeira passada.",
    diferenciais: "Fácil de transportar em prancha pequena." },
  { marca: "Dynapac", modelo: "CC1100 VI", categoria: "rolo_tandem", proprio: true, pesoOperacional: 2700,
    descricao: "Tandem leve da geração VI para ruas, estacionamentos e reparos.",
    pontosFortes: "Aspersão de água confiável; visibilidade das bordas do cilindro.",
    diferenciais: "Geração VI com comando simplificado." },
  { marca: "Dynapac", modelo: "CC1200 VI", categoria: "rolo_tandem", proprio: true, pesoOperacional: 2900,
    descricao: "Tandem leve de 1,2 m de cilindro para vias urbanas.",
    pontosFortes: "Acabamento uniforme em capa fina; manutenção simples.",
    diferenciais: "Geração VI, mesma plataforma do CC1100." },
  { marca: "Dynapac", modelo: "CC2200 VI", categoria: "rolo_tandem", proprio: true, pesoOperacional: 7000,
    descricao: "Tandem de 7 t fabricado em Sorocaba, com cabine — o cavalo de batalha do asfalto.",
    pontosFortes: "Produtividade em rua e rodovia; conforto do operador em jornada longa.",
    diferenciais: "Fabricação nacional: prazo de entrega e peça no país." },
  { marca: "Dynapac", modelo: "CC3200", categoria: "rolo_tandem", proprio: true,
    descricao: "Tandem intermediário para pavimentação urbana e rodovia de porte médio.",
    pontosFortes: "Compactação uniforme com boa velocidade de trabalho.",
    diferenciais: "Sistema de vibração Dynapac com amplitude ajustável." },
  { marca: "Dynapac", modelo: "CC3800", categoria: "rolo_tandem", proprio: true,
    descricao: "Tandem para rodovia, entre o CC3200 e o CC4200.",
    pontosFortes: "Boa cobertura por passada; estabilidade em capa espessa.",
    diferenciais: "Plataforma consolidada, com peça fácil." },
  { marca: "Dynapac", modelo: "CC4200 VI", categoria: "rolo_tandem", proprio: true, pesoOperacional: 10000,
    descricao: "Tandem de 10 t fabricado no Brasil, para rodovia e obra pesada de asfalto.",
    pontosFortes: "Acabamento superior em capa espessa; robustez comprovada.",
    diferenciais: "Linha nacional com suporte forte da rede." },
  { marca: "Dynapac", modelo: "CC5200 VI", categoria: "rolo_tandem", proprio: true,
    descricao: "Tandem pesado para rodovia de pista dupla e aeroporto.",
    pontosFortes: "Alta produção por hora; compactação homogênea.",
    diferenciais: "Geração VI com controle de compactação." },
  { marca: "Dynapac", modelo: "CC6200 VI", categoria: "rolo_tandem", proprio: true, pesoOperacional: 12000,
    descricao: "Tandem de 12 t, o maior da linha, para grandes pavimentações.",
    pontosFortes: "Produção máxima em pista longa; acabamento de rodovia.",
    diferenciais: "Tecnologia Dynapac para obra de grande porte." },
  { marca: "Dynapac", modelo: "D.ONE", categoria: "rolo_tandem", proprio: true,
    descricao: "Rolo de oscilação direcionada: compacta perto de ponte, meio-fio e estrutura sensível sem vibrar o entorno.",
    pontosFortes: "Compacta sem transmitir vibração para construções vizinhas; ótimo em junta e reparo.",
    diferenciais: "Exclusividade Dynapac — não há equivalente direto na concorrência." },
];

// ── ROLOS PNEUMÁTICOS (CP) ──────────────────────────────────────────────────
const ROLOS_PNEUMATICOS: MaquinaCatalogo[] = [
  { marca: "Dynapac", modelo: "CP1200", categoria: "rolo_pneumatico", proprio: true,
    descricao: "Pneumático compacto fabricado em Sorocaba, para selagem em via urbana.",
    pontosFortes: "Selagem e impermeabilização da capa; lastro ajustável.",
    diferenciais: "Fabricação nacional, entrega rápida." },
  { marca: "Dynapac", modelo: "CP2100", categoria: "rolo_pneumatico", proprio: true, pesoOperacional: 10000,
    descricao: "Pneumático para selagem e acabamento de asfalto em rua e rodovia.",
    pontosFortes: "Fecha os poros da capa; versatilidade de lastro.",
    diferenciais: "Referência em selagem e acabamento." },
  { marca: "Dynapac", modelo: "CP2100W", categoria: "rolo_pneumatico", proprio: true, pesoOperacional: 10000,
    descricao: "Versão do CP2100 com cabine/configuração para jornada longa.",
    pontosFortes: "Mesmo desempenho do CP2100 com mais conforto.",
    diferenciais: "Operador rende mais no turno inteiro." },
  { marca: "Dynapac", modelo: "CP2700", categoria: "rolo_pneumatico", proprio: true, pesoOperacional: 20000,
    descricao: "Pneumático pesado para rodovia e aeroporto.",
    pontosFortes: "Grande capacidade de lastro; produtividade em pista longa.",
    diferenciais: "Robustez Dynapac para obra pesada." },
];

// ── VIBROACABADORAS (PAVIMENTADORAS) ────────────────────────────────────────
const PAVIMENTADORAS: MaquinaCatalogo[] = [
  { marca: "Dynapac", modelo: "SD2500CS", categoria: "paver", proprio: true,
    descricao: "Vibroacabadora sobre esteiras para rodovia e obra de médio/grande porte.",
    pontosFortes: "Tração em piso irregular; mesa com bom acabamento.",
    diferenciais: "Geração SD com comando eletrônico e nivelamento preciso." },
  { marca: "Dynapac", modelo: "SD2550CS", categoria: "paver", proprio: true,
    descricao: "Vibroacabadora sobre esteiras de maior largura de pavimentação.",
    pontosFortes: "Cobre pista larga em menos passadas.",
    diferenciais: "Mesa extensível e controle de nivelamento." },
  { marca: "Dynapac", modelo: "SD2500WS", categoria: "paver", proprio: true,
    descricao: "Vibroacabadora sobre pneus, ágil para obra urbana com deslocamento frequente.",
    pontosFortes: "Desloca-se pela própria via entre frentes de serviço.",
    diferenciais: "Mesma mesa da versão esteira, com mobilidade de pneu." },
  { marca: "Dynapac", modelo: "SD2550WS", categoria: "paver", proprio: true,
    descricao: "Vibroacabadora sobre pneus de maior largura de pavimentação.",
    pontosFortes: "Produção alta sem perder mobilidade.",
    diferenciais: "Indicada para prefeitura com várias frentes abertas." },
  { marca: "Dynapac", modelo: "F1250CS", categoria: "paver", proprio: true,
    descricao: "Vibroacabadora compacta sobre esteiras para rua, ciclovia e pátio.",
    pontosFortes: "Entra em obra estreita; fácil de transportar.",
    diferenciais: "Boa porta de entrada para prefeitura pequena." },
  { marca: "Dynapac", modelo: "F1700C", categoria: "paver", proprio: true,
    descricao: "Vibroacabadora sobre esteiras de porte médio.",
    pontosFortes: "Equilíbrio entre largura de pavimentação e transporte.",
    diferenciais: "Plataforma conhecida, com peça disponível." },
  { marca: "Dynapac", modelo: "F2500C", categoria: "paver", proprio: true,
    descricao: "Vibroacabadora sobre esteiras para rodovia e grandes volumes.",
    pontosFortes: "Alta capacidade de recebimento de massa.",
    diferenciais: "Produção contínua em pista longa." },
];

// ── ALIMENTADOR DE MASSA ────────────────────────────────────────────────────
const ALIMENTADORES: MaquinaCatalogo[] = [
  { marca: "Dynapac", modelo: "MF2500CS", categoria: "alimentador", proprio: true,
    descricao: "Alimentador de massa: recebe do caminhão e abastece a vibroacabadora sem parar a frente de serviço.",
    pontosFortes: "Acaba com a parada para troca de caminhão; capa mais homogênea.",
    diferenciais: "Versões com transportador lateral e homogeneizador de massa." },
];

// ── FRESADORAS ──────────────────────────────────────────────────────────────
const FRESADORAS: MaquinaCatalogo[] = [
  { marca: "Dynapac", modelo: "PL2000S", categoria: "fresadora", proprio: true,
    descricao: "Fresadora de asfalto para recuperação de pavimento.",
    pontosFortes: "Remove a capa velha com corte uniforme antes do recape.",
    diferenciais: "Serviço de fresagem abre porta para vender o recape completo." },
  { marca: "Dynapac", modelo: "PL2500S", categoria: "fresadora", proprio: true,
    descricao: "Fresadora de maior largura de corte para rodovia.",
    pontosFortes: "Produção alta em pista longa.",
    diferenciais: "Complementa a linha de pavimentação." },
];

// ── COMPACTAÇÃO LEVE ────────────────────────────────────────────────────────
const LEVES: MaquinaCatalogo[] = [
  { marca: "Dynapac", modelo: "LP6500", categoria: "leve", proprio: true,
    descricao: "Rolo de vala com controle remoto, para trincheira, rede de água/esgoto e espaço confinado.",
    pontosFortes: "Compacta vala estreita sem operador dentro do buraco (segurança).",
    diferenciais: "Controle remoto por rádio; muito procurado por saneamento." },
];

export const CATALOGO_DYNAPAC: MaquinaCatalogo[] = [
  ...ROLOS_SOLO,
  ...ROLOS_TANDEM,
  ...ROLOS_PNEUMATICOS,
  ...PAVIMENTADORAS,
  ...ALIMENTADORES,
  ...FRESADORAS,
  ...LEVES,
];

// Só os modelos (para as listas da IA e para a heurística de conversa).
export const MODELOS_DYNAPAC: string[] = CATALOGO_DYNAPAC.map((m) => m.modelo);
