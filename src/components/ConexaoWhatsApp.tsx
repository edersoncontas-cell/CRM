"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { reiniciarZapi, desconectarZapi, refazerConexaoWhatsAppAction, configurarWebhookEvolutionAction, criarInstanciaEvolutionAction, vigiarConexaoAction, lerConexaoVigiadaAction } from "@/lib/actions";
import {
  Smartphone, RefreshCw, QrCode, CheckCircle2, AlertTriangle, LogOut, Loader2, Server, Terminal, ShieldCheck, Stethoscope,
} from "lucide-react";

type EtapaDiagnostico = { etapa: string; ok: boolean; detalhe: string };
type Diagnostico = { provedor: string | null; url: string | null; instancia: string | null; etapas: EtapaDiagnostico[]; conclusao: string };

type Status = {
  configurado: boolean;
  conectado: boolean;
  precisaQrCode: boolean;
  clientTokenConfigurado: boolean;
  provedor?: "evolution" | "zapi" | null;
  telefone?: string | null;
  erro?: string | null;
  instanciaNaoExiste?: boolean;
  webhookOk?: boolean | null;
  instancia?: string | null;
};

const COMANDO_INSTALAR = "curl -fsSL https://raw.githubusercontent.com/edersoncontas-cell/CRM/claude/relaxed-cori-5c3g4l/evolution/instalar.sh | sudo bash -s -- https://SEU-CRM.vercel.app";

// Aviso quando o ZAPI_CLIENT_TOKEN está faltando — o número até recebe mensagens,
// mas NÃO consegue enviar (a Z-API recusa com "client-token is not configured").
function AvisoClientToken() {
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="mb-1.5 flex items-center gap-2 font-semibold text-red-800">
        <AlertTriangle size={17} /> Falta o token de envio (ZAPI_CLIENT_TOKEN)
      </div>
      <p className="text-sm text-red-700">
        O número recebe mensagens, mas <b>não consegue enviar</b> — a Z-API exige o
        &quot;Token de segurança da conta&quot; (Client-Token) no envio.
      </p>
      <ol className="mt-2 space-y-1 text-sm text-red-700">
        <li>1. No painel da <b>Z-API</b>, abra <b>Segurança</b> e copie o <b>Account Security Token</b>.</li>
        <li>2. No Vercel, em <b>Settings → Environment Variables</b>, adicione:
          <code className="ml-1 rounded bg-red-100 px-1.5 py-0.5">ZAPI_CLIENT_TOKEN</code>
        </li>
        <li>3. Faça um <b>redeploy</b> para a variável entrar em vigor.</li>
      </ol>
    </div>
  );
}

