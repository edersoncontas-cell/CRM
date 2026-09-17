// Abordagem por cidade: o vendedor escolhe uma cidade, o CRM lista os clientes
// de lá e manda a mesma mensagem para todos de uma vez, para fechar visitas na
// semana seguinte. Regras puras (sem banco, sem IA) — testáveis.

// "{nome}" no texto vira o primeiro nome do cliente. Nome que é só número
// (contato sem nome) vira "tudo bem" para a frase não ficar "Olá 27999...".
export function primeiroNome(nome: string): string {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!limpo || /^\d[\d\s()-]*$/.test(limpo) || /^contato\s+\d/i.test(limpo)) return "";
  const primeiro = limpo.split(" ")[0];
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

export function personalizarTexto(texto: string, nome: string): string {
  const p = primeiroNome(nome);
  return texto
    .replace(/\{nome\}/gi, p)
    // Sem nome: "Olá , tudo bem" → "Olá, tudo bem"; "Bom dia !" → "Bom dia!"
    .replace(/\s+([,!?.;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Texto que vale mesmo sem IA configurada.
export function modeloAbordagemPadrao(cidade: string, periodo: string): string {
  return `Olá {nome}, tudo bem? Aqui é o Edy, da New Holland Construction. ` +
    `Vou estar em ${cidade} ${periodo} visitando alguns clientes e queria passar aí para conversar sobre máquinas ` +
    `e ver como posso ajudar na sua operação. Qual dia fica melhor para você?`;
}

// Lotes pequenos: cada chamada ao servidor manda poucos, para caber no tempo
// da função e não parecer disparo de robô.
export function dividirEmLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += Math.max(1, tamanho)) lotes.push(itens.slice(i, i + Math.max(1, tamanho)));
  return lotes;
}

// "semana que vem (22/09 a 26/09)", calculado em Brasília a partir de hoje.
export function periodoSemanaQueVem(hoje = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const [a, m, d] = fmt.format(hoje).split("-").map(Number);
  const base = new Date(Date.UTC(a, m - 1, d, 12));
  const dow = base.getUTCDay(); // 0=dom
  const ateSegunda = dow === 0 ? 1 : 8 - dow;
  const seg = new Date(base); seg.setUTCDate(base.getUTCDate() + ateSegunda);
  const sex = new Date(seg); sex.setUTCDate(seg.getUTCDate() + 4);
  const ddmm = (x: Date) => `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  return `na semana que vem (${ddmm(seg)} a ${ddmm(sex)})`;
}
