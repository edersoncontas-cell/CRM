// Contexto e geração de resposta do Cérebro para o auto-responder do WhatsApp.
// Compartilhado pelas duas rotas que despacham o Cérebro automaticamente:
// `api/cerebro/despacho-rapido` (debounce de 1s, caminho principal) e
// `api/cron/agnes-dispatch` (debounce de 2min, fallback do cron) — antes cada
// uma montava um contexto diferente; agora as duas usam o MESMO contexto rico
// (cliente, negociações abertas, visitas, alertas, tarefas, Academia).

import { db } from "@/lib/db";
import { METODOLOGIAS, PERFIS_DISC, OBJECOES, FECHAMENTOS } from "@/lib/academia";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { zeusReport } from "@/lib/zeus/eventos";
import { lerParametros } from "@/lib/parametros";
import { montarContextoAgenda } from "@/lib/zeus/agenda-contexto";

// Monta contexto rico do cliente para o Cérebro entender tudo antes de responder.
export async function montarContextoCliente(conv: {
  id: string;
  contactName: string | null;
  clienteId: string | null;
  externalPhone: string;
}): Promise<string> {
  if (!conv.clienteId) {
    return `Cliente: ${conv.contactName ?? conv.externalPhone}\nSituação: contato ainda não vinculado ao CRM.`;
  }

  try {
    const [cliente, negociacoes, visitas] = await Promise.all([
      db.cliente.findUnique({
        where: { id: conv.clienteId },
        include: {
          municipio: true,
          frota: true,
          alertas: { where: { resolvido: false }, orderBy: { criadoEm: "desc" }, take: 5 },
          tarefas: { where: { coluna: { not: "concluido" } }, orderBy: { criadoEm: "desc" }, take: 5 },
        },
      }),
      db.negociacao.findMany({
        where: { clienteId: conv.clienteId, status: "aberta" },
        orderBy: { ultimoContato: "desc" },
        take: 5,
      }),
      db.visita.findMany({
        where: { clienteId: conv.clienteId },
        orderBy: { data: "desc" },
        take: 3,
      }),
    ]);

    if (!cliente) return `Cliente ID ${conv.clienteId} — dados não encontrados.`;

    const linhas: string[] = [
      `Nome: ${cliente.nome}`,
      cliente.municipio ? `Cidade: ${cliente.municipio.nome}` : null,
      `Status CRM: ${cliente.status}`,
      cliente.telefone ? `Telefone: ${cliente.telefone}` : null,
      cliente.jaComprou ? `Já comprou de nós anteriormente.` : `Ainda não comprou conosco.`,
      cliente.perfilDISC ? `Perfil DISC: ${cliente.perfilDISC}` : null,
      cliente.perfilIA ? `Perfil IA: ${cliente.perfilIA}` : null,
      cliente.abordagemIA ? `Abordagem sugerida: ${cliente.abordagemIA}` : null,
      cliente.resumoTexto ? `Resumo: ${cliente.resumoTexto}` : null,
      cliente.resumoMaquinas ? `Máquinas de interesse: ${cliente.resumoMaquinas}` : null,
      cliente.resumoCondicao ? `Condição de pagamento preferida: ${cliente.resumoCondicao}` : null,
      cliente.resumoValor ? `Valor negociado estimado: R$ ${cliente.resumoValor.toLocaleString("pt-BR")}` : null,
      cliente.interesseFuturo ? `Interesse futuro registrado${cliente.interesseFuturoData ? " para " + cliente.interesseFuturoData.toLocaleDateString("pt-BR") : ""}${cliente.interesseFuturoNota ? ": " + cliente.interesseFuturoNota : ""}` : null,
      cliente.observacoes ? `Observações: ${cliente.observacoes}` : null,
    ].filter(Boolean) as string[];

    if (cliente.frota.length > 0) {
      const frotaStr = cliente.frota.map((m) => `${m.marca} ${m.modelo}`).join(", ");
      linhas.push(`Frota atual: ${frotaStr}`);
    }

    if (negociacoes.length > 0) {
      linhas.push(`--- Negociações abertas ---`);
      for (const neg of negociacoes) {
        const partes = [
          neg.maquinaModelo ? `Máquina: ${neg.maquinaModelo}` : null,
          neg.valor ? `Valor: R$ ${neg.valor.toLocaleString("pt-BR")}` : null,
          neg.estagio ? `Estágio: ${neg.estagio}` : null,
          neg.termometro !== undefined ? `Termômetro: ${neg.termometro}/100` : null,
          neg.proximaAcao ? `Próxima ação: ${neg.proximaAcao}` : null,
          neg.concorrenteMencionado ? `Concorrente: ${neg.concorrenteMencionado}` : null,
          neg.tipoPagamento ? `Condição de pagamento: ${neg.tipoPagamento}` : null,
          neg.bancoFinanciamento ? `Banco: ${neg.bancoFinanciamento}` : null,
          neg.entradaValor ? `Entrada: R$ ${neg.entradaValor.toLocaleString("pt-BR")}${neg.entradaPercentual ? ` (${neg.entradaPercentual}%)` : ""}` : null,
          neg.consorcioTipo ? `Consórcio: ${neg.consorcioTipo}${neg.consorcioCotas ? ` — ${neg.consorcioCotas} cotas` : ""}` : null,
          neg.crdSaldoParcelasQtd ? `CRD PME: ${neg.crdSaldoParcelasQtd}x de R$ ${(neg.crdParcelaValor ?? 0).toLocaleString("pt-BR")}` : null,
          neg.faturadoEm ? `Faturado em: ${neg.faturadoEm.toLocaleDateString("pt-BR")}` : null,
        ].filter(Boolean).join(" | ");
        linhas.push(`• ${partes}`);
      }
    }

    if (visitas.length > 0) {
      linhas.push(`--- Visitas ---`);
      for (const v of visitas) {
        linhas.push(`• ${v.data.toLocaleDateString("pt-BR")}${v.observacao ? ": " + v.observacao : ""}`);
      }
    }

    if (cliente.proximaVisita) {
      linhas.push(`Próxima visita agendada: ${cliente.proximaVisita.toLocaleDateString("pt-BR")}${cliente.proximaVisitaNota ? " — " + cliente.proximaVisitaNota : ""}`);
    }

    if (cliente.alertas.length > 0) {
      linhas.push(`Alertas: ${cliente.alertas.map((a) => a.mensagem).join("; ")}`);
    }

    // Notas de conhecimento do vendedor (Comparativo 2.0) sobre a(s)
    // máquina(s) que o cliente demonstrou interesse — resumo/negociações.
    const modelosInteresse = new Set<string>();
    if (cliente.resumoMaquinas) modelosInteresse.add(cliente.resumoMaquinas);
    for (const neg of negociacoes) if (neg.maquinaModelo) modelosInteresse.add(neg.maquinaModelo);
    if (modelosInteresse.size > 0) {
      const maquinasInteresse = await db.maquina.findMany({
        where: { proprio: true, OR: Array.from(modelosInteresse).map((m) => ({ modelo: { contains: m, mode: "insensitive" as const } })) },
        select: { id: true, modelo: true },
      });
      if (maquinasInteresse.length > 0) {
        const notas = await db.notaMaquina.findMany({
          where: { maquinaId: { in: maquinasInteresse.map((m) => m.id) } },
          orderBy: { criadoEm: "desc" },
          take: 10,
        });
        if (notas.length > 0) {
          linhas.push(`--- Notas do vendedor sobre a(s) máquina(s) de interesse ---`);
          for (const nt of notas) {
            const maq = maquinasInteresse.find((m) => m.id === nt.maquinaId);
            linhas.push(`• [${maq?.modelo ?? "?"}] ${nt.texto}`);
          }
        }
      }
    }

    // Agenda dos próximos dias com cidade + melhor dia para visitar ESTE
    // cliente (por proximidade) — para a IA propor um dia que encaixe na rota.
    const agenda = await montarContextoAgenda(cliente.id);
    if (agenda.texto) linhas.push(agenda.texto);

    return linhas.join("\n");
  } catch {
    return `Cliente: ${conv.contactName ?? conv.externalPhone}`;
  }
}

