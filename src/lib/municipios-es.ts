// Coordenadas (aproximadas, sede) dos 78 municípios do Espírito Santo — usadas
// como fallback quando o município do cadastro ainda não tem lat/lng no banco
// (municípios criados automaticamente pelo pipeline do WhatsApp nascem sem
// coordenada). Assim toda cidade com venda aparece no mapa do Dashboard.

const MUNICIPIOS_ES: [string, number, number][] = [
  ["Afonso Cláudio", -20.0740, -41.1240], ["Água Doce do Norte", -18.5480, -40.9850], ["Águia Branca", -18.9830, -40.7380],
  ["Alegre", -20.7640, -41.5380], ["Alfredo Chaves", -20.6367, -40.7508], ["Alto Rio Novo", -19.0620, -41.0230],
  ["Anchieta", -20.8060, -40.6420], ["Apiacá", -21.1520, -41.5710], ["Aracruz", -19.8200, -40.2730],
  ["Atílio Vivácqua", -20.9130, -41.1980], ["Baixo Guandu", -19.5190, -41.0160], ["Barra de São Francisco", -18.7550, -40.8970],
  ["Boa Esperança", -18.5400, -40.2960], ["Bom Jesus do Norte", -21.1170, -41.6740], ["Brejetuba", -20.1400, -41.2920],
  ["Cachoeiro de Itapemirim", -20.8490, -41.1130], ["Cariacica", -20.2630, -40.4160], ["Castelo", -20.6030, -41.1850],
  ["Colatina", -19.5390, -40.6310], ["Conceição da Barra", -18.5880, -39.7320], ["Conceição do Castelo", -20.3640, -41.2430],
  ["Divino de São Lourenço", -20.6180, -41.6930], ["Domingos Martins", -20.3630, -40.6590], ["Dores do Rio Preto", -20.6910, -41.8410],
  ["Ecoporanga", -18.3730, -40.8300], ["Fundão", -19.9330, -40.4030], ["Governador Lindenberg", -19.2520, -40.4600],
  ["Guaçuí", -20.7750, -41.6790], ["Guarapari", -20.6670, -40.5000], ["Ibatiba", -20.2340, -41.5070],
  ["Ibiraçu", -19.8320, -40.3700], ["Ibitirama", -20.5450, -41.6650], ["Iconha", -20.7950, -40.8130],
  ["Irupi", -20.3470, -41.6410], ["Itaguaçu", -19.8020, -40.8570], ["Itapemirim", -21.0100, -40.8310],
  ["Itarana", -19.8740, -40.8750], ["Iúna", -20.3510, -41.5370], ["Jaguaré", -18.9070, -40.0760],
  ["Jerônimo Monteiro", -20.7940, -41.3940], ["João Neiva", -19.7570, -40.3860], ["Laranja da Terra", -19.9000, -41.0570],
  ["Linhares", -19.3910, -40.0720], ["Mantenópolis", -18.8620, -41.1240], ["Marataízes", -21.0430, -40.8240],
  ["Marechal Floriano", -20.4130, -40.6830], ["Marilândia", -19.4130, -40.5420], ["Mimoso do Sul", -21.0640, -41.3660],
  ["Montanha", -18.1270, -40.3630], ["Mucurici", -18.0960, -40.5170], ["Muniz Freire", -20.4650, -41.4130],
  ["Muqui", -20.9530, -41.3460], ["Nova Venécia", -18.7150, -40.4010], ["Pancas", -19.2250, -40.8510],
  ["Pedro Canário", -18.3010, -39.9570], ["Pinheiros", -18.4140, -40.2170], ["Piúma", -20.8380, -40.7270],
  ["Ponto Belo", -18.1270, -40.5390], ["Presidente Kennedy", -21.0960, -41.0470], ["Rio Bananal", -19.2650, -40.3330],
  ["Rio Novo do Sul", -20.8630, -40.9380], ["Santa Leopoldina", -20.1010, -40.5300], ["Santa Maria de Jetibá", -20.0270, -40.7440],
  ["Santa Teresa", -19.9360, -40.6000], ["São Domingos do Norte", -19.1450, -40.6260], ["São Gabriel da Palha", -19.0190, -40.5370],
  ["São José do Calçado", -21.0270, -41.6600], ["São Mateus", -18.7160, -39.8590], ["São Roque do Canaã", -19.7400, -40.6560],
  ["Serra", -20.1290, -40.3080], ["Sooretama", -19.1900, -40.0970], ["Vargem Alta", -20.6710, -41.0070],
  ["Venda Nova do Imigrante", -20.3270, -41.1350], ["Viana", -20.3900, -40.4960], ["Vila Pavão", -18.6120, -40.6070],
  ["Vila Valério", -18.9970, -40.3860], ["Vila Velha", -20.3300, -40.2920], ["Vitória", -20.3155, -40.3128],
];

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const INDICE = new Map(MUNICIPIOS_ES.map(([nome, lat, lng]) => [normalizar(nome), { lat, lng }]));

export function coordenadasMunicipioES(nome: string): { lat: number; lng: number } | null {
  return INDICE.get(normalizar(nome)) ?? null;
}

// Limites aproximados do estado (para travar o mapa do Dashboard no ES).
export const LIMITES_ES: [[number, number], [number, number]] = [[-21.35, -41.95], [-17.85, -39.6]];
export const CENTRO_ES: [number, number] = [-19.6, -40.65];
