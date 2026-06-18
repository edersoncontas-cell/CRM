import { db } from "@/lib/db";

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
    modelo: "E145C EVO",
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
    modelo: "E175C EVO",
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
    modelo: "E215C EVO",
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
    modelo: "E245C EVO",
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
];

let fichasGarantidas = false;

// Preenche o campo `especificacoes` das máquinas que têm ficha verificada,
// sem sobrescrever conteúdo já preenchido manualmente pelo usuário (só preenche
// se estiver vazio). Roda na abertura da página Super Trunfo.
export async function garantirFichasVerificadas(): Promise<void> {
  if (fichasGarantidas) return;
  try {
    for (const f of FICHAS_VERIFICADAS) {
      await db.maquina.updateMany({
        where: { marca: f.marca, modelo: f.modelo, especificacoes: null },
        data: { especificacoes: f.especificacoes },
      });
    }
  } catch (e) {
    console.error("Falha ao garantir fichas verificadas:", e);
  }
  fichasGarantidas = true;
}
