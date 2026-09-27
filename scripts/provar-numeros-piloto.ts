// PROVA DOS NÚMEROS DO PILOTO num Postgres de verdade (dados simulados).
//
// Monta do zero um banco com conversas escolhidas a dedo — resposta rápida,
// resposta que só veio depois de um envio em massa, cliente de fora do
// horário, "obrigado" que não pede resposta, conversa marcada como respondida,
// conversa apagada, grupo, negociação aberta pela IA, pelo Cérebro e apagada —
// e confere cada número da tela contra a conta feita à mão.
//
//   PILOTO_URL=postgresql://.../piloto_t npx tsx scripts/provar-numeros-piloto.ts
//
// O banco em PILOTO_URL é APAGADO e recriado. Com SO_MONTAR=1, só monta (para
// abrir a tela em cima dele) e não confere.

import { PrismaClient } from "@prisma/client";
import { DDL_DO_ZERO } from "@/lib/banco-do-zero-ddl";
import { readFileSync } from "node:fs";
import { CHAVE_HISTORICO_ESFRIANDO, ROTULO_ENVIO_MASSA } from "@/lib/piloto-regra";

const URL = process.env.PILOTO_URL;
if (!URL) throw new Error("Defina PILOTO_URL (o banco é apagado e recriado).");
process.env.DATABASE_URL = URL;
process.env.DATABASE_URL_UNPOOLED = URL;
const db = new PrismaClient({ datasources: { db: { url: URL } } });
// Lida do arquivo, não importada: lib/manutencao puxa módulos que só rodam
// dentro do Next. Marcar a manutenção como feita deixa a tela abrir direto.
const CHAVE_MANUTENCAO = /CHAVE_MANUTENCAO = "([^"]+)"/.exec(readFileSync("src/lib/manutencao.ts", "utf8"))![1];

type L = Record<string, unknown>;
const falhas: string[] = [];
function confere(ok: boolean, o_que: string, visto?: unknown) {
  console.log(`${ok ? "  ok " : "  FALHOU"} ${o_que}${ok ? "" : ` — veio ${JSON.stringify(visto)}`}`);
  if (!ok) falhas.push(o_que);
}
async function inserir(tabela: string, linhas: L[]) {
  for (const l of linhas) {
    const limpa = Object.fromEntries(Object.entries(l).filter(([, v]) => v !== undefined));
    const cols = Object.keys(limpa).map((c) => `"${c}"`).join(", ");
    await db.$executeRawUnsafe(`INSERT INTO "${tabela}" (${cols}) SELECT ${cols} FROM json_populate_record(NULL::"${tabela}", $1::json)`, JSON.stringify(limpa));
  }
}

// As datas andam com o relógio: a segunda-feira da semana passada é a base,
// então a prova vale em qualquer dia em que for rodada.
const agora = new Date();
const DIA = 86_400_000;
const diaSemana = new Date(agora.getTime() - 3 * 3600_000).getUTCDay(); // em Brasília
const segunda = new Date(agora.getTime() - 3 * 3600_000 - ((diaSemana + 6) % 7 + 7) * DIA);
segunda.setUTCHours(0, 0, 0, 0);
/** Dia `d` depois da segunda-base, às hh:mm de Brasília. */
const em = (d: number, hh: number, mm = 0) => new Date(segunda.getTime() + d * DIA + (hh + 3) * 3600_000 + mm * 60_000);
const diasAtras = (d: number) => new Date(agora.getTime() - d * DIA);
const diaBR = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

