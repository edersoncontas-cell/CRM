import { PrismaClient } from "@prisma/client";
import { semear } from "../src/lib/seed-core";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Semeando banco (construção)...");
  const r = await semear(db);
  console.log("✅ Seed concluído:", r);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
