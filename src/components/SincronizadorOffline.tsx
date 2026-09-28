"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { WifiOff, CloudUpload, AlertTriangle, Loader2 } from "lucide-react";
import { useSemSinal, useOnline, useSincroniaAutomatica } from "@/components/sem-sinal/useSemSinal";
import { prepararModoSemSinal, PAGINA_SEM_SINAL } from "@/lib/sem-sinal-sincronia";
import { pedirArmazenamentoPersistente } from "@/lib/sem-sinal-local";
import { contarFila } from "@/lib/sem-sinal-regra";

// Em TODA tela do CRM (layout do grupo app):
//  - pede ao service worker para guardar a tela do modo sem sinal;
//  - baixa o pacote (no máximo a cada 30 min) e sobe o que ficou pendente;
//  - mostra um aviso pequeno quando a internet cai ("abrir modo sem sinal")
//    ou quando há registro feito sem sinal que ainda não subiu.
// Sem nada disso, ele só descobriria o modo sem sinal sem internet — que é
// justamente quando não daria mais para baixar nada.
export function SincronizadorOffline() {
  const online = useOnline();
  const { fila, sinc } = useSemSinal();
  useSincroniaAutomatica();
  const caminho = usePathname();
  const c = useMemo(() => contarFila(fila), [fila]);

  useEffect(() => {
    prepararModoSemSinal();
    pedirArmazenamentoPersistente();
  }, []);

  const destino = (aba?: string) => `${PAGINA_SEM_SINAL}?de=${encodeURIComponent(caminho ?? "/dashboard")}${aba ? `&aba=${aba}` : ""}`;

  // No Atendimento o rodapé é a caixa de mensagem do WhatsApp: ali só o aviso
  // de sem internet aparece (sem rede ela não envia mesmo). Pendente e recusa
  // esperam a próxima tela — ficam também na aba Pendentes do modo sem sinal.
  const discreto = Boolean(caminho?.startsWith("/atendimento"));

  let conteudo: React.ReactNode = null;
  if (!online) {
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
      <div className="pointer-events-auto max-w-full">{conteudo}</div>
    </div>
  );
}
