"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { WifiOff, CloudUpload, AlertTriangle, Loader2, History, RefreshCw } from "lucide-react";
import { useSemSinal, useOnline, useSincroniaAutomatica } from "@/components/sem-sinal/useSemSinal";
import { prepararModoSemSinal, guardarTelaAtual, avisarTelasMudaram, vigiarAcoesQueGravam, PAGINA_SEM_SINAL } from "@/lib/sem-sinal-sincronia";
import { pedirArmazenamentoPersistente } from "@/lib/sem-sinal-local";
import { contarFila } from "@/lib/sem-sinal-regra";
import { ehCopia, quandoFoi } from "@/lib/sem-sinal-telas";

// Espera a tela aberta terminar de carregar antes de pedir a cópia dela: o
// pedido monta a tela de novo no servidor, e não pode disputar com a de agora.
const ESPERA_COPIA_MS = 4000;

// Em TODA tela do CRM (layout do grupo app):
//  - pede ao service worker para guardar a tela do modo sem sinal e as
//    cópias das telas principais (e da tela aberta, para ler sem sinal);
//  - baixa o pacote (no máximo a cada 30 min) e sobe o que ficou pendente;
//  - mostra um aviso pequeno quando a internet cai, quando a tela é a CÓPIA
//    guardada (e de quando ela é), ou quando há registro feito sem sinal que
//    ainda não subiu.
// Sem nada disso, ele só descobriria o modo sem sinal sem internet — que é
// justamente quando não daria mais para baixar nada.
export function SincronizadorOffline({ renderizadoEm }: { renderizadoEm: number }) {
  const online = useOnline();
  const { fila, sinc } = useSemSinal();
  useSincroniaAutomatica();
  const caminho = usePathname();
  const c = useMemo(() => contarFila(fila), [fila]);
  // Cópia: a tela foi montada no servidor bem antes de o aparelho abri-la —
  // veio do cache do aparelho, não da internet. Decide uma vez, ao abrir.
  const [copia, setCopia] = useState<number | null>(null);

  useEffect(() => {
    const aberto = typeof performance !== "undefined" && performance.timeOrigin ? performance.timeOrigin : Date.now();
    if (ehCopia(renderizadoEm, aberto)) setCopia(renderizadoEm);
    // Só na abertura: numa troca de tela por dentro do app o layout não é
    // montado de novo, e num "atualizar" a hora nova não é de cópia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    prepararModoSemSinal();
    pedirArmazenamentoPersistente();
    // App que volta do fundo (celular) não recarrega: renova as cópias ao
    // voltar para a tela. O worker só refaz o que tiver mais de uma hora.
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) prepararModoSemSinal();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    // Ação que gravou (card arrastado, negociação nova): as cópias ficaram
    // velhas — o worker as renova logo, e não na hora cheia. Ele pode sair
    // do sinal em seguida.
    const pararDeVigiar = vigiarAcoesQueGravam(window, () => avisarTelasMudaram([window.location.pathname]));
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      pararDeVigiar();
    };
  }, []);

  // A tela aberta por dentro do app vira cópia também (a ficha do cliente
  // que ele viu de manhã abre sem sinal à tarde).
  useEffect(() => {
    if (copia || !caminho || !online) return;
    const t = window.setTimeout(() => guardarTelaAtual(window.location.pathname, window.location.search), ESPERA_COPIA_MS);
    return () => window.clearTimeout(t);
  }, [caminho, copia, online]);

  // Subiu o que foi feito sem sinal: a tela aberta (montada antes) ainda não
  // tem. Remonta com os dados de agora — a negociação que estava à parte em
  // "Feitas sem sinal" passa para o funil. Na cópia não: ali a faixa oferece
  // "Atualizar", e recarregar sozinho tiraria a tela de quem está lendo.
  const router = useRouter();
  const vistaAoAbrir = useRef(sinc.ultimo?.quando ?? 0);
  const ultimaSubida = sinc.ultimo && sinc.ultimo.enviadas > 0 ? sinc.ultimo.quando : 0;
  useEffect(() => {
    if (!ultimaSubida || ultimaSubida <= vistaAoAbrir.current || copia) return;
    vistaAoAbrir.current = ultimaSubida;
    router.refresh();
  }, [ultimaSubida, copia, router]);

  const destino = (aba?: string) => `${PAGINA_SEM_SINAL}?de=${encodeURIComponent(caminho ?? "/dashboard")}${aba ? `&aba=${aba}` : ""}`;

  // No Atendimento o rodapé é a caixa de mensagem do WhatsApp: ali só o aviso
  // de sem internet aparece (sem rede ela não envia mesmo). Pendente e recusa
  // esperam a próxima tela — ficam também na aba Pendentes do modo sem sinal.
  const discreto = Boolean(caminho?.startsWith("/atendimento"));

  let conteudo: React.ReactNode = null;
  if (copia && !online) {
    conteudo = (
      <a href={destino()} className="flex items-start gap-2 rounded-2xl bg-slate-900 px-3.5 py-2 text-xs font-semibold leading-snug text-white shadow-lg ring-1 ring-white/10">
        <History size={14} className="mt-px shrink-0 text-agro-400" />
        <span>
          Sem internet · esta tela é a cópia guardada {quandoFoi(copia, Date.now())}, só para ler.{" "}
          <span className="underline">Registrar pelo modo sem sinal</span>
        </span>
      </a>
    );
  } else if (copia) {
    // Com internet e ainda assim cópia: o sinal voltou depois de abrir, ou o
    // CRM não respondeu a tempo (banco acordando, sinal fraco). Atualizar
    // tenta a tela de agora.
    conteudo = (
      <button type="button" onClick={() => window.location.reload()} className="flex items-start gap-2 rounded-2xl bg-amber-400 px-3.5 py-2 text-left text-xs font-semibold leading-snug text-slate-900 shadow-lg">
        <History size={14} className="mt-px shrink-0" />
        <span>
          Esta tela é a cópia guardada {quandoFoi(copia, Date.now())} e pode estar desatualizada.{" "}
          <span className="inline-flex items-center gap-1 underline"><RefreshCw size={12} /> Atualizar</span>
        </span>
      </button>
    );
  } else if (!online) {
    conteudo = (
      <a href={destino()} className="flex items-center gap-2 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/10">
        <WifiOff size={14} className="text-agro-400" /> Sem internet · <span className="underline">abrir modo sem sinal</span>
      </a>
    );
  } else if (discreto) {
    conteudo = null;
  } else if (c.erros > 0) {
    conteudo = (
      <a href={destino("pendentes")} className="flex items-center gap-2 rounded-full bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
        <AlertTriangle size={14} /> {c.erros === 1 ? "1 registro feito sem sinal não subiu" : `${c.erros} registros feitos sem sinal não subiram`} · <span className="underline">ver</span>
      </a>
    );
  } else if (c.pendentes > 0) {
    conteudo = (
      <a href={destino("pendentes")} className="flex items-center gap-2 rounded-full bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-900 shadow-lg">
        {sinc.rodando ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />}
        {sinc.rodando ? "Subindo" : "Esperando para subir:"} {c.pendentes} {c.pendentes === 1 ? "registro feito sem sinal" : "registros feitos sem sinal"}
      </a>
    );
  }

  if (!conteudo) return null;
  return (
    <div
      // z-[90]: acima do rodapé (z-40), ABAIXO das janelas (z-[100]) — por
      // cima de uma janela aberta, cobriria o botão de salvar dela.
      className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4 print:hidden"
      style={{ bottom: "calc(var(--rodape-mercado, 30px) + 12px + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto max-w-full sm:max-w-xl">{conteudo}</div>
    </div>
  );
}
