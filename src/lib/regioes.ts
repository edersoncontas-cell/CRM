import { db } from "@/lib/db";

// "Municípios" especiais que representam regiões de OUTROS vendedores.
// Servem para classificar clientes fora da minha área e impedir que eles
// recebam campanhas/disparos automáticos (mas ainda podem ser atendidos
// normalmente se eles iniciarem a conversa).
export const REGIOES_FORA_AREA = ["Região Vix", "Região Norte"];

// Municípios inválidos que devem ser removidos do banco caso existam.
const MUNICIPIOS_REMOVER = ["Palantino"];

let garantido = false;

// Garante (idempotente) que as regiões fora de área existam e remove entradas inválidas.
export async function garantirRegioes(): Promise<void> {
  if (garantido) return;
  for (const nome of REGIOES_FORA_AREA) {
    await db.municipio.upsert({
      where: { nome },
      update: { foraDeArea: true, regiao: "Fora da área" },
      create: { nome, foraDeArea: true, regiao: "Fora da área" },
    });
  }
  // Remove municípios incorretos silenciosamente (ignora se não existir)
  for (const nome of MUNICIPIOS_REMOVER) {
    await db.municipio.deleteMany({ where: { nome } });
  }
  garantido = true;
}

// Termos que indicam contatos que NÃO são clientes (o CRM é exclusivo de clientes).
const TERMOS_DESCARTE = ["POUSADA", "HOTEL", "PME"];

let limpezaFeita = false;

// Remove do banco contatos que não são clientes (pousadas, hotéis, PME...).
// Mantém-se idempotente e barato (dataset pequeno).
export async function limparContatosDescartados(): Promise<void> {
  if (limpezaFeita) return;
  try {
    await db.cliente.deleteMany({
      where: {
        OR: TERMOS_DESCARTE.map((t) => ({
          nome: { contains: t, mode: "insensitive" as const },
        })),
      },
    });
  } catch {
    // silencioso — não bloqueia o carregamento da página
  }
  limpezaFeita = true;
}
