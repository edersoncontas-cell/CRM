// Extração heurística (fallback sem ANTHROPIC_API_KEY).
// Cobre o essencial: modelo de máquina, valor, condição de pagamento,
// concorrente, data/hora de visita e sentimento — usando regex em PT-BR.

export interface ExtracaoConversa {
  resumo: string;
  perfil: string | null;
  nomeCliente: string | null;
  telefoneCliente: string | null;
  municipio: string | null;
  maquina: string | null;
  valor: number | null;
  condicaoPagamento: string | null;
  concorrente: string | null;
  dataVisita: Date | null;
  sentimento: "positivo" | "neutro" | "negativo";
  ehProspectReal: boolean;
  rascunhoResposta: string;
  fonte: "ia" | "heuristica";
}

// Modelos da minha linha (New Holland Construction + Dynapac) — portfólio oficial.
const MODELOS_NEW_HOLLAND = [
  // New Holland Construction
  "E35D", "E145C", "E175C", "E215C", "E245C", "E385C", "E405C", "E485C", "E505C",
  "B95C", "B110C", "B95", "B110",
  "L320", "L330",
  "W130B", "W170B", "W190B", "W130", "W170", "W190",
  "RG140", "RG170", "RG200",
  // Dynapac
  "CA1500", "CA2500", "CA3500", "CA4000", "CA5000", "CA6500",
  "CC1300", "CC2200", "CC4200", "CC6200", "CP2100", "CP2700",
];

const CONCORRENTES = [
  "Caterpillar", "CAT", "Komatsu", "Volvo", "JCB", "Case", "Case IH",
  "XCMG", "Sany", "SDLG", "LiuGong", "Hyundai", "Develon", "Doosan",
  "Liebherr", "John Deere", "Bobcat", "Kubota", "Randon", "Shantui",
  "Hamm", "Bomag", "Ammann", "Müller", "Muller",
];

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, segunda: 1, "segunda-feira": 1, terca: 2, terça: 2,
  "terça-feira": 2, quarta: 3, "quarta-feira": 3, quinta: 4,
  "quinta-feira": 4, sexta: 5, "sexta-feira": 5, sabado: 6, sábado: 6,
};

export function extrairValor(texto: string): number | null {
  const t = texto.toLowerCase();
  // "1,2 milhão" / "1.2 milhoes"
  // "milhão", "milhao", "milhões", "milhoes" (acentos não casam em \b nem em [õo] sem u).
  const milhao = t.match(/(\d+[.,]?\d*)\s*milh[õãoe]/u);
  if (milhao) {
    return parseFloat(milhao[1].replace(".", "").replace(",", ".")) * 1_000_000;
  }
  // "450 mil" / "450mil"
  const mil = t.match(/(\d+[.,]?\d*)\s*mil\b/);
  if (mil) {
    return parseFloat(mil[1].replace(".", "").replace(",", ".")) * 1_000;
  }
  // "R$ 450.000" / "450000"
  const reais = t.match(/r\$\s*([\d.]+)(?:,\d{2})?/);
  if (reais) {
    const n = parseFloat(reais[1].replace(/\./g, ""));
    if (!Number.isNaN(n) && n > 1000) return n;
  }
  return null;
}

export function extrairMaquina(texto: string): string | null {
  const upper = texto.toUpperCase();
  for (const modelo of MODELOS_NEW_HOLLAND) {
    // procura o modelo como token (ex.: "T7", "T7.245")
    const re = new RegExp(`\\b${modelo.replace(".", "\\.")}(\\.\\d+)?\\b`);
    const m = upper.match(re);
    if (m) return m[0];
  }
  return null;
}

export function extrairCondicaoPagamento(texto: string): string | null {
  const t = texto.toLowerCase();
  if (/(à vista|a vista|avista|dinheiro|pix)/.test(t)) return "avista";
  if (/cons[óo]rcio/.test(t)) return "consorcio";
  if (/financ|banco|bndes|finame|parcel/.test(t)) return "financiamento";
  return null;
}

export function extrairConcorrente(texto: string): string | null {
  for (const c of CONCORRENTES) {
    if (new RegExp(`\\b${c}\\b`, "i").test(texto)) return c;
  }
  return null;
}

