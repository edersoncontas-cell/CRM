import { AlertTriangle } from "lucide-react";
import { haQuanto, type SaudeAgendador } from "@/lib/agendador-regra";

// Aviso da tela de Conexão: o agendador externo (cron-job.org) parou de chamar o
// CRM. Sem ele o WhatsApp pode cair e ninguém religa. Só aparece quando parou.
export function AvisoAgendadorParado({ saude }: { saude: SaudeAgendador }) {
  if (saude.tipo !== "parado") return null;
  const nunca = saude.ultima == null;
  return (
    <div role="alert" data-aviso="agendador-parado" className="mb-4 flex max-w-2xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold">
          {nunca ? "O agendador ainda não chamou o CRM" : `O agendador do CRM parou — a última chamada foi ${haQuanto(saude.minutos)}`}
        </div>
        <p className="mt-1">
          É o <b>cron-job.org</b> que acorda o CRM de 15 em 15 minutos para vigiar o WhatsApp, religar quando ele cai e mandar os lembretes.
          Sem ele, o WhatsApp pode cair e ninguém religa.
        </p>
        <p className="mt-1">
          Enquanto isso o CRM se vigia sozinho <b>cada vez que você o abre</b> — mas só dá certo com ele aberto.
        </p>
        <p className="mt-1">
          <b>Para voltar ao normal:</b> entre em cron-job.org, abra o job do CRM (endereço <code className="rounded bg-red-100 px-1">/api/cron/tudo</code>)
          e olhe <b>History</b> para ver por que falhou. O cron-job.org desliga o job sozinho depois de muitas falhas seguidas (como na semana em
          que o banco ficou fora): é só ativá-lo de novo. Passo a passo em <code className="rounded bg-red-100 px-1">docs/GRATUITO.md</code> (Passo 4).
        </p>
      </div>
    </div>
  );
}
