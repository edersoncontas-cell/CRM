import { AcademiaClient } from "@/components/AcademiaClient";
import { AcademiaTrilha } from "@/components/AcademiaTrilha";
import { AcademiaAbas } from "@/components/AcademiaAbas";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { dicaDoDia } from "@/lib/academia";
import { lerProgressoAcademia } from "@/lib/academia-actions";
import { AcademiaEtapas } from "@/components/AcademiaEtapas";
import { lerRegrasNegocio } from "@/lib/contexto-negocio";
import { iaHabilitada } from "@/lib/ai";
import { ETAPAS, tamanhoDoGuia } from "@/lib/academia/etapas";
import { CENARIOS } from "@/lib/academia/simulador";
import { TRILHA, TODAS_AULAS } from "@/lib/academia-trilha";

export const dynamic = "force-dynamic";

export default async function AcademiaPage() {
  const [estrategias, progresso, realidade] = await Promise.all([
    db.estrategiaVenda.findMany({ orderBy: [{ favorito: "desc" }, { criadoEm: "desc" }], take: 50 }),
    lerProgressoAcademia(),
    lerRegrasNegocio().catch(() => []),
  ]);
  const guia = tamanhoDoGuia();

  return (
    <div>
      <PageHeader
        titulo="Academia de Vendas"
        subtitulo={`Três camadas: as ${ETAPAS.length} Etapas da Venda com o passo a passo de campo (${guia.falas} falas prontas por canal, ${guia.perguntas} perguntas e ${CENARIOS.length} cenários de treino em que você escolhe o que falar), a Trilha de Formação com ${TRILHA.length} módulos e ${TODAS_AULAS.length} aulas, e a Biblioteca de referência. Tudo respeita a realidade do seu negócio.`}
      />
      <AcademiaAbas
        trilha={<AcademiaTrilha progressoInicial={progresso} />}
        etapas={<AcademiaEtapas realidade={realidade} temIA={iaHabilitada()} />}
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
