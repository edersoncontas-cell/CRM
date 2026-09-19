import { PageHeader } from "@/components/ui";
import { MarketingClient } from "@/components/MarketingClient";
import { listarPostsAction } from "@/lib/marketing-actions";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { iaHabilitada } from "@/lib/ai";
import { geracaoDeImagemHabilitada } from "@/lib/ai/imagem";
import { db } from "@/lib/db";
import { MarketingAbas } from "@/components/MarketingAbas";
import { MensagemClientes } from "@/components/MensagemClientes";

export const dynamic = "force-dynamic";

export default async function MarketingPage({ searchParams }: { searchParams: { aba?: string } }) {
  await garantirManutencaoSeNecessario();

  const [posts, maquinas, municipios] = await Promise.all([
    listarPostsAction(40).catch(() => []),
    db.maquina.findMany({
      where: { proprio: true },
      orderBy: [{ marca: "asc" }, { modelo: "asc" }],
      select: { marca: true, modelo: true },
    }).catch(() => []),
    db.municipio.findMany({
      select: { id: true, nome: true, _count: { select: { clientes: { where: { origem: { not: "prospect_ia" } } } } } },
      orderBy: { nome: "asc" },
    }).catch(() => []),
  ]);
  const cidadesComClientes = municipios.filter((m) => m._count.clientes > 0).map((m) => ({ id: m.id, nome: m.nome, total: m._count.clientes }));

  return (
    <div>
      <PageHeader
        titulo="Marketing"
        subtitulo="Dois caminhos no mesmo lugar: o Cérebro escreve o post e cria a arte com o Gemini para as redes, e a mensagem em massa avisa a carteira sobre visita, promoção, data comemorativa ou aniversário."
      />
      <MarketingAbas
        inicial={searchParams.aba === "mensagem" ? "mensagem" : "posts"}
        posts={<MarketingClient posts={posts} maquinas={maquinas} temIA={iaHabilitada()} temImagem={geracaoDeImagemHabilitada()} />}
        mensagem={<MensagemClientes cidades={cidadesComClientes} />}
      />
    </div>
  );
}
