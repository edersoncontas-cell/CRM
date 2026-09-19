import type { PrismaClient } from "@prisma/client";
import { CATALOGO_DYNAPAC } from "./dynapac-catalogo";

const MUNICIPIOS: { nome: string; lat: number; lng: number }[] = [
  { nome: "Cachoeiro de Itapemirim", lat: -20.8489, lng: -41.1128 },
  { nome: "Itapemirim", lat: -21.0094, lng: -40.8333 },
  { nome: "Marataízes", lat: -21.0433, lng: -40.8244 },
  { nome: "Presidente Kennedy", lat: -21.0967, lng: -41.0461 },
  { nome: "Piúma", lat: -20.8344, lng: -40.7256 },
  { nome: "Anchieta", lat: -20.8056, lng: -40.6447 },
  { nome: "Iconha", lat: -20.7917, lng: -40.8125 },
  { nome: "Rio Novo do Sul", lat: -20.8636, lng: -40.9367 },
  { nome: "Vargem Alta", lat: -20.6711, lng: -41.0050 },
  { nome: "Castelo", lat: -20.6039, lng: -41.1858 },
  { nome: "Alegre", lat: -20.7639, lng: -41.5322 },
  { nome: "Guaçuí", lat: -20.7758, lng: -41.6794 },
  { nome: "Mimoso do Sul", lat: -21.0644, lng: -41.3661 },
  { nome: "Muqui", lat: -20.9497, lng: -41.3458 },
  { nome: "Atílio Vivácqua", lat: -20.9133, lng: -41.1947 },
  { nome: "Apiacá", lat: -21.1672, lng: -41.5667 },
  { nome: "Bom Jesus do Norte", lat: -21.1300, lng: -41.6750 },
  { nome: "São José do Calçado", lat: -21.0286, lng: -41.6597 },
  { nome: "Jerônimo Monteiro", lat: -20.7900, lng: -41.3936 },
  { nome: "Muniz Freire", lat: -20.4636, lng: -41.4119 },
  { nome: "Ibitirama", lat: -20.5436, lng: -41.6650 },
  { nome: "Divino de São Lourenço", lat: -20.6172, lng: -41.6925 },
  { nome: "Dores do Rio Preto", lat: -20.6939, lng: -41.8447 },
  { nome: "Conceição do Castelo", lat: -20.3650, lng: -41.2417 },
  { nome: "Brejetuba", lat: -20.1419, lng: -41.2914 },
  // Adicionados a pedido (sul/Caparaó/serra)
  { nome: "Iúna", lat: -20.3447, lng: -41.5358 },
  { nome: "Ibatiba", lat: -20.2367, lng: -41.5097 },
  { nome: "Irupi", lat: -20.3506, lng: -41.6403 },
  { nome: "Afonso Cláudio", lat: -20.0739, lng: -41.1239 },
  { nome: "Venda Nova do Imigrante", lat: -20.3289, lng: -41.1364 },
  { nome: "Marechal Floriano", lat: -20.4117, lng: -40.6814 },
  { nome: "Domingos Martins", lat: -20.3622, lng: -40.6589 },
  { nome: "Santa Maria de Jetibá", lat: -20.0267, lng: -40.7436 },
  { nome: "Santa Leopoldina", lat: -20.0986, lng: -40.5306 },
  { nome: "Itarana", lat: -19.8731, lng: -40.8761 },
  { nome: "Itaguaçu", lat: -19.8000, lng: -40.8567 },
  { nome: "Alfredo Chaves", lat: -20.6367, lng: -40.7508 },
];

interface MaquinaSeed {
  marca: string;
  modelo: string;
  categoria: string;
  proprio?: boolean;
  pesoOperacional?: number; // kg
  potencia?: number; // cv
  descricao?: string;
  pontosFortes?: string;
  diferenciais?: string;
}