async function montar() {
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.$executeRawUnsafe(`CREATE SCHEMA public`);
  for (const sql of DDL_DO_ZERO) await db.$executeRawUnsafe(sql);

  await inserir("Configuracao", [
    { chave: CHAVE_MANUTENCAO, valor: "ok" },
    { chave: "whatsapp.pausa.v1", valor: "pausado" },
    // O "antes" do critério 2: 6 esfriando há 50 dias.
    { chave: CHAVE_HISTORICO_ESFRIANDO, valor: JSON.stringify({ [diaBR(diasAtras(50))]: 6 }) },
  ]);
  await inserir("ColunaFunil", [
    { id: "col1", titulo: "OPORTUNIDADE", papel: "em_negociacao", ordem: 0, probabilidade: 10 },
    { id: "col2", titulo: "PROPOSTA", papel: "banco", ordem: 1, probabilidade: 40 },
    { id: "col3", titulo: "FATURADO", papel: "faturado", ordem: 2, probabilidade: 100 },
    { id: "col4", titulo: "VENDA PERDIDA", papel: "perdida", ordem: 3, probabilidade: 0 },
  ]);

  const cli = (id: string, nome: string, tel: string) => ({ id, nome, telefone: tel, atualizadoEm: diasAtras(100), criadoEm: diasAtras(100) });
  await inserir("Cliente", [
    cli("c_ana", "Ana Terraplenagem", "28999990001"),
    cli("c_bruno", "Bruno Construtora", "28999990002"),
    cli("c_carla", "Carla Pedreira", "28999990003"),
    cli("c_diego", "Diego Locações", "28999990004"),
    cli("c_hugo", "Hugo Fazenda", "28999990008"),
    cli("c_joao", "João Apagado", "28999990010"),
    cli("c_fabio", "Fabio Primo", "28999990006"),
    cli("c_perda", "Paulo Perdas", "28999990011"),
  ]);

  const conv = (id: string, tel: string, category: string | null, o: L = {}) => ({
    id, externalPhone: `55${tel}`, category, contactName: null, isGroup: false, lastMessageAt: agora, createdAt: diasAtras(100), updatedAt: agora, ...o,
  });
  await inserir("WhatsAppConversation", [
    conv("v_ana", "28999990001", "LEAD", { clienteId: "c_ana", contactName: "Ana (Terraplenagem)" }),
    conv("v_bruno", "28999990002", "CLIENTE", { clienteId: "c_bruno", contactName: "Bruno" }),
    conv("v_carla", "28999990003", "LEAD", { clienteId: "c_carla", contactName: "Carla" }),
    conv("v_diego", "28999990004", "LEAD", { clienteId: "c_diego", contactName: "Diego" }),
    conv("v_eva", "28999990005", "CLIENTE", { contactName: "Eva sem cadastro" }),
    conv("v_fabio", "28999990006", "OUTRO", { clienteId: "c_fabio", contactName: "Fabio (primo)", categoryConfirmed: true }),
    conv("v_gil", "28999990007", null, { contactName: "Gil" }),
    conv("v_hugo", "28999990008", "LEAD", { clienteId: "c_hugo", contactName: "Hugo", ignored: true }),
    conv("v_grupo", "120363000000000001", "LEAD", { isGroup: true, groupName: "Grupo obra" }),
    conv("v_joao", "28999990010", "LEAD", { clienteId: "c_joao", contactName: "João" }),
  ]);
  await inserir("ConversaExcluida", [{ telefone: "5528999990010", excluidaEm: diasAtras(40), motivo: "manual" }]);

  let k = 0;
  const msg = (conversa: string, direction: "IN" | "OUT", sentAt: Date, body: string, o: L = {}) => ({
    id: `m${++k}`, conversationId: conversa, direction, body, sentAt, isDraft: false,
    ...(direction === "OUT" ? { operatorDisplayName: "Você", origin: "CRM", sendStatus: "SENT" } : {}), ...o,
  });
  await inserir("WhatsAppMessage", [
    // Ana: chama segunda 10h, resposta em 20 min. Primeiro contato.
    msg("v_ana", "IN", em(0, 10), "Bom dia, tem retro 4x4?"),
    msg("v_ana", "OUT", em(0, 10, 20), "Tenho sim, te mando a condição"),
    // Bruno: terça 9h; às 9h30 cai um envio em massa (não é resposta); ele responde às 11h.
    msg("v_bruno", "IN", em(1, 9), "Qual o prazo da escavadeira?"),
    msg("v_bruno", "OUT", em(1, 9, 30), "Promoção da semana", { operatorDisplayName: ROTULO_ENVIO_MASSA }),
    msg("v_bruno", "OUT", em(1, 11), "Prazo de 30 dias"),
    // Carla: quarta 20h (fora do horário), resposta quinta 8h30 = 12h30.
    msg("v_carla", "IN", em(2, 20), "Me passa o valor da pá carregadeira"),
    msg("v_carla", "OUT", em(3, 8, 30), "Bom dia Carla, segue"),
    // Diego: quinta 14h, resposta em 10 min; depois só "obrigado" (não pede resposta).
    msg("v_diego", "IN", em(3, 14), "Quero ver a escavadeira"),
    msg("v_diego", "OUT", em(3, 14, 10), "Passo aí amanhã"),
    msg("v_diego", "IN", em(3, 14, 15), "Obrigado!"),
    // Eva: quinta 10h, ninguém respondeu.
    msg("v_eva", "IN", em(3, 10), "Vocês têm rolo compactador?"),
    // Fabio (outro assunto) e Gil (sem classificação): fora da conta.
    msg("v_fabio", "IN", em(2, 10), "Vai no churrasco?"),
    msg("v_gil", "IN", em(2, 11), "Oi"),
    // Hugo: sem resposta, mas marcado como respondido (resolveu por telefone).
    msg("v_hugo", "IN", em(2, 15), "Me liga"),
    // Grupo: nunca conta.
    msg("v_grupo", "IN", em(2, 9), "Bom dia pessoal"),
    // João: conversa apagada à mão, sem negociação aberta — fora de tudo.
    msg("v_joao", "IN", em(2, 9), "Tem peça?"),
  ]);

  const neg = (id: string, clienteId: string, o: L) => ({
    id, clienteId, estagio: "OPORTUNIDADE", status: "aberta", termometro: 50, criadoEm: diasAtras(20), atualizadoEm: diasAtras(2), ultimoContato: diasAtras(2), ...o,
  });
  await inserir("Negociacao", [
    neg("n_ana", "c_ana", { valor: 450000, maquinaModelo: "B95C" }),                                   // pela IA, aberta
    neg("n_bruno", "c_bruno", { criadoEm: diasAtras(90), ultimoContato: diasAtras(15) }),               // manual, esfriando
    neg("n_diego", "c_diego", { valor: 900000, status: "ganha", estagio: "FATURADO", maquinaModelo: "E215C" }), // pela IA, ganha
    neg("n_cerebro", "c_fabio", { valor: 100000 }),                                                    // pelo Cérebro: não conta
    neg("n_orfa", "c_carla", { estagio: "COLUNA QUE NÃO EXISTE MAIS", ultimoContato: diasAtras(20), criadoEm: diasAtras(200), atualizadoEm: diasAtras(200) }),
    neg("n_perda1", "c_perda", { status: "perdida", estagio: "VENDA PERDIDA", motivoPerda: "preco: achou caro" }),
    neg("n_perda2", "c_perda", { status: "perdida", estagio: "VENDA PERDIDA", motivoPerda: null }),
    neg("n_velha", "c_hugo", { status: "ganha", negociacaoAntiga: true }),
  ]);
  const audit = (id: string, entidadeId: string, origem: string, quando: Date) => ({
    id, acao: "negociacao_criada", origem, descricao: "teste", entidade: "Negociacao", entidadeId, criadoEm: quando,
  });
  await inserir("AuditLog", [
    audit("a1", "n_ana", "zeus", em(0, 10, 1)),
    audit("a2", "n_diego", "zeus", em(3, 14, 1)),
    audit("a3", "n_apagada", "zeus", em(2, 12)),        // apagada depois
    audit("a4", "n_cerebro", "cerebro", em(2, 12)),     // pedido ao Cérebro
    audit("a5", "n_velha_ia", "zeus", diasAtras(80)),   // fora dos 60 dias
  ]);
}

