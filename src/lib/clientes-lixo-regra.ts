// Cadastros "sem identidade" — regra pura (sem banco, testável).
//
// Sobras de importação e de conversas apagadas: nome "?", "@", um id do
// WhatsApp de 14 dígitos no lugar do nome, número no lugar do nome sem
// telefone no campo, "Contato 5527…" que não tem mais conversa nenhuma.
// O que dá para consertar (número vira telefone, nome vira "Contato <tel>")
// é consertado; o que não tem nada — nem nome, nem dado, nem vínculo — sai.
// Nunca mexe em quem tem negociação, visita, frota, conversa, alerta ou
// tarefa, e nunca apaga cadastro ligado ao Google (a agenda mandaria de volta).

import { chaveNome, nomeGenerico, normalizarTexto, telefoneNacional } from "@/lib/google-contatos-util";
import { telefoneDoNome } from "@/lib/clientes-duplicados-regra";

export type ClienteParaLimpeza = {
  id: string;
  nome: string;
  telefone: string | null;
  googleContatoId: string | null;
  vinculos: number; // negociações + visitas + frota + conversas + alertas + tarefas + pós-venda + indicados
};

export type MotivoLimpeza = "sem_nome_sem_telefone" | "id_whatsapp_no_nome" | "numero_no_nome" | "nome_vazio_com_telefone" | "contato_sem_conversa";
export type DecisaoLimpeza =
  | { acao: "apagar"; motivo: MotivoLimpeza }
  | { acao: "renomear"; motivo: MotivoLimpeza; novoNome: string }
  | { acao: "telefone_do_nome"; motivo: MotivoLimpeza; novoTelefone: string };

// Id interno do WhatsApp (lid) no lugar do nome: 14+ dígitos, não é telefone.
export function ehIdWhatsApp(nome: string): boolean {
  const t = nome.trim();
  return /^\d{14,}$/.test(t.replace(/\D/g, "")) && /^[\d\s()+-]+$/.test(t);
}

// Nome sem nenhuma letra ("?", "…", "@", "-"): não identifica ninguém.
// "Zé" tem letras — é nome, fica.
export function nomeVazio(nome: string): boolean {
  return normalizarTexto(nome).replace(/[^a-z]/g, "").length === 0;
}

export function decidirLimpeza(c: ClienteParaLimpeza): DecisaoLimpeza | null {
  const temTelefone = !!c.telefone?.trim();
  const nome = c.nome.trim();

  // Número no lugar do nome, telefone vazio: o número É o telefone.
  const doNome = telefoneDoNome(nome);
  if (!temTelefone && doNome) {
    const nacional = telefoneNacional(doNome);
    if (nacional) return { acao: "telefone_do_nome", motivo: "numero_no_nome", novoTelefone: nacional };
  }

  const semNome = ehIdWhatsApp(nome) || (nomeVazio(nome) && !doNome);
  if (semNome) {
    if (temTelefone) return { acao: "renomear", motivo: ehIdWhatsApp(nome) ? "id_whatsapp_no_nome" : "nome_vazio_com_telefone", novoNome: `Contato ${c.telefone!.trim()}` };
    if (c.vinculos === 0 && !c.googleContatoId) return { acao: "apagar", motivo: ehIdWhatsApp(nome) ? "id_whatsapp_no_nome" : "sem_nome_sem_telefone" };
    return null;
  }

  // "Contato 5527…" sem conversa e sem nada: sobra de conversa apagada. Se
  // a pessoa mandar mensagem de novo, o cadastro nasce de novo sozinho.
  if (nomeGenerico(nome) && !chaveNome(nome) && c.vinculos === 0 && !c.googleContatoId) {
    return { acao: "apagar", motivo: "contato_sem_conversa" };
  }
  return null;
}

export const DESCRICAO_MOTIVO: Record<MotivoLimpeza, string> = {
  sem_nome_sem_telefone: "sem nome e sem telefone",
  id_whatsapp_no_nome: "id do WhatsApp no lugar do nome",
  numero_no_nome: "número no lugar do nome (vira telefone)",
  nome_vazio_com_telefone: "nome vazio, só telefone (vira \"Contato <tel>\")",
  contato_sem_conversa: "contato de WhatsApp sem conversa nem dado",
};
