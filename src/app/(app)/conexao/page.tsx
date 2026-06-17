import { PageHeader, Card } from "@/components/ui";
import { ConexaoWhatsApp } from "@/components/ConexaoWhatsApp";
import { MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ConexaoPage() {
  return (
    <div>
      <PageHeader
        titulo="Conexão WhatsApp"
        subtitulo="Conecte seu número por QR Code — ele continua no seu celular"
      />

      <div className="mb-6 max-w-2xl">
        <ConexaoWhatsApp />
      </div>

      <Card className="max-w-2xl">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <MessageCircle size={18} className="text-emerald-500" /> Como funciona
        </div>
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li>• O número fica no seu celular (igual ao WhatsApp Web) — nada migra para a Meta.</li>
          <li>• Mensagens recebidas entram no <b>/inbox</b> e a IA analisa cada uma.</li>
          <li>• Você responde direto pelo CRM e o cliente sai da fila de &quot;aguardando retorno&quot;.</li>
          <li>• Clientes de regiões fora da sua área não recebem disparos automáticos.</li>
        </ul>
      </Card>
    </div>
  );
}
