import { db } from "@/lib/db";
import { aplicarMigracoes } from "@/lib/migrations";

// Regiões de outros vendedores — com os novos nomes solicitados pelo Ederson.
export const REGIOES_FORA_AREA = ["Cliente Cristiano", "Cliente Welligton"];

const MUNICIPIOS_REMOVER = ["Palantino", "TINAPÁ", "Tinapá", "Interior de Goias", "Interior de Goiás"];

// Renomeia municípios antigos para os novos nomes.
const RENOMEAR: { de: string; para: string }[] = [
  { de: "Região Vix",   para: "Cliente Cristiano" },
  { de: "Regiao Vix",   para: "Cliente Cristiano" },
  { de: "Revisao vix",  para: "Cliente Cristiano" },
  { de: "Região Norte", para: "Cliente Welligton" },
  { de: "Regiao Norte", para: "Cliente Welligton" },
];

const MUNICIPIOS_GARANTIDOS: { nome: string; lat: number; lng: number }[] = [
  { nome: "Alfredo Chaves", lat: -20.6367, lng: -40.7508 },
];

let garantido = false;

export async function garantirRegioes(): Promise<void> {
  if (garantido) return;

  // Aplica migrações de schema pendentes (idempotente)
  await aplicarMigracoes();

  // Renomeia municípios com nomes antigos
  for (const { de, para } of RENOMEAR) {
    try {
      const existe = await db.municipio.findFirst({ where: { nome: { equals: de, mode: "insensitive" } } });
      if (existe) {
        const jaExistePara = await db.municipio.findFirst({ where: { nome: { equals: para, mode: "insensitive" } } });
        if (jaExistePara) {
          // Move clientes para o município destino e remove o antigo
          await db.cliente.updateMany({ where: { municipioId: existe.id }, data: { municipioId: jaExistePara.id } });
          await db.municipio.delete({ where: { id: existe.id } });
        } else {
          await db.municipio.update({ where: { id: existe.id }, data: { nome: para, foraDeArea: true, regiao: "Fora da área" } });
        }
      }
    } catch {}
  }

  // Garante que regiões fora de área existam com nomes corretos
  for (const nome of REGIOES_FORA_AREA) {
    await db.municipio.upsert({
      where: { nome },
      update: { foraDeArea: true, regiao: "Fora da área" },
      create: { nome, foraDeArea: true, regiao: "Fora da área" },
    });
  }

  // Garante municípios adicionados após o seed inicial
  for (const m of MUNICIPIOS_GARANTIDOS) {
    await db.municipio.upsert({
      where: { nome: m.nome },
      update: { lat: m.lat, lng: m.lng },
      create: { nome: m.nome, lat: m.lat, lng: m.lng },
    });
  }

  // Remove municípios inválidos
  for (const nome of MUNICIPIOS_REMOVER) {
    try {
      await db.municipio.deleteMany({ where: { nome: { equals: nome, mode: "insensitive" } } });
    } catch {}
  }

  // Strip +55 de todos os telefones (idempotente — só altera quem ainda tem o prefixo)
  try {
    await db.$executeRawUnsafe(`
      UPDATE "Cliente"
      SET telefone = regexp_replace(telefone, '^(\\+55|55)(?=\\d{10,11}$)', '')
      WHERE telefone ~ '^(\\+55|55)\\d{10,11}$'
    `);
  } catch {}

  garantido = true;
}

const TERMOS_DESCARTE = ["POUSADA", "HOTEL", "PME"];
let limpezaFeita = false;

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
  } catch {}
  limpezaFeita = true;
}