// ===== MINHA LINHA: New Holland Construction + Dynapac =====
const MINHAS: MaquinaSeed[] = [
  // New Holland — mini escavadeira
  { marca: "New Holland", modelo: "E35D", categoria: "miniescavadeira", proprio: true, pesoOperacional: 3500, potencia: 24,
    descricao: "Mini escavadeira ágil para áreas urbanas, demolição leve e espaços reduzidos.",
    pontosFortes: "Compacta e versátil; raio traseiro reduzido; fácil transporte em prancha; baixo custo operacional.",
    diferenciais: "Robustez New Holland em tamanho compacto e rede nacional de peças." },
  // New Holland — escavadeiras hidráulicas (nomenclatura oficial do portfólio, sem sufixo EVO)
  { marca: "New Holland", modelo: "E145C", categoria: "escavadeira", proprio: true, pesoOperacional: 14500, potencia: 110,
    descricao: "Escavadeira de 14,5 t para obras urbanas e médias.",
    pontosFortes: "Ágil e econômica; ótima para saneamento e infraestrutura urbana.",
    diferenciais: "Maior caçamba da categoria e motor FPT econômico." },
  { marca: "New Holland", modelo: "E175C", categoria: "escavadeira", proprio: true, pesoOperacional: 17500, potencia: 128,
    descricao: "Escavadeira de porte médio para terraplenagem e infraestrutura.",
    pontosFortes: "Equilíbrio entre força e consumo; cabine confortável; ideal para obras médias.",
    diferenciais: "Motor FPT econômico e durabilidade reconhecida." },
  { marca: "New Holland", modelo: "E215C", categoria: "escavadeira", proprio: true, pesoOperacional: 21500, potencia: 158,
    descricao: "Escavadeira de 21,5 t com caçamba de 1,1 a 1,7 m³.",
    pontosFortes: "Alta produtividade; sistema hidráulico eficiente; cabine ROPS; câmera de ré.",
    diferenciais: "Motor FPT, baixo consumo por m³ movimentado e ótima revenda." },
  { marca: "New Holland", modelo: "E245C", categoria: "escavadeira", proprio: true, pesoOperacional: 24000, potencia: 158,
    descricao: "Escavadeira de 24 t para mineração, terraplenagem pesada e infraestrutura.",
    pontosFortes: "Força de escavação superior; estrutura reforçada; produtividade em ciclo longo.",
    diferenciais: "Robustez para serviço pesado com suporte nacional." },
  // Linha pesada do portfólio — cadastradas sem specs numéricas (evita
  // inventar peso/potência); completar em /maquinas/fichas quando disponível.
  { marca: "New Holland", modelo: "E385C", categoria: "escavadeira", proprio: true },
  { marca: "New Holland", modelo: "E405C", categoria: "escavadeira", proprio: true },
  { marca: "New Holland", modelo: "E485C", categoria: "escavadeira", proprio: true },
  { marca: "New Holland", modelo: "E505C", categoria: "escavadeira", proprio: true },
  // New Holland — retroescavadeiras
  { marca: "New Holland", modelo: "B95C", categoria: "retroescavadeira", proprio: true, pesoOperacional: 7000, potencia: 81,
    descricao: "Retroescavadeira versátil para obras urbanas, saneamento e agro.",
    pontosFortes: "Conforto de cabine; força de escavação; baixo consumo; manutenção simples.",
    diferenciais: "Liderança histórica e tradição da New Holland em retroescavadeiras no Brasil." },
  { marca: "New Holland", modelo: "B110C", categoria: "retroescavadeira", proprio: true, pesoOperacional: 8000, potencia: 82,
    descricao: "Retroescavadeira de maior porte e alcance para obras exigentes.",
    pontosFortes: "Maior profundidade de escavação; potência de levante; robustez.",
    diferenciais: "Motor FPT e a melhor rede de assistência do segmento." },
  // New Holland — minicarregadeira (skid steer)
  { marca: "New Holland", modelo: "L320", categoria: "minicarregadeira", proprio: true, pesoOperacional: 2930, potencia: 67,
    descricao: "Minicarregadeira Série 300 de entrada, ágil para obras compactas e paisagismo.",
    pontosFortes: "Elevação vertical Super Boom; compacta e econômica.",
    diferenciais: "Robustez New Holland com baixo custo operacional." },
  { marca: "New Holland", modelo: "L330", categoria: "minicarregadeira", proprio: true, pesoOperacional: 3765, potencia: 90,
    descricao: "Minicarregadeira Série 300 topo de linha, maior potência e capacidade de carga.",
    pontosFortes: "90 cv e ROC de 1.360 kg; elevação vertical para trabalhos pesados.",
    diferenciais: "Robustez New Holland com baixo custo operacional." },
  // New Holland — pás carregadeiras
  { marca: "New Holland", modelo: "W130B", categoria: "pacarregadeira", proprio: true, pesoOperacional: 12500, potencia: 173,
    descricao: "Pá carregadeira de 12,5 t para carga geral, agro e construção.",
    pontosFortes: "Força de arranque; baldes para fertilizante e cana; conforto e visibilidade.",
    diferenciais: "Versões específicas para o agro e excelente revenda." },
  { marca: "New Holland", modelo: "W170B", categoria: "pacarregadeira", proprio: true, pesoOperacional: 16500, potencia: 197,
    descricao: "Pá carregadeira de 16,5 t para produção intensa.",
    pontosFortes: "Alta capacidade de balde; transmissão eficiente; robustez.",
    diferenciais: "Produtividade por litro de diesel e suporte nacional." },
  { marca: "New Holland", modelo: "W190B", categoria: "pacarregadeira", proprio: true, pesoOperacional: 19000, potencia: 223,
    descricao: "Pá carregadeira de 19 t para mineração e grandes volumes.",
    pontosFortes: "Força e capacidade superiores; cabine premium; durabilidade.",
    diferenciais: "Custo por tonelada competitivo com a rede New Holland." },
  // New Holland — motoniveladoras (nomenclatura oficial do portfólio)
  { marca: "New Holland", modelo: "RG140", categoria: "motoniveladora", proprio: true, pesoOperacional: 13500, potencia: 140,
    descricao: "Motoniveladora de 140 cv para manutenção de estradas e terraplenagem.",
    pontosFortes: "Controles hidráulicos de precisão; articulação à frente da cabine; lâmina Roll Away.",
    diferenciais: "Transmissão eletrônica inteligente e fabricação nacional." },
  { marca: "New Holland", modelo: "RG170", categoria: "motoniveladora", proprio: true, pesoOperacional: 15000, potencia: 170,
    descricao: "Motoniveladora de 170 cv, versátil e produtiva.",
    pontosFortes: "Tecnologia avançada; precisão de acabamento; conforto.",
    diferenciais: "Tradição e suporte New Holland em obras públicas." },
  { marca: "New Holland", modelo: "RG200", categoria: "motoniveladora", proprio: true, pesoOperacional: 17000, potencia: 200,
    descricao: "Motoniveladora de 200 cv para serviço pesado e mineração.",
    pontosFortes: "Maior potência e estabilidade; produtividade em pista longa.",
    diferenciais: "Robustez para serviço severo com revenda forte." },

  // Dynapac — catálogo atual (rolos de solo CA, tandem CC, pneumáticos CP,
  // vibroacabadoras, alimentador, fresadoras e compactação leve), em
  // lib/dynapac-catalogo.ts para o seed, a manutenção e a migração usarem a
  // mesma lista.
  ...CATALOGO_DYNAPAC,
];