// Extrai hora apenas de marcadores explícitos: "14h", "14:30", "às 14", "14 horas".
function extrairHora(t: string): { hora: number; minuto: number } {
  let hora = 9;
  let minuto = 0;
  // "14:30" ou "14h30"
  const hm = t.match(/\b(\d{1,2})[:h](\d{2})\b/);
  // "14h", "14 horas", "às 14"
  const hSimples = t.match(/(?:às|as)\s*(\d{1,2})|\b(\d{1,2})\s*(?:h|hs|horas)\b/);
  if (hm) {
    hora = parseInt(hm[1]);
    minuto = parseInt(hm[2]);
  } else if (hSimples) {
    hora = parseInt(hSimples[1] ?? hSimples[2]);
    if (hora < 7) hora += 12; // "às 2" provavelmente é 14h
  }
  return { hora, minuto };
}

export function extrairDataVisita(texto: string, base = new Date()): Date | null {
  const t = texto.toLowerCase();
  const { hora, minuto } = extrairHora(t);

  // data explícita dd/mm
  const dataExplicita = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dataExplicita) {
    const dia = parseInt(dataExplicita[1]);
    const mes = parseInt(dataExplicita[2]) - 1;
    const ano = dataExplicita[3]
      ? parseInt(dataExplicita[3].length === 2 ? `20${dataExplicita[3]}` : dataExplicita[3])
      : base.getFullYear();
    return new Date(ano, mes, dia, hora, minuto);
  }

  // "amanhã"
  // \b não funciona depois de "ã" (não é caractere de palavra em JS): usa lookaround Unicode.
  if (/(?<!\p{L})amanh[ãa](?!\p{L})/u.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    d.setHours(hora, minuto, 0, 0);
    return d;
  }
  // "hoje"
  if (/\bhoje\b/.test(t)) {
    const d = new Date(base);
    d.setHours(hora, minuto, 0, 0);
    return d;
  }
  // dia da semana
  for (const [nome, idx] of Object.entries(DIAS_SEMANA)) {
    if (new RegExp(`\\b${nome}\\b`).test(t)) {
      const d = new Date(base);
      const diff = (idx - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(hora, minuto, 0, 0);
      return d;
    }
  }
  return null;
}

// Extrai um telefone (BR) do texto, retornando só os dígitos.
export function extrairTelefone(texto: string): string | null {
  const m = texto.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s.]?\d{4}/);
  if (!m) return null;
  const dig = m[0].replace(/\D/g, "");
  return dig.length >= 10 ? dig : null;
}

// Municípios do ES (sul, Caparaó, serrana e Grande Vitória) para casar por nome.
const MUNICIPIOS_ES = [
  "Cachoeiro de Itapemirim", "Itapemirim", "Marataízes", "Presidente Kennedy",
  "Piúma", "Anchieta", "Iconha", "Rio Novo do Sul", "Vargem Alta", "Castelo",
  "Alegre", "Guaçuí", "Mimoso do Sul", "Muqui", "Atílio Vivácqua", "Apiacá",
  "Bom Jesus do Norte", "São José do Calçado", "Jerônimo Monteiro", "Muniz Freire",
  "Ibitirama", "Divino de São Lourenço", "Dores do Rio Preto", "Conceição do Castelo",
  "Brejetuba", "Iúna", "Ibatiba", "Irupi", "Afonso Cláudio", "Venda Nova do Imigrante",
  "Marechal Floriano", "Domingos Martins", "Vila Velha", "Vitória", "Serra",
  "Cariacica", "Viana", "Guarapari", "Fundão", "Santa Teresa", "Linhares",
  "Aracruz", "Colatina", "São Mateus",
];

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Detecta o município citado na conversa (ex.: "sou de Vila Velha", "aqui em Castelo").
export function extrairMunicipio(texto: string): string | null {
  const t = norm(texto);
  // prioriza os de nome mais longo (evita casar "Vitória" dentro de "Cachoeiro")
  const ordenados = [...MUNICIPIOS_ES].sort((a, b) => b.length - a.length);
  for (const m of ordenados) {
    const re = new RegExp(`\\b${norm(m).replace(/ /g, "\\s+")}\\b`);
    if (re.test(t)) return m;
  }
  return null;
}

