"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { prepararImportacaoAction } from "@/lib/whatsapp-importacao-actions";
import { DESDE_TUDO } from "@/lib/whatsapp-corte-regra";
import { cn } from "@/lib/utils";

// Puxa para o Atendimento as conversas que a Evolution guardou do celular.
//
// Duas coisas que faziam o botão "não trazer nada":
//  1. a data de corte (16/09) barrava todo o histórico — agora o vendedor
//     escolhe "tudo" ou "a partir de" qual dia quer, e o corte recua junto;
//  2. a instância não pedia o histórico completo ao celular — o preparo liga
//     isso antes de importar (vale a partir do próximo pareamento).
//
// A peneira é a mesma do webhook: grupo, telefone bloqueado e contato cujo
// nome bate no filtro (contabilidade, banco, hotel…) ficam de fora.

function diasAtras(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function ddmm(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

type Resultado = { tipo: "ok" | "aviso" | "erro"; texto: string; detalhe?: string };

export function ImportarAtendimento({ dataCorte }: { dataCorte: string | null }) {
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [modo, setModo] = useState<"tudo" | "desde">("tudo");
  const [desde, setDesde] = useState(dataCorte ?? diasAtras(30));
  const router = useRouter();

  const tudo = modo === "tudo";

  async function importar() {
    if (!tudo && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) { setResultado({ tipo: "erro", texto: "Escolha o dia a partir do qual importar." }); return; }
    const recuaCorte = !!dataCorte && (tudo || desde < dataCorte);
    const filtro = "Grupos e contatos que batem no filtro (contabilidade, banco, hotel…) ficam de fora; conversas que você apagou à mão não voltam.";
    const pergunta = tudo
      ? `Importar TODAS as conversas que estão no celular?\n\n${recuaCorte ? `A data de corte (${ddmm(dataCorte!)}) deixa de existir. ` : ""}${filtro}\n\nPode levar vários minutos — deixe a tela aberta.`
      : recuaCorte
      ? `Importar as conversas do celular a partir de ${ddmm(desde)}?\n\nA data de corte (${ddmm(dataCorte!)}) vai recuar para ${ddmm(desde)}. ${filtro}`
      : `Importar as conversas do celular a partir de ${ddmm(desde)}? ${filtro} Pode levar 1-2 minutos.`;
    if (!confirm(pergunta)) return;

    setRodando(true);
    setResultado(null);
    setProgresso("Preparando a conexão…");

    // 1) Liga o histórico completo na instância e vê se a Evolution tem algo.
    const preparo = await prepararImportacaoAction().catch(() => null);
    const historicoLigadoAgora = preparo?.historico?.ok === true && preparo.historico.jaEstava === false;
    if (preparo && preparo.conversasGuardadas === 0) {
      setRodando(false);
      setProgresso(null);
      setResultado({
        tipo: "aviso",
        texto: "A Evolution ainda não tem nenhuma conversa guardada — o celular só manda o histórico na hora de parear.",
        detalhe: `${historicoLigadoAgora ? "Acabei de ligar o histórico completo na instância. " : ""}Clique em Desconectar lá em cima, leia o QR de novo, espere 1–2 minutos e volte aqui para importar.`,
      });
      return;
    }
    const totalChats = preparo?.conversasGuardadas ?? 0;

    // 2) Importa em lotes. Com "tudo", vai fundo em cada conversa e até o fim
    //    da lista (o guarda só evita loop infinito: 400 lotes × 5 = 2000 chats).
    let page = 1, chats = 0, msgs = 0, criadas = 0, semNada = 0, bloqueados = 0, more = true, guard = 0;
    while (more && guard < 400) {
      guard++;
      const r = await fetch("/api/whatsapp/import-history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, pageSize: 5, messagesPerChat: tudo ? 5000 : 300, desde: tudo ? DESDE_TUDO : desde }),
      }).then((res) => res.json()).catch(() => null);
      if (!r?.ok) {
        setResultado({ tipo: "erro", texto: "A importação parou no meio.", detalhe: `Lote ${page}: a Evolution não respondeu ou está desconectada. O que já veio ficou salvo — pode clicar de novo, que continua de onde parou sem duplicar.` });
        setRodando(false); setProgresso(null);
        router.refresh();
        return;
      }
      chats += r.chatsProcessed; msgs += r.messagesImported; criadas += r.conversationsCreated ?? 0; semNada += r.chatsIgnoradosAntigos ?? 0; bloqueados += r.chatsBloqueados ?? 0;
      more = r.hasMore; page = r.nextPage;
      const lidas = chats + bloqueados;
      setProgresso(`Importando… ${lidas}${totalChats ? ` de ${totalChats}` : ""} conversas, ${msgs} mensagens novas`);
    }

    setRodando(false);
    setProgresso(null);
    const partes = [`${msgs} mensagem(ns) nova(s) em ${chats - semNada} conversa(s)`];
    if (criadas) partes.push(`${criadas} conversa(s) nova(s) no Atendimento`);
    if (bloqueados) partes.push(`${bloqueados} contato(s) barrado(s) pelo filtro`);
    if (semNada) partes.push(tudo ? `${semNada} sem mensagem de texto` : `${semNada} sem nada desde ${ddmm(desde)}`);
    setResultado({
      tipo: msgs > 0 ? "ok" : "aviso",
      texto: msgs > 0 ? "Importação concluída." : "Nada novo para importar.",
      detalhe: partes.join(" · ") + (historicoLigadoAgora
        ? " Liguei o histórico completo na instância: para o celular mandar as conversas antigas, desconecte e leia o QR de novo uma vez."
        : msgs === 0 && chats > 0
        ? " Se no celular há conversas mais antigas que não vieram, desconecte e leia o QR de novo — é no pareamento que o celular manda o histórico."
        : ""),
    });
    router.refresh();
  }

  const opcao = (valor: "tudo" | "desde", rotulo: string) => (
    <button
      type="button"
      onClick={() => setModo(valor)}
      disabled={rodando}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-bold",
        modo === valor ? "bg-slate-900 text-agro-400" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {opcao("tudo", "Tudo o que está no celular")}
        {opcao("desde", "A partir de um dia")}
        {!tudo && (
          <input
            type="date"
            value={desde}
            max={diasAtras(0)}
            onChange={(e) => setDesde(e.target.value)}
            disabled={rodando}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400"
          />
        )}
      </div>
      <button
        onClick={importar}
        disabled={rodando}
        className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
      >
        {rodando ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
        {progresso ?? (tudo ? "Importar todas as conversas do celular" : "Importar conversas do celular")}
      </button>
      {dataCorte && !rodando && (tudo || desde < dataCorte) && (
        <p className="text-[11px] text-amber-700">
          {tudo
            ? `Existe uma data de corte (${ddmm(dataCorte)}): ao importar tudo, ela deixa de existir e o histórico inteiro passa a valer.`
            : `Antes da data de corte (${ddmm(dataCorte)}): ao importar, o corte recua para ${ddmm(desde)}.`}
        </p>
      )}
      {resultado && (
        <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
          resultado.tipo === "ok" ? "bg-green-50 text-green-800" : resultado.tipo === "aviso" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"
        }`}>
          {resultado.tipo === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <div>
            <b>{resultado.texto}</b>
            {resultado.detalhe && <div className="mt-0.5 text-xs opacity-90">{resultado.detalhe}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
