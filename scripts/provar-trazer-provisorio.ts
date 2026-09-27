// Prova da volta do banco provisório para o principal, em dois Postgres
// locais (não há rede para o Neon nem para o Supabase daqui).
//
//   PRINCIPAL = cópia do banco de teste (1.298 clientes), com as sobras que o
//               Neon de verdade tem (tabela Usuario, coluna vendedorId, marca
//               manutencao.v45) e um pouco de histórico de WhatsApp.
//   PROVISORIO = nasce vazio pelo DDL do banco-do-zero, como o Supabase, e
//               recebe uma "semana" simulada: clientes reimportados com id
//               novo, conversas dos mesmos números, mensagens repetidas e
//               novas, negociação, envio em massa pendente, travas liberadas…
//
// Uso (com os dois bancos criados — ver o fim do arquivo):
//   PRINCIPAL_URL=postgresql://... PROVISORIO_URL=postgresql://... npx tsx scripts/provar-trazer-provisorio.ts

import { PrismaClient } from "@prisma/client";
import { DDL_DO_ZERO } from "@/lib/banco-do-zero-ddl";
import { rodarVolta, TOTAL_ETAPAS, type ResultadoEtapa } from "@/lib/trazer-provisorio";

const principal = new PrismaClient({ datasources: { db: { url: process.env.PRINCIPAL_URL! } } });
const provisorio = new PrismaClient({ datasources: { db: { url: process.env.PROVISORIO_URL! } } });

type L = Record<string, unknown>;
const falhas: string[] = [];
function confere(ok: boolean, o_que: string) {
  console.log(`${ok ? "  ok " : "  FALHOU"} ${o_que}`);
  if (!ok) falhas.push(o_que);
}
async function um<T = L>(db: PrismaClient, sql: string, ...p: unknown[]): Promise<T> {
  return ((await db.$queryRawUnsafe<T[]>(sql, ...p))[0]) as T;
}
async function n(db: PrismaClient, sql: string, ...p: unknown[]): Promise<number> {
  return Number((await um<{ n: number }>(db, sql, ...p)).n);
}
// Linha a linha, só com as colunas que a linha traz: o resto fica com o
// valor padrão da tabela (como numa gravação normal do CRM).
async function inserir(db: PrismaClient, tabela: string, linhas: L[]) {
  const porColunas = new Map<string, L[]>();
  for (const l of linhas) {
    const limpa = Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined));
    const k = Object.keys(limpa).sort().join(",");
    porColunas.set(k, [...(porColunas.get(k) ?? []), limpa]);
  }
  for (const [k, grupo] of porColunas) {
    const cols = k.split(",").map((c) => `"${c}"`).join(", ");
    await db.$executeRawUnsafe(`INSERT INTO "${tabela}" (${cols}) SELECT ${cols} FROM json_populate_recordset(NULL::"${tabela}", $1::json)`, JSON.stringify(grupo));
  }
}
const agora = new Date("2026-09-28T15:00:00Z");
const dia = (d: number) => new Date(agora.getTime() - d * 86_400_000);

