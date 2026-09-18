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
        subtitulo="Formação de consultor de máquinas pesadas em 10 níveis e 60 aulas, no padrão de escola de negócios: frameworks nomeados (SPIN, MEDDICC, BATNA, Challenger, LAER-C, DISC), contas feitas passo a passo com números do sul do ES, diálogos anotados, casos com resultado e lição, missão prática em cada aula, quiz de cenários com alternativas embaralhadas, prova por módulo, revisão espaçada, treino com IA em duas rodadas com rubrica e certificação final."
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