// ===== CONCORRENTES (ramo construction Brasil) =====
const CONCORRENTES: MaquinaSeed[] = [
  // Mini escavadeiras
  { marca: "Caterpillar", modelo: "303.5", categoria: "miniescavadeira", pesoOperacional: 3900, potencia: 24 },
  { marca: "Komatsu", modelo: "PC35MR", categoria: "miniescavadeira", pesoOperacional: 3600 },
  { marca: "JCB", modelo: "35Z", categoria: "miniescavadeira", pesoOperacional: 3700 },
  { marca: "Bobcat", modelo: "E35", categoria: "miniescavadeira", pesoOperacional: 3500 },
  { marca: "Kubota", modelo: "KX033", categoria: "miniescavadeira", pesoOperacional: 3400 },
  { marca: "Sany", modelo: "SY35U", categoria: "miniescavadeira", pesoOperacional: 3800 },
  { marca: "Hyundai", modelo: "R35Z", categoria: "miniescavadeira", pesoOperacional: 3700 },
  { marca: "XCMG", modelo: "XE35U", categoria: "miniescavadeira", pesoOperacional: 3700 },
  // Minicarregadeiras (skid steer)
  { marca: "Bobcat", modelo: "S650", categoria: "minicarregadeira", pesoOperacional: 3900 },
  { marca: "Caterpillar", modelo: "236", categoria: "minicarregadeira", pesoOperacional: 3700 },
  { marca: "Case", modelo: "SR210", categoria: "minicarregadeira", pesoOperacional: 3500 },
  { marca: "JCB", modelo: "155", categoria: "minicarregadeira", pesoOperacional: 3600 },
  { marca: "XCMG", modelo: "XC760K", categoria: "minicarregadeira", pesoOperacional: 3800 },
  // Escavadeiras
  { marca: "Caterpillar", modelo: "320", categoria: "escavadeira", pesoOperacional: 22000, potencia: 162 },
  { marca: "Caterpillar", modelo: "315", categoria: "escavadeira", pesoOperacional: 15000, potencia: 109 },
  { marca: "Komatsu", modelo: "PC130", categoria: "escavadeira", pesoOperacional: 13500 },
  { marca: "Caterpillar", modelo: "318", categoria: "escavadeira", pesoOperacional: 18000, potencia: 122 },
  { marca: "Komatsu", modelo: "PC200", categoria: "escavadeira", pesoOperacional: 20000, potencia: 155 },
  { marca: "Komatsu", modelo: "PC170", categoria: "escavadeira", pesoOperacional: 17500 },
  { marca: "Volvo", modelo: "EC210", categoria: "escavadeira", pesoOperacional: 22000 },
  { marca: "Hyundai", modelo: "R220", categoria: "escavadeira", pesoOperacional: 22000 },
  { marca: "Sany", modelo: "SY215C", categoria: "escavadeira", pesoOperacional: 21500, potencia: 153 },
  { marca: "Sany", modelo: "SY175C", categoria: "escavadeira", pesoOperacional: 17500 },
  { marca: "XCMG", modelo: "XE215", categoria: "escavadeira", pesoOperacional: 21500 },
  { marca: "Case", modelo: "CX220C", categoria: "escavadeira", pesoOperacional: 22000 },
  { marca: "Develon", modelo: "DX225", categoria: "escavadeira", pesoOperacional: 22000 },
  { marca: "John Deere", modelo: "210G", categoria: "escavadeira", pesoOperacional: 22000 },
  { marca: "Caterpillar", modelo: "336", categoria: "escavadeira", pesoOperacional: 38000, potencia: 311 },
  // Retroescavadeiras
  { marca: "Caterpillar", modelo: "416F2", categoria: "retroescavadeira", pesoOperacional: 7500, potencia: 87 },
  { marca: "Caterpillar", modelo: "420F2", categoria: "retroescavadeira", pesoOperacional: 8200 },
  { marca: "JCB", modelo: "3CX", categoria: "retroescavadeira", pesoOperacional: 8000 },
  { marca: "JCB", modelo: "4CX", categoria: "retroescavadeira", pesoOperacional: 8600 },
  { marca: "Case", modelo: "580N", categoria: "retroescavadeira", pesoOperacional: 7600 },
  { marca: "Komatsu", modelo: "WB93R", categoria: "retroescavadeira", pesoOperacional: 8200 },
  { marca: "Randon", modelo: "RK406B", categoria: "retroescavadeira", pesoOperacional: 7000 },
  { marca: "John Deere", modelo: "310L", categoria: "retroescavadeira", pesoOperacional: 7300 },
  // Pás carregadeiras
  { marca: "Caterpillar", modelo: "930", categoria: "pacarregadeira", pesoOperacional: 13000 },
  { marca: "Caterpillar", modelo: "950", categoria: "pacarregadeira", pesoOperacional: 18000 },
  { marca: "Komatsu", modelo: "WA270", categoria: "pacarregadeira", pesoOperacional: 13000 },
  { marca: "Komatsu", modelo: "WA380", categoria: "pacarregadeira", pesoOperacional: 17000 },
  { marca: "Volvo", modelo: "L90", categoria: "pacarregadeira", pesoOperacional: 13500 },
  { marca: "Volvo", modelo: "L120", categoria: "pacarregadeira", pesoOperacional: 18500 },
  { marca: "XCMG", modelo: "LW300", categoria: "pacarregadeira", pesoOperacional: 10500 },
  { marca: "SDLG", modelo: "LG946", categoria: "pacarregadeira", pesoOperacional: 12000 },
  { marca: "SDLG", modelo: "LG958", categoria: "pacarregadeira", pesoOperacional: 17000 },
  { marca: "Case", modelo: "721G", categoria: "pacarregadeira", pesoOperacional: 13000 },
  { marca: "LiuGong", modelo: "856", categoria: "pacarregadeira", pesoOperacional: 17000 },
  { marca: "John Deere", modelo: "624", categoria: "pacarregadeira", pesoOperacional: 13500 },
  // Motoniveladoras
  { marca: "Caterpillar", modelo: "120", categoria: "motoniveladora", pesoOperacional: 13700, potencia: 145 },
  { marca: "Caterpillar", modelo: "140", categoria: "motoniveladora", pesoOperacional: 15000, potencia: 193 },
  { marca: "Komatsu", modelo: "GD555", categoria: "motoniveladora", pesoOperacional: 14000 },
  { marca: "Komatsu", modelo: "GD675", categoria: "motoniveladora", pesoOperacional: 16000 },
  { marca: "Volvo", modelo: "G930", categoria: "motoniveladora", pesoOperacional: 15000 },
  { marca: "XCMG", modelo: "GR135", categoria: "motoniveladora", pesoOperacional: 13000 },
  { marca: "XCMG", modelo: "GR180", categoria: "motoniveladora", pesoOperacional: 16500 },
  { marca: "Case", modelo: "845B", categoria: "motoniveladora", pesoOperacional: 13500 },
  { marca: "John Deere", modelo: "620G", categoria: "motoniveladora", pesoOperacional: 14000 },
  { marca: "SDLG", modelo: "G9190", categoria: "motoniveladora", pesoOperacional: 16500 },
  { marca: "Sany", modelo: "SAG120", categoria: "motoniveladora", pesoOperacional: 13500 },
  // Tratores de esteira
  { marca: "Caterpillar", modelo: "D5", categoria: "tratoresteira", pesoOperacional: 13900 },
  { marca: "Komatsu", modelo: "D51", categoria: "tratoresteira", pesoOperacional: 13800 },
  { marca: "Case", modelo: "1150L", categoria: "tratoresteira", pesoOperacional: 13000 },
  { marca: "Shantui", modelo: "SD16", categoria: "tratoresteira", pesoOperacional: 17000 },
  { marca: "XCMG", modelo: "TY160", categoria: "tratoresteira", pesoOperacional: 17000 },
  // Rolos de solo
  { marca: "Caterpillar", modelo: "CS54B", categoria: "rolo_solo", pesoOperacional: 11000 },
  { marca: "Caterpillar", modelo: "CS64B", categoria: "rolo_solo", pesoOperacional: 16000 },
  { marca: "Hamm", modelo: "3411", categoria: "rolo_solo", pesoOperacional: 11000 },
  { marca: "Hamm", modelo: "3516", categoria: "rolo_solo", pesoOperacional: 16000 },
  { marca: "Bomag", modelo: "BW211", categoria: "rolo_solo", pesoOperacional: 11500 },
  { marca: "Bomag", modelo: "BW213", categoria: "rolo_solo", pesoOperacional: 12500 },
  { marca: "Ammann", modelo: "ASC130", categoria: "rolo_solo", pesoOperacional: 13000 },
  { marca: "Case", modelo: "1107EX", categoria: "rolo_solo", pesoOperacional: 11000 },
  { marca: "XCMG", modelo: "XS143", categoria: "rolo_solo", pesoOperacional: 14000 },
  { marca: "Sany", modelo: "SSR120", categoria: "rolo_solo", pesoOperacional: 12000 },
  { marca: "Müller", modelo: "VAP70", categoria: "rolo_solo", pesoOperacional: 11000 },
  // Rolos tandem
  { marca: "Caterpillar", modelo: "CB10", categoria: "rolo_tandem", pesoOperacional: 10000 },
  { marca: "Caterpillar", modelo: "CB2.7", categoria: "rolo_tandem", pesoOperacional: 2700 },
  { marca: "Hamm", modelo: "HD90", categoria: "rolo_tandem", pesoOperacional: 9300 },
  { marca: "Hamm", modelo: "HD110", categoria: "rolo_tandem", pesoOperacional: 11200 },
  { marca: "Bomag", modelo: "BW151", categoria: "rolo_tandem", pesoOperacional: 9500 },
  { marca: "Ammann", modelo: "AV110", categoria: "rolo_tandem", pesoOperacional: 11000 },
  { marca: "Volvo", modelo: "DD110", categoria: "rolo_tandem", pesoOperacional: 11000 },
  // Rolos pneumáticos
  { marca: "Caterpillar", modelo: "CW34", categoria: "rolo_pneumatico", pesoOperacional: 10000 },
  { marca: "Hamm", modelo: "GRW280", categoria: "rolo_pneumatico", pesoOperacional: 24000 },
  { marca: "Ammann", modelo: "AP240", categoria: "rolo_pneumatico", pesoOperacional: 24000 },
];

