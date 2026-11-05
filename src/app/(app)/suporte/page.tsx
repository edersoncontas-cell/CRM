import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { suporteLigado, listarTickets } from "@/lib/suporte";
import { SuporteClient, type TicketTela } from "@/components/suporte/SuporteClient";

export const dynamic = "force-dynamic";

// Pedidos de suporte e sugestões: lista, conversa com prints, status,
// resposta e o "prompt pronto" para colar no Claude Code.
export default async function SuportePage() {
  if (!(await suporteLigado())) {
    return (
      <>
        <PageHeader titulo="Suporte e sugestões" />
        <Card>
          <p className="text-sm">O suporte está desligado. Para usar, ligue em{" "}
            <Link href="/configuracoes#suporte" className="font-semibold underline">Configurações → Suporte e sugestões</Link>.
          </p>
        </Card>
      </>
    );
  }

  let tickets: TicketTela[] | null = null;
  let erro: string | null = null;
  try {
    const brutos = await listarTickets();
    tickets = brutos.map((t) => ({
      id: t.id, assunto: t.assunto, tela: t.tela, status: t.status, promptPronto: t.promptPronto,
      criadoEm: t.criadoEm.toISOString(), atualizadoEm: t.atualizadoEm.toISOString(),
      mensagens: t.mensagens.map((m) => ({
        id: m.id, lado: m.lado, texto: m.texto, criadoEm: m.criadoEm.toISOString(),
        anexos: m.anexos.map((a) => ({ id: a.id, nome: a.nome, tamanho: a.tamanho })),
      })),
    }));
  } catch (e) {
    console.error("[suporte] lista", e);
    erro = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <PageHeader titulo="Suporte e sugestões" subtitulo="Pedidos enviados pelo botão de suporte, com a conversa, os prints e o prompt pronto." />
      {tickets ? (
        <SuporteClient tickets={tickets} />
      ) : (
        <Card>
          <p role="alert" className="text-sm text-red-700">
            Não foi possível carregar os pedidos agora. O banco não respondeu ou a tabela ainda não foi criada
            (a manutenção cria na primeira abertura depois da atualização).
          </p>
          {erro && <p className="mt-1 text-xs text-slate-500">Motivo: {erro.slice(0, 200)}</p>}
        </Card>
      )}
    </>
  );
}
