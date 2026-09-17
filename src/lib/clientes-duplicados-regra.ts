// Regras puras da unificação de cadastros duplicados (sem banco, testável).
//
// Dois cadastros são o mesmo cliente quando têm o mesmo telefone (em qualquer
// formato: com/sem 55, com/sem 9º dígito), ou quando têm o mesmo nome e um
// deles NÃO tem telefone. Mesmo nome com números diferentes são pessoas
// diferentes — ficam os dois.
//
// Quem fica: quem tem telefone; entre esses, o que veio do Google (a agenda
// do vendedor é a fonte da verdade dos contatos); depois, o mais antigo. Todo
// o resto (negociações, frota, visitas…) é migrado para quem fica, e os
// campos vazios de quem fica são preenchidos com os do(s) outro(s).

import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { chaveNome, normalizarTexto } from "@/lib/google-contatos-util";
import { NOMES_MUNICIPIOS_ES } from "@/lib/municipios-es";

export { chaveNome };

// Cadastro cujo NOME é só um número de telefone ("27995219314") e sem
// telefone no campo: o número é o telefone. Vem assim de importação/Google
// quando o contato foi salvo sem nome.
export function telefoneDoNome(nome: string): string | null {
  const d = nome.replace(/\D/g, "");
  if (!/^\+?[\d\s()-]+$/.test(nome.trim()) || d.length < 10 || d.length > 13) return null;
  return d;
}
export function telefoneEfetivo(c: { nome: string; telefone: string | null }): string | null {
  return c.telefone?.trim() || telefoneDoNome(c.nome);
}

// Nome sem a cidade colada no fim: "(ITA) Adailton Christophori Dores do
// Rio Preto" e "(ITA) Adailton Christophori" são a mesma pessoa — o Google
// guarda o município no nome, o CRM guarda no cadastro. Só tira quando sobra
// nome de verdade (3+ letras) e a cidade é um município do ES.
const CIDADES_NORMALIZADAS = [...NOMES_MUNICIPIOS_ES].map(normalizarTexto).sort((a, b) => b.length - a.length);
export function chaveNomeSemCidade(nome: string): string | null {
  const n = chaveNome(nome);
  if (!n) return null;
  for (const cidade of CIDADES_NORMALIZADAS) {
    if (n.endsWith(" " + cidade)) {
      const resto = n.slice(0, -cidade.length).trim();
      if (resto.length >= 3 && !/^[\d ]+$/.test(resto)) return resto;
    }
  }
  return n;
}

export type ClienteParaDedup = {
  id: string;
  nome: string;
  telefone: string | null;
  googleContatoId: string | null;
  googleSincronizadoEm: Date | null;
  origem: string | null;
  criadoEm: Date;
};

export type GrupoDuplicados<T extends ClienteParaDedup = ClienteParaDedup> = { fica: T; somem: T[]; motivo: "telefone" | "nome" | "telefone+nome" };

// Chave única por número: nacional sem o 9º dígito (menor variante com DDD).
export function chaveTelefone(telefone: string | null): string | null {
  if (!telefone) return null;
  const variantes = phoneLookupVariants(telefone).filter((v) => !v.startsWith("55") || v.length <= 10);
  const nacionais = variantes.filter((v) => v.length >= 10 && v.length <= 11);
  if (!nacionais.length) return null;
  return nacionais.sort((a, b) => a.length - b.length || a.localeCompare(b))[0];
}

// Quem fica: quem tem telefone > quem veio do Google (sincronizado por
// último) > o mais antigo.
export function escolherQuemFica<T extends ClienteParaDedup>(grupo: T[]): T {
  // Telefone no campo certo vale mais que número no lugar do nome.
  const comTelefoneReal = grupo.filter((c) => !!chaveTelefone(c.telefone));
  const comTelefone = comTelefoneReal.length ? comTelefoneReal : grupo.filter((c) => !!chaveTelefone(telefoneEfetivo(c)));
  const base = comTelefone.length ? comTelefone : grupo;
  const google = base.filter((c) => !!c.googleContatoId);
  const candidatos = google.length ? google : base;
  return [...candidatos].sort((a, b) => {
    if (google.length) {
      const sa = a.googleSincronizadoEm?.getTime() ?? 0, sb = b.googleSincronizadoEm?.getTime() ?? 0;
      if (sa !== sb) return sb - sa;
    }
    return a.criadoEm.getTime() - b.criadoEm.getTime();
  })[0];
}