const NOMES = [
  "Construtora Vale Verde", "Prefeitura de Cachoeiro (licitação)", "Pavimentadora Sul Capixaba",
  "João Batista Ferreira", "Terraplenagem Montanha", "Mineradora Pedra Azul",
  "Cooperativa de Estradas Rurais", "Antônio Carlos Souza", "Obras & Asfalto ES",
  "Construtora Litoral",
];

export interface ResultadoSeed {
  municipios: number;
  maquinas: number;
  clientes: number;
}

export async function semear(db: PrismaClient): Promise<ResultadoSeed> {
  for (const m of MUNICIPIOS) {
    await db.municipio.upsert({
      where: { nome: m.nome },
      update: { lat: m.lat, lng: m.lng },
      create: { nome: m.nome, lat: m.lat, lng: m.lng },
    });
  }
  // Regiões fora da minha área (outros vendedores) — não recebem campanhas.
  for (const nome of ["Região Vix", "Região Norte"]) {
    await db.municipio.upsert({
      where: { nome },
      update: { foraDeArea: true, regiao: "Fora da área" },
      create: { nome, foraDeArea: true, regiao: "Fora da área" },
    });
  }
  const municipios = await db.municipio.findMany();

  // Máquinas (minhas + concorrentes)
  for (const m of [...MINHAS, ...CONCORRENTES]) {
    await db.maquina.upsert({
      where: { marca_modelo: { marca: m.marca, modelo: m.modelo } },
      update: {
        categoria: m.categoria, proprio: !!m.proprio, pesoOperacional: m.pesoOperacional ?? null,
        potencia: m.potencia ?? null, descricao: m.descricao ?? null,
        pontosFortes: m.pontosFortes ?? null, diferenciais: m.diferenciais ?? null,
      },
      create: {
        marca: m.marca, modelo: m.modelo, categoria: m.categoria, proprio: !!m.proprio,
        pesoOperacional: m.pesoOperacional ?? null, potencia: m.potencia ?? null,
        descricao: m.descricao ?? null, pontosFortes: m.pontosFortes ?? null,
        diferenciais: m.diferenciais ?? null,
      },
    });
  }

  // Estilo de fala
  const estilo = await db.estiloDeFala.findFirst();
  if (!estilo) {
    await db.estiloDeFala.create({
      data: {
        guia: "Tom cordial, direto e profissional, com proximidade regional do sul do ES. Foca em produtividade, custo operacional e suporte/peças. Sempre puxa para a visita técnica e a demonstração da máquina.",
      },
    });
  }


  // Clientes + negociações
  if ((await db.cliente.count()) === 0) {
    const minhas = MINHAS.map((m) => m.modelo);
    const estagios = ["demandas", "primeiro_contato", "visita_pendente", "visita_realizada", "proposta_bcnh", "proposta_aprovada"];
    const criados: string[] = [];
    for (let i = 0; i < NOMES.length; i++) {
      const muni = municipios[i % municipios.length];
      const diasUltimoContato = [1, 3, 8, 0, 15, 2, 6, 20, 4, 11][i];
      const ultimoContato = new Date();
      ultimoContato.setDate(ultimoContato.getDate() - diasUltimoContato);

      const comprou = i % 3 === 0;
      const cliente = await db.cliente.create({
        data: {
          nome: NOMES[i],
          telefone: `2899${String(10000000 + i * 13).slice(0, 7)}`,
          municipioId: muni.id,
          origem: i % 2 === 0 ? "whatsapp" : "indicacao",
          jaComprou: comprou,
          visitado: i % 2 === 0,
          dataCompra: comprou ? new Date(Date.now() - 1000 * 60 * 60 * 24 * (60 + i * 10)) : null,
          maquinaComprada: comprou ? minhas[i % minhas.length] : null,
          perfilIA: comprou ? "Cliente recorrente, já adquiriu máquina conosco." : "Avaliando primeira aquisição; sensível a custo operacional.",
        },
      });
      criados.push(cliente.id);

      await db.negociacao.create({
        data: {
          clienteId: cliente.id,
          maquinaModelo: minhas[i % minhas.length],
          valor: [620000, 980000, 450000, 320000, 1850000, 2200000, 280000, 760000, 540000, 410000][i],
          condicaoPagamento: ["financiamento", "consorcio", "avista", "financiamento", "avista"][i % 5],
          concorrenteMencionado: i % 3 === 0 ? ["Caterpillar", "Komatsu", "XCMG"][i % 3] : null,
          estagio: estagios[i % estagios.length],
          termometro: [80, 60, 40, 90, 30, 70, 50, 20, 65, 45][i],
          ultimoContato,
          proximaAcao: i % 2 === 0 ? "Enviar proposta com comparativo" : "Agendar demonstração técnica",
          status: i === 7 ? "perdida" : "aberta",
          motivoPerda: i === 7 ? "Comprou da concorrência (preço)" : null,
        },
      });

      if (i < 5) {
        await db.tarefaKanban.create({
          data: {
            titulo: `Follow-up ${NOMES[i].split(" ")[0]}`,
            descricao: "Retomar negociação e enviar condições.",
            coluna: ["a_fazer", "fazendo", "a_fazer", "feito", "fazendo"][i],
            ordem: i,
            clienteId: cliente.id,
          },
        });
      }

      if (diasUltimoContato >= 8) {
        await db.alerta.create({
          data: {
            clienteId: cliente.id,
            tipo: "sem_resposta",
            mensagem: `${NOMES[i].split(" ")[0]} está há ${diasUltimoContato} dias sem resposta.`,
            diasDesde: diasUltimoContato,
            severidade: diasUltimoContato >= 15 ? "alta" : "media",
          },
        });
      }
    }
    // Exemplo de indicação (cliente 5 indicado pelo cliente 1)
    if (criados[4] && criados[0]) {
      await db.cliente.update({ where: { id: criados[4] }, data: { indicadoPorId: criados[0] } });
    }
  }

  return {
    municipios: await db.municipio.count(),
    maquinas: await db.maquina.count(),
    clientes: await db.cliente.count(),
  };
}