// Monta trecho da Academia de Vendas relevante para o contexto da conversa.
export function montarContextoAcademia(historico: string): string {
  const hist = historico.toLowerCase();

  const metRelevantes = METODOLOGIAS.filter((m) => {
    const palavras = m.quandoUsar.toLowerCase() + " " + m.resumo.toLowerCase();
    return (
      (hist.includes("preço") && palavras.includes("preço")) ||
      (hist.includes("caro") && palavras.includes("caro")) ||
      (hist.includes("aluguel") && palavras.includes("aluguel")) ||
      (hist.includes("concorrente") && palavras.includes("concorrente")) ||
      (hist.includes("prazo") && palavras.includes("prazo")) ||
      true // sempre inclui pelo menos as primeiras
    );
  }).slice(0, 3);

  const objRelevantes = OBJECOES.filter((o) => {
    const kw = o.objecao.toLowerCase();
    return (
      (hist.includes("caro") && kw.includes("caro")) ||
      (hist.includes("barato") && kw.includes("barato")) ||
      (hist.includes("pensar") && kw.includes("pensar")) ||
      (hist.includes("sócio") && kw.includes("sócio")) ||
      (hist.includes("aluguel") && kw.includes("aluguel")) ||
      (hist.includes("concorrente") && kw.includes("concorrente")) ||
      (hist.includes("espera") && kw.includes("espera"))
    );
  }).slice(0, 2);

  const fechamentos = FECHAMENTOS.slice(0, 2);

  const linhas: string[] = ["## Técnicas de venda disponíveis:"];

  for (const m of metRelevantes) {
    linhas.push(`**${m.nome}**: ${m.resumo.slice(0, 120)}...`);
  }

  if (objRelevantes.length > 0) {
    linhas.push("\n## Respostas para objeções identificadas na conversa:");
    for (const o of objRelevantes) {
      linhas.push(`- Objeção "${o.objecao}": ${o.resposta}`);
    }
  }

  linhas.push("\n## Fechamentos recomendados:");
  for (const f of fechamentos) {
    linhas.push(`- ${f.nome}: ${f.exemplo}`);
  }

  const perfis: Record<string, string> = {
    D: "direto, objetivo, foca em resultado e ROI",
    I: "caloroso, emocional, usa prova social e entusiasmo",
    S: "paciente, foca em segurança e garantia, zero pressão",
    C: "técnico, usa dados e comparativos, seja preciso",
  };
  const perfilDetectado = hist.includes("resultado") || hist.includes("rápido")
    ? "D" : hist.includes("garantia") || hist.includes("segurança")
    ? "S" : hist.includes("dados") || hist.includes("especificação")
    ? "C" : null;
  if (perfilDetectado) {
    const p = PERFIS_DISC.find((d) => d.letra === perfilDetectado);
    if (p) linhas.push(`\nPerfil detectado: ${p.nome} — ${perfis[perfilDetectado]}. Abordagem: ${p.abordagemWhatsApp}`);
  }

  return linhas.join("\n");
}

