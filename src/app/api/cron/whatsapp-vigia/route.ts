import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { vigiarConexao } from "@/lib/whatsapp-vigia";
import { unificarConversasDuplicadas } from "@/lib/whatsapp-dedupe";
import { sincronizarNomesDosContatos } from "@/lib/whatsapp-nomes";
import { sincronizarFotosDosContatos } from "@/lib/whatsapp-fotos";
import { resgatarMensagensEvolution } from "@/lib/whatsapp-resgate";
import { provedorWhatsApp } from "@/lib/zapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vigia da conexão do WhatsApp: se o socket caiu, religa sozinho (connect →
// restart) e só pede o QR depois de esgotar as tentativas. Também reaponta o
// webhook quando ele sai do lugar.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const conexao = await vigiarConexao();

  // Rede de segurança do recebimento (02/10): o que a Evolution recebeu e o
  // webhook não trouxe, o CRM puxa daqui — pelo mesmo caminho do webhook.
  // Uma consulta à Evolution e uma ao banco por passada; nada a puxar, nada
  // é gravado além da hora da passada.
  let resgate = null;
  if (conexao.conectado && provedorWhatsApp() === "evolution") {
    try {
      const r = await resgatarMensagensEvolution();
      resgate = r.puxadas.length ? { puxadas: r.puxadas.length } : null;
    } catch (e) {
      console.error("[whatsapp-vigia] resgate de mensagens:", e);
    }
  }

  // De carona: junta conversa do mesmo contato que tenha ficado partida em
  // duas ou mais (o bug do álbum de mídias). Não tendo duplicata, não faz
  // nada — e se falhar, não pode derrubar o vigia da conexão, que é o que
  // realmente importa nesta rota.
  let unificacao = null;
  try {
    const r = await unificarConversasDuplicadas();
    unificacao = r.gruposUnificados ? r : null;
  } catch (e) {
    console.error("[whatsapp-vigia] unificação de conversas:", e);
  }

  // Também de carona: o nome dos contatos como estão na agenda do celular.
  // Só faz sentido com a conexão de pé — desconectado, a lista do provedor
  // vem vazia e seria uma chamada à toa.
  let nomes = null;
  if (conexao.conectado) {
    try {
      const r = await sincronizarNomesDosContatos();
      nomes = r.nomesAtualizados ? r : null;
    } catch (e) {
      console.error("[whatsapp-vigia] nomes dos contatos:", e);
    }
  }

  // E a foto de perfil, pelo mesmo motivo e na mesma condição: a lista de
  // conversas do provedor já traz a foto de cada contato, então aproveitar a
  // carona aqui não custa chamada nenhuma a mais. Desconectado, não há lista.
  let fotos = null;
  if (conexao.conectado) {
    try {
      const r = await sincronizarFotosDosContatos();
      fotos = r.atualizadas ? r : null;
    } catch (e) {
      console.error("[whatsapp-vigia] fotos dos contatos:", e);
    }
  }

  return NextResponse.json({ ...conexao, ...(resgate ? { resgate } : {}), ...(unificacao ? { unificacao } : {}), ...(nomes ? { nomes } : {}), ...(fotos ? { fotos } : {}) });
}
