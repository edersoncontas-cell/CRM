"use client";

// "Testar recebimento" — 02/10: "desconectei, conectei, mandei mensagem de
// outro telefone e não chegou". O vendedor manda uma mensagem de outro
// celular e a tela mostra, passo a passo, até onde ela chegou: conexão viva
// por dentro → Evolution recebeu → CRM recebeu (pelo aviso, puxada ou
// descartada). O que dá para consertar daqui o servidor já conserta
// (puxa a mensagem, reaponta o webhook); o resto vira um botão.

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, MessageCircle, RefreshCw, XCircle } from "lucide-react";
import { testarRecebimentoAction } from "@/lib/whatsapp-recebimento-actions";
import { ESPERA_TESTE_MS, type ResultadoTeste } from "@/lib/whatsapp-resgate-regra";

type Fase = "parado" | "rodando" | "fim" | "falhou";
type Passo = "ok" | "erro" | "esperando" | "nao-se-sabe";

const INTERVALO_MS = 5_000;

function Marca({ p }: { p: Passo }) {
  if (p === "ok") return <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-green-600" />;
  if (p === "erro") return <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />;
  if (p === "esperando") return <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-slate-400" />;
  return <Circle size={15} className="mt-0.5 shrink-0 text-slate-300" />;
}

export function TesteRecebimento({ aoRefazer }: { aoRefazer: () => void }) {
  const [fase, setFase] = useState<Fase>("parado");
  const [r, setR] = useState<ResultadoTeste | null>(null);
  const [restante, setRestante] = useState(0);
  // Fica de uma consulta para a outra: só a primeira traz as atrasadas.
  const [atrasadas, setAtrasadas] = useState(0);
  const vivo = useRef(true);
  const rodada = useRef(0);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { vivo.current = false; }, []);
  useEffect(() => { if (fase === "fim" || fase === "falhou") fimRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [fase]);

  async function testar() {
    const minha = ++rodada.current;
    const inicio = new Date().toISOString();
    const t0 = Date.now();
    setR(null);
    setAtrasadas(0);
    setFase("rodando");
    let sonda: { estado: ResultadoTeste["conexao"]; detalhe: string } | null = null;
    let falhas = 0;
    // Cada volta é uma ação do servidor; a tela só espera e mostra.
    for (;;) {
      if (!vivo.current || minha !== rodada.current) return;
      setRestante(Math.max(0, Math.ceil((ESPERA_TESTE_MS - (Date.now() - t0)) / 1000)));
      try {
        const res = await testarRecebimentoAction(inicio, sonda);
        if (!vivo.current || minha !== rodada.current) return;
        falhas = 0;
        sonda = { estado: res.conexao, detalhe: res.detalheConexao };
        if (res.atrasadasPuxadas) setAtrasadas(res.atrasadasPuxadas);
        setR(res);
        if (res.conclusao.final) { setFase("fim"); return; }
      } catch {
        if (++falhas >= 3) { setFase("falhou"); return; }
      }
      // O servidor fecha o teste quando o tempo acaba; isto é só a trava caso
      // ele nunca feche (nenhum laço pode ficar girando para sempre na tela).
      if (Date.now() - t0 > ESPERA_TESTE_MS + 60_000) { setFase("falhou"); return; }
      await new Promise((ok) => setTimeout(ok, INTERVALO_MS));
    }
  }

  function parar() { rodada.current++; setFase("parado"); setR(null); }

  const situacao = r?.conclusao.situacao;
  // Chegou ao CRM (de qualquer jeito) = a Evolution recebeu, mesmo que ela não guarde mensagens.
  const chegouAoCrm = situacao === "chegou" || situacao === "puxada" || situacao === "descartada" || situacao === "recusada-no-webhook";
  const recebidaNaEvolution = chegouAoCrm || (r?.naEvolution ?? []).some((m) => m.deOutraPessoa);
  const passoConexao: Passo = !r ? "esperando" : r.conexao === "viva" ? "ok" : r.conexao === "morta" ? "erro" : "nao-se-sabe";
  const passoEvolution: Passo = recebidaNaEvolution ? "ok" : r?.conclusao.final ? "erro" : "esperando";
  const finais = (r?.naEvolution ?? []).filter((m) => m.deOutraPessoa).map((m) => `final ${m.numero || "?"}`);
  const passoCrm: Passo = situacao === "chegou" || situacao === "puxada" ? "ok"
    : situacao === "descartada" || situacao === "recusada-no-webhook" || r?.conclusao.final ? "erro"
    : "esperando";
  const bom = situacao === "chegou" || situacao === "puxada";

  const botao = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60";

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {fase !== "rodando" && (
          <button onClick={testar} className={`${botao} bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100`}>
            <MessageCircle size={13} /> {fase === "parado" ? "Testar recebimento" : "Testar de novo"}
          </button>
        )}
        {fase === "parado" && <span className="text-xs text-slate-500">Manda uma mensagem de outro celular e vê, passo a passo, até onde ela chega.</span>}
      </div>

      {fase === "rodando" && (
        <div role="status" className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <p className="font-semibold">Agora, de OUTRO celular, mande uma mensagem para o seu número do WhatsApp (pode ser só &quot;teste&quot;).</p>
          <p className="mt-1 text-xs text-sky-800">O CRM fica olhando por até {Math.floor(ESPERA_TESTE_MS / 60_000)} min e {Math.round((ESPERA_TESTE_MS % 60_000) / 1000)} s{restante ? ` · faltam ${restante} s` : ""}.</p>
          <button onClick={parar} className="mt-2 text-xs font-semibold text-sky-800 underline">Parar o teste</button>
        </div>
      )}

      {atrasadas > 0 && (fase === "rodando" || fase === "fim") && (
        <p className="mt-2 rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-800">
          De quebra: {atrasadas === 1 ? "1 mensagem" : `${atrasadas} mensagens`} das últimas 24 h {atrasadas === 1 ? "estava" : "estavam"} na Evolution sem ter chegado ao CRM — {atrasadas === 1 ? "já está" : "já estão"} no Atendimento.
        </p>
      )}

      {(fase === "rodando" || fase === "fim") && (
        <ol className="mt-3 space-y-1.5 text-xs text-slate-700">
          <li className="flex items-start gap-1.5">
            <Marca p={passoConexao} />
            <span><b>Conexão viva por dentro</b>{r ? ` — ${r.conexao === "viva" ? "o WhatsApp respondeu pela conexão" : r.conexao === "morta" ? "o WhatsApp respondeu \"Connection Closed\"" : "não deu para saber"}` : " — conferindo…"}</span>
          </li>
          <li className="flex items-start gap-1.5">
            <Marca p={passoEvolution} />
            <span><b>A Evolution recebeu</b>{recebidaNaEvolution
              ? (finais.length ? ` — de ${finais.join(", ")}` : "")
              : passoEvolution === "esperando" ? " — esperando a mensagem…" : " — nada chegou nela"}</span>
          </li>
          <li className="flex items-start gap-1.5">
            <Marca p={passoCrm} />
            <span><b>O CRM recebeu</b>{situacao === "chegou" ? " — pelo aviso da Evolution (webhook), na hora"
              : situacao === "puxada" ? ` — o aviso não veio; o CRM puxou da Evolution (${r?.puxadas ?? 0})`
              : situacao === "descartada" ? " — chegou, mas foi deixada de fora"
              : situacao === "recusada-no-webhook" ? " — o aviso chegou e foi recusado"
              : r?.conclusao.final ? " — não" : " — esperando…"}</span>
          </li>
        </ol>
      )}

      {fase === "fim" && r && (
        <div ref={fimRef} role="status" className={`mt-3 rounded-md border p-3 text-sm ${bom ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <p className="font-semibold">{r.conclusao.titulo}</p>
          {r.conclusao.texto && <p className="mt-1 text-xs">{r.conclusao.texto}</p>}
          {r.webhookReapontado && <p className="mt-1 text-xs font-semibold">Webhook reapontado agora.</p>}
          {r.conexao !== "viva" && r.detalheConexao && <p className="mt-1 break-words font-mono text-[11px] opacity-80">Resposta da conexão: {r.detalheConexao}</p>}
          {r.conclusao.refazer && (
            <button onClick={aoRefazer} className={`${botao} mt-2 bg-amber-600 text-white hover:bg-amber-700`}>
              <RefreshCw size={13} /> Refazer do zero
            </button>
          )}
        </div>
      )}

      {fase === "falhou" && (
        <div ref={fimRef} role="status" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          O CRM não respondeu ao teste três vezes seguidas. Recarregue a página e tente de novo; se continuar, use &quot;Diagnosticar conexão&quot;.
        </div>
      )}
    </div>
  );
}
