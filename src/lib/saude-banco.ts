// O BANCO ESTÁ DE PÉ? — e, se não estiver, POR QUÊ.
//
// Por que isto existe: com o CRM fora do ar, a tela só dizia "Algo deu errado
// nesta página". O Next esconde a mensagem real em produção de propósito (para
// não vazar detalhe), e o resultado foi um dia inteiro de adivinhação — minha,
// e com o vendedor parado na rua. Tela que falha em silêncio é o pior desfecho
// possível (regra 2); tela que DIZ o motivo resolve em trinta segundos.
//
// A sonda é barata: uma consulta só, que já traz as três respostas que
// importam. Ela roda no layout, antes das telas, e nunca estoura — se ela
// mesma falhasse, voltaríamos ao silêncio.

import { db } from "@/lib/db";

export type SaudeBanco =
  | { ok: true }
  | { ok: false; titulo: string; motivo: string; somenteLeitura: boolean };

function recado(e: unknown): string {
  const numaLinha = (t: string) => t.replace(/\s+/g, " ").trim();
  if (e instanceof Error) return numaLinha(`${e.name}: ${e.message}`).slice(0, 400);
  return numaLinha(String(e)).slice(0, 400);
}

export async function conferirBanco(): Promise<SaudeBanco> {
  try {
    // Uma consulta, três respostas:
    //  · responde?            → se estourar, o banco está fora
    //  · transaction_read_only → o Neon põe o banco em SÓ LEITURA quando a
    //    cota do plano grátis estoura. Nesse estado o CRM inteiro cai, com
    //    qualquer versão do código — foi a suspeita que eu não conseguia
    //    confirmar sem esta sonda.
    //  · tamanho              → para dizer o quanto falta do limite
    const r = await db.$queryRawUnsafe<{ ro: string; tamanho: string }[]>(
      `SELECT current_setting('transaction_read_only') AS ro,
              pg_size_pretty(pg_database_size(current_database())) AS tamanho`,
    );
    const linha = r?.[0];
    if (linha?.ro === "on") {
      return {
        ok: false,
        somenteLeitura: true,
        titulo: "O banco está em modo SÓ LEITURA",
        motivo:
          `O banco responde, mas recusa gravar. É assim que o Neon reage quando a cota do plano ` +
          `grátis estoura. Tamanho atual: ${linha.tamanho ?? "?"} (o limite do plano grátis é 0,5 GB).`,
      };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      somenteLeitura: false,
      titulo: "O banco de dados não respondeu",
      motivo: recado(e),
    };
  }
}
