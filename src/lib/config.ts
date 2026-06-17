import { db } from "@/lib/db";

// Chaves de configuração global do CRM (armazenadas na tabela Configuracao).
export const CHAVES = {
  modoFimDeSemana: "modo_fim_de_semana", // "on" | "off" — IA responde por mim automaticamente
} as const;

export async function getConfig(chave: string): Promise<string | null> {
  const c = await db.configuracao.findUnique({ where: { chave } });
  return c?.valor ?? null;
}

export async function setConfig(chave: string, valor: string): Promise<void> {
  await db.configuracao.upsert({
    where: { chave },
    update: { valor },
    create: { chave, valor },
  });
}

export async function modoFimDeSemanaAtivo(): Promise<boolean> {
  return (await getConfig(CHAVES.modoFimDeSemana)) === "on";
}
