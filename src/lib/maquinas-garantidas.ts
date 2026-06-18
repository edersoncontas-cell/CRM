import { db } from "@/lib/db";

// Máquinas próprias adicionadas DEPOIS do seed inicial. Como o deploy roda só
// `prisma db push` (não o seed), elas não entrariam em bancos já populados.
// Esta rotina faz upsert idempotente para garantir que existam, sem depender
// do seed. Mesma estratégia dos MUNICIPIOS_GARANTIDOS em regioes.ts.
type MaquinaNova = {
  marca: string;
  modelo: string;
  categoria: string;
  proprio: boolean;
  pesoOperacional: number;
  potencia: number;
  descricao: string;
  pontosFortes: string;
  diferenciais: string;
};

const MAQUINAS_GARANTIDAS: MaquinaNova[] = [
  {
    marca: "New Holland",
    modelo: "L320",
    categoria: "minicarregadeira",
    proprio: true,
    pesoOperacional: 2930,
    potencia: 67,
    descricao: "Minicarregadeira Série 300 de entrada, ágil para obras compactas e paisagismo.",
    pontosFortes: "Elevação vertical Super Boom; compacta e econômica.",
    diferenciais: "Robustez New Holland com baixo custo operacional.",
  },
  {
    marca: "New Holland",
    modelo: "L330",
    categoria: "minicarregadeira",
    proprio: true,
    pesoOperacional: 3765,
    potencia: 90,
    descricao: "Minicarregadeira Série 300 topo de linha, maior potência e capacidade de carga.",
    pontosFortes: "90 cv e ROC de 1.360 kg; elevação vertical para trabalhos pesados.",
    diferenciais: "Robustez New Holland com baixo custo operacional.",
  },
];

let maquinasGarantidas = false;

// Garante (idempotente) que as máquinas adicionadas após o seed existam no banco.
// Só preenche campos descritivos na criação; não sobrescreve edições do usuário.
export async function garantirMaquinasNovas(): Promise<void> {
  if (maquinasGarantidas) return;
  try {
    for (const m of MAQUINAS_GARANTIDAS) {
      await db.maquina.upsert({
        where: { marca_modelo: { marca: m.marca, modelo: m.modelo } },
        update: {}, // já existe: não mexe (preserva foco, vendas, ficha etc.)
        create: {
          marca: m.marca,
          modelo: m.modelo,
          categoria: m.categoria,
          proprio: m.proprio,
          pesoOperacional: m.pesoOperacional,
          potencia: m.potencia,
          descricao: m.descricao,
          pontosFortes: m.pontosFortes,
          diferenciais: m.diferenciais,
        },
      });
    }
  } catch (e) {
    console.error("Falha ao garantir máquinas novas:", e);
  }
  maquinasGarantidas = true;
}
