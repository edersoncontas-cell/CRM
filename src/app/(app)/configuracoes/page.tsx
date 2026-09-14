import { Card, PageHeader, Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { iaHabilitada, provedorIANome } from "@/lib/ai";
import * as zapi from "@/lib/zapi";
import * as googleCalendar from "@/lib/integrations/googleCalendar";
import * as contacts from "@/lib/integrations/contacts";
import * as transcription from "@/lib/integrations/transcription";
import { Bot, MessageCircle, Calendar, Contact, Mic, CheckCircle2, Circle, Smartphone, ArrowRight, Wrench, Coffee } from "lucide-react";
import { VisibilidadeMenu } from "@/components/VisibilidadeMenu";
import { BotaoManutencao } from "@/components/BotaoManutencao";
import { AtualizarCotacaoCafeForm } from "@/components/AtualizarCotacaoCafeForm";
import { obterCotacoes } from "@/lib/mercado";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const [estilo, cotacoes] = await Promise.all([
    db.estiloDeFala.findFirst(),
    obterCotacoes(),
  ]);

  const integracoes = [
    {
      nome: iaHabilitada() ? `Orientador de Vendas (${provedorIANome()})` : "Orientador de Vendas",
      icon: Bot,
      ativo: iaHabilitada(),
      desc: "Analisa toda a negociação (histórico completo, cadastro, visitas, financiamento) e sugere estágio, objeções, temperatura, probabilidade de fechamento e a melhor resposta.",
      comoAtivar: "Defina GEMINI_API_KEY (recomendado, tem camada grátis) ou GROQ_API_KEY (grátis) no ambiente. DeepSeek/OpenAI/Anthropic também funcionam.",
    },
    {
      nome: zapi.isEnabled() ? `WhatsApp via ${zapi.provedorWhatsAppNome()}` : "WhatsApp (número fica no celular)",
      icon: MessageCircle,
      ativo: zapi.isEnabled(),
      desc: "Conecta por QR Code (estilo WhatsApp Web). O número continua no celular, sem migrar.",
      comoAtivar: "Grátis: Evolution API (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE — ver docs/GRATUITO.md). Paga: Z-API (ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN, ZAPI_CLIENT_TOKEN).",
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

      {/* Visibilidade dos itens do menu lateral */}
      <Card className="mb-6">
        <VisibilidadeMenu />
      </Card>

      <Link
        href="/conexao"
        className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100"
      >
        <div className="rounded-lg bg-emerald-500 p-2 text-white">
          <Smartphone size={20} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-emerald-800">Conectar WhatsApp por QR Code</div>
          <p className="text-sm text-emerald-700">
            {zapi.isEnabled()
              ? `${zapi.provedorWhatsAppNome()} configurada. Abra para escanear o QR e parear seu número.`
              : "Veja como ativar e escanear o QR para receber/responder no CRM."}
          </p>
        </div>
        <ArrowRight size={18} className="text-emerald-600" />
      </Link>

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

      <Card className="mt-6">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <Coffee size={18} className="text-brand-600" /> Cotação do café (letreiro do Dashboard)
        </div>
        <p className="mb-3 text-sm text-slate-600">
          A cotação agora é <b>automática</b>: café arábica (bolsa de Nova York) e conilon/robusta (bolsa de Londres),
          convertidos para R$/saca pelo dólar do momento e atualizados a cada minuto no letreiro do Dashboard.
          Os valores abaixo são só uma <b>reserva</b>, usados se a bolsa ficar indisponível.
          {cotacoes.fonte === "mercado" && cotacoes.cafeAtualizadoEm && (
            <> Última leitura automática: {new Date(cotacoes.cafeAtualizadoEm).toLocaleString("pt-BR")}.</>
          )}
        </p>
        <AtualizarCotacaoCafeForm arabica={cotacoes.cafeArabica} conilon={cotacoes.cafeConilon} />
      </Card>

      <Card className="mt-6">
        <div className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
          <Wrench size={18} className="text-brand-600" /> Manutenção do sistema
        </div>
        <p className="mb-3 text-sm text-slate-600">
          Aplica migrações de schema pendentes e reexecuta as rotinas de manutenção (regiões, colunas do funil/demandas,
          catálogo de máquinas, fichas verificadas) sem esperar o próximo carregamento de página.
        </p>
        <BotaoManutencao />
      </Card>
    </div>
  );
}
