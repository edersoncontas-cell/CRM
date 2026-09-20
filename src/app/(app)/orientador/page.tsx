import { PageHeader } from "@/components/ui";
import { listarOrientadorPorPeriodo } from "@/lib/actions";
import { OrientadorLista } from "@/components/OrientadorLista";
import { periodoValido, PERIODOS_ORIENTADOR } from "@/lib/orientador-periodos";
import { garantirManutencaoSeNecessario } from "@/lib/manutencao";

export const dynamic = "force-dynamic";

export default async function OrientadorPage({ searchParams }: { searchParams: { periodo?: string } }) {
  await garantirManutencaoSeNecessario();
  const periodo = periodoValido(searchParams.periodo);
  const itens = await listarOrientadorPorPeriodo(periodo);

  return (
    <div>
      {/* Esta tela é a TRIAGEM da manhã, não a tela de coaching.

          O coaching mora no Atendimento, ao lado da conversa — e é ali que ele
          funciona, porque conselho sobre um cliente só vale com a conversa
          dele na frente. Aqui a pergunta é outra e mais simples: por quem eu
          começo hoje? Por isso cada card abre direto a conversa. */}
      <PageHeader
        titulo="Orientador de Vendas"
        subtitulo={`Por quem começar hoje: os clientes com conversa nos últimos ${PERIODOS_ORIENTADOR[periodo].dias} dias, na ordem de atacar. Toque num card para abrir a conversa — a leitura completa do Orientador fica lá, ao lado das mensagens.`}
      />
      <OrientadorLista itens={itens} periodo={periodo} />
    </div>
  );
}
