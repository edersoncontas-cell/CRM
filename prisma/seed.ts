import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const MUNICIPIOS = [
  "Cachoeiro de Itapemirim", "Itapemirim", "Marataízes", "Presidente Kennedy",
  "Piúma", "Anchieta", "Iconha", "Rio Novo do Sul", "Vargem Alta", "Castelo",
  "Alegre", "Guaçuí", "Mimoso do Sul", "Muqui", "Atílio Vivácqua", "Apiacá",
  "Bom Jesus do Norte", "São José do Calçado", "Jerônimo Monteiro",
  "Muniz Freire", "Ibitirama", "Divino de São Lourenço", "Dores do Rio Preto",
  "Conceição do Castelo", "Brejetuba",
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
  // New Holland — escavadeiras hidráulicas
  { marca: "New Holland", modelo: "E175C EVO", categoria: "escavadeira", proprio: true, pesoOperacional: 17500, potencia: 128,
    descricao: "Escavadeira de porte médio para terraplenagem e infraestrutura.",
    pontosFortes: "Equilíbrio entre força e consumo; cabine confortável; ideal para obras médias.",
    diferenciais: "Motor FPT econômico e durabilidade reconhecida." },
  { marca: "New Holland", modelo: "E215C EVO", categoria: "escavadeira", proprio: true, pesoOperacional: 21500, potencia: 158,
    descricao: "Escavadeira de 21,5 t com caçamba de 1,1 a 1,7 m³.",
    pontosFortes: "Alta produtividade; sistema hidráulico eficiente; cabine ROPS; câmera de ré.",
    diferenciais: "Motor FPT, baixo consumo por m³ movimentado e ótima revenda." },
  { marca: "New Holland", modelo: "E245C EVO", categoria: "escavadeira", proprio: true, pesoOperacional: 24000, potencia: 158,
    descricao: "Escavadeira de 24 t para mineração, terraplenagem pesada e infraestrutura.",
    pontosFortes: "Força de escavação superior; estrutura reforçada; produtividade em ciclo longo.",
    diferenciais: "Robustez para serviço pesado com suporte nacional." },
  // New Holland — retroescavadeiras
  { marca: "New Holland", modelo: "B95C", categoria: "retroescavadeira", proprio: true, pesoOperacional: 7000, potencia: 81,
    descricao: "Retroescavadeira versátil para obras urbanas, saneamento e agro.",
    pontosFortes: "Conforto de cabine; força de escavação; baixo consumo; manutenção simples.",
    diferenciais: "Liderança histórica e tradição da New Holland em retroescavadeiras no Brasil." },
  { marca: "New Holland", modelo: "B110C", categoria: "retroescavadeira", proprio: true, pesoOperacional: 8000, potencia: 82,
    descricao: "Retroescavadeira de maior porte e alcance para obras exigentes.",
    pontosFortes: "Maior profundidade de escavação; potência de levante; robustez.",
    diferenciais: "Motor FPT e a melhor rede de assistência do segmento." },
  // New Holland — pás carregadeiras
  { marca: "New Holland", modelo: "W12D", categoria: "pacarregadeira", proprio: true, pesoOperacional: 4800, potencia: 75,
    descricao: "Mini pá carregadeira para espaços compactos e agro.",
    pontosFortes: "Agilidade; baixo custo; ideal para armazéns, agro e obras pequenas.",
    diferenciais: "Versatilidade com a confiabilidade New Holland." },
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
  // New Holland — motoniveladoras
  { marca: "New Holland", modelo: "RG140.B EVO", categoria: "motoniveladora", proprio: true, pesoOperacional: 13500, potencia: 140,
    descricao: "Motoniveladora de 140 cv para manutenção de estradas e terraplenagem.",
    pontosFortes: "Controles hidráulicos de precisão; articulação à frente da cabine; lâmina Roll Away.",
    diferenciais: "Transmissão eletrônica inteligente e fabricação nacional." },
  { marca: "New Holland", modelo: "RG170.B EVO", categoria: "motoniveladora", proprio: true, pesoOperacional: 15000, potencia: 170,
    descricao: "Motoniveladora de 170 cv, versátil e produtiva.",
    pontosFortes: "Tecnologia avançada; precisão de acabamento; conforto.",
    diferenciais: "Tradição e suporte New Holland em obras públicas." },
  { marca: "New Holland", modelo: "RG200.B EVO", categoria: "motoniveladora", proprio: true, pesoOperacional: 17000, potencia: 200,
    descricao: "Motoniveladora de 200 cv para serviço pesado e mineração.",
    pontosFortes: "Maior potência e estabilidade; produtividade em pista longa.",
    diferenciais: "Robustez para serviço severo com revenda forte." },
  // New Holland — trator de esteira
  { marca: "New Holland", modelo: "D140B", categoria: "tratoresteira", proprio: true, pesoOperacional: 14000, potencia: 140,
    descricao: "Trator de esteira para terraplenagem e empurro de material.",
    pontosFortes: "Força de tração; lâmina robusta; fabricado em Contagem-MG.",
    diferenciais: "Produção nacional e rede de peças consolidada." },

  // Dynapac — rolos de solo (CA)
  { marca: "Dynapac", modelo: "CA1500", categoria: "rolo_solo", proprio: true, pesoOperacional: 7000,
    descricao: "Rolo compactador de solo de pequeno porte.",
    pontosFortes: "Compactação eficiente em camadas finas; manobrabilidade.",
    diferenciais: "Tecnologia sueca de compactação com fabricação nacional." },
  { marca: "Dynapac", modelo: "CA2500", categoria: "rolo_solo", proprio: true, pesoOperacional: 10500,
    descricao: "Rolo de solo de 10,5 t, o mais popular do segmento.",
    pontosFortes: "Excelente custo-benefício; alta produtividade; assistência ampla.",
    diferenciais: "Líder de base instalada no Brasil e telemetria Dyn@Link." },
  { marca: "Dynapac", modelo: "CA3500", categoria: "rolo_solo", proprio: true, pesoOperacional: 11500,
    descricao: "Rolo de solo para grandes aterros e rochas.",
    pontosFortes: "Amplitude para compactar camadas espessas; robustez.",
    diferenciais: "Sistema de compactação inteligente e acabamento superior." },
  { marca: "Dynapac", modelo: "CA4000", categoria: "rolo_solo", proprio: true, pesoOperacional: 12000,
    descricao: "Rolo de solo de alta capacidade para obras pesadas.",
    pontosFortes: "Força de compactação; estabilidade; baixo consumo.",
    diferenciais: "Qualidade Dynapac com suporte local." },
  { marca: "Dynapac", modelo: "CA5000", categoria: "rolo_solo", proprio: true, pesoOperacional: 15000,
    descricao: "Rolo de solo pesado para grandes terraplenagens.",
    pontosFortes: "Produtividade em grandes volumes; durabilidade.",
    diferenciais: "Tecnologia de medição de compactação." },
  { marca: "Dynapac", modelo: "CA6500", categoria: "rolo_solo", proprio: true, pesoOperacional: 19000,
    descricao: "Rolo de solo de 19 t para mineração e barragens.",
    pontosFortes: "Máxima força de compactação; estrutura reforçada.",
    diferenciais: "Referência em compactação pesada no Brasil." },
  // Dynapac — tandem asfalto (CC)
  { marca: "Dynapac", modelo: "CC1300", categoria: "rolo_tandem", proprio: true, pesoOperacional: 4000,
    descricao: "Rolo tandem de 4 t para asfalto e reparos.",
    pontosFortes: "Acabamento de qualidade; ideal para ruas e tapa-buracos.",
    diferenciais: "Acabamento premium da tecnologia sueca." },
  { marca: "Dynapac", modelo: "CC2200", categoria: "rolo_tandem", proprio: true, pesoOperacional: 7000,
    descricao: "Rolo tandem de 7 t, fabricado no Brasil, com cabine fechada.",
    pontosFortes: "Produtividade; conforto do operador; ótimo acabamento.",
    diferenciais: "Fabricação nacional e disponibilidade imediata." },
  { marca: "Dynapac", modelo: "CC4200", categoria: "rolo_tandem", proprio: true, pesoOperacional: 10000,
    descricao: "Rolo tandem vibratório de 7,7 a 12 t, fabricado no Brasil.",
    pontosFortes: "Compactação uniforme; acabamento superior; robustez.",
    diferenciais: "Linha completa nacional com forte suporte." },
  { marca: "Dynapac", modelo: "CC6200", categoria: "rolo_tandem", proprio: true, pesoOperacional: 12000,
    descricao: "Rolo tandem pesado para rodovias e grandes pavimentações.",
    pontosFortes: "Alta produção; qualidade de acabamento em rodovia.",
    diferenciais: "Tecnologia Dynapac para grandes obras." },
  // Dynapac — pneumáticos (CP)
  { marca: "Dynapac", modelo: "CP2100", categoria: "rolo_pneumatico", proprio: true, pesoOperacional: 10000,
    descricao: "Rolo pneumático para selagem e acabamento de asfalto.",
    pontosFortes: "Selagem superficial; impermeabilização; versatilidade de lastro.",
    diferenciais: "Acabamento e selagem de referência." },
  { marca: "Dynapac", modelo: "CP2700", categoria: "rolo_pneumatico", proprio: true, pesoOperacional: 20000,
    descricao: "Rolo pneumático pesado para rodovias.",
    pontosFortes: "Grande capacidade de lastro; produtividade em rodovia.",
    diferenciais: "Robustez e acabamento Dynapac." },
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
  // Escavadeiras
  { marca: "Caterpillar", modelo: "320", categoria: "escavadeira", pesoOperacional: 22000, potencia: 162 },
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

async function main() {
  console.log("🌱 Semeando banco (construção)...");

  for (const nome of MUNICIPIOS) {
    await db.municipio.upsert({ where: { nome }, update: {}, create: { nome } });
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

  // Metas
  if ((await db.meta.count()) === 0) {
    await db.meta.createMany({
      data: [
        { tipo: "diaria", rotulo: "Contatos com clientes (hoje)", alvo: 10, progresso: 6, periodo: "diaria" },
        { tipo: "prospeccao", rotulo: "Novos prospects (semana)", alvo: 15, progresso: 9, periodo: "semanal" },
        { tipo: "negocios_banco", rotulo: "Propostas em banco (mês)", alvo: 8, progresso: 3, periodo: "mensal" },
        { tipo: "mensal", rotulo: "Máquinas vendidas (mês)", alvo: 5, progresso: 2, periodo: "mensal" },
        { tipo: "semanal", rotulo: "Visitas técnicas (semana)", alvo: 6, progresso: 4, periodo: "semanal" },
      ],
    });
  }

  // Clientes + negociações
  if ((await db.cliente.count()) === 0) {
    const minhas = MINHAS.map((m) => m.modelo);
    const estagios = ["novo", "contato", "proposta", "negociacao", "fechamento"];
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

  // Sugestões de vínculo
  if ((await db.sugestaoVinculo.count()) === 0) {
    const cliente = await db.cliente.findFirst();
    await db.sugestaoVinculo.createMany({
      data: [
        { telefone: "28998887766", nomeDetectado: "Zé da Terraplenagem", textoContexto: "Bom dia, queria saber da escavadeira E215", confianca: 72, clienteId: cliente?.id },
        { telefone: "28997776655", nomeDetectado: null, textoContexto: "Oi, vi seu anúncio do rolo Dynapac", confianca: 45 },
      ],
    });
  }

  // Mídia
  if ((await db.midiaPost.count()) === 0) {
    const maq = await db.maquina.findFirst({ where: { marca: "New Holland", modelo: "E215C EVO" } });
    await db.midiaPost.create({
      data: {
        maquinaId: maq?.id,
        titulo: "Você conhece a New Holland E215C EVO?",
        conteudo: "🚜 21,5 toneladas de produtividade com o motor FPT econômico! Caçamba de até 1,7 m³, cabine ROPS e câmera de ré. Quer um comparativo com a concorrência? Me chama! 👇",
        status: "agendado",
        agendadoPara: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      },
    });
  }

  console.log("✅ Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
