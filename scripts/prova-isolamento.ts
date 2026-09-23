// A PROVA do isolamento, contra o banco de verdade.
// Não é teste de mesa: cria dois vendedores, um cliente para cada, e tenta
// vazar de todo jeito que já vazou antes.
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const req = createRequire(import.meta.url);
const react = req("react");
if (typeof react.cache !== "function") react.cache = (f: unknown) => f;

const { db } = req("../src/lib/db.ts") as { db: any };
const { comUsuario, semFiltro } = req("../src/lib/tenant.ts") as {
  comUsuario: <T>(u: unknown, fn: () => T | Promise<T>) => Promise<T>;
  semFiltro: <T>(fn: () => T | Promise<T>) => Promise<T>;
};

const cru = new PrismaClient();
const edy = { id: "prova-edy", nome: "Edy", papel: "vendedor" as const };
const joao = { id: "prova-joao", nome: "João", papel: "vendedor" as const };
const chefe = { id: "prova-chefe", nome: "Gerente", papel: "gerente" as const };

async function main() {
  await cru.$executeRawUnsafe(`DELETE FROM "Cliente" WHERE "id" LIKE 'prova-%'`);
  const idEdy = "prova-cli-edy", idJoao = "prova-cli-joao";
  await cru.$executeRawUnsafe(
    `INSERT INTO "Cliente" ("id","nome","vendedorId","criadoEm","atualizadoEm") VALUES
      ($1,'Cliente do Edy',$3,NOW(),NOW()), ($2,'Cliente do João',$4,NOW(),NOW())`,
    idEdy, idJoao, edy.id, joao.id);

  const so = (l: { nome: string }[]) => l.map((c) => c.nome);
  const filtro = { where: { id: { in: [idEdy, idJoao] } } };

  console.log("Edy vê:      ", so(await comUsuario(edy, () => db.cliente.findMany(filtro))));
  console.log("João vê:     ", so(await comUsuario(joao, () => db.cliente.findMany(filtro))));
  console.log("Gerente vê:  ", so(await comUsuario(chefe, () => db.cliente.findMany(filtro))));

  const totalEdy = await comUsuario(edy, () => db.cliente.count());
  const totalSistema = await semFiltro(() => db.cliente.count());
  console.log(`count: Edy=${totalEdy}  sistema=${totalSistema}  (Edy tem que ser 1)`);

  const mexeu = await comUsuario(joao, () => db.cliente.updateMany({ data: { nome: "MEXIDO" } }));
  const doEdy = await cru.$queryRawUnsafe<{ nome: string }[]>(`SELECT "nome" FROM "Cliente" WHERE "id" = $1`, idEdy);
  console.log(`updateMany do João mexeu em: ${mexeu.count} (tem que ser 1)`);
  console.log(`o cliente do Edy foi mexido? ${doEdy[0]?.nome === "Cliente do Edy" ? "não" : "SIM — VAZOU"}`);

  const espiada = await comUsuario(joao, () => db.cliente.findUnique({ where: { id: idEdy } }));
  console.log(`João espiando o cliente do Edy por id: ${espiada ? "VAZOU -> " + espiada.nome : "null (certo)"}`);

  const apagou = await comUsuario(joao, () => db.cliente.deleteMany({ where: { id: idEdy } }));
  console.log(`João tentando APAGAR o cliente do Edy: ${apagou.count} linha(s) (tem que ser 0)`);

  const semNinguem = await db.cliente.count();
  console.log(`fora de requisição (cron/migração) o count é o da base inteira: ${semNinguem}`);

  await cru.$executeRawUnsafe(`DELETE FROM "Cliente" WHERE "id" LIKE 'prova-%'`);
}

main().then(() => cru.$disconnect()).catch(async (e) => { console.error("FALHOU:", e); await cru.$disconnect(); process.exit(1); });
