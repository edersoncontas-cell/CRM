import { PageHeader } from "@/components/ui";
import { ConexaoWhatsApp } from "@/components/ConexaoWhatsApp";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { AvisoAgendadorParado } from "@/components/AvisoAgendadorParado";
import { lerPassadas } from "@/lib/agendador";
import { saudeAgendador } from "@/lib/agendador-regra";
import { isEnabled, provedorWhatsAppNome } from "@/lib/zapi";
import { Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";
// As ações da tela (desconectar conferindo o estado, refazer a instância)
// esperam a Evolution: até 40 s. O padrão da Vercel cortaria no meio e a tela
// ficaria sem resposta nenhuma.
export const maxDuration = 60;

// 03/11, pedido dele: saíram desta tela os três cards de baixo (importar
// conversas, painel de recebimento e "como funciona"). O diagnóstico da
// conexão e o "Testar recebimento" continuam dentro do card de conexão
// (ConexaoWhatsApp), e o registro das chamadas (lerDiag) segue alimentando o
// Atendimento e o Zeus — só não há mais card para ele aqui.
export default async function ConexaoPage() {
  // O agendador externo parou? (O WhatsApp só é vigiado quando ele chama.)
  const agendador = saudeAgendador((await lerPassadas()).externa, new Date());

  return (
    <div>
      <PageHeader
        titulo="Conexão WhatsApp"
        subtitulo="Conecte seu número por QR Code — ele continua no seu celular"
        acao={<BotaoAtualizar />}
      />

      <AvisoAgendadorParado saude={agendador} />

      <div className="mb-4 flex max-w-2xl items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="shrink-0 rounded-lg bg-emerald-500 p-2 text-white">
          <Smartphone size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-emerald-800">Conectar WhatsApp por QR Code</div>
          <p className="text-sm text-emerald-700">
            {isEnabled()
              ? `${provedorWhatsAppNome()} configurada. Escaneie o QR logo abaixo para parear seu número.`
              : "WhatsApp ainda não configurado — veja abaixo como ativar e escanear o QR para espelhar suas conversas no CRM."}
          </p>
        </div>
      </div>

      <div className="mb-6 max-w-2xl">
        <ConexaoWhatsApp />
      </div>
    </div>
  );
}
