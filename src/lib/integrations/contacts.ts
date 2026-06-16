// Importação de contatos do PRÓPRIO usuário (Google Contacts / WhatsApp / CSV).
// Caminho legal para preencher nomes — nada de varredura em contas de terceiros.

export function isEnabled() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export interface ContatoImportado {
  nome: string;
  telefone: string;
}

// Faz o parse de um CSV simples (nome,telefone) exportado do Google/WhatsApp.
export function parseCsvContatos(csv: string): ContatoImportado[] {
  const linhas = csv.split(/\r?\n/).filter((l) => l.trim());
  const contatos: ContatoImportado[] = [];
  for (const linha of linhas) {
    const [nome, telefone] = linha.split(/[,;]/).map((c) => c?.trim());
    if (!nome || !telefone) continue;
    if (/nome|name/i.test(nome) && /telefone|phone/i.test(telefone)) continue; // cabeçalho
    contatos.push({ nome, telefone: telefone.replace(/\D/g, "") });
  }
  return contatos;
}
