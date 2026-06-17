import { db } from "@/lib/db";

// "Municípios" especiais que representam regiões de OUTROS vendedores.
// Servem para classificar clientes fora da minha área e impedir que eles
// recebam campanhas/disparos automáticos (mas ainda podem ser atendidos
// normalmente se eles iniciarem a conversa).
export const REGIOES_FORA_AREA = ["Região Vix", "Região Norte"];

let garantido = false;

// Garante (idempotente) que as regiões fora de área existam no banco.
export async function garantirRegioes(): Promise<void> {
  if (garantido) return;
  for (const nome of REGIOES_FORA_AREA) {
    await db.municipio.upsert({
      where: { nome },
      update: { foraDeArea: true, regiao: "Fora da área" },
      create: { nome, foraDeArea: true, regiao: "Fora da área" },
    });
  }
  garantido = true;
}