export function agruparDuplicados<T extends ClienteParaDedup>(clientes: T[]): GrupoDuplicados<T>[] {
  const pai = new Map<string, string>();
  const achar = (x: string): string => {
    let r = x;
    while (pai.get(r) !== r) r = pai.get(r)!;
    let c = x;
    while (pai.get(c) !== r) { const p = pai.get(c)!; pai.set(c, r); c = p; }
    return r;
  };
  const unir = (a: string, b: string) => { const ra = achar(a), rb = achar(b); if (ra !== rb) pai.set(ra, rb); };
  for (const c of clientes) pai.set(c.id, c.id);

  const motivoPorPar = new Map<string, Set<"telefone" | "nome">>();
  const marcar = (a: string, b: string, m: "telefone" | "nome") => {
    unir(a, b);
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!motivoPorPar.has(k)) motivoPorPar.set(k, new Set());
    motivoPorPar.get(k)!.add(m);
  };

  // 1) Mesmo telefone = mesma pessoa, sempre.
  const porTelefone = new Map<string, string>();
  const porNome = new Map<string, T[]>();
  for (const c of clientes) {
    const t = chaveTelefone(telefoneEfetivo(c));
    if (t) { const outro = porTelefone.get(t); if (outro) marcar(outro, c.id, "telefone"); else porTelefone.set(t, c.id); }
    const n = chaveNomeSemCidade(c.nome);
    if (n) { if (!porNome.has(n)) porNome.set(n, []); porNome.get(n)!.push(c); }
  }

  // 2) Mesmo nome: números DIFERENTES são pessoas diferentes (ficam os dois).
  //    Quem não tem telefone junta com o xará que tem — se houver um só
  //    número entre os xarás; com mais de um, só junta se o nome bater
  //    exatamente com um deles (senão fica em paz, na dúvida não mexe).
  for (const xaras of porNome.values()) {
    if (xaras.length < 2) continue;
    const comTelefone = xaras.filter((c) => chaveTelefone(telefoneEfetivo(c)));
    const semTelefone = xaras.filter((c) => !chaveTelefone(telefoneEfetivo(c)));
    const numeros = new Map<string, T>();
    for (const c of comTelefone) { const t = chaveTelefone(telefoneEfetivo(c))!; if (!numeros.has(t)) numeros.set(t, c); }

    if (numeros.size === 0) {
      for (let i = 1; i < semTelefone.length; i++) marcar(semTelefone[0].id, semTelefone[i].id, "nome");
      continue;
    }
    for (const s of semTelefone) {
      let alvo: T | null = null;
      if (numeros.size === 1) alvo = numeros.values().next().value ?? null;
      else {
        const exatos = [...numeros.values()].filter((c) => c.nome.trim().toLowerCase() === s.nome.trim().toLowerCase());
        if (exatos.length === 1) alvo = exatos[0];
      }
      if (alvo) marcar(alvo.id, s.id, "nome");
    }
  }

  const grupos = new Map<string, T[]>();
  for (const c of clientes) {
    const r = achar(c.id);
    if (!grupos.has(r)) grupos.set(r, []);
    grupos.get(r)!.push(c);
  }

  const saida: GrupoDuplicados<T>[] = [];
  for (const membros of grupos.values()) {
    if (membros.length < 2) continue;
    const fica = escolherQuemFica(membros);
    const motivos = new Set<string>();
    for (const [k, ms] of motivoPorPar) {
      const [a, b] = k.split("|");
      if (membros.some((m) => m.id === a) && membros.some((m) => m.id === b)) ms.forEach((m) => motivos.add(m));
    }
    const motivo = motivos.has("telefone") && motivos.has("nome") ? "telefone+nome" : motivos.has("telefone") ? "telefone" : "nome";
    saida.push({ fica, somem: membros.filter((m) => m.id !== fica.id).sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime()), motivo });
  }
  return saida.sort((a, b) => a.fica.nome.localeCompare(b.fica.nome, "pt-BR"));
}

