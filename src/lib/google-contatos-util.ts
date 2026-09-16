// Regras PURAS da sincronização Google Contatos ↔ lista de clientes (sem banco,
// sem rede) — assim dá para testar com dados fixos. A parte que grava está em
// lib/google-contatos.ts.
//
// Regra geral: o Google Contatos é a agenda do vendedor; todo contato com
// telefone vira cliente no CRM (ou se liga ao cliente que já existe com o
// mesmo número). Nome, e-mail, endereço e município vêm do Google quando o
// CRM não tem; o nome genérico "Contato 5528…" (criado pelo WhatsApp) é
// sempre trocado pelo nome real.

import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { motivoBloqueioComListas, TERMOS_BLOQUEIO_PADRAO, PALAVRAS_BLOQUEIO_PADRAO } from "@/lib/utils";

// Listas do filtro de contatos indesejados, injetadas por quem chama (que as
// lê do banco em lib/filtro-contatos.ts). O padrão de fábrica é só para os
// testes e para nunca deixar passar nada se alguém esquecer de passar.
export type FiltroContatos = { termos: string[]; palavras: string[] };
const FILTRO_PADRAO: FiltroContatos = { termos: TERMOS_BLOQUEIO_PADRAO, palavras: PALAVRAS_BLOQUEIO_PADRAO };
const descartar = (nome: string, f: FiltroContatos) => motivoBloqueioComListas(nome, f.termos, f.palavras) !== null;

export type ContatoGoogle = {
  id: string;            // resourceName ("people/c123")
  nome: string;
  telefones: string[];   // só dígitos, como o Google manda (com 55)
  emails: string[];
  enderecos: { cidade: string | null; texto: string | null }[];
  empresa: string | null;
};

export type ClienteResumo = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  municipioId: string | null;
  origem: string | null;
  googleContatoId: string | null;
};

export type MunicipioResumo = { id: string; nome: string };

export type PlanoCriar = { nome: string; telefone: string; email: string | null; endereco: string | null; municipioId: string | null; googleContatoId: string };
export type PlanoAtualizar = { id: string; dados: Partial<{ nome: string; telefone: string; email: string; endereco: string; municipioId: string; googleContatoId: string }> };
export type PlanoSincronizacao = { criar: PlanoCriar[]; atualizar: PlanoAtualizar[]; ignorados: number; semTelefone: number };

// Nome genérico dado pelo pipeline quando o WhatsApp não manda o nome do contato.
const NOME_GENERICO = /^(contato\s+\d+|\+?\d[\d\s()-]{7,})$/i;
export const nomeGenerico = (nome: string) => NOME_GENERICO.test(nome.trim());

export const normalizarTexto = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Chave para casar dois cadastros pelo nome (sem acento/caixa/pontuação).
// null = nome genérico ou curto demais para valer como identidade.
export function chaveNome(nome: string): string | null {
  const n = normalizarTexto(nome);
  if (n.length < 3 || nomeGenerico(nome) || /^[\d ]+$/.test(n)) return null;
  return n;
}

// Telefone como o CRM guarda: só dígitos, sem o 55 do Brasil (28999798168).
export function telefoneNacional(raw: string): string | null {
  const d = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (d.length < 8) return null;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d.slice(2);
  return d;
}

// Município a partir da cidade do endereço (ou do texto do endereço).
export function acharMunicipio(municipios: MunicipioResumo[], enderecos: ContatoGoogle["enderecos"]): string | null {
  const porNome = municipios.map((m) => ({ id: m.id, chave: normalizarTexto(m.nome) })).filter((m) => m.chave);
  for (const e of enderecos) {
    const cidade = e.cidade ? normalizarTexto(e.cidade) : "";
    if (cidade) {
      const exato = porNome.find((m) => m.chave === cidade);
      if (exato) return exato.id;
    }
  }
  // Sem campo cidade: procura o nome de um município dentro do endereço (o mais longo primeiro,
  // para "Cachoeiro de Itapemirim" ganhar de "Itapemirim").
  const ordenados = [...porNome].sort((a, b) => b.chave.length - a.chave.length);
  for (const e of enderecos) {
    const texto = e.texto ? ` ${normalizarTexto(e.texto)} ` : "";
    if (!texto.trim()) continue;
    const m = ordenados.find((x) => texto.includes(` ${x.chave} `));
    if (m) return m.id;
  }
  return null;
}

