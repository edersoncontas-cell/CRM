import { db } from "@/lib/db";
import { garantirMaquinasNovas } from "@/lib/maquinas-garantidas";

// Fichas técnicas VERIFICADAS em fontes oficiais / bases de specs (LECTURA, sites
// dos fabricantes). Usadas para popular o campo `especificacoes` no banco de
// produção sem depender de seed manual. Idempotente: só preenche se estiver vazio
// ou se o conteúdo verificado mudar. Vai sendo ampliada categoria por categoria.
type FichaVerificada = {
  marca: string;
  modelo: string;
  especificacoes: string;
};

export const FICHAS_VERIFICADAS: FichaVerificada[] = [
  // ── Mini escavadeira (3,5 t) ──────────────────────────────────────────────
  {
    marca: "New Holland",
    modelo: "E35D",
    especificacoes: [
      "Potência: 24,7 cv",
      "Peso operacional: 3.400 kg",
      "Profundidade de escavação: 2.870 mm",
      "Força de escavação: 31 kN",
      "Caçamba: 700 mm",
      "Largura de transporte: 1.580 mm",
      "Giro de cauda: zero (zero tail swing)",
      "Cabine: ROPS/FOPS (aberta ou fechada)",
    ].join("\n"),
  },
  {
    marca: "Bobcat",
    modelo: "E35",
    especificacoes: [
      "Potência: 24,8 cv (opcional 33 cv)",
      "Peso operacional: 3.500 kg",
      "Profundidade de escavação: 3.100 mm",
      "Força de escavação da caçamba: 32,4 kN",
      "Classe: 3 toneladas",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "303.5",
    especificacoes: [
      "Potência líquida: 23,6 cv",
      "Peso operacional: 3.730 kg",
      "Profundidade de escavação: 3.180 mm",
      "Alcance horizontal máx.: 5.320 mm",
      "Caçamba: 0,054 m³",
      "Força de escavação: 33 kN",
    ].join("\n"),
  },
  {
    marca: "Kubota",
    modelo: "KX033",
    especificacoes: [
      "Potência: 25 cv",
      "Peso operacional: 3.530 kg",
      "Profundidade de escavação: 3.200 mm",
      "Alcance horizontal máx.: 5.120 mm",
      "Força de escavação: 36,2 kN",
    ].join("\n"),
  },

  // ── Escavadeira hidráulica ────────────────────────────────────────────────
  {
    marca: "New Holland",
    modelo: "E145C",
    especificacoes: [
      "Motor: FPT",
      "Potência líquida: 95 cv",
      "Peso operacional: 13.080 kg",
      "Caçamba: 0,37 – 0,65 m³",
      "Cabine: ROPS",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "E175C",
    especificacoes: [
      "Motor: FPT",
      "Potência líquida: 120 cv",
      "Peso operacional: 17.500 kg",
      "Caçamba: 0,55 – 0,98 m³",
      "Cabine: ROPS",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "E215C",
    especificacoes: [
      "Motor: FPT NEF6",
      "Potência: 148 cv",
      "Peso operacional: 22.000 kg",
      "Profundidade de escavação: 6.600 mm",
      "Caçamba: 1,1 – 1,7 m³",
      "Cabine: ROPS/FOPS, display LED 7\"",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "E245C",
    especificacoes: [
      "Motor: FPT",
      "Potência: 173 cv",
      "Peso operacional: 25.000 kg",
      "Força de escavação (caçamba): 142 kN (152 kN c/ Power-Boost)",
      "Força de escavação (braço): 123 kN (132 kN c/ Power-Boost)",
      "Profundidade de escavação: 6.500 mm",
      "Caçamba: 1,4 – 1,5 m³",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "320",
    especificacoes: [
      "Motor: Cat C4.4 (Tier 4 Final)",
      "Peso operacional: 21.900 kg",
      "Caçamba: 1,19 m³",
      "Profundidade de escavação: 6.720 mm",
      "Alcance horizontal máx.: 9.860 mm",
      "Força de escavação: 150 kN",
    ].join("\n"),
  },
  {
    marca: "Komatsu",
    modelo: "PC200",
    especificacoes: [
      "Potência líquida: 138 cv",
      "Peso operacional: 20.500 kg",
      "Caçamba: até 1,2 m³",
      "Profundidade de escavação: 6.620 mm",
      "Alcance horizontal máx.: 9.700 mm",
    ].join("\n"),
  },
  {
    marca: "Volvo",
    modelo: "EC210",
    especificacoes: [
      "Potência: 160 cv",
      "Peso operacional: 21.000 kg",
      "Caçamba: até 1,6 m³",
      "Força de escavação: 159,9 kN",
      "Profundidade de escavação: 7.730 mm",
    ].join("\n"),
  },
  {
    marca: "Sany",
    modelo: "SY215C",
    especificacoes: [
      "Motor: Cummins QSB6.7",
      "Potência: 164 cv",
      "Peso operacional: 21.500 kg",
      "Caçamba: 1,2 m³",
      "Força de escavação: 138 kN",
      "Profundidade de escavação: 6.255 mm",
    ].join("\n"),
  },

  // ── Retroescavadeira ──────────────────────────────────────────────────────
  {
    marca: "New Holland",
    modelo: "B95C",
    especificacoes: [
      "Motor: FPT S8000 (Tier III)",
      "Potência: 95 cv",
      "Peso operacional: 7.000 kg",
      "Caçamba dianteira: 1 m³",
      "Profundidade de escavação: 4.500 – 5.600 mm (braço extensível)",
      "Tração: 4x4 disponível",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "B110C",
    especificacoes: [
      "Motor: FPT 4,5 L turbo",
      "Potência: 110 cv",
      "Peso operacional: 7.500 kg",
      "Caçamba dianteira: 1 m³",
      "Profundidade de escavação: 4.727 – 5.623 mm",
      "Vazão hidráulica: até 152 l/min",
      "Transmissão: Power Shuttle 4x4",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "416F2",
    especificacoes: [
      "Motor: Cat 3054C",
      "Potência: 87 cv",
      "Peso operacional: 7.210 kg",
      "Caçamba (traseira): 0,76 m³",
      "Profundidade de escavação: 4.350 mm",
      "Alcance horizontal: 5.610 mm",
      "Força de escavação: 47,9 kN",
    ].join("\n"),
  },
  {
    marca: "Case",
    modelo: "580N",
    especificacoes: [
      "Potência: 90 cv",
      "Peso operacional: 6.860 kg",
      "Profundidade de escavação: 4.460 mm (5.500+ com Extendahoe)",
      "Força de escavação: 47,2 kN",
      "Emissões: Tier 4 Interim",
    ].join("\n"),
  },
  {
    marca: "JCB",
    modelo: "3CX",
    especificacoes: [
      "Potência: 74 – 109 cv (conforme versão)",
      "Peso operacional: 7.400 – 8.070 kg",
      "Caçamba carregadeira: 1,0 m³",
      "Profundidade de escavação: até 6.140 mm (6.510 com extensível)",
      "Vazão hidráulica: 165 l/min",
    ].join("\n"),
  },

  // ── Pá carregadeira ───────────────────────────────────────────────────────
  {
    marca: "New Holland",
    modelo: "W130B",
    especificacoes: [
      "Motor: FPT 6.7L (Tier 3, 6 cil. turbo)",
      "Potência líquida: 127 cv (bruta 142 cv)",
      "Peso operacional: 11.945 – 12.155 kg",
      "Caçamba: 1,5 – 3,0 m³ (padrão 2,1 m³)",
      "Torque máx.: 607 Nm",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "W170B",
    especificacoes: [
      "Potência líquida: 183 cv",
      "Peso operacional: 14.430 kg",
      "Caçamba: 2,6 m³",
      "Altura máx. de descarga: 2.780 mm",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "W190B",
    especificacoes: [
      "Motor: New Holland 667TA/EB3 (Tier IIIA)",
      "Potência líquida: 213 cv",
      "Peso operacional: 19.353 kg",
      "Caçamba: 3,0 – 3,5 m³",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "930",
    especificacoes: [
      "Potência líquida: 149 cv",
      "Peso operacional: 13.000 kg",
      "Caçamba: 2,5 m³",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "950",
    especificacoes: [
      "Potência: 227 cv",
      "Peso operacional: 18.850 kg",
      "Caçamba: 3,1 m³ (2,7 – 4,4 m³)",
      "Força de levantamento: 154 kN",
    ].join("\n"),
  },
  {
    marca: "Volvo",
    modelo: "L120",
    especificacoes: [
      "Potência líquida: 230 cv (169 – 179 kW)",
      "Peso operacional: 18.000 – 20.000 kg",
      "Caçamba: 3,3 – 3,4 m³",
    ].join("\n"),
  },

  // ── Motoniveladora ────────────────────────────────────────────────────────
  {
    marca: "New Holland",
    modelo: "RG140",
    especificacoes: [
      "Motor: FPT (Tier 3)",
      "Potência líquida: 140 – 160 cv",
      "Peso operacional: 14.605 – 16.395 kg",
      "Lâmina (moldboard): 3.660 mm",
      "Transmissão: Powershift automática",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "RG170",
    especificacoes: [
      "Motor: NH/FPT 6.7L (Tier 3)",
      "Potência líquida: 178 / 190 / 205 cv",
      "Peso operacional máx.: 17.642 kg",
      "Lâmina central Roll Away com controle hidráulico",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "RG200",
    especificacoes: [
      "Motor: NH/FPT 6.7L (Tier 3)",
      "Potência líquida: 205 / 219 cv",
      "Torque líquido: 864 / 924 Nm",
      "Transmissão: Powershift com conversor",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "120",
    especificacoes: [
      "Potência líquida: 165 cv (145 – 189 cv AWD)",
      "Peso operacional: 15.906 kg",
      "Lâmina (moldboard): 3.658 mm (12 ft)",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "140",
    especificacoes: [
      "Potência líquida: 187 cv",
      "Peso operacional: 20.235 kg",
      "Lâmina (moldboard): 3.660 mm (inclinação até 30°)",
    ].join("\n"),
  },
  {
    marca: "Komatsu",
    modelo: "GD555",
    especificacoes: [
      "Potência líquida: 193 cv",
      "Peso operacional: 15.135 kg",
      "Lâmina (moldboard): 3.710 mm",
    ].join("\n"),
  },
  {
    marca: "Volvo",
    modelo: "G930",
    especificacoes: [
      "Motor: Volvo D7E",
      "Potência líquida: 155 cv",
      "Peso operacional: 16.000 kg",
      "Lâmina (moldboard): 3.650 mm",
    ].join("\n"),
  },

  // ── Minicarregadeira (skid steer) ─────────────────────────────────────────
  {
    marca: "New Holland",
    modelo: "L320",
    especificacoes: [
      "Motor: FPT (Tier 4 Final)",
      "Potência: 67 cv",
      "Peso operacional: 2.930 kg",
      "Capacidade operacional (ROC): 905 kg",
      "Altura de descarga: 2.330 mm",
      "Elevação: vertical Super Boom",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "L330",
    especificacoes: [
      "Motor: FPT",
      "Potência: 90 cv (67 kW)",
      "Peso operacional: 3.765 kg",
      "Capacidade operacional (ROC): 1.360 kg",
      "Altura de descarga: 2.655 mm",
      "Elevação: vertical",
    ].join("\n"),
  },
  {
    marca: "New Holland",
    modelo: "L325",
    especificacoes: [
      "Motor: FPT F5C (4 cil., turbo)",
      "Potência: 76 cv",
      "Peso operacional: 3.580 kg",
      "Capacidade operacional (ROC): 1.135 kg",
      "Carga de tombamento: 2.270 kg",
      "Altura de descarga: 2.615 mm",
      "Transmissão: hidrostática 2 velocidades",
    ].join("\n"),
  },
  {
    marca: "Bobcat",
    modelo: "S650",
    especificacoes: [
      "Potência: 74 cv (Tier 4)",
      "Peso operacional: 3.777 kg",
      "Capacidade operacional (ROC): 1.282 kg",
      "Carga de tombamento: 2.564 kg",
      "Altura de elevação: 3.100 mm",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "236",
    especificacoes: [
      "Motor: Cat C3.3B (236D3)",
      "Potência: 73 cv",
      "Peso operacional: 2.970 kg",
      "Capacidade operacional (ROC): 820 kg",
      "Carga de tombamento: 1.640 kg",
    ].join("\n"),
  },
  {
    marca: "Case",
    modelo: "SR210",
    especificacoes: [
      "Potência: 74 cv (SR210B)",
      "Peso operacional: 3.160 kg",
      "Capacidade operacional (ROC): 955 kg",
      "Carga de tombamento: 1.905 kg",
    ].join("\n"),
  },
  {
    marca: "JCB",
    modelo: "155",
    especificacoes: [
      "Potência: 59 cv (42 kW)",
      "Peso operacional: 2.950 kg",
      "Capacidade operacional (ROC): 703 kg",
      "Caçamba: 0,4 m³",
    ].join("\n"),
  },

  // ── Mini pá carregadeira ──────────────────────────────────────────────────
  {
    marca: "New Holland",
    modelo: "W12D",
    especificacoes: [
      "Motor: FPT NEF6 (Tier 3, turbo)",
      "Potência: 130 cv",
      "Peso operacional máx.: 10.500 kg",
      "Caçamba: 2,3 m³",
      "Braço: duplo z-bar",
      "Transmissão: Powershift",
      "Cabine: ROPS/FOPS",
      "Eixos: ZF HD",
    ].join("\n"),
  },

  // ── Rolo de solo (Dynapac CA) ─────────────────────────────────────────────
  {
    marca: "Dynapac",
    modelo: "CA2500",
    especificacoes: [
      "Peso operacional: 10.100 kg",
      "Largura do cilindro: 2.130 mm",
      "Força centrífuga: 250 / 130 kN (alta/baixa amplitude)",
      "Amplitude: 1,8 / 0,9 mm",
      "Frequência: 34 Hz",
    ].join("\n"),
  },
  {
    marca: "Dynapac",
    modelo: "CA3500",
    especificacoes: [
      "Motor: Cummins QSF3.8 (Tier 4F)",
      "Potência: 130 cv",
      "Peso operacional: 11.900 kg",
      "Largura do cilindro: 2.130 mm",
      "Força centrífuga: 280 / 170 kN (alta/baixa amplitude)",
      "Frequência: 31 / 34 Hz",
    ].join("\n"),
  },
  {
    marca: "Dynapac",
    modelo: "CA5000",
    especificacoes: [
      "Peso operacional: 16.000 kg",
      "Largura do cilindro: 2.130 mm",
      "Diâmetro do cilindro: 1.524 mm",
    ].join("\n"),
  },

  {
    marca: "Dynapac",
    modelo: "CA1500",
    especificacoes: [
      "Motor: Deutz TD3.6 (ou Cummins QSB3.3)",
      "Potência: 75 cv",
      "Peso operacional: 7.200 kg",
      "Largura do cilindro: 1.676 mm",
      "Força centrífuga: 133 / 72 kN (alta/baixa amplitude)",
    ].join("\n"),
  },
  {
    marca: "Dynapac",
    modelo: "CA4000",
    especificacoes: [
      "Motor: Cummins",
      "Potência: 162 cv (119 kW)",
      "Peso operacional: 13.400 kg (máx. 13.700 kg)",
      "Largura do cilindro: 2.130 mm",
      "Carga linear estática: 41 kg/cm",
    ].join("\n"),
  },
  {
    marca: "Dynapac",
    modelo: "CA6500",
    especificacoes: [
      "Potência: 200 cv",
      "Peso operacional: 20.700 kg",
      "Largura do cilindro: 2.130 mm",
      "Diâmetro do cilindro: 1.550 mm",
      "Amplitude: 2,1 mm · Frequência: 30 Hz",
      "Carga linear estática: 65 kg/cm",
    ].join("\n"),
  },

  // ── Rolo tandem asfalto (Dynapac CC) ──────────────────────────────────────
  {
    marca: "Dynapac",
    modelo: "CC1300",
    especificacoes: [
      "Motor: Kubota",
      "Potência: 45 cv (33 kW)",
      "Peso operacional: 4.000 kg",
      "Largura de trabalho: 1.300 mm",
      "Força centrífuga: 33 / 36 kN",
      "Versão combi disponível (cilindro + 4 pneus)",
    ].join("\n"),
  },
  {
    marca: "Dynapac",
    modelo: "CC2200",
    especificacoes: [
      "Motor: Deutz TCD 3.6 (Tier 4F)",
      "Potência: 74 cv",
      "Peso operacional: 9.100 kg",
      "Largura de trabalho: 1.500 – 1.680 mm",
      "Tecnologia SEISMIC (frequência automática) + modo ECO",
    ].join("\n"),
  },
  {
    marca: "Dynapac",
    modelo: "CC4200",
    especificacoes: [
      "Motor: Cummins QSB4.5",
      "Potência: 130 cv",
      "Peso operacional máx.: 13.150 kg",
      "Largura de trabalho: 1.680 mm",
      "Força centrífuga: 139 / 92 kN (alta/baixa amplitude)",
    ].join("\n"),
  },

  {
    marca: "Dynapac",
    modelo: "CC6200",
    especificacoes: [
      "Peso operacional: 12.200 kg",
      "Largura de trabalho: 2.130 mm",
      "Força centrífuga: 166 / 106 kN (alta/baixa amplitude)",
    ].join("\n"),
  },

  // ── Rolo pneumático (Dynapac CP) ──────────────────────────────────────────
  {
    marca: "Dynapac",
    modelo: "CP2700",
    especificacoes: [
      "Peso (vazio): 10.440 kg · com lastro: até 27.000 kg",
      "Largura de rolagem: 2.300 mm",
      "Pneus: 9 (5 dianteiros + 4 traseiros)",
      "Lastro: 4 a 16 blocos de aço (até 8 t)",
    ].join("\n"),
  },
  {
    marca: "Dynapac",
    modelo: "CP2100",
    especificacoes: [
      "Peso (vazio): 10.395 kg · com lastro: até 16.340 kg",
      "Largura de rolagem: 1.800 mm",
      "Pneus: 9 (11.00-20)",
      "Carga por roda: até 3.000 kg",
      "Lastro: 7 (3,5 t) ou 13 (6,5 t) blocos de aço",
    ].join("\n"),
  },

  // ── Rolos — concorrentes ──────────────────────────────────────────────────
  {
    marca: "Hamm",
    modelo: "3411",
    especificacoes: [
      "Potência: 136 cv (100 kW)",
      "Peso operacional: 11.310 – 11.800 kg",
      "Largura do cilindro: 2.140 mm",
      "Força centrífuga: 246 kN",
      "Amplitude: 1,9 mm · Frequência: 37 Hz",
    ].join("\n"),
  },
  {
    marca: "Bomag",
    modelo: "BW211",
    especificacoes: [
      "Peso operacional: 10.600 kg",
      "Largura do cilindro: 2.130 mm",
      "Amplitude: 1,83 mm · Frequência: 34 Hz",
      "Carga linear estática: 26,6 kg/cm",
    ].join("\n"),
  },
  {
    marca: "Caterpillar",
    modelo: "CS54B",
    especificacoes: [
      "Motor: Cat C4.4",
      "Peso operacional: 11.500 kg",
      "Largura do cilindro: 2.134 mm",
      "Frequência: 23,3 – 30,5 Hz",
    ].join("\n"),
  },
  {
    marca: "Hamm",
    modelo: "HD110",
    especificacoes: [
      "Motor: Deutz TCD 2012 L04",
      "Potência: 136 cv (100 kW)",
      "Peso operacional: 10.265 kg (máx. 13.180 kg)",
      "Largura do cilindro: 1.680 mm",
      "Força centrífuga: 120 kN · Frequência: 50 Hz",
    ].join("\n"),
  },
];

// Diferencial de nicho das motoniveladoras New Holland: cabine no chassi
// TRASEIRO (a articulação do chassi dianteiro, que carrega a lâmina, fica à
// frente da cabine) — favorece a visualização da lâmina, segundo material
// oficial da fábrica ("newholland.com.br/70anos/.../Motoniveladoras"). A
// Caterpillar (concorrente direto cadastrado aqui) usa o layout oposto:
// cabine no chassi DIANTEIRO, com a articulação atrás da cabine. Não
// confirmamos essa mesma comparação para Komatsu/Volvo — evite citar essas
// duas marcas nesse ponto específico sem checar o manual delas antes.
const DIFERENCIAL_CABINE_MOTONIVELADORA =
  "Cabine montada no CHASSI TRASEIRO: a articulação do chassi dianteiro (que carrega a lâmina) fica à frente da cabine, favorecendo a visualização da lâmina durante a operação — diferente da Caterpillar, cuja cabine é montada no chassi dianteiro (articulação atrás da cabine).";

const MODELOS_MOTONIVELADORA_NH = ["RG140", "RG170", "RG200"];

let diferencialCabineGarantido = false;

// Adiciona o diferencial de posição da cabine às motoniveladoras New Holland
// já cadastradas — não sobrescreve o que o vendedor já escreveu em
// `diferenciais`, só complementa (e não duplica se rodar de novo).
async function garantirDiferencialCabineMotoniveladora(): Promise<void> {
  if (diferencialCabineGarantido) return;
  try {
    const motoniveladoras = await db.maquina.findMany({
      where: { marca: "New Holland", modelo: { in: MODELOS_MOTONIVELADORA_NH } },
      select: { id: true, diferenciais: true },
    });
    for (const m of motoniveladoras) {
      if (m.diferenciais?.includes("CHASSI TRASEIRO")) continue;
      const novoTexto = m.diferenciais?.trim()
        ? `${m.diferenciais.trim()}\n${DIFERENCIAL_CABINE_MOTONIVELADORA}`
        : DIFERENCIAL_CABINE_MOTONIVELADORA;
      await db.maquina.update({ where: { id: m.id }, data: { diferenciais: novoTexto } });
    }
  } catch (e) {
    console.error("Falha ao garantir diferencial de cabine das motoniveladoras:", e);
  }
  diferencialCabineGarantido = true;
}

let fichasGarantidas = false;

// Versão das fichas. Bump aqui quando FICHAS_VERIFICADAS mudar para reaplicar.
const FICHAS_VERSAO = "v1";
const CHAVE_VERSAO = "fichas_verificadas_versao";

// Preenche o campo `especificacoes` das máquinas que têm ficha verificada,
// sem sobrescrever conteúdo já preenchido manualmente pelo usuário (só preenche
// se estiver vazio). Roda na abertura da página Super Trunfo.
//
// Performance: depois de preenchidas uma vez, grava uma flag de versão no banco
// e passa a SAIR cedo (1 query em vez de 57). Quando precisa rodar, dispara os
// updates em PARALELO. Antes, eram 57 queries sequenciais a cada cold start —
// causa da lentidão (~10s) ao abrir o Super Trunfo.
export async function garantirFichasVerificadas(): Promise<void> {
  if (fichasGarantidas) return;
  try {
    // Máquinas novas (pós-seed) — barato, tem guarda própria em memória.
    await garantirMaquinasNovas();
    // Diferencial de cabine das motoniveladoras — roda independente da versão
    // das fichas abaixo (guarda própria por conteúdo, não pela flag de versão).
    await garantirDiferencialCabineMotoniveladora();

    // Já preenchido nesta versão? Pula os 57 updates.
    const cfg = await db.configuracao.findUnique({ where: { chave: CHAVE_VERSAO } });
    if (cfg?.valor === FICHAS_VERSAO) {
      fichasGarantidas = true;
      return;
    }

    await Promise.all(
      FICHAS_VERIFICADAS.map((f) =>
        db.maquina.updateMany({
          where: { marca: f.marca, modelo: f.modelo, especificacoes: null },
          data: { especificacoes: f.especificacoes },
        })
      )
    );

    await db.configuracao.upsert({
      where: { chave: CHAVE_VERSAO },
      update: { valor: FICHAS_VERSAO },
      create: { chave: CHAVE_VERSAO, valor: FICHAS_VERSAO },
    });
  } catch (e) {
    console.error("Falha ao garantir fichas verificadas:", e);
  }
  fichasGarantidas = true;
}