export function ConexaoWhatsApp() {
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [carregandoQr, setCarregandoQr] = useState(false);
  const [qrErro, setQrErro] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const [diagnosticando, setDiagnosticando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [webhookMsg, setWebhookMsg] = useState<string | null>(null);
  const [criandoMsg, setCriandoMsg] = useState<string | null>(null);
  const [vigia, setVigia] = useState<{ descricao: string; reconexoes: number } | null>(null);
  const [vigiaMsg, setVigiaMsg] = useState<string | null>(null);
  const webhookCorrigido = useRef(false);
  const diagnosticoAuto = useRef(false);

  useEffect(() => { lerConexaoVigiadaAction().then(setVigia).catch(() => {}); }, [status?.conectado]);

  // Webhook fora do lugar (ou desligado): o CRM aponta para si mesmo sozinho,
  // uma vez por visita à página. Sem isso as mensagens não chegam.
  useEffect(() => {
    if (status?.provedor !== "evolution" || status.webhookOk !== false || webhookCorrigido.current) return;
    webhookCorrigido.current = true;
    configurarWebhookEvolutionAction().then((r) => setWebhookMsg(r.ok ? `Webhook apontado automaticamente para ${r.url}` : `Não consegui apontar o webhook: ${r.erro}`)).catch(() => {});
  }, [status]);

  const buscarStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/zapi/status", { cache: "no-store" });
      const data = (await res.json()) as Status;
      setStatus(data);
      return data;
    } catch {
      setStatus((s) => ({
        configurado: true, conectado: false, precisaQrCode: true, clientTokenConfigurado: true,
        provedor: s?.provedor ?? null, instancia: s?.instancia ?? null,
        erro: "O CRM não conseguiu consultar a conexão. Use \"Diagnosticar\" abaixo.",
      }));
      return null;
    }
  }, []);

  const diagnosticar = useCallback(async () => {
    setDiagnosticando(true);
    try {
      const res = await fetch("/api/zapi/diagnostico", { cache: "no-store" });
      setDiagnostico((await res.json()) as Diagnostico);
    } catch {
      setDiagnostico({ provedor: null, url: null, instancia: null, etapas: [], conclusao: "Não consegui rodar o diagnóstico — o próprio CRM não respondeu." });
    } finally {
      setDiagnosticando(false);
    }
  }, []);

  const buscarQr = useCallback(async () => {
    setCarregandoQr(true);
    try {
      const res = await fetch("/api/zapi/qr", { cache: "no-store" });
      const data = (await res.json()) as { imagem: string | null; erro?: string };
      setQr(data.imagem);
      setQrErro(data.imagem ? null : data.erro ?? null);
    } catch {
      setQr(null);
      setQrErro("Não consegui falar com o CRM para pegar o QR.");
    } finally {
      setCarregandoQr(false);
    }
  }, []);

  // Polling: status a cada 5s. Enquanto precisar de QR, atualiza o QR a cada 20s.
  useEffect(() => {
    let ativo = true;
    let qrTick = 0;

    const loop = async () => {
      const s = await buscarStatus();
      if (!ativo || !s) return;
      if (s.configurado && !s.conectado) {
        // Atualiza o QR na primeira vez e a cada ~20s (4 ciclos de 5s).
        if (qrTick % 4 === 0) await buscarQr();
        qrTick++;
      } else {
        setQr(null);
      }
    };

    loop();
    // Os 5 s ficam (é o que atualiza o QR enquanto ele conecta), mas com a aba
    // escondida não chama: a rota de status lê o banco, e 720 chamadas por hora
    // em segundo plano não deixavam o Neon suspender (docs/consumo-invocacoes.md).
    const id = setInterval(() => { if (document.visibilityState === "visible") loop(); }, 5000);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [buscarStatus, buscarQr]);

  // Servidor fora do ar: roda o diagnóstico sozinho na primeira falha, para a
  // tela já dizer o que consertar em vez de só girar. Também quando a pessoa
  // chega pelo aviso do Atendimento ("o recebimento parou"): ?diagnosticar=1.
  // O diagnóstico testa o webhook de fora e, se ele aponta para o endereço
  // errado, reaponta para o deste navegador.
  useEffect(() => {
    if (!status || diagnostico || diagnosticando || diagnosticoAuto.current) return;
    const pedido = new URLSearchParams(window.location.search).get("diagnosticar") === "1";
    if (!status.erro && !pedido) return;
    diagnosticoAuto.current = true;
    diagnosticar();
  }, [status, diagnostico, diagnosticando, diagnosticar]);

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin" /> Consultando status…
      </div>
    );
  }

  // Nenhum provedor configurado: passo a passo da Evolution API (grátis).
  if (!status.configurado) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800">
          <AlertTriangle size={18} /> WhatsApp ainda não configurado
        </div>
        <p className="text-sm text-amber-700">
          O CRM usa a <b>Evolution API</b> (software aberto, sem mensalidade). Ela precisa rodar num
          servidor ligado 24h. São três passos:
        </p>
        <ol className="mt-3 space-y-3 text-sm text-amber-800">
          <li className="flex gap-2">
            <Server size={16} className="mt-0.5 shrink-0" />
            <div><b>1. Um servidor Ubuntu</b> (VPS de R$ 20–30/mês na Hostinger, Contabo ou DigitalOcean, ou a VM grátis da Oracle Cloud). Guia em <code className="rounded bg-amber-100 px-1.5 py-0.5">docs/GRATUITO.md</code>.</div>
          </li>
          <li className="flex gap-2">
            <Terminal size={16} className="mt-0.5 shrink-0" />
            <div>
              <b>2. Um comando no servidor</b> (por SSH). Ele instala tudo, cria a instância e mostra as variáveis:
              <code className="mt-1 block break-all rounded bg-amber-100 px-2 py-1.5 text-[11px] leading-relaxed">{COMANDO_INSTALAR}</code>
            </div>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 break-words">
              <b>3. Colar na Vercel</b> (Settings → Environment Variables) as três variáveis que o comando imprime:
              <code className="mx-1 break-all rounded bg-amber-100 px-1.5 py-0.5">EVOLUTION_API_URL</code>
              <code className="mx-1 break-all rounded bg-amber-100 px-1.5 py-0.5">EVOLUTION_API_KEY</code>
              <code className="mx-1 break-all rounded bg-amber-100 px-1.5 py-0.5">EVOLUTION_INSTANCE</code>
              e fazer <b>Redeploy</b>. Volte aqui e escaneie o QR.
            </div>
          </li>
        </ol>
      </div>
    );
  }

  // Diagnóstico completo (servidor → chave → instância → webhook → chamada de
  // teste). Aparece também com o número CONECTADO: "conectado mas nada chega"
  // é justamente o caso em que ele mais ajuda.
  const blocoDiagnostico = (legenda: string) => (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={diagnosticar}
          disabled={diagnosticando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-60"
        >
          {diagnosticando ? <Loader2 size={13} className="animate-spin" /> : <Stethoscope size={13} />} Diagnosticar conexão
        </button>
        <span className="text-xs text-slate-500">{legenda}</span>
      </div>
      {diagnostico && (
        <div className="mt-2">
          <ul className="space-y-1">
            {diagnostico.etapas.map((e) => (
              <li key={e.etapa} className="flex items-start gap-1.5 text-xs">
                {e.ok
                  ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-green-600" />
                  : <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-500" />}
                <span className={e.ok ? "text-slate-600" : "font-semibold text-red-700"}>
                  {e.etapa}: <span className="font-normal break-all">{e.detalhe}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 rounded-md bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">{diagnostico.conclusao}</p>
        </div>
      )}
    </div>
  );

  // Conectado.
  if (status.conectado) {
    return (
      <div>
      {!status.clientTokenConfigurado && <AvisoClientToken />}
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="mb-1 flex items-center gap-2 text-lg font-bold text-green-700">
          <CheckCircle2 size={22} /> WhatsApp conectado
          {status.provedor === "evolution" && <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Evolution API · grátis</span>}
        </div>
        <p className="flex items-center gap-2 text-sm text-green-700">
          <Smartphone size={15} />
          {status.telefone ? `Número ${status.telefone}` : "Seu número está pareado e recebendo mensagens."}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          As mensagens recebidas entram no <b>WhatsApp do CRM</b> e são analisadas pela IA automaticamente.
        </p>
        {status.provedor === "evolution" && (
          <div className="mt-3 rounded-lg border border-green-200 bg-white p-3 text-sm text-slate-600">
            {status.webhookOk === true ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-green-700"><CheckCircle2 size={15} /> Webhook apontando para este CRM — as mensagens chegam sozinhas.</span>
            ) : status.webhookOk === false ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700"><AlertTriangle size={15} /> Webhook fora do lugar — corrigindo automaticamente…</span>
            ) : (
              <><b className="text-slate-700">Webhook da Evolution.</b> Aponte a instância para este CRM com um clique (eventos de mensagem e status, áudio em base64).</>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => startTransition(async () => { const r = await configurarWebhookEvolutionAction(); setWebhookMsg(r.ok ? `Webhook configurado: ${r.url}` : `Falhou: ${r.erro}`); })}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Configurar webhook agora
              </button>
              {webhookMsg && <span className="text-xs text-slate-500">{webhookMsg}</span>}
            </div>
          </div>
        )}
        {status.provedor === "evolution" && blocoDiagnostico("Conectado mas nada chega? Isto testa o caminho inteiro, inclusive uma chamada de fora no webhook.")}
        <div className="mt-3 rounded-lg border border-green-200 bg-white p-3 text-sm text-slate-600">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700"><ShieldCheck size={15} className="text-green-600" /> Vigia da conexão</div>
          <p className="mt-1 text-xs text-slate-500">
            O CRM confere a conexão de 5 em 5 minutos. Se o WhatsApp cair, ele religa sozinho (e reaponta o webhook) — só pede o QR Code
            quando o pareamento cai de verdade. Nada no sistema desconecta o número: só o botão abaixo.
          </p>
          {vigia && <p className="mt-1.5 text-xs font-semibold text-slate-600">{vigia.descricao}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => startTransition(async () => {
                const r = await vigiarConexaoAction();
                setVigiaMsg(r.religou ? "Religado agora." : r.webhookCorrigido ? "Webhook reapontado." : r.conectado ? "Tudo certo — conexão de pé." : "Ainda fora do ar; continuo tentando.");
                await buscarStatus();
                await lerConexaoVigiadaAction().then(setVigia).catch(() => {});
              })}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-60"
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Verificar e religar agora
            </button>
            {vigiaMsg && <span className="text-xs text-slate-500">{vigiaMsg}</span>}
          </div>
        </div>
        <SaidaWhatsApp provedor={status.provedor} aoTerminar={async () => { await buscarStatus(); }} />
      </div>
      </div>
    );
  }

  // Evolution configurada, mas a instância ainda não foi criada: cria daqui.
  if (status.provedor === "evolution" && status.instanciaNaoExiste) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2 font-semibold text-amber-800">
          <Server size={18} /> Falta criar a instância &quot;{status.instancia}&quot; na Evolution
        </div>
        <p className="text-sm text-amber-700">
          A Evolution respondeu, mas ainda não tem uma instância com esse nome. O CRM cria agora,
          já com o webhook apontando para cá, e em seguida mostra o QR Code.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => startTransition(async () => {
              setCriandoMsg(null);
              const r = await criarInstanciaEvolutionAction();
              if (r.ok) { setCriandoMsg("Instância criada."); if (r.qr) setQr(r.qr); await buscarStatus(); if (!r.qr) await buscarQr(); }
              else setCriandoMsg(`Falhou: ${r.erro}`);
            })}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />} Criar instância e gerar QR
          </button>
          {criandoMsg && <span className="text-xs text-slate-600">{criandoMsg}</span>}
        </div>
      </div>
    );
  }

  // Precisa escanear o QR.
  return (
    <div>
    {!status.clientTokenConfigurado && <AvisoClientToken />}
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2 font-semibold text-slate-700">
        <QrCode size={18} className="text-brand-600" /> Escaneie para conectar
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-56 w-56 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
          {carregandoQr && !qr ? (
            <Loader2 size={28} className="animate-spin text-slate-300" />
          ) : qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code do WhatsApp" className="h-52 w-52 rounded-lg" />
          ) : (
            <div className="px-4 text-center text-sm text-slate-400">
              {qrErro ?? "Clique em \"Gerar novo QR\"."}
            </div>
          )}
        </div>
        <ol className="flex-1 space-y-2 text-sm text-slate-600">
          <li>1. Abra o <b>WhatsApp</b> no seu celular.</li>
          <li>2. Toque em <b>Configurações → Aparelhos conectados</b>.</li>
          <li>3. Toque em <b>Conectar um aparelho</b>.</li>
          <li>4. Aponte a câmera para este QR Code.</li>
          <li className="text-xs text-slate-400">A página detecta a conexão sozinha em alguns segundos.</li>
        </ol>
      </div>

      {/* Status e QR costumam falhar pelo mesmo motivo — mostrar as duas
          mensagens iguais só polui a tela. */}
      {(qrErro ?? status.erro) && <p className="mt-3 text-xs text-amber-600">{qrErro ?? status.erro}</p>}
      {qrErro && status.erro && status.erro !== qrErro && <p className="mt-1 text-xs text-amber-600">{status.erro}</p>}

      {blocoDiagnostico("Descobre em que ponto a conexão quebrou.")}

      <div className="mt-4 flex gap-2">
        <button
          onClick={buscarQr}
          disabled={carregandoQr}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {carregandoQr ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />} Gerar novo QR
        </button>
        <button
          onClick={() => startTransition(async () => {
            const r = await vigiarConexaoAction();
            setVigiaMsg(r.religou ? "Religou sem precisar do QR." : "Não deu para religar sozinho — escaneie o QR.");
            await buscarStatus();
          })}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-bold text-agro-400 hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Tentar religar sem QR
        </button>
        <button
          onClick={() => startTransition(async () => { await reiniciarZapi(); await buscarQr(); })}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reiniciar instância
        </button>
      </div>
      {(vigiaMsg || vigia) && <p className="mt-2 text-xs text-slate-500">{vigiaMsg ?? vigia?.descricao}</p>}
    </div>
    </div>
  );
}

