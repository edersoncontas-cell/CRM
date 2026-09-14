import { PageHeader } from "@/components/ui";
import { listarOrientadorPorPeriodo, contarClientesConversados } from "@/lib/actions";
import { OrientadorLista } from "@/components/OrientadorLista";
import { periodoValido } from "@/lib/orientador-periodos";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { db } from "@/lib/db";
import { criarCategorizadorColunas } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function OrientadorPage({ searchParams }: { searchParams: { periodo?: string } }) {
  await garantirManutencaoSeNecessario();
  const periodo = periodoValido(searchParams.periodo);
  const [itens, contagem, colunasFunil] = await Promise.all([
    listarOrientadorPorPeriodo(periodo),
    contarClientesConversados(),
    db.colunaFunil.findMany({ orderBy: { ordem: "asc" }, select: { id: true, titulo: true } }),
  ]);

  // Colunas que aceitam negociação em aberto (em negociação / banco) — alvos
  // do arrastar. "Em negociação" é o destino padrão (botão ✓).
  const categorizar = criarCategorizadorColunas(colunasFunil);
  const abertas = colunasFunil.filter((c) => ["em_negociacao", "banco"].includes(categorizar(c.titulo)));
  // Mesma regra do botão ✓ (criarNegociacaoDoOrientador): a coluna cujo nome
  // tem "negocia"; se não existir, a primeira coluna aberta do funil.
  const padraoId = (abertas.find((c) => /negocia/i.test(c.titulo)) ?? abertas[0])?.id;
  const colunas = abertas.map((c) => ({ id: c.id, titulo: c.titulo, padrao: c.id === padraoId }));

  return (
    <div>
      <PageHeader
        titulo="Orientador de Vendas"
        subtitulo="Cada cliente com quem você conversou no período vira um card com a leitura da IA. Arraste o card para uma coluna do funil (ou toque em ✓ para “Em negociação”); ✗ tira o card (ele volta se chegar mensagem nova)."
      />
      <OrientadorLista itens={itens} contagem={contagem} periodo={periodo} colunas={colunas} />
    </div>
  );
}