// Campos do cadastro que "some" que completam o que falta em quem fica.
// Nunca sobrescreve o que quem fica já tem; flags viram OU; datas/scores
// ficam com o maior; observações e resumos são concatenados se diferirem.
export type CamposMesclaveis = {
  telefone: string | null; email: string | null; endereco: string | null; municipioId: string | null;
  perfilIA: string | null; origem: string | null; jaComprou: boolean; visitado: boolean; fotoUrl: string | null;
  observacoes: string | null; ultimoContato: Date | null; aguardandoResposta: boolean; perfilDISC: string | null;
  abordagemIA: string | null; dataCompra: Date | null; maquinaComprada: string | null; interesseFuturo: boolean;
  interesseFuturoData: Date | null; interesseFuturoNota: string | null; status: string; proximaVisita: Date | null;
  proximaVisitaNota: string | null; resumoMaquinas: string | null; resumoValor: number | null; resumoEntrada: number | null;
  resumoCondicao: string | null; resumoTexto: string | null; leadScore: number; leadScoreAtualizadoEm: Date | null;
  googleContatoId: string | null; googleSincronizadoEm: Date | null; indicadoPorId: string | null;
};

const PESO_STATUS: Record<string, number> = { nao_cliente: 0, potencial: 1, cliente: 2 };

export function mesclarCampos(fica: CamposMesclaveis, some: CamposMesclaveis): Partial<CamposMesclaveis> {
  const patch: Partial<CamposMesclaveis> = {};
  const preencher = <K extends keyof CamposMesclaveis>(k: K) => {
    const atual = fica[k], novo = some[k];
    if ((atual === null || atual === undefined || atual === "") && novo !== null && novo !== undefined && novo !== "") patch[k] = novo;
  };
  (["telefone", "email", "endereco", "municipioId", "perfilIA", "fotoUrl", "perfilDISC", "abordagemIA", "dataCompra", "maquinaComprada",
    "interesseFuturoData", "interesseFuturoNota", "proximaVisita", "proximaVisitaNota", "resumoMaquinas", "resumoValor", "resumoEntrada",
    "resumoCondicao", "resumoTexto", "googleContatoId", "googleSincronizadoEm", "indicadoPorId"] as const).forEach(preencher);
  if (!fica.jaComprou && some.jaComprou) patch.jaComprou = true;
  if (!fica.visitado && some.visitado) patch.visitado = true;
  if (!fica.interesseFuturo && some.interesseFuturo) patch.interesseFuturo = true;
  if (!fica.aguardandoResposta && some.aguardandoResposta) patch.aguardandoResposta = true;
  if (some.ultimoContato && (!fica.ultimoContato || some.ultimoContato > fica.ultimoContato)) patch.ultimoContato = some.ultimoContato;
  if (some.leadScore > fica.leadScore) { patch.leadScore = some.leadScore; patch.leadScoreAtualizadoEm = some.leadScoreAtualizadoEm; }
  if ((PESO_STATUS[some.status] ?? 1) > (PESO_STATUS[fica.status] ?? 1)) patch.status = some.status;
  if (some.observacoes?.trim() && some.observacoes.trim() !== fica.observacoes?.trim()) {
    patch.observacoes = fica.observacoes?.trim() ? `${fica.observacoes.trim()}\n\n${some.observacoes.trim()}` : some.observacoes.trim();
  }
  return patch;
}
