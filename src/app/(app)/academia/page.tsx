import { AcademiaClient } from "@/components/AcademiaClient";
import { AcademiaTrilha } from "@/components/AcademiaTrilha";
import { AcademiaAbas } from "@/components/AcademiaAbas";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { dicaDoDia } from "@/lib/academia";
import { lerProgressoAcademia } from "@/lib/academia-actions";

export const dynamic = "force-dynamic";

export default async function AcademiaPage() {
  const [estrategias, progresso] = await Promise.all([
    db.estrategiaVenda.findMany({ orderBy: [{ favorito: "desc" }, { criadoEm: "desc" }], take: 50 }),
    lerProgressoAcademia(),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Academia de Vendas"
        subtitulo="Trilha de formação em 10 níveis e 60 aulas, escrita para quem vende máquinas pesadas no sul do ES: fundamentos, psicologia, neurociência, prospecção, diagnóstico, valor, objeções, fechamentos agressivos, negociação e pós-venda — com casos reais, scripts, tabelas, checklists, quiz, missão prática, prova final e treino com IA em cada módulo."
      />
      <AcademiaAbas
        trilha={<AcademiaTrilha progressoInicial={progresso} />}
        biblioteca={
          <AcademiaClient
            estrategias={estrategias.map((e) => ({
              id: e.id,
              titulo: e.titulo,
              categoria: e.categoria,
              perfilAlvo: e.perfilAlvo,
              conteudo: e.conteudo,
              fonte: e.fonte,
              favorito: e.favorito,
              criadoEm: e.criadoEm.toISOString(),
            }))}
            dicaDoDia={dicaDoDia()}
          />
        }
      />
    </div>
  );
}