// O botão Desconectar e o que vem depois dele. Fica fora do componente
// principal para ter o próprio "ocupado" (não trava os outros botões) e para
// não ser remontado a cada consulta de status.
//
// Antes: window.prompt pedindo para digitar DESCONECTAR, um pedido só à
// Evolution, e o resultado numa linha cinza lá em cima — com a sessão presa a
// tela continuava verde e nada dizia por quê (01/10). Agora a confirmação é
// na tela, a resposta aparece embaixo do botão, e quando a conexão fica presa
// a tela dá as duas saídas que sempre funcionam.
function SaidaWhatsApp({ provedor, aoTerminar }: { provedor: string | null | undefined; aoTerminar: () => Promise<void> }) {
  const [etapa, setEtapa] = useState<"parado" | "confirmando" | "desconectando" | "presa" | "confirmandoRefazer" | "refazendo">("parado");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [motivoPresa, setMotivoPresa] = useState<string | null>(null);
  const semResposta = "O CRM não respondeu a tempo. Recarregue a página: se aparecer o QR Code, a desconexão funcionou.";

  async function desconectar() {
    setEtapa("desconectando");
    setMsg(null);
    try {
      const r = await desconectarZapi("DESCONECTAR");
      if (r.ok) {
        setMsg({ tipo: "ok", texto: r.jaEstava ? "O número já estava fora do CRM — o QR Code aparece aqui em instantes." : "Desconectado. O QR Code aparece aqui em instantes." });
        setEtapa("parado");
        await aoTerminar();
      } else if (r.presa) {
        setMotivoPresa(r.erro ?? null);
        setEtapa("presa");
      } else {
        setMsg({ tipo: "erro", texto: `Não desconectou: ${r.erro ?? "a Evolution não disse o motivo"}.` });
        setEtapa("parado");
      }
    } catch {
      setMsg({ tipo: "erro", texto: semResposta });
      setEtapa("parado");
    }
  }

  async function refazer() {
    setEtapa("refazendo");
    setMsg(null);
    try {
      const r = await refazerConexaoWhatsAppAction("REFAZER");
      if (r.ok) {
        setMsg({ tipo: "ok", texto: "Conexão refeita. O QR Code aparece aqui em instantes." });
        setEtapa("parado");
        await aoTerminar();
      } else {
        setMsg({ tipo: "erro", texto: `Não deu para refazer: ${r.erro ?? "sem motivo"}.` });
        setEtapa("presa");
      }
    } catch {
      setMsg({ tipo: "erro", texto: semResposta });
      setEtapa("presa");
    }
  }

  const botao = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60";
  return (
    <div className="mt-4">
      {etapa === "parado" && (
        <button onClick={() => { setMsg(null); setEtapa("confirmando"); }} className={`${botao} bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50`}>
          <LogOut size={14} /> Desconectar
        </button>
      )}
      {etapa === "confirmando" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p>Isso tira o WhatsApp do CRM e você vai ler o QR Code de novo. As conversas que já estão no CRM ficam.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={desconectar} className={`${botao} bg-red-600 text-white hover:bg-red-700`}><LogOut size={14} /> Sim, desconectar</button>
            <button onClick={() => setEtapa("parado")} className={`${botao} bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50`}>Cancelar</button>
          </div>
        </div>
      )}
      {(etapa === "desconectando" || etapa === "refazendo") && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={14} className="animate-spin" />
          {etapa === "desconectando" ? "Desconectando e conferindo se saiu mesmo… (pode levar até 40 s)" : "Apagando a instância e criando de novo…"}
        </p>
      )}
      {(etapa === "presa" || etapa === "confirmandoRefazer") && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">A conexão ficou presa: a Evolution não deixou desconectar.</p>
          {motivoPresa && <p className="mt-0.5 text-xs text-amber-800">{motivoPresa}</p>}
          <p className="mt-2"><b>Saída 1 — pelo celular</b> (a mais rápida): WhatsApp → Configurações → <b>Aparelhos conectados</b> → toque no aparelho do CRM → <b>Desconectar</b>. Em segundos esta tela mostra o QR Code.</p>
          {provedor === "evolution" && <p className="mt-1.5"><b>Saída 2 — refazer do zero</b>: o CRM apaga a instância na Evolution e cria de novo, já com o QR Code. As conversas do CRM ficam; o celular manda o histórico de novo ao ler o QR.</p>}
          {provedor === "evolution" && etapa === "presa" && (
            <button onClick={() => setEtapa("confirmandoRefazer")} className={`${botao} mt-2 bg-amber-600 text-white hover:bg-amber-700`}><RefreshCw size={14} /> Refazer do zero</button>
          )}
          {etapa === "confirmandoRefazer" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={refazer} className={`${botao} bg-amber-600 text-white hover:bg-amber-700`}><RefreshCw size={14} /> Sim, refazer do zero</button>
              <button onClick={() => setEtapa("presa")} className={`${botao} bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50`}>Cancelar</button>
            </div>
          )}
          <button onClick={desconectar} className="mt-2 block text-xs font-semibold text-amber-800 underline">Tentar desconectar de novo</button>
        </div>
      )}
      {msg && <p role="status" className={`mt-2 text-sm ${msg.tipo === "ok" ? "text-green-700" : "text-red-700"}`}>{msg.texto}</p>}
    </div>
  );
}