async function montarPrincipal() {
  await principal.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Usuario" (id text PRIMARY KEY, login text, papel text)`);
  await principal.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "vendedorId" text`);
  await principal.$executeRawUnsafe(`ALTER TABLE "Negociacao" ADD COLUMN IF NOT EXISTS "vendedorId" text`);
  await principal.$executeRawUnsafe(`INSERT INTO "Configuracao" VALUES ('manutencao.v45','ok') ON CONFLICT DO NOTHING`);
  await principal.$executeRawUnsafe(`INSERT INTO "Configuracao" VALUES ('whatsapp.pausa.v1','pausado') ON CONFLICT (chave) DO UPDATE SET valor='pausado'`);
  await principal.$executeRawUnsafe(
    `INSERT INTO "Configuracao" VALUES ('frase_dia.historico', $1) ON CONFLICT (chave) DO UPDATE SET valor=EXCLUDED.valor`,
    JSON.stringify([{ d: "2026-09-20", f: "Frase antiga um", a: "Autor A" }, { d: "2026-09-21", f: "Frase antiga dois", a: "Autor B" }]),
  );
  // Três clientes com conversa e histórico no principal.
  const cs = await principal.$queryRawUnsafe<L[]>(`SELECT id, telefone FROM "Cliente" WHERE telefone IS NOT NULL ORDER BY id LIMIT 3`);
  for (const [i, c] of cs.entries()) {
    await inserir(principal, "WhatsAppConversation", [{ id: `conv_p${i}`, externalPhone: `55${c.telefone}`, clienteId: c.id, lastMessageAt: dia(10), createdAt: dia(30), updatedAt: dia(10) }]);
    await inserir(principal, "WhatsAppMessage", [
      { id: `msg_p${i}a`, conversationId: `conv_p${i}`, direction: "IN", body: "Bom dia, tem retro?", sentAt: dia(10), zapiMessageId: `Z-P${i}-1` },
      { id: `msg_p${i}b`, conversationId: `conv_p${i}`, direction: "OUT", body: "Tenho sim", sentAt: dia(10), zapiMessageId: null },
    ]);
  }
  await inserir(principal, "Negociacao", [{ id: "neg_p0", clienteId: cs[0].id, marca: "New Holland", maquinaModelo: "B95C", status: "aberta", estagio: "proposta", criadoEm: dia(20), atualizadoEm: dia(20) }]);
  await inserir(principal, "OrientadorAnalise", [{ id: "ori_p0", clienteId: cs[0].id, estagioVenda: "velho", temperatura: "morno", objecoes: [], oportunidadesPerdidas: [], atualizadoEm: dia(10) }]);
  return cs;
}

async function montarProvisorio(csP: L[]) {
  for (const cmd of DDL_DO_ZERO) await provisorio.$executeRawUnsafe(cmd);
  // A manutenção do provisório recriou cidades, máquinas e colunas com ids novos.
  const cidades = await principal.$queryRawUnsafe<L[]>(`SELECT * FROM "Municipio"`);
  await inserir(provisorio, "Municipio", [...cidades.map((c) => ({ ...c, id: `mun_v_${c.id}` })), { id: "mun_nova", nome: "Cidade Nova do Teste" }]);
  const maquinas = await principal.$queryRawUnsafe<L[]>(`SELECT * FROM "Maquina"`);
  if (maquinas.length) await inserir(provisorio, "Maquina", maquinas.map((m) => ({ ...m, id: `maq_v_${m.id}` })));
  const colunas = await principal.$queryRawUnsafe<L[]>(`SELECT * FROM "ColunaFunil"`);
  if (colunas.length) await inserir(provisorio, "ColunaFunil", colunas.map((c) => ({ ...c, id: `col_v_${c.id}` })));

  // Clientes reimportados: ids novos, mesmo telefone/Google.
  const clientes = await principal.$queryRawUnsafe<L[]>(`SELECT * FROM "Cliente"`);
  const reimport = clientes.map((c) => ({
    ...c, id: `cli_v_${c.id}`, municipioId: c.municipioId ? `mun_v_${c.municipioId}` : null, indicadoPorId: null, vendedorId: undefined,
  }));
  const [a, b, z] = [csP[0], csP[1], csP[2]].map((c) => `cli_v_${c.id}`);
  for (const r of reimport) {
    if (r.id === a) Object.assign(r, { naoPerturbe: true, naoPerturbeEm: dia(2), naoPerturbeMotivo: "Respondeu SAIR" });
    if (r.id === b) Object.assign(r, { ultimoContato: dia(1), aguardandoResposta: true });
    if (r.id === z) Object.assign(r, { email: "novo@cliente.com.br" });
  }
  await inserir(provisorio, "Cliente", reimport);
  await inserir(provisorio, "Cliente", [
    { id: "cli_novo1", nome: "Cliente Novo Um", telefone: "28999990001", municipioId: "mun_nova", criadoEm: dia(3), atualizadoEm: dia(3) },
    { id: "cli_novo2", nome: "Cliente Novo Dois", telefone: "28999990002", indicadoPorId: "cli_novo1", criadoEm: dia(3), atualizadoEm: dia(3) },
  ]);

  // Conversas: as três do principal (mesmo número, id novo) e uma nova.
  await inserir(provisorio, "WhatsAppConversation", [
    ...csP.map((c, i) => ({ id: `conv_v${i}`, externalPhone: `55${c.telefone}`, clienteId: `cli_v_${c.id}`, lastMessageAt: dia(1), createdAt: dia(6), updatedAt: dia(1), agnesScheduledAt: dia(1) })),
    { id: "conv_vnova", externalPhone: "5528999990001", clienteId: "cli_novo1", lastMessageAt: dia(2), createdAt: dia(3), updatedAt: dia(2), agnesScheduledAt: dia(2) },
  ]);
  await inserir(provisorio, "WhatsAppMessage", [
    // repetida do principal (mesmo id do WhatsApp) — não pode duplicar
    { id: "msg_v0a", conversationId: "conv_v0", direction: "IN", body: "Bom dia, tem retro?", sentAt: dia(10), zapiMessageId: "Z-P0-1" },
    // repetida sem id do WhatsApp (mesmo texto, mesmo instante)
    { id: "msg_v0b", conversationId: "conv_v0", direction: "OUT", body: "Tenho sim", sentAt: dia(10), zapiMessageId: null },
    { id: "msg_v0c", conversationId: "conv_v0", direction: "IN", body: "Quanto fica a B95C?", sentAt: dia(2), zapiMessageId: "Z-V0-3" },
    { id: "msg_v1a", conversationId: "conv_v1", direction: "OUT", body: "Falhou ao sair", sentAt: dia(1), sendStatus: "FAILED", retryCount: 0 },
    { id: "msg_v1b", conversationId: "conv_v1", direction: "OUT", body: "Rascunho do Orientador", sentAt: dia(1), isDraft: true, draftStatus: "PENDING" },
    { id: "msg_vn1", conversationId: "conv_vnova", direction: "IN", body: "Oi, vi o anúncio", sentAt: dia(2), zapiMessageId: "Z-VN-1" },
  ]);

  await inserir(provisorio, "Negociacao", [
    { id: "neg_v_dupla", clienteId: a, marca: "New Holland", maquinaModelo: "B95C", status: "aberta", estagio: "oportunidade", criadoEm: dia(2), atualizadoEm: dia(2) },
    { id: "neg_v_nova", clienteId: "cli_novo1", marca: "Dynapac", maquinaModelo: "CA25", status: "aberta", estagio: "proposta", criadoEm: dia(2), atualizadoEm: dia(2) },
  ]);
  await inserir(provisorio, "Proposta", [{ id: "prop_v", negociacaoId: "neg_v_nova", dados: { valor: 450000 }, criadoEm: dia(2), atualizadoEm: dia(2) }]);
  await inserir(provisorio, "Visita", [{ id: "vis_v", clienteId: "cli_novo1", data: dia(-2), cidade: "Cidade Nova do Teste", criadoEm: dia(2) }]);
  await inserir(provisorio, "OrientadorAnalise", [{ id: "ori_v0", clienteId: a, estagioVenda: "novo", temperatura: "quente", objecoes: [], oportunidadesPerdidas: [], atualizadoEm: dia(1) }]);
  await inserir(provisorio, "TarefaKanban", [{ id: "tar_v", titulo: "Ligar", coluna: "a_fazer", clienteId: b, chave: "zeus:ligar:b", criadoEm: dia(1) }]);
  await inserir(provisorio, "MidiaEnvio", [{ id: "mid_v", mimeType: "image/png", nome: "folder.png", tipo: "imagem", origem: "upload", base64: "iVBORw0KGgo=", criadoEm: dia(2) }]);
  await inserir(provisorio, "EnvioProgramado", [
    { id: "env_v", quando: dia(-1), texto: "Promoção", clienteIds: [a, b, "cli_novo1"], midiaId: "mid_v", status: "pendente", criadoEm: dia(1) },
    { id: "env_v2", quando: dia(1), texto: "Meio caminho", clienteIds: [z], status: "enviando", criadoEm: dia(1), enviados: 3 },
  ]);
  await inserir(provisorio, "AuditLog", [{ id: "aud_v", acao: "cliente_atualizado", origem: "usuario", descricao: "teste", clienteId: a, criadoEm: dia(1) }]);
  await inserir(provisorio, "RelatorioDiario", [{ id: "rel_v", dia: dia(1), resumo: "dia bom", dados: "{}", criadoEm: dia(1) }]);
  await inserir(provisorio, "UnificacaoClientes", [{ id: "uni_v", origem: "usuario", resumo: "x", dados: { ids: [a] }, criadoEm: dia(1) }]);
  await inserir(provisorio, "Configuracao", [
    { chave: "whatsapp.pausa.v1", valor: "liberado" },
    { chave: "ia.somente_gratuitos", valor: "false" },
    { chave: "manutencao.v44", valor: "ok" },
    { chave: "filtro.contatos.termos", valor: "[\"teste\"]" },
    { chave: "frase_dia.historico", valor: JSON.stringify([{ d: "2026-09-21", f: "Frase antiga dois", a: "Autor B" }, { d: "2026-09-25", f: "Frase da semana", a: "Autor C" }]) },
  ]);
}

function tabela(etapas: ResultadoEtapa[]) {
  for (const e of etapas) {
    if (!e.noProvisorio && !e.erro) continue;
    console.log(`  ${e.rotulo.padEnd(28)} prov ${String(e.noProvisorio).padStart(5)} · já trazidas ${String(e.jaTrazidas).padStart(5)} · já existiam ${String(e.jaExistiam).padStart(5)} · novas ${String(e.novas).padStart(4)} · gravadas ${String(e.gravadas).padStart(4)} · atualizadas ${e.atualizadas}${e.deixadasDeFora ? ` · fora ${e.deixadasDeFora}` : ""}${e.observacao ? `\n      ↳ ${e.observacao}` : ""}${e.erro ? `\n      ERRO ${e.erro}` : ""}`);
  }
}

async function main() {
  const csP = await montarPrincipal();
  await montarProvisorio(csP);
  // SO_MONTAR=1: só monta os dois bancos (para conferir a tela com eles).
  if (process.env.SO_MONTAR) {
    console.log("bancos montados");
    await principal.$disconnect(); await provisorio.$disconnect();
    return;
  }
  const antes = {
    clientes: await n(principal, `SELECT count(*)::int n FROM "Cliente"`),
    conversas: await n(principal, `SELECT count(*)::int n FROM "WhatsAppConversation"`),
    mensagens: await n(principal, `SELECT count(*)::int n FROM "WhatsAppMessage"`),
    cidades: await n(principal, `SELECT count(*)::int n FROM "Municipio"`),
    usuarios: await n(principal, `SELECT count(*)::int n FROM "Usuario"`),
  };

  console.log("\n1) PRÉVIA (não grava nada)");
  const previa = await rodarVolta({ origem: provisorio, destino: principal, aplicar: false });
  tabela(previa.etapas);
  confere((await n(principal, `SELECT count(*)::int n FROM "Cliente"`)) === antes.clientes, "a prévia não gravou nada");
  confere(!!previa.etapas.find((e) => e.tabela === "Negociacao")?.observacao, "a prévia avisa da negociação que pode ser a mesma venda duas vezes");

  console.log("\n2) TRAZER — uma etapa por rodada, como se o tempo acabasse a cada uma");
  let inicio = 0, rodadas = 0;
  const feitas: ResultadoEtapa[] = [];
  for (;;) {
    rodadas++;
    const r = await rodarVolta({ origem: provisorio, destino: principal, aplicar: true, inicio, prazoMs: 1, agora: (() => { let t = 0; return () => (t += 10); })() });
    feitas.push(...r.etapas);
    if (r.etapas.some((e) => e.erro)) break;
    if (r.concluido) break;
    inicio = r.proxima;
  }
  tabela(feitas);
  confere(rodadas >= TOTAL_ETAPAS - 1, `rodou em ${rodadas} rodadas, continuando de onde parou`);
  confere(!feitas.some((e) => e.erro), "nenhuma etapa deu erro");

  console.log("\n3) CONFERÊNCIA");
  const [a, b, z] = csP.map((c) => String(c.id));
  confere((await n(principal, `SELECT count(*)::int n FROM "Cliente"`)) === antes.clientes + 2, "só os 2 clientes novos entraram (os 1.298 reimportados casaram)");
  confere((await um<L>(principal, `SELECT "naoPerturbe" FROM "Cliente" WHERE id=$1`, a)).naoPerturbe === true, "quem respondeu SAIR no provisório ficou marcado no principal");
  confere((await um<L>(principal, `SELECT "aguardandoResposta" FROM "Cliente" WHERE id=$1`, b)).aguardandoResposta === true, "o contato mais recente (e o 'esperando resposta') veio");
  confere((await um<L>(principal, `SELECT email FROM "Cliente" WHERE id=$1`, z)).email === "novo@cliente.com.br", "campo vazio no principal foi completado");
  confere((await um<L>(principal, `SELECT "indicadoPorId" FROM "Cliente" WHERE id='cli_novo2'`)).indicadoPorId === "cli_novo1", "quem indicou quem veio certo");
  const cidadeNova = await um<L>(principal, `SELECT id FROM "Municipio" WHERE nome='Cidade Nova do Teste'`);
  confere((await n(principal, `SELECT count(*)::int n FROM "Municipio"`)) === antes.cidades + 1, "cidades não duplicaram (só a nova entrou)");
  confere((await um<L>(principal, `SELECT "municipioId" FROM "Cliente" WHERE id='cli_novo1'`)).municipioId === cidadeNova.id, "cliente novo aponta para a cidade certa");
  confere((await n(principal, `SELECT count(*)::int n FROM "WhatsAppConversation"`)) === antes.conversas + 1, "conversas do mesmo número não duplicaram (só a nova entrou)");
  confere((await n(principal, `SELECT count(*)::int n FROM "WhatsAppMessage"`)) === antes.mensagens + 4, "mensagens: as 2 repetidas ficaram de fora, as 4 novas entraram");
  confere((await um<L>(principal, `SELECT "conversationId" FROM "WhatsAppMessage" WHERE id='msg_v0c'`)).conversationId === "conv_p0", "mensagem nova foi para a conversa que já existia no principal");
  confere(Number((await um<L>(principal, `SELECT "retryCount" FROM "WhatsAppMessage" WHERE id='msg_v1a'`)).retryCount) >= 3, "mensagem que falhou chegou sem novas tentativas (não sai sozinha)");
  confere((await um<L>(principal, `SELECT "agnesScheduledAt" FROM "WhatsAppConversation" WHERE id='conv_vnova'`)).agnesScheduledAt === null, "conversa nova chegou sem resposta automática agendada");
  confere((await um<L>(principal, `SELECT "clienteId" FROM "Negociacao" WHERE id='neg_v_dupla'`)).clienteId === a, "negociação do cliente reimportado foi para o cadastro do principal");
  const envios = await principal.$queryRawUnsafe<L[]>(`SELECT id, status, "clienteIds" FROM "EnvioProgramado" ORDER BY id`);
  confere(envios.length === 2 && envios.every((e) => e.status === "cancelado"), "envios em massa pendente e 'enviando' chegaram CANCELADOS");
  confere(JSON.stringify(envios[0].clienteIds) === JSON.stringify([a, b, "cli_novo1"]), "a lista do envio aponta para os clientes do principal");
  confere((await um<L>(principal, `SELECT valor FROM "Configuracao" WHERE chave='whatsapp.pausa.v1'`)).valor === "pausado", "trava do WhatsApp continua PAUSADA (o 'liberado' do provisório não veio)");
  confere((await n(principal, `SELECT count(*)::int n FROM "Configuracao" WHERE chave='ia.somente_gratuitos'`)) === 0, "trava de IA paga não foi afrouxada");
  confere((await n(principal, `SELECT count(*)::int n FROM "Configuracao" WHERE chave='filtro.contatos.termos'`)) === 1, "configuração que o principal não tinha veio");
  const hist = JSON.parse(String((await um<L>(principal, `SELECT valor FROM "Configuracao" WHERE chave='frase_dia.historico'`)).valor));
  confere(hist.length === 3 && hist[2].f === "Frase da semana", "histórico da motivação do dia juntou os dois bancos, sem repetir");
  confere((await um<L>(principal, `SELECT "estagioVenda" FROM "OrientadorAnalise" WHERE "clienteId"=$1`, a)).estagioVenda === "novo", "leitura do Orientador mais recente ficou");
  confere((await n(principal, `SELECT count(*)::int n FROM "UnificacaoClientes"`)) === 0, "histórico de unificação do provisório não veio");
  confere((await n(principal, `SELECT count(*)::int n FROM "Usuario"`)) === antes.usuarios, "sobras do principal (Usuario, vendedorId) intactas");
  confere((await n(principal, `SELECT count(*)::int n FROM (SELECT "externalPhone" FROM "WhatsAppConversation" GROUP BY 1 HAVING count(*)>1) x`)) === 0, "nenhum número com duas conversas");

  console.log("\n4) RODAR DE NOVO — não pode trazer nada");
  const denovo = await rodarVolta({ origem: provisorio, destino: principal, aplicar: true });
  const gravou = denovo.etapas.reduce((s, e) => s + e.gravadas, 0);
  confere(denovo.concluido && gravou === 0, `segunda rodada gravou ${gravou} linha(s)`);
  confere((await n(principal, `SELECT count(*)::int n FROM "Cliente"`)) === antes.clientes + 2, "contagem de clientes igual depois da segunda rodada");

  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTUDO CERTO");
  await principal.$disconnect();
  await provisorio.$disconnect();
  process.exit(falhas.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});

// Para montar os bancos locais (porta 5433):
//   dropdb -p 5433 --if-exists principal_t && createdb -p 5433 -T crmtest principal_t
//   dropdb -p 5433 --if-exists provisorio_t && createdb -p 5433 provisorio_t