// Monta o plano: o que criar e o que atualizar no CRM a partir dos contatos.
export function planejarSincronizacao(contatos: ContatoGoogle[], clientes: ClienteResumo[], municipios: MunicipioResumo[], telefonesBloqueados: Set<string> = new Set(), filtro: FiltroContatos = FILTRO_PADRAO): PlanoSincronizacao {
  const porGoogleId = new Map<string, ClienteResumo>();
  const porTelefone = new Map<string, ClienteResumo>();
  const porNome = new Map<string, ClienteResumo>();
  for (const c of clientes) {
    if (c.googleContatoId && !porGoogleId.has(c.googleContatoId)) porGoogleId.set(c.googleContatoId, c);
    if (c.telefone) for (const v of phoneLookupVariants(c.telefone)) if (!porTelefone.has(v)) porTelefone.set(v, c);
    // Só cadastro SEM telefone casa por nome: mesmo nome com outro número é
    // outra pessoa.
    const n = c.telefone ? null : chaveNome(c.nome);
    if (n && !porNome.has(n)) porNome.set(n, c);
  }

  const plano: PlanoSincronizacao = { criar: [], atualizar: [], ignorados: 0, semTelefone: 0 };
  const jaTratados = new Set<string>();      // clientes já atualizados nesta rodada
  const telefonesCriados = new Set<string>(); // evita criar dois clientes para o mesmo número

  for (const g of contatos) {
    const nome = g.nome.trim();
    if (!nome || descartar(nome, filtro)) { plano.ignorados++; continue; }
    const telefones = g.telefones.map(telefoneNacional).filter((t): t is string => !!t);
    if (!telefones.length) { plano.semTelefone++; continue; }
    // Telefone já bloqueado no CRM (contato apagado por não ser cliente): não volta.
    if (telefones.some((t) => phoneLookupVariants(t).some((v) => telefonesBloqueados.has(v)))) { plano.ignorados++; continue; }

    let cliente = porGoogleId.get(g.id) ?? null;
    if (!cliente) for (const t of telefones) { for (const v of phoneLookupVariants(t)) { const c = porTelefone.get(v); if (c) { cliente = c; break; } } if (cliente) break; }
    // Mesmo nome já cadastrado sem telefone: é o mesmo cliente — liga (e
    // completa o número) em vez de criar um segundo cadastro.
    if (!cliente) { const n = chaveNome(nome); if (n) cliente = porNome.get(n) ?? null; }

    const email = g.emails[0] ?? null;
    const endereco = g.enderecos.find((e) => e.texto)?.texto ?? null;
    const municipioId = acharMunicipio(municipios, g.enderecos);

    if (cliente) {
      if (jaTratados.has(cliente.id)) { plano.ignorados++; continue; }
      jaTratados.add(cliente.id);
      const dados: PlanoAtualizar["dados"] = {};
      if (cliente.googleContatoId !== g.id) dados.googleContatoId = g.id;
      // Nome: troca o genérico do WhatsApp; e quem nasceu do Google segue o Google.
      if (nomeGenerico(cliente.nome) || (cliente.origem === "google" && cliente.nome.trim() !== nome)) dados.nome = nome;
      if (!cliente.telefone && telefones[0]) dados.telefone = telefones[0];
      if (!cliente.email && email) dados.email = email;
      if (!cliente.endereco && endereco) dados.endereco = endereco;
      if (!cliente.municipioId && municipioId) dados.municipioId = municipioId;
      if (Object.keys(dados).length) plano.atualizar.push({ id: cliente.id, dados });
      continue;
    }

    const principal = telefones[0];
    if (telefonesCriados.has(principal)) { plano.ignorados++; continue; }
    telefonesCriados.add(principal);
    plano.criar.push({ nome, telefone: principal, email, endereco, municipioId, googleContatoId: g.id });
  }
  return plano;
}

// Clientes do CRM que ainda não existem no Google (para o envio inverso).
export function clientesParaEnviar(clientes: ClienteResumo[], limite: number, filtro: FiltroContatos = FILTRO_PADRAO): ClienteResumo[] {
  return clientes
    .filter((c) => !c.googleContatoId && c.telefone && !nomeGenerico(c.nome) && !descartar(c.nome, filtro) && c.origem !== "prospect_ia" && c.origem !== "google")
    .slice(0, limite);
}
