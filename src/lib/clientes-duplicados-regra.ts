// Regras puras da unificação de cadastros duplicados (sem banco, testável).
//
// Dois cadastros são o mesmo cliente quando têm o mesmo telefone (em qualquer
// formato: com/sem 55, com/sem 9º dígito) OU o mesmo nome (sem acento,
// caixa ou pontuação). Grupos são fechados por transitividade: A~B por
// telefone e B~C por nome → A, B e C viram um só.
//
// Quem fica: o cadastro que veio do Google (a agenda do vendedor é a fonte
// da verdade dos contatos). Sem Google no grupo, fica o mais antigo. Todo o
// resto (negociações, frota, visitas…) é migrado para quem fica, e os campos
// vazios de quem fica são preenchidos com os do(s) outro(s).

import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { chaveNome } from "@/lib/google-contatos-util";

export { chaveNome };

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

export function escolherQuemFica<T extends ClienteParaDedup>(grupo: T[]): T {
  const google = grupo.filter((c) => !!c.googleContatoId);
  const candidatos = google.length ? google : grupo;
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

  const porTelefone = new Map<string, string>();
  const porNome = new Map<string, string>();
  const motivoPorPar = new Map<string, Set<"telefone" | "nome">>();
  const marcar = (a: string, b: string, m: "telefone" | "nome") => {
    unir(a, b);
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!motivoPorPar.has(k)) motivoPorPar.set(k, new Set());
    motivoPorPar.get(k)!.add(m);
  };
  for (const c of clientes) {
    const t = chaveTelefone(c.telefone);
    if (t) { const outro = porTelefone.get(t); if (outro) marcar(outro, c.id, "telefone"); else porTelefone.set(t, c.id); }
    const n = chaveNome(c.nome);
    if (n) { const outro = porNome.get(n); if (outro) marcar(outro, c.id, "nome"); else porNome.set(n, c.id); }
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
