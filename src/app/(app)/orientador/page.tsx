import { PageHeader } from "@/components/ui";
import { listarOrientadorAnalises } from "@/lib/actions";
import { OrientadorLista } from "@/components/OrientadorLista";

export const dynamic = "force-dynamic";

export default async function OrientadorPage() {
  const analises = await listarOrientadorAnalises();

  return (
    <div>
      <PageHeader
        titulo="Orientador de Vendas"
        subtitulo="Seu gerente comercial de IA — estágio, temperatura, objeções e próxima ação de cada negociação, gerados a partir de toda a conversa de WhatsApp."
      />
      <OrientadorLista analises={analises} />
    </div>
  );
}
