import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { MaquinasUsadasClient, type Usada } from "@/components/MaquinasUsadasClient";

export const dynamic = "force-dynamic";

export default async function UsadasPage() {
  const maquinas = (await db.maquinaUsada.findMany({
    orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
  })) as Usada[];

  return (
    <div>
      <PageHeader
        titulo="Máquinas Usadas"
        subtitulo="Seu estoque de seminovos para venda — cadastre, controle o status e gere o anúncio pro WhatsApp"
      />
      <MaquinasUsadasClient maquinas={maquinas} />
    </div>
  );
}
