// Manutenção do CRM (Fase 2B, item A): antes, as funções `garantir*` (DDL +
// escritas em massa) rodavam no CAMINHO DE RENDERIZAÇÃO de cada página, a
// cada cold start de lambda serverless — causa raiz do "~5s pra abrir".
//
// Agora elas só rodam: (1) manualmente via POST /api/admin/manutencao, ou
// (2) automaticamente, UMA vez, quando a chave `manutencao.v1` ainda não
// existe na tabela Configuracao. Cada página pesada faz no máximo 1 SELECT
// barato (memoizado por request com React.cache) para checar a chave.
import { cache } from "react";
import { db } from "@/lib/db";
import { aplicarMigracoes, limparMunicipiosInventados, limparTelefonesFalsos } from "@/lib/migrations";
import { garantirRegioes } from "@/lib/regioes";
import { limparContatosIndesejados } from "@/lib/contatos-bloqueados";
import { aplicarCorteInicialWhatsApp } from "@/lib/whatsapp-corte";
import { garantirColunasFunil } from "@/lib/actions";
import { garantirMaquinasNovas } from "@/lib/maquinas-garantidas";
import { garantirFichasVerificadas } from "@/lib/fichas-verificadas";

// v3: adiciona as tabelas do Orientador de Vendas (OrientadorAnalise), do
// Setor de Pós-venda (PosVendaContato) e a coluna Maquina.aplicacoes -- sem
// bumpar aqui, bancos que já tinham manutencao.v2 feita NUNCA rodariam a
// migração de novo sozinhos, e toda página que usa essas tabelas quebra
// (era o caso: "Algo deu errado" ao abrir o cadastro de cliente/Orientador/
// Pós-venda/Aplicações em produção). Bump aqui sempre que uma migração nova
// precisar rodar em bancos que já passaram pela versão anterior.
// v4: colunas de cache do Relatório de conversas (WhatsAppConversation.
// resumoRelatorio/resumoRelatorioEm). Bump aqui sempre que uma migração nova
// precisar rodar em bancos que já passaram pela versão anterior — sem isso,
// bancos com a versão antiga marcada NUNCA rodariam a migração sozinhos e
// toda página que usa as colunas novas quebra (já aconteceu em produção).
// v6: coluna Visita.googleEventId (integração real com a Google Agenda).
// v7: remove as 7 tabelas de telas excluídas (ver migrations.ts).
// v8: tabela Proposta (proposta comercial + calculadora).
// v9: tabela Cadencia (follow-up de 7 toques).
// v10: papel e probabilidade das colunas do funil.
// v11: janela de horário e limite diário da resposta automática.
// v12: respostas prontas do WhatsApp.
// v13: demandas em lista única (prioridade, origem, chave) e cidade da visita.
// v14: itens resolvidos da Central de alertas (AlertaOculto).
// v15: confirmação de visitas (status, realizadaEm, reagendadaDeId).
// v21: resolve alertas duplicados (mesmo cliente+tipo) e trava um índice
// único no banco pra nunca mais duplicar (ver migrations.ts).
// v22: índice em Cliente.aguardandoResposta e limpeza do AlertaOculto que
// "aguardando"/"atacar" não usam mais.
// v23: unifica eventos do ZEUS repetidos (mesmo erro várias vezes) num só,
// com contador de ocorrências, e trava índice único pra não duplicar de novo.
// v24: tabela ConversaExcluida + data de corte do WhatsApp (16/09/2026):
// apaga as conversas anteriores e impede que importação/histórico as traga
// de volta.
// v25: tabelas da unificação de cadastros duplicados (histórico para
// desfazer + redirecionamento dos links antigos).
// v26: tabela Evento (compromissos de vários dias na agenda).
// v30: tabelas da Central Inteligente (RelatorioDiario, IdeiaInovacao,
// PostMarketing, MemoriaCerebro).
// v31: NotaContextoCliente — o que o vendedor ensina sobre um cliente e que
// nunca apareceria na conversa do WhatsApp.
// v34: OrientadorAnalise.pedidosPendentes (ordens escritas na caixa de
// contexto, esperando confirmação) e Negociacao.observacao (tamanho do braço
// da escavadeira e se a venda é com Inscrição Estadual).
//
// v33: limpeza das cidades que a IA inventou (um cliente de Guaçuí gravado
// como sendo de Recife). Ver limparMunicipiosInventados em migrations.ts.
//
// v32: OrientadorAnalise.notaVendedor — o que o vendedor escreve na tela para
// o Orientador levar em conta.
//
// ATENÇÃO, e o motivo desta linha existir: TODA migração nova exige subir
// este número. A manutenção só roda quando a chave ainda NÃO está gravada no
// banco; com a chave antiga já em "ok", ela é pulada, a coluna nova nunca é
// criada e a tela que lê aquela coluna quebra inteira — foi exatamente o que
// aconteceu com a notaVendedor no Orientador.
export const CHAVE_MANUTENCAO = "manutencao.v37";