// Tenta achar o nome do cliente: frases explícitas ou o remetente da conversa
// exportada do WhatsApp ("12/06/2026 14:30 - Fulano: ...").
export function extrairNome(texto: string): string | null {
  const frase = texto.match(
    /(?:meu nome (?:é|e)|me chamo|aqui (?:é|e) o|aqui (?:é|e) a|sou o|sou a|quem fala (?:é|e))\s+([A-ZÀ-Ÿ][\p{L}]+(?:\s+[A-ZÀ-Ÿ][\p{L}]+)?)/iu
  );
  if (frase) return frase[1].trim();

  // Formato de exportação do WhatsApp: pega o primeiro remetente que não seja o dono.
  const re = /(?:^|\n).*?[-–]\s*([^:\n]{2,40}?):/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(texto)) !== null) {
    const nome = mm[1].trim();
    if (/\d/.test(nome)) continue;
    if (/^(você|voce|you|eu|me|sistema)$/i.test(nome)) continue;
    return nome;
  }
  return null;
}

export function detectarSentimento(texto: string): "positivo" | "neutro" | "negativo" {
  const t = texto.toLowerCase();
  const pos = /(fechad|fechei|fechou|gostei|ótimo|otimo|excelente|perfeito|quero|vamos fechar|combinado|interessad|pode vir|aceito)/.test(t);
  const neg = /(caro|desisti|não quero|nao quero|deixa pra|outro fornecedor|comprei (?:da|na|o)|muito alto|sem interesse|talvez depois)/.test(t);
  if (neg && !pos) return "negativo";
  if (pos && !neg) return "positivo";
  return "neutro";
}

export function extrairHeuristica(texto: string, base = new Date()): ExtracaoConversa {
  const maquina = extrairMaquina(texto);
  const valor = extrairValor(texto);
  const condicao = extrairCondicaoPagamento(texto);
  const concorrente = extrairConcorrente(texto);
  const dataVisita = extrairDataVisita(texto, base);
  const sentimento = detectarSentimento(texto);

  const ehProspectReal =
    !!maquina ||
    !!valor ||
    /(pre[çc]o|or[çc]amento|proposta|cota[çc][ãa]o|financ|cons[óo]rcio|comprar|interessad|m[áa]quina|escavadeira|retroescavadeira|retro|p[áa]\s?carregadeira|motoniveladora|rolo|compactador)/i.test(texto);

  const partes: string[] = [];
  if (maquina) partes.push(`Interesse na ${maquina}`);
  if (valor) partes.push(`valor ~ R$ ${valor.toLocaleString("pt-BR")}`);
  if (condicao) partes.push(`pagamento: ${condicao}`);
  if (concorrente) partes.push(`citou concorrente: ${concorrente}`);
  if (dataVisita) partes.push(`visita sugerida`);
  const resumo = partes.length
    ? partes.join("; ") + "."
    : "Conversa registrada (sem dados estruturados detectados).";

  const rascunho = montarRascunho({ maquina, dataVisita, condicao, sentimento });

  return {
    resumo,
    perfil: maquina ? `Potencial comprador de ${maquina}` : null,
    nomeCliente: extrairNome(texto),
    telefoneCliente: extrairTelefone(texto),
    municipio: extrairMunicipio(texto),
    maquina,
    valor,
    condicaoPagamento: condicao,
    concorrente,
    dataVisita,
    sentimento,
    ehProspectReal,
    rascunhoResposta: rascunho,
    fonte: "heuristica",
  };
}

function montarRascunho(d: {
  maquina: string | null;
  dataVisita: Date | null;
  condicao: string | null;
  sentimento: string;
}): string {
  const linhas: string[] = ["Olá! Tudo bem?"];
  if (d.maquina) {
    linhas.push(
      `Que bom o seu interesse na ${d.maquina}! É uma excelente escolha para a sua obra.`
    );
  } else {
    linhas.push("Obrigado pelo contato! Posso te ajudar com as melhores condições.");
  }
  if (d.condicao === "financiamento") {
    linhas.push("Consigo simular o financiamento (BNDES/Finame) com as melhores taxas pra você.");
  } else if (d.condicao === "consorcio") {
    linhas.push("Temos ótimas cartas de consórcio disponíveis, posso te passar os valores.");
  }
  if (d.dataVisita) {
    linhas.push("Confirmo a nossa visita conforme combinamos. Qualquer coisa, me avise!");
  } else {
    linhas.push("Quando puder, marcamos uma visita para eu te mostrar a máquina de perto. 👍");
  }
  return linhas.join(" ");
}
