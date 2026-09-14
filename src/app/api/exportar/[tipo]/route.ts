import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { lerParametros } from "@/lib/parametros";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Exportação dos dados do CRM em CSV que o Excel brasileiro abre direto
// (UTF-8 com BOM, separador ";"). Tipos: clientes, negociacoes, visitas,
// mensagens, pos-venda. Protegida pelo login (middleware).

const FUSO = "America/Sao_Paulo";
const dt = (d: Date | null | undefined) => (d ? d.toLocaleString("pt-BR", { timeZone: FUSO }) : "");
const num = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

function csv(colunas: string[], linhas: (string | number | boolean | null | undefined)[][]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "boolean" ? (v ? "sim" : "não") : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [colunas, ...linhas].map((l) => l.map(esc).join(";")).join("\r\n");
}

async function exportar(tipo: string): Promise<{ nome: string; conteudo: string } | null> {
  if (tipo === "clientes") {
    const rows = await db.cliente.findMany({
      orderBy: { nome: "asc" },
      include: { municipio: { select: { nome: true, regiao: true } }, frota: true, indicadoPor: { select: { nome: true } } },
    });
    return {
      nome: "clientes",
      conteudo: csv(
        ["Nome", "Telefone", "E-mail", "Município", "Região", "Status", "Já comprou", "Visitado", "Perfil DISC", "Lead score", "Último contato", "Aguardando resposta", "Interesse futuro", "Frota", "Indicado por", "Origem", "Observações", "Resumo", "Cadastrado em"],
        rows.map((c) => [
          c.nome, c.telefone, c.email, c.municipio?.nome, c.municipio?.regiao, c.status, c.jaComprou, c.visitado, c.perfilDISC, c.leadScore,
          dt(c.ultimoContato), c.aguardandoResposta, c.interesseFuturo ? `${dt(c.interesseFuturoData)} ${c.interesseFuturoNota ?? ""}`.trim() : "",
          c.frota.map((f) => `${f.marca} ${f.modelo}`).join(" | "), c.indicadoPor?.nome, c.origem, c.observacoes, c.resumoTexto, dt(c.criadoEm),
        ])
      ),
    };
  }
  if (tipo === "negociacoes") {
    const { taxaComissao } = await lerParametros();
    const rows = await db.negociacao.findMany({ orderBy: { atualizadoEm: "desc" }, include: { cliente: { select: { nome: true, municipio: { select: { nome: true } } } } } });
    return {
      nome: "negociacoes",
      conteudo: csv(
        ["Cliente", "Município", "Marca", "Modelo", "Valor", "Estágio", "Status", "Termômetro", "Tipo de pagamento", "Banco", "Entrada", "Concorrente", "Próxima ação", "Último contato", "Visita", "Faturado em", "Comissão", "Comissão paga", "Mês pagamento", "Motivo perda", "Criada em"],
        rows.map((n) => [
          n.cliente.nome, n.cliente.municipio?.nome, n.marca, n.maquinaModelo, num(n.valor), n.estagio, n.status, n.termometro, n.tipoPagamento, n.bancoFinanciamento,
          num(n.entradaValor), n.concorrenteMencionado, n.proximaAcao, dt(n.ultimoContato), dt(n.dataVisita), dt(n.faturadoEm),
          n.status === "ganha" ? num(Math.round((n.valor ?? 0) * taxaComissao * 100) / 100) : "", n.comissaoPaga, n.comissaoPagaMes, n.motivoPerda, dt(n.criadoEm),
        ])
      ),
    };
  }
  if (tipo === "visitas") {
    const rows = await db.visita.findMany({ orderBy: { data: "desc" }, include: { cliente: { select: { nome: true, telefone: true, municipio: { select: { nome: true } } } } } });
    return {
      nome: "visitas",
      conteudo: csv(
        ["Data", "Cliente", "Telefone", "Município", "Observação", "Na Google Agenda"],
        rows.map((v) => [dt(v.data), v.cliente.nome, v.cliente.telefone, v.cliente.municipio?.nome, v.observacao, !!v.googleEventId])
      ),
    };
  }
  if (tipo === "mensagens") {
    const rows = await db.whatsAppMessage.findMany({
      where: { isDraft: false },
      orderBy: { sentAt: "desc" },
      take: 50000,
      include: { conversation: { select: { contactName: true, externalPhone: true, isGroup: true } } },
    });
    return {
      nome: "mensagens-whatsapp",
      conteudo: csv(
        ["Data", "Contato", "Telefone", "Grupo", "Direção", "Mensagem", "Tipo de mídia", "Status de envio"],
        rows.map((m) => [dt(m.sentAt), m.conversation.contactName, m.conversation.externalPhone, m.conversation.isGroup, m.direction === "OUT" ? "enviada" : "recebida", m.body, m.mediaType, m.sendStatus])
      ),
    };
  }
  if (tipo === "pos-venda") {
    const rows = await db.posVendaContato.findMany({ orderBy: { data: "desc" }, include: { cliente: { select: { nome: true } } } });
    return {
      nome: "pos-venda",
      conteudo: csv(["Data", "Cliente", "Tipo", "Nota"], rows.map((p) => [dt(p.data), p.cliente.nome, p.tipo, p.nota])),
    };
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { tipo: string } }) {
  const r = await exportar(params.tipo);
  if (!r) return NextResponse.json({ erro: "Tipo inválido. Use clientes, negociacoes, visitas, mensagens ou pos-venda." }, { status: 400 });
  const data = new Date().toISOString().slice(0, 10);
  return new NextResponse(r.conteudo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crm-${r.nome}-${data}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
