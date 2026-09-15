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
import { aplicarMigracoes } from "@/lib/migrations";
import { garantirRegioes } from "@/lib/regioes";
import { limparContatosIndesejados } from "@/lib/contatos-bloqueados";
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
export const CHAVE_MANUTENCAO = "manutencao.v17";

export type EtapaManutencao = { etapa: string; ok: boolean; erro?: string };

// Roda TODAS as rotinas de manutenção de uma vez (idempotentes) e devolve um
// relatório do que foi feito. Usada pela rota /api/admin/manutencao e pelo
// disparo automático de primeira execução.
export async function rodarManutencao(): Promise<EtapaManutencao[]> {
  const etapas: [string, () => Promise<void>][] = [
    ["Migrações de schema", aplicarMigracoes],
    ["Regiões e municípios", garantirRegioes],
    ["Limpeza de contatos bloqueados (contabilidade, bancos, hotéis…)", async () => { await limparContatosIndesejados(); }],
    ["Colunas do funil de negociações", async () => { await garantirColunasFunil(); }],
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
  await rodarManutencao();
}
