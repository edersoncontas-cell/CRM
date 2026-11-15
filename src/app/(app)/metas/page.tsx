import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { metasRecursoLigado, listarMetasComProgresso, type MetaComProgresso } from "@/lib/metas-cadastro";
import { MetasClient } from "@/components/metas/MetasClient";

export const dynamic = "force-dynamic";

// Metas e supermetas: progresso de cada meta (máquinas, faturamento, visitas,
// negociações) com falta, dias restantes e ritmo. Nasce desligado.
export default async function MetasPage() {
  if (!(await metasRecursoLigado())) {
    return (
      <>
        <PageHeader titulo="Metas e supermetas" />
        <Card>
          <p className="text-sm">As metas estão desligadas. Para usar, ligue em{" "}
            <Link href="/configuracoes#metas" className="font-semibold underline">Configurações → Metas e supermetas</Link>.
          </p>
        </Card>
      </>
    );
  }

  let metas: MetaComProgresso[] | null = null;
  let erro: string | null = null;
  try {
    metas = await listarMetasComProgresso();
  } catch (e) {
    console.error("[metas] lista", e);
    erro = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <PageHeader titulo="Metas e supermetas" subtitulo="Quanto falta para cada meta, em quantos dias e a que ritmo." />
      {metas ? (
        <MetasClient metas={metas} agoraIso={new Date().toISOString()} />
      ) : (
        <Card>
          <p role="alert" className="text-sm text-red-700">
            Não foi possível carregar as metas agora. O banco não respondeu ou a tabela ainda não foi criada
            (a manutenção cria na primeira abertura depois da atualização).
          </p>
          {erro && <p className="mt-1 text-xs text-slate-500">Motivo: {erro.slice(0, 200)}</p>}
        </Card>
      )}
    </>
  );
}
