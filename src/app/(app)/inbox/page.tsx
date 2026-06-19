import { db } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui";
import { InboxClient, type Contato } from "@/components/InboxClient";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { LimparDuplicados } from "@/components/LimparDuplicados";
import { ImportarHistorico } from "@/components/ImportarHistorico";
import * as zapi from "@/lib/integrations/zapi";
import { modoFimDeSemanaAtivo } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const modoFimDeSemana = await modoFimDeSemanaAtivo();
  // Clientes que já têm alguma conversa (recebida ou enviada).
  const clientes = await db.cliente.findMany({
    where: { conversas: { some: {} } },
    include: {
      municipio: true,
      conversas: {
        orderBy: { criadoEm: "asc" },
        include: { analise: true },
        take: 50,
      },
    },
  });

  const contatos: Contato[] = clientes
    .map((c) => {
      const mensagens = c.conversas.map((m) => ({
        id: m.id,
        conteudo: m.conteudo,
        remetente: m.remetente,
        tipo: m.tipo,
        criadoEm: m.criadoEm.toISOString(),
      }));
      // Rascunho da IA = resposta sugerida da última mensagem recebida do cliente.
      let rascunho: string | null = null;
      for (let i = c.conversas.length - 1; i >= 0; i--) {
        const conv = c.conversas[i];
        if (conv.remetente === "cliente" && conv.analise?.rascunhoResposta) {
          rascunho = conv.analise.rascunhoResposta;
          break;
        }
      }
      const ultima = c.conversas[c.conversas.length - 1];
      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        municipio: c.municipio?.nome ?? null,
        aguardando: c.aguardandoResposta,
        ultimoContato: (c.ultimoContato ?? ultima?.criadoEm ?? c.criadoEm).toISOString(),
        previa: ultima?.conteudo ?? "",
        mensagens,
        rascunho,
      } satisfies Contato;
    })
    .sort((a, b) => +new Date(b.ultimoContato) - +new Date(a.ultimoContato));

  const aguardando = contatos.filter((c) => c.aguardando).length;

  return (
    <div>
      <PageHeader
        titulo="WhatsApp"
        subtitulo="Converse com seus clientes sem sair do CRM — com rascunho da IA pronto pra enviar"
        acao={
          <div className="flex items-center gap-2">
            <BotaoAtualizar />
            <ImportarHistorico />
            <LimparDuplicados />
            <Badge tom={zapi.isEnabled() ? "green" : "yellow"}>
              {zapi.isEnabled() ? "Z-API conectada" : "Z-API não conectada"}
            </Badge>
            {aguardando > 0 && <Badge tom="red">{aguardando} aguardando</Badge>}
          </div>
        }
      />
      <InboxClient contatos={contatos} zapiAtiva={zapi.isEnabled()} modoFimDeSemana={modoFimDeSemana} />
    </div>
  );
}