// Follow-up automático inteligente (Fase 5, item 3): mensagem de RETOMADA de
// contato para uma negociação quente que esfriou — não responde a mensagem
// nenhuma do cliente (diferente do Orientador de Vendas, que roda por
// mensagem), então o prompt é deliberadamente mais cauteloso para não soar
// como cobrança/robô. Roteado por llmTexto (OpenAI > Anthropic > Groq).
export async function gerarMensagemFollowUp(args: {
  contextoCliente: string;
  estilo: string | null;
}): Promise<string> {
  if (!iaHabilitada()) return "";

  const p = await lerParametros();
  const system = `Você é o Orientador de Vendas, assistente comercial de ${p.nomeVendedor} (${p.marcas}, ${p.regiao}).
O cliente abaixo tem uma negociação ABERTA e QUENTE, mas o contato esfriou (alguns dias sem resposta).

## Contexto completo do cliente
${args.contextoCliente}
${args.estilo ? `\n## Estilo de comunicação do vendedor\n${args.estilo}` : ""}

## Regras absolutas
- Escreva uma mensagem de WhatsApp CURTA (1-3 frases) para RETOMAR o contato de forma natural
- Use um gancho real do contexto acima (a máquina de interesse, a visita combinada, o que ficou pendente)
- NUNCA soe como cobrança, robô ou mensagem automática de disparo em massa
- NUNCA invente preço, prazo ou informação que não esteja no contexto
- NUNCA use emojis — linguagem 100% profissional e direta
- Responda APENAS com o texto da mensagem, sem aspas nem comentários`;

  try {
    return (await llmTexto(system, "Escreva a mensagem de retomada de contato.", { maxTokens: 150 })).trim();
  } catch (e) {
    await zeusReport(e, "gerarMensagemFollowUp (retomada de contato)");
    return "";
  }
}

// Toque de WhatsApp da cadência de 7 toques (lib/cadencias.ts). Diferente do
// follow-up de negociação quente, aqui o cliente ainda NÃO respondeu nada —
// cada toque precisa entregar valor novo e terminar com pergunta fechada,
// nunca cobrar. Recebe o modelo de texto do nicho como referência do tom.
export async function gerarMensagemToqueCadencia(args: {
  contextoCliente: string;
  estilo: string | null;
  toque: { numero: number; titulo: string; objetivo: string; canal: string };
  nicho: string;
  modelo: string;
}): Promise<string> {
  if (!iaHabilitada()) return "";

  const p = await lerParametros();
  const system = `Você é o Orientador de Vendas, assistente comercial de ${p.nomeVendedor} (${p.marcas}, ${p.regiao}).
O cliente abaixo está numa cadência de prospecção de 7 toques e ainda não respondeu. Este é o toque ${args.toque.numero} de 7: "${args.toque.titulo}".
Nicho do cliente: ${args.nicho}.

## Objetivo deste toque
${args.toque.objetivo}

## Contexto do cliente (use ganchos reais daqui; se estiver vazio, use o modelo)
${args.contextoCliente || "(sem histórico)"}
${args.estilo ? `\n## Estilo de comunicação do vendedor\n${args.estilo}` : ""}

## Modelo de referência (tom e tamanho — adapte, não copie)
${args.modelo}

## Regras absolutas
- Mensagem de WhatsApp CURTA: no máximo 3 linhas
- Valor novo neste toque; NUNCA "viu minha mensagem?" nem repetição do toque anterior
- Termine com UMA pergunta fechada (sim/não ou escolha simples)
- NUNCA invente preço, prazo, nome de obra ou dado que não esteja no contexto; use frases genéricas quando faltar informação
- NUNCA use emojis — linguagem profissional e direta
- Responda APENAS com o texto da mensagem, sem aspas nem comentários`;

  try {
    return (await llmTexto(system, "Escreva a mensagem deste toque.", { maxTokens: 180 })).trim();
  } catch (e) {
    await zeusReport(e, "gerarMensagemToqueCadencia (cadência de 7 toques)");
    return "";
  }
}