async function conferir() {
  const { calcularNumerosPiloto } = await import("@/lib/piloto");
  const n = await calcularNumerosPiloto(60, agora);
  const r = n.respostas;
  console.log("\nTempo até a primeira resposta");
  confere(r.noHorario.total === 4, "4 esperas no horário (Ana, Bruno, Diego, Eva)", r.noHorario.total);
  confere(r.noHorario.respondidas === 3, "3 respondidas no horário", r.noHorario.respondidas);
  confere(r.noHorario.medianaMin === 20, "mediana no horário = 20 min (10, 20, 120)", r.noHorario.medianaMin);
  confere(r.noHorario.ateUmaHora === 2 && r.noHorario.baseUmaHora === 4, "2 de 4 em até 1 hora", [r.noHorario.ateUmaHora, r.noHorario.baseUmaHora]);
  confere(r.foraDoHorario.medianaMin === 750, "fora do horário: Carla em 12h30 (750 min)", r.foraDoHorario.medianaMin);
  confere(r.primeiroContato.respondidas === 4 && r.primeiroContato.medianaMin === 70, "primeiro contato: 4, mediana 70 min", [r.primeiroContato.respondidas, r.primeiroContato.medianaMin]);
  confere(r.semResposta === 1, "1 sem resposta (Eva)", r.semResposta);
  confere(r.dispensadas === 1, "1 dispensada (Hugo, marcado como respondido)", r.dispensadas);
  confere(n.esperando.map((e) => e.nome).join() === "Eva sem cadastro", "lista de espera = só a Eva", n.esperando.map((e) => e.nome));

  console.log("\nConversas de venda × negociação");
  confere(n.conversas.venda === 6, "6 conversas de venda (Ana, Bruno, Carla, Diego, Eva, Hugo) — sem grupo e sem a apagada", n.conversas.venda);
  confere(n.conversas.comNegociacao === 3, "3 com negociação (Ana, Bruno, Diego)", n.conversas.comNegociacao);
  confere(n.conversas.semCadastro === 1, "1 sem cadastro (Eva)", n.conversas.semCadastro);
  const sem = n.conversas.semNegociacao.map((c) => c.nome).sort().join();
  confere(sem === "Carla,Eva sem cadastro,Hugo", "sem negociação: Carla (só a órfã), Eva, Hugo (só a antiga)", sem);
  const fora = n.conversas.foraDaConta;
  confere(fora.total === 2 && fora.outro === 1 && fora.semClassificacao === 1, "fora da conta: Fabio (outro) e Gil (sem classificação)", fora);
  confere(fora.marcadasAMao === 1, "1 tirada da conta à mão (Fabio, \"Não é venda\")", fora.marcadasAMao);

  console.log("\nNegociações abertas pela IA");
  confere(n.ia.total === 3, "3 no período (Ana, Diego, 1 apagada) — sem a do Cérebro e sem a de 80 dias", n.ia.total);
  confere(n.ia.somaValor === 1_350_000, "somando R$ 1.350.000", n.ia.somaValor);
  confere(n.ia.abertas === 1 && n.ia.ganhas === 1 && n.ia.perdidas === 0 && n.ia.apagadas === 1, "1 aberta, 1 ganha, 1 apagada", n.ia);

  console.log("\nCritérios");
  confere(n.criterios.perdidas === 2 && n.criterios.perdidasSemMotivo === 1, "2 perdidas, 1 sem motivo", n.criterios);
  confere(n.criterios.esfriandoHoje === 1, "1 esfriando hoje (Bruno; a órfã não conta)", n.criterios.esfriandoHoje);
  confere(n.criterios.esfriandoInicio?.n === 6, "começo do período: 6 (anotação de 50 dias atrás)", n.criterios.esfriandoInicio);
  const hist = await db.configuracao.findUnique({ where: { chave: CHAVE_HISTORICO_ESFRIANDO } });
  const anotado = JSON.parse(hist?.valor ?? "{}") as Record<string, number>;
  confere(anotado[diaBR(agora)] === 1, "anotou hoje = 1 no histórico", anotado);
}

async function main() {
  await montar();
  console.log(`Banco montado (segunda-base ${segunda.toISOString().slice(0, 10)}).`);
  if (process.env.SO_MONTAR === "1") return;
  await conferir();
  console.log(falhas.length ? `\n${falhas.length} conferência(s) FALHARAM.` : "\nTudo conferido.");
  if (falhas.length) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
