import { PageHeader, Card } from "@/components/ui";
import { ConexaoWhatsApp } from "@/components/ConexaoWhatsApp";
import { BotaoAtualizar } from "@/components/BotaoAtualizar";
import { ImportarAtendimento } from "@/components/ImportarAtendimento";
import { lerDiag } from "@/lib/zapi-diag";
import { provedorWhatsApp, urlPublicaCrm, urlPublicaConfirmada } from "@/lib/zapi";
import { dataCorteWhatsApp } from "@/lib/whatsapp-corte";
import { diaBrasiliaISO } from "@/lib/whatsapp-corte-regra";
import { diasDesde } from "@/lib/utils";
import { MessageCircle, Activity, CheckCircle2, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

function quando(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return "agora há pouco";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${diasDesde(iso)}d`;
}

// O que cada status das últimas chamadas quer dizer — só aparece para os que
// estão na lista, para o vendedor não ficar adivinhando por que "recebida"
// não virou conversa.
const EXPLICACAO_STATUS: Record<string, string> = {
  recebida: "entrou no Atendimento.",
  enviada: "mensagem que você mandou pelo celular, registrada na conversa.",
  grupo: "grupo — grupos não entram no CRM.",
  status: "story/status do WhatsApp — ignorado.",
  "sem-texto": "chegou sem texto (figurinha, reação, mídia sem legenda) — nada para registrar.",
  "sem-telefone": "veio sem número de origem — ignorada.",
  antiga: "anterior à data de corte ou a uma exclusão sua — não entra (Configurações → Conversas antigas).",
  bloqueado: "contato barrado pelo filtro de nomes ou já bloqueado — apagado do CRM (Configurações → Filtro de contatos).",
  eco: "cópia de uma mensagem que o próprio CRM enviou — ignorada.",
  duplicado: "a Evolution reenviou a mesma mensagem — ignorada.",
  "chave-recusada": "a Evolution chamou com uma chave que o CRM não reconhece — clique em Configurar webhook agora.",
  "outra-instancia": "chamada de OUTRA instância da Evolution — confira EVOLUTION_INSTANCE na Vercel.",
};

const CORES_STATUS: Record<string, string> = {
  recebida: "bg-green-100 text-green-700",
  enviada: "bg-blue-100 text-blue-700",
  grupo: "bg-slate-100 text-slate-500",
  status: "bg-slate-100 text-slate-400",
  "sem-texto": "bg-amber-100 text-amber-700",
  "sem-telefone": "bg-amber-100 text-amber-700",
  antiga: "bg-slate-100 text-slate-500",
  bloqueado: "bg-slate-100 text-slate-500",
  eco: "bg-slate-100 text-slate-400",
  duplicado: "bg-slate-100 text-slate-400",
  "chave-recusada": "bg-red-100 text-red-700",
  "outra-instancia": "bg-red-100 text-red-700",
};

export default async function ConexaoPage() {
  const diag = await lerDiag();
  const corte = await dataCorteWhatsApp().catch(() => null);
  const recebeuAlgo = diag.ultimos.some((e) => e.status === "recebida" || e.status === "enviada");
  const provedor = provedorWhatsApp();
  const nomeProvedor = provedor === "evolution" ? "Evolution API" : "Z-API";
  const base = (await urlPublicaConfirmada().catch(() => null)) ?? urlPublicaCrm() ?? "https://SEU-CRM.vercel.app";
  const urlWebhook = provedor === "evolution" ? `${base}/api/webhooks/evolution` : `${base}/api/webhooks/zapi`;

  return (
    <div>
      <PageHeader
        titulo="Conexão WhatsApp"
        subtitulo="Conecte seu número por QR Code — ele continua no seu celular"
        acao={<BotaoAtualizar />}
      />

      <div className="mb-6 max-w-2xl">
        <ConexaoWhatsApp />
      </div>

      <Card className="mb-6 max-w-2xl">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <MessageCircle size={18} className="text-brand-600" /> Importar conversas para o Atendimento
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Puxa para o <b>Atendimento</b> as conversas que já estão no seu celular, a partir do dia que você
          escolher. Pode rodar quantas vezes quiser — não duplica. Conversa que você apagou à mão não volta.
        </p>
        <ImportarAtendimento dataCorte={corte ? diaBrasiliaISO(corte) : null} />
      </Card>

      {/* Diagnóstico do webhook — mostra se o provedor está chamando o CRM */}
      <Card className="mb-6 max-w-2xl">
        <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
          <Activity size={18} className="text-brand-600" /> Diagnóstico do recebimento
        </div>

        {diag.totalChamadas === 0 ? (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <b>A {nomeProvedor} ainda não chamou o CRM nenhuma vez.</b> Isso significa que o webhook não está
              configurado/apontando certo. A URL do webhook precisa ser:
              <code className="mt-1 block break-all rounded bg-red-100 px-2 py-1 text-xs">
                {urlWebhook}
              </code>
              {provedor === "evolution"
                ? <>com os eventos <b>MESSAGES_UPSERT</b> e <b>MESSAGES_UPDATE</b> e a opção <b>Base64</b> ligada.</>
                : <>e ligue <b>&quot;Notificar as enviadas por mim também&quot;</b>.</>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{diag.totalChamadas}</div>
                <div className="text-xs text-slate-500">chamadas recebidas da {nomeProvedor}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-sm font-bold text-slate-800">{quando(diag.ultimaChamada)}</div>
                <div className="text-xs text-slate-500">última chamada</div>
              </div>
            </div>

            {diag.ultimos.some((e) => e.status === "chave-recusada") && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>A {nomeProvedor} está chamando, mas o CRM <b>recusou a chave</b> em alguma chamada. Clique em <b>Configurar webhook agora</b> (no card de cima) para reapontar com a chave certa.</span>
              </div>
            )}
            {recebeuAlgo ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                <CheckCircle2 size={15} /> A {nomeProvedor} está entregando mensagens ao CRM. ✅
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                A {nomeProvedor} está chamando, mas só com grupos/status — nenhuma mensagem de cliente ainda.
                Mande uma mensagem de teste para o seu número e clique em Atualizar.
              </div>
            )}

            {(() => {
              const presentes = Array.from(new Set(diag.ultimos.map((e) => e.status))).filter((st) => EXPLICACAO_STATUS[st] || st.startsWith("erro:"));
              if (!presentes.length) return null;
              return (
                <ul className="space-y-0.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  {presentes.map((st) => (
                    <li key={st}><b>{st}</b>: {EXPLICACAO_STATUS[st] ?? "o CRM falhou ao gravar — o texto do erro está na linha."}</li>
                  ))}
                </ul>
              );
            })()}

            {/* Últimos eventos */}
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <div className="bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Últimos eventos
              </div>
              <ul className="divide-y divide-slate-100">
                {diag.ultimos.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${CORES_STATUS[e.status] ?? "bg-red-100 text-red-700"}`}>
                      {e.status}
                    </span>
                    <span className="w-16 shrink-0 text-xs text-slate-400">{quando(e.em)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-600">
                      {e.nome ? <b>{e.nome}</b> : e.phone ? e.phone : "—"}
                      {e.texto ? ` · ${e.texto}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <Card className="max-w-2xl">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <MessageCircle size={18} className="text-emerald-500" /> Como funciona
        </div>
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li>• O número fica no seu celular (igual ao WhatsApp Web) — nada migra para a Meta.</li>
          <li>• Mensagens recebidas entram no <b>/atendimento</b> e a IA analisa cada uma.</li>
          <li>• Você responde direto pelo CRM e o cliente sai da fila de &quot;aguardando retorno&quot;.</li>
          <li>• Clientes de regiões fora da sua área não recebem disparos automáticos.</li>
        </ul>
      </Card>
    </div>
  );
}
