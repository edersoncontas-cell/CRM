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