export type EtapaManutencao = { etapa: string; ok: boolean; erro?: string };

// Roda TODAS as rotinas de manutenção de uma vez (idempotentes) e devolve um
// relatório do que foi feito. Usada pela rota /api/admin/manutencao e pelo
// disparo automático de primeira execução.
export async function rodarManutencao(): Promise<EtapaManutencao[]> {
  const etapas: [string, () => Promise<void>][] = [
    ["Migrações de schema", aplicarMigracoes],
    ["Regiões e municípios", garantirRegioes],
    ["Limpeza de contatos bloqueados (contabilidade, bancos, hotéis…)", async () => { await limparContatosIndesejados(); }],
    ["Data de corte do WhatsApp (conversas antigas)", async () => { await aplicarCorteInicialWhatsApp(); }],
    ["Colunas do funil de negociações", async () => { await garantirColunasFunil(); }],
    ["Cidades inventadas pela IA (fora do ES)", async () => { await limparMunicipiosInventados(); }],
    ["Identificador do WhatsApp no lugar do telefone", async () => { await limparTelefonesFalsos(); }],
    ["Máquinas novas (pós-seed)", garantirMaquinasNovas],
    ["Fichas técnicas verificadas", garantirFichasVerificadas],
  ];

  const relatorio: EtapaManutencao[] = [];
  for (const [etapa, fn] of etapas) {
    try {
      await fn();
      relatorio.push({ etapa, ok: true });
    } catch (e) {
      relatorio.push({ etapa, ok: false, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return relatorio;
}

// Checagem barata (1 SELECT, memoizado por request) de se a manutenção já
// rodou pelo menos uma vez neste banco.
const manutencaoJaFeita = cache(async (): Promise<boolean> => {
  const cfg = await db.configuracao.findUnique({ where: { chave: CHAVE_MANUTENCAO } }).catch(() => null);
  return cfg?.valor === "ok";
});

// Chamado no topo das páginas pesadas. Faz no máximo 1 SELECT quando a
// manutenção já rodou (caso normal). Na primeira vez em um banco novo, grava
// a chave ANTES de rodar (lock otimista — evita duas lambdas rodando juntas
// ao mesmo tempo) e então executa a manutenção completa uma única vez.
export async function garantirManutencaoSeNecessario(): Promise<void> {
  if (await manutencaoJaFeita()) return;
  try {
    await db.configuracao.upsert({
      where: { chave: CHAVE_MANUTENCAO },
      update: {},
      create: { chave: CHAVE_MANUTENCAO, valor: "ok" },
    });
  } catch {
    return; // outra lambda já está cuidando disso ou o banco não está pronto
  }
  const relatorio = await rodarManutencao().catch((e) => {
    console.error("[manutencao] falhou inteira:", e);
    return [{ etapa: "geral", ok: false, erro: String(e) }] as EtapaManutencao[];
  });
  // Se alguma etapa falhou, APAGA a marca para tentar de novo na próxima
  // carga. Sem isto, a marca gravada antes de rodar (o lock que evita duas
  // lambdas juntas) ficava dizendo "já fiz" para sempre, e a migração que
  // não passou nunca mais teria uma segunda chance.
  const falhou = relatorio.filter((e) => !e.ok);
  if (falhou.length) {
    console.error("[manutencao] etapas com erro:", falhou.map((e) => `${e.etapa}: ${e.erro}`).join(" | "));
    await db.configuracao.delete({ where: { chave: CHAVE_MANUTENCAO } }).catch(() => {});
  }
}
