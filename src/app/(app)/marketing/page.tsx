import { PageHeader } from "@/components/ui";
import { MarketingClient } from "@/components/MarketingClient";
import { listarPostsAction } from "@/lib/marketing-actions";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";
import { iaHabilitada } from "@/lib/ai";
import { geracaoDeImagemHabilitada } from "@/lib/ai/imagem";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  await garantirManutencaoSeNecessario();

  const [posts, maquinas] = await Promise.all([
    listarPostsAction(40).catch(() => []),
    db.maquina.findMany({
      where: { proprio: true },
      orderBy: [{ marca: "asc" }, { modelo: "asc" }],
      select: { marca: true, modelo: true },
    }).catch(() => []),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Marketing"
        subtitulo="O Cérebro escreve o post e cria a arte com o Gemini: do conteúdo do dia à campanha de promoção, pronto para publicar ou mandar para os clientes."
      />
      <MarketingClient posts={posts} maquinas={maquinas} temIA={iaHabilitada()} temImagem={geracaoDeImagemHabilitada()} />
    </div>
  );
}
