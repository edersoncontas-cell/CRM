import { db } from "@/lib/db";
import { aplicarMigracoes } from "@/lib/migrations";

// Remove acentos e converte para minúsculas para comparação fuzzy
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Abreviações conhecidas: chave = sigla normalizada, valor = nome do município (normalizado)
const ABREVIACOES: Record<string, string> = {
  smj: "santa maria de jetiba",
  afc: "afonso claudio",
};

// Termos que identificam cadastros que NÃO são clientes compradores de máquinas.
// Qualquer cliente cujo nome contenha um desses termos terá status = "nao_cliente".
const TERMOS_NAO_CLIENTE = [
  "pme", "sicoob", "sicredi", "banestes", "pousada",
  "contabilidade", "cresol", "sonhagro", "contador",
  "consultoria", "bcnh", "hotel",
];

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

  // Vincula município automaticamente para clientes cujo nome contém o nome da cidade
  await vincularMunicipiosPorNome();

  // Classifica como "nao_cliente" todos os cadastros com termos institucionais
  await classificarNaoClientes();

  garantido = true;
}

// Detecta nome de município dentro do nome do cliente e vincula automaticamente.
// Só age em clientes sem município definido e só usa municípios da área de atendimento.
async function vincularMunicipiosPorNome(): Promise<void> {
  try {
    const [semMunicipio, todosServidos] = await Promise.all([
      db.cliente.findMany({
        where: { municipioId: null },
        select: { id: true, nome: true },
      }),
      db.municipio.findMany({
        where: { foraDeArea: false },
        select: { id: true, nome: true },
      }),
    ]);

    if (!semMunicipio.length || !todosServidos.length) return;

    // Pré-normaliza os municípios (mínimo 5 chars para evitar falsos positivos)
    const candidatos = todosServidos
      .map((m) => ({ id: m.id, norm: normalizar(m.nome) }))
      .filter((m) => m.norm.length >= 5)
      .sort((a, b) => b.norm.length - a.norm.length); // mais específico primeiro

    for (const cliente of semMunicipio) {
      const nomeNorm = normalizar(cliente.nome);

      // Verifica abreviações (ex: SMJ → santa maria de jetiba)
      let municipioId: string | null = null;
      const palavras = nomeNorm.split(/\s+/);
      for (const palavra of palavras) {
        if (ABREVIACOES[palavra]) {
          const alvo = candidatos.find((c) => c.norm === ABREVIACOES[palavra]);
          if (alvo) { municipioId = alvo.id; break; }
        }
      }

      // Verifica se o nome do município aparece no nome do cliente
      if (!municipioId) {
        for (const cand of candidatos) {
          if (nomeNorm.includes(cand.norm)) {
            municipioId = cand.id;
            break;
          }
        }
      }

      if (municipioId) {
        await db.cliente.update({ where: { id: cliente.id }, data: { municipioId } });
      }
    }
  } catch {}
}

// Classifica cadastros com termos institucionais como "nao_cliente" (não deleta).
async function classificarNaoClientes(): Promise<void> {
  try {
    for (const termo of TERMOS_NAO_CLIENTE) {
      await db.cliente.updateMany({
        where: {
          nome: { contains: termo, mode: "insensitive" },
          status: { not: "nao_cliente" },
        },
        data: { status: "nao_cliente", jaComprou: false },
      });
    }
  } catch {}
}

let limpezaFeita = false;

export async function limparContatosDescartados(): Promise<void> {
  if (limpezaFeita) return;
  limpezaFeita = true;
  // A limpeza agora é feita por classificarNaoClientes() dentro de garantirRegioes().
  // Esta função é mantida para compatibilidade com chamadas existentes.
}
