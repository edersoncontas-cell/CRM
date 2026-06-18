import type { PrismaClient } from "@prisma/client";

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
  // New Holland — escavadeiras hidráulicas
  { marca: "New Holland", modelo: "E145C EVO", categoria: "escavadeira", proprio: true, pesoOperacional: 14500, potencia: 110,
    descricao: "Escavadeira de 14,5 t para obras urbanas e médias.",
    pontosFortes: "Ágil e econômica; ótima para saneamento e infraestrutura urbana.",
    diferenciais: "Maior caçamba da categoria e motor FPT econômico." },
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
  // New Holland — minicarregadeira (skid steer)
  { marca: "New Holland", modelo: "L320", categoria: "minicarregadeira", proprio: true, pesoOperacional: 2930, potencia: 67,
    descricao: "Minicarregadeira Série 300 de entrada, ágil para obras compactas e paisagismo.",
    pontosFortes: "Elevação vertical Super Boom; compacta e econômica.",
    diferenciais: "Robustez New Holland com baixo custo operacional." },
  { marca: "New Holland", modelo: "L325", categoria: "minicarregadeira", proprio: true, pesoOperacional: 3700, potencia: 74,
    descricao: "Minicarregadeira Série 300, robusta e versátil para obras compactas.",
    pontosFortes: "Capacidade de carga e altura de elevação líderes; troca rápida de implementos.",
    diferenciais: "Robustez New Holland com baixo custo operacional." },
  { marca: "New Holland", modelo: "L330", categoria: "minicarregadeira", proprio: true, pesoOperacional: 3765, potencia: 90,
    descricao: "Minicarregadeira Série 300 topo de linha, maior potência e capacidade de carga.",
    pontosFortes: "90 cv e ROC de 1.360 kg; elevação vertical para trabalhos pesados.",
    diferenciais: "Robustez New Holland com baixo custo operacional." },
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

const MOTIVACOES: { texto: string; autor?: string; categoria: string }[] = [
  { texto: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", autor: "Robert Collier", categoria: "persistencia" },
  { texto: "Não espere por oportunidades extraordinárias. Agarre ocasiões comuns e as torne grandes.", autor: "Orison Marden", categoria: "vendas" },
  { texto: "A persistência é o caminho do êxito.", autor: "Charles Chaplin", categoria: "persistencia" },
  { texto: "Pessoas compram de pessoas em quem confiam. Construa relação antes da venda.", categoria: "vendas" },
  { texto: "Cada 'não' te aproxima do próximo 'sim'. Continue ligando.", categoria: "vendas" },
  { texto: "Foco não é dizer sim. Foco é dizer não para mil coisas boas.", autor: "Steve Jobs", categoria: "foco" },
  { texto: "Comece onde você está. Use o que você tem. Faça o que você pode.", autor: "Arthur Ashe", categoria: "mindset" },
  { texto: "A melhor maneira de prever o futuro é criá-lo.", autor: "Peter Drucker", categoria: "mindset" },
  { texto: "Quem não é visto, não é lembrado. Esteja presente na obra do cliente.", categoria: "vendas" },
  { texto: "Disciplina é fazer o que precisa ser feito, mesmo quando você não tem vontade.", categoria: "foco" },
  { texto: "Não conte os dias, faça os dias contarem.", autor: "Muhammad Ali", categoria: "mindset" },
  { texto: "Uma meta sem um plano é apenas um desejo.", autor: "Antoine de Saint-Exupéry", categoria: "foco" },
  { texto: "O cliente não compra a máquina. Compra a solução para o problema dele.", categoria: "vendas" },
  { texto: "Grandes resultados exigem grandes ambições.", autor: "Heráclito", categoria: "mindset" },
  { texto: "Pequenos passos todos os dias vencem grandes saltos de vez em quando.", categoria: "tdah" },
  { texto: "Faça uma coisa de cada vez. Termine. Depois a próxima.", categoria: "tdah" },
  { texto: "Anote agora. Sua memória vai te trair, sua lista não.", categoria: "tdah" },
  { texto: "Energia gera energia. Comece pela tarefa mais fácil e ganhe impulso.", categoria: "tdah" },
  { texto: "Vender é transferir confiança e entusiasmo.", autor: "Zig Ziglar", categoria: "vendas" },
  { texto: "Seu maior concorrente é a versão de você que desistiu ontem.", categoria: "persistencia" },
  { texto: "Trabalhe enquanto eles dormem. Aprenda enquanto eles se divertem.", categoria: "persistencia" },
  { texto: "A diferença entre o impossível e o possível está na determinação.", autor: "Tommy Lasorda", categoria: "persistencia" },
];

export interface ResultadoSeed {
  municipios: number;
  maquinas: number;
  clientes: number;
  metas: number;
  motivacoes: number;
  campanhas: number;
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

  // Motivações
  if ((await db.motivacao.count()) === 0) {
    await db.motivacao.createMany({ data: MOTIVACOES });
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

  // Campanhas de marketing de demonstração
  if ((await db.campanhaMarketing.count()) === 0) {
    await db.campanhaMarketing.createMany({
      data: [
        {
          tipo: "diario",
          titulo: "💡 Sabia disso sobre a New Holland E245C EVO?",
          conteudo: "🔧 Dica do dia!\n\nA New Holland E245C EVO tem capacidade de escavação de até 7,2 metros de profundidade — ideal para fundações profundas e obras de saneamento!\n\nIsso significa MAIS OBRA com MENOS reposicionamento. 💪\n\nQuer um comparativo técnico? Me chama! 👇",
          hashtags: "#NewHolland #E245C #Escavadeira #Construção #SulES",
          canalAlvo: "ambos",
          status: "rascunho",
          marca: "New Holland",
          categoria: "escavadeira",
        },
        {
          tipo: "segunda",
          titulo: "🚀 Segunda-feira de oportunidades!",
          conteudo: "Bom dia! 🌅 Semana nova, oportunidade nova!\n\nA Dynapac CA3500 está disponível com condições especiais Finame/BNDES. Rolo liso de 8 toneladas com tração 4x4 — perfeito para asfalto e solo.\n\n✅ Taxa reduzida\n✅ Demonstração gratuita\n✅ Proposta em 24h\n\nMe chama! 👇",
          hashtags: "#Dynapac #CA3500 #RoloCompactador #Finame #Construção",
          canalAlvo: "whatsapp",
          status: "aprovado",
          marca: "Dynapac",
          categoria: "rolo_solo",
        },
        {
          tipo: "mensal_fim",
          titulo: "⏰ Últimos dias — condições especiais vencem!",
          conteudo: "⚠️ ATENÇÃO!\n\nEstamos nos ÚLTIMOS DIAS do mês!\n\nA New Holland B110C (retroescavadeira) com condições que só existem AGORA:\n🔥 Finame com entrada reduzida\n🔥 Demonstração na sua obra\n🔥 Garantia estendida incluída\n\nMe chama AGORA e garanta sua proposta! ⬇️",
          hashtags: "#NewHolland #B110C #Retroescavadeira #ÚltimosDias #Oportunidade",
          canalAlvo: "ambos",
          status: "enviado",
          marca: "New Holland",
          categoria: "retroescavadeira",
          totalEnviado: 12,
          enviadoEm: new Date(Date.now() - 1000 * 60 * 60 * 48),
        },
      ],
    });
  }

  return {
    municipios: await db.municipio.count(),
    maquinas: await db.maquina.count(),
    clientes: await db.cliente.count(),
    metas: await db.meta.count(),
    motivacoes: await db.motivacao.count(),
    campanhas: await db.campanhaMarketing.count(),
  };
}
