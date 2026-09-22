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
import { PlanoDeEstudo } from "@/components/PlanoDeEstudo";
import { contarFatosVendedor } from "@/lib/orientador-vendedor-dados";
import { analisarVendedor, planoDeEstudo } from "@/lib/orientador-vendedor";
import Link from "next/link";
import { UserRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AcademiaPage() {
  const [estrategias, progresso, realidade, fatos] = await Promise.all([
    db.estrategiaVenda.findMany({ orderBy: [{ favorito: "desc" }, { criadoEm: "desc" }], take: 50 }),
    lerProgressoAcademia(),
    lerRegrasNegocio().catch(() => []),
    contarFatosVendedor().catch(() => null),
  ]);
  const guia = tamanhoDoGuia();
  // O plano sai do diagnóstico do vendedor (Como você vende). Se a conta
  // falhar, a Academia continua de pé sem a aba personalizada — ela é um
  // atalho, não um pré-requisito.
  const diagnostico = fatos ? analisarVendedor(fatos) : null;
  const plano = diagnostico ? planoDeEstudo(diagnostico) : { modulos: [], etapas: [] };

  return (
    <div>
      <PageHeader
        titulo="Academia de Vendas"
        subtitulo={`Três camadas: as ${ETAPAS.length} Etapas da Venda com o passo a passo de campo (${guia.falas} falas prontas por canal, ${guia.perguntas} perguntas e ${CENARIOS.length} cenários de treino em que você escolhe o que falar), a Trilha de Formação com ${TRILHA.length} módulos e ${TODAS_AULAS.length} aulas, e a Biblioteca de referência. Tudo respeita a realidade do seu negócio.`}
      />
      <AcademiaAbas
        plano={
          <>
            {diagnostico && !diagnostico.poucosDados && (
              <Link
                href="/como-voce-vende"
                className="mb-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
              >
                <span className="shrink-0 rounded-xl bg-slate-900 p-2.5 text-agro-400"><UserRound size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">Seu perfil hoje</span>
                  <span className="mt-0.5 block text-base font-bold text-slate-900">{diagnostico.perfil.titulo}</span>
                  <span className="mt-1 block text-xs text-slate-600">
                    {diagnostico.gargalo
                      ? `Seu gargalo está em ${diagnostico.gargalo.de} → ${diagnostico.gargalo.para}. Toque para ver a leitura completa.`
                      : "Toque para ver a leitura completa dos seus números."}
                  </span>
                </span>
              </Link>
            )}
            <PlanoDeEstudo modulos={plano.modulos} etapas={plano.etapas} compacto />
          </>
        }
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
