import { Card, PageHeader, Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { iaHabilitada, provedorIANome } from "@/lib/ai";
import * as whatsapp from "@/lib/integrations/whatsapp";
import * as zapi from "@/lib/integrations/zapi";
import * as googleCalendar from "@/lib/integrations/googleCalendar";
import * as contacts from "@/lib/integrations/contacts";
import * as transcription from "@/lib/integrations/transcription";
import { Bot, MessageCircle, Calendar, Contact, Mic, CheckCircle2, Circle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const estilo = await db.estiloDeFala.findFirst();

  const integracoes = [
    {
      nome: iaHabilitada() ? `Cérebro de IA (${provedorIANome()})` : "Cérebro de IA",
      icon: Bot,
      ativo: iaHabilitada(),
      desc: "Analisa conversas, identifica perfil, extrai dados e escreve no seu tom.",
      comoAtivar: "Defina GROQ_API_KEY (grátis) ou ANTHROPIC_API_KEY no ambiente.",
    },
    {
      nome: "WhatsApp via Z-API (número fica no celular)",
      icon: MessageCircle,
      ativo: zapi.isEnabled(),
      desc: "Conecta por QR Code (estilo WhatsApp Web). O número continua no celular, sem migrar.",
      comoAtivar: "Defina ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN.",
    },
    {
      nome: "WhatsApp Business (Meta Cloud API)",
      icon: MessageCircle,
      ativo: whatsapp.isEnabled(),
      desc: "Oficial da Meta. Exige migrar o número para a API (sai do app do celular).",
      comoAtivar: "Defina WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID (Meta Cloud API).",
    },
    {
      nome: "Google Agenda",
      icon: Calendar,
      ativo: googleCalendar.isEnabled(),
      desc: "Lança automaticamente as visitas detectadas pela IA na sua agenda.",
      comoAtivar: "Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (OAuth).",
    },
    {
      nome: "Importar contatos",
      icon: Contact,
      ativo: contacts.isEnabled(),
      desc: "Puxa nomes dos SEUS contatos (Google/WhatsApp) — caminho legal e seguro.",
      comoAtivar: "Use a conexão Google ou importe um CSV (nome,telefone).",
    },
    {
      nome: "Transcrição de áudio",
      icon: Mic,
      ativo: transcription.isEnabled(),
      desc: "Transforma áudios do WhatsApp em texto para a IA analisar.",
      comoAtivar: "Defina GROQ_API_KEY (Whisper grátis) ou OPENAI_API_KEY.",
    },
  ];

  return (
    <div>
      <PageHeader
        titulo="Configurações"
        subtitulo="Ative as integrações conforme você obtiver as credenciais"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {integracoes.map((i) => (
          <Card key={i.nome}>
            <div className="flex items-start gap-3">
              <div className={`rounded-lg p-2 ${i.ativo ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                <i.icon size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{i.nome}</span>
                  {i.ativo ? (
                    <Badge tom="green"><CheckCircle2 size={12} className="mr-1 inline" /> conectado</Badge>
                  ) : (
                    <Badge tom="slate"><Circle size={12} className="mr-1 inline" /> não conectado</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{i.desc}</p>
                {!i.ativo && (
                  <p className="mt-2 text-xs text-brand-600">Como ativar: {i.comoAtivar}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <Bot size={18} className="text-brand-600" /> Estilo de fala aprendido
        </div>
        <p className="text-sm text-slate-600">
          {estilo?.guia ?? "Ainda não aprendido. Quando você conectar suas conversas, a IA aprende o seu jeito de falar."}
        </p>
      </Card>
    </div>
  );
}
