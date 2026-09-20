import { PageHeader } from "@/components/ui";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { db } from "@/lib/db";
import { MensagemClientes } from "@/components/MensagemClientes";

export const dynamic = "force-dynamic";

// MARKETING = mensagem para a carteira. Só isso.
//
//   "Como a geração de imagem é limitada, remove essa parte de post para as
//    redes e deixa só mensagens para clientes."
//
// A aba "Post para as redes" saiu junto com o componente que a desenhava. Ela
// dependia da geração de imagem do Gemini, que tem cota apertada no plano que
// o vendedor paga — uma tela que só funciona de vez em quando ensina a não
// confiar nela. A arte continua existindo onde tem uso garantido: como anexo
// da mensagem, feita sob demanda, uma por vez.
export default async function MarketingPage() {
  await garantirManutencaoSeNecessario();

  const municipios = await db.municipio.findMany({
    select: { id: true, nome: true, _count: { select: { clientes: { where: { origem: { not: "prospect_ia" } } } } } },
    orderBy: { nome: "asc" },
  }).catch(() => []);
  const cidadesComClientes = municipios
    .filter((m) => m._count.clientes > 0)
    .map((m) => ({ id: m.id, nome: m.nome, total: m._count.clientes }));

  return (
    <div>
      <PageHeader
        titulo="Marketing"
        subtitulo="Mensagem em massa para a carteira: visita na cidade, promoção, data comemorativa ou aniversário. Dá para mandar na hora ou programar dia e horário (fuso de Brasília)."
      />
      <MensagemClientes cidades={cidadesComClientes} />
    </div>
  );
}
