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

import { db, ehFalhaDeConexao, tentarReserva, tentarVoltarAoPrincipal, enderecoAtivo } from "@/lib/db";

export type SaudeBanco =
  | { ok: true; endereco: "principal" | "reserva" }
  | { ok: false; titulo: string; motivo: string; somenteLeitura: boolean; tentouReserva: boolean };

function recado(e: unknown): string {
  const numaLinha = (t: string) => t.replace(/\s+/g, " ").trim();
  if (e instanceof Error) return numaLinha(`${e.name}: ${e.message}`).slice(0, 400);
  return numaLinha(String(e)).slice(0, 400);
}

async function sondar(): Promise<{ ro: string; tamanho: string } | undefined> {
  const r = await db.$queryRawUnsafe<{ ro: string; tamanho: string }[]>(
    `SELECT current_setting('transaction_read_only') AS ro,
            pg_size_pretty(pg_database_size(current_database())) AS tamanho`,
  );
  return r?.[0];
}

export async function conferirBanco(): Promise<SaudeBanco> {
  // Na reserva há um tempo? Tenta voltar ao principal (no máximo 1x/min).
  await tentarVoltarAoPrincipal().catch(() => {});
  let tentouReserva = false;
  try {
    // Uma consulta, três respostas:
    //  · responde?            → se estourar, o banco está fora
    //  · transaction_read_only → o Neon põe o banco em SÓ LEITURA quando a
    //    cota do plano grátis estoura. Nesse estado o CRM inteiro cai, com
    //    qualquer versão do código — foi a suspeita que eu não conseguia
    //    confirmar sem esta sonda.
    //  · tamanho              → para dizer o quanto falta do limite
    let linha = await sondar().catch(async (e) => {
      // O principal não conectou? O desvio de lib/db.ts já tentou a reserva
      // por dentro. Se ainda assim caiu, tenta uma vez explicitamente — é a
      // última chance antes de mostrar a tela de banco fora.
      if (!ehFalhaDeConexao(e)) throw e;
      tentouReserva = true;
      if (!(await tentarReserva())) throw e;
      return sondar();
    });
    linha ??= undefined;
    if (linha?.ro === "on") {
      return {
        ok: false,
        somenteLeitura: true,
        tentouReserva,
        titulo: "O banco está em modo SÓ LEITURA",
        motivo:
          `O banco responde, mas recusa gravar. É assim que o Neon reage quando a cota do plano ` +
          `grátis estoura. Tamanho atual: ${linha.tamanho ?? "?"} (o limite do plano grátis é 0,5 GB).`,
      };
    }
    return { ok: true, endereco: enderecoAtivo() };
  } catch (e) {
    return {
      ok: false,
      somenteLeitura: false,
      tentouReserva: tentouReserva || ehFalhaDeConexao(e),
      titulo: "O banco de dados não respondeu",
      motivo: recado(e),
    };
  }
}
