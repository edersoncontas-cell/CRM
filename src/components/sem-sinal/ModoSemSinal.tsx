"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WifiOff, Wifi, CalendarPlus, Handshake, Loader2, AlertTriangle, CloudUpload, ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import { useSemSinal, useOnline, useSincroniaAutomatica } from "@/components/sem-sinal/useSemSinal";
import { FormVisitaSemSinal, FormNegociacaoSemSinal } from "@/components/sem-sinal/FormulariosSemSinal";
import { VisitasSemSinal, ClientesSemSinal, FunilSemSinal, PendentesSemSinal } from "@/components/sem-sinal/ListasSemSinal";
import type { ClienteEscolhido } from "@/components/sem-sinal/SeletorClienteSemSinal";
import { guardarRegistros, pedirArmazenamentoPersistente } from "@/lib/sem-sinal-local";
import { sincronizar, tentarDeNovo, descartar, prepararModoSemSinal, modoSemSinalGuardado } from "@/lib/sem-sinal-sincronia";
import { aplicarPendentes, contarFila, diaBrasilia, novoId, novoRegistro, type OperacaoSemSinal, type VisitaVista } from "@/lib/sem-sinal-regra";
import { COOKIE_TEMA, modoValido } from "@/lib/tema";
import { cn } from "@/lib/utils";

// A TELA DO MODO SEM SINAL.
//
// Abre sozinha quando o CRM é aberto sem internet (o service worker desvia
// para cá — src/app/sw.js/route.ts) e também pelo menu. Não depende do
// servidor para nada: lê o que está guardado no aparelho e guarda o que o
// vendedor fizer. Quando o sinal volta, sobe tudo sozinha.
//
// Os quatro estados: carregando (lendo o aparelho), erro (o aparelho não
// deixa guardar), vazio (nunca baixou nada aqui) e o normal.

type Aba = "visitas" | "clientes" | "funil" | "pendentes";
type Painel = null | { tipo: "visita" | "negociacao"; cliente?: ClienteEscolhido };

function quandoFoi(iso: string, agora: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "em data desconhecida";
  const hora = new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const dia = diaBrasilia(t);
  const hoje = diaBrasilia(agora);
  if (dia === hoje) return `hoje às ${hora}`;
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86_400_000);
  if (dias === 1) return `ontem às ${hora}`;
  return `há ${dias} dias (${dia.slice(8, 10)}/${dia.slice(5, 7)} às ${hora})`;
}

export function ModoSemSinal() {
  const { carregado, falha, pacote, fila, sinc } = useSemSinal();
  const online = useOnline();
  useSincroniaAutomatica();
  const [aba, setAba] = useState<Aba>("visitas");
  const [painel, setPainel] = useState<Painel>(null);
  const [de, setDe] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<boolean | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    // A tela pode ter vindo do cache do aparelho, montada com o tema de
    // quando foi guardada. O cookie diz o tema de agora.
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_TEMA}=([^;]*)`));
    document.documentElement.dataset.theme = modoValido(m?.[1]) === "claro" ? "light" : "dark";

    const q = new URLSearchParams(window.location.search);
    const origem = q.get("de");
    if (origem && origem.startsWith("/") && !origem.startsWith("//") && !origem.startsWith("/sem-sinal")) setDe(origem);
    const a = q.get("aba");
    if (a === "pendentes" || a === "clientes" || a === "funil") setAba(a);

    pedirArmazenamentoPersistente();
    prepararModoSemSinal();
    modoSemSinalGuardado().then(setGuardado);
    const aoResponder = (e: MessageEvent) => {
      if (e.data?.tipo === "sem-sinal-preparado") modoSemSinalGuardado().then(setGuardado);
    };
    navigator.serviceWorker?.addEventListener("message", aoResponder);
    const t = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", aoResponder);
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!recado) return;
    const t = window.setTimeout(() => setRecado(null), 6000);
    return () => window.clearTimeout(t);
  }, [recado]);

  const visao = useMemo(() => (pacote ? aplicarPendentes(pacote, fila) : null), [pacote, fila]);
  const contagem = useMemo(() => contarFila(fila), [fila]);
  const hoje = diaBrasilia(agora);

  const guardar = useCallback(async (op: OperacaoSemSinal, frase: string) => {
    await guardarRegistros([novoRegistro(op)]);
    setPainel(null);
    if (navigator.onLine !== false) {
      setRecado(`${frase} Enviando para o CRM…`);
      sincronizar({ baixar: "nunca" }).catch(() => {});
    } else {
      setRecado(`${frase} Quando o sinal voltar, vai para o CRM automaticamente.`);
    }
  }, []);

  const concluir = useCallback(async (v: VisitaVista, feita: boolean, relato: string) => {
    await guardar(
      { tipo: "visita.concluir", id: novoId(), criadaEm: new Date().toISOString(), clienteNome: v.clienteNome, visitaId: v.id, feita, relato },
      feita ? "Visita marcada como feita." : "Visita marcada como não aconteceu.",
    );
  }, [guardar]);

  const problema = sinc.ultimo?.problema ?? null;
  const pacoteAntigo = pacote ? agora - Date.parse(pacote.geradoEm) > 24 * 3_600_000 : false;

  // ── Cabeçalho (vale para todos os estados) ──
  const cabecalho = (
    <header className="mb-4">
      <div className="flex items-start gap-3">
        <div className={cn("shrink-0 rounded-xl p-2.5", online ? "bg-emerald-600 text-white" : "bg-slate-900 text-agro-400")}>
          {online ? <Wifi size={20} /> : <WifiOff size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-[var(--sobre-fundo-titulo)] sm:text-2xl">Modo sem sinal</h1>
          <p className="mt-0.5 text-sm leading-snug text-[var(--sobre-fundo-texto)]">
            {falha
              // Aparelho que não guarda nada: nenhuma frase de "já subiu" ou
              // "fica guardado" pode aparecer aqui — seria mentira.
              ? online
                ? "Com internet. Use o CRM normal — este aparelho não guarda nada para usar sem sinal."
                : "Sem internet, e este aparelho não guarda dados para usar sem sinal."
              : !online
              ? "Sem internet agora. O que você fizer aqui fica guardado neste aparelho e sobe sozinho para o CRM quando o sinal voltar."
              : sinc.rodando
                ? "Com internet — conversando com o CRM…"
                : contagem.pendentes > 0
                  ? `Com internet. ${contagem.pendentes} ${contagem.pendentes === 1 ? "registro esperando" : "registros esperando"} para subir.`
                  : contagem.erros > 0
                    ? `Com internet. ${contagem.erros === 1 ? "1 registro não subiu" : `${contagem.erros} registros não subiram`} — veja em Pendentes.`
                    : "Com internet. Tudo o que foi feito aqui já subiu para o CRM."}
          </p>
          {pacote && (
            <p className={cn("mt-1 text-xs", pacoteAntigo ? "font-semibold text-amber-500" : "text-[var(--sobre-fundo-mudo)]")}>
              Dados baixados {quandoFoi(pacote.geradoEm, agora)}
              {pacoteAntigo && " — abra com internet para atualizar"}.
            </p>
          )}
          {!falha && online && problema && problema.tipo !== "rede" && !sinc.rodando && (
            <p className="mt-1 flex items-start gap-1 text-xs font-semibold text-amber-500">
              <AlertTriangle size={13} className="mt-px shrink-0" /> {problema.motivo}
              {problema.tipo === "sessao" && <a href="/login" className="ml-1 underline">Entrar</a>}
            </p>
          )}
          {guardado === false && (
            <p className="mt-1 text-xs font-semibold text-amber-500">
              Esta tela ainda não ficou guardada no aparelho para abrir sem internet{online ? " — guardando agora." : "."}
            </p>
          )}
          {guardado === true && online && !falha && (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--sobre-fundo-mudo)]">
              <CheckCircle2 size={12} className="text-emerald-500" /> Pronto para abrir sem internet neste aparelho.
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {online && !falha && (
          <button
            type="button"
            onClick={() => sincronizar({ baixar: "sempre" }).catch(() => {})}
            disabled={sinc.rodando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--menu-borda)] bg-[var(--menu-fundo)] px-3 py-2 text-xs font-semibold text-[var(--menu-texto)] disabled:opacity-60"
          >
            {sinc.rodando ? <Loader2 size={14} className="animate-spin" /> : contagem.pendentes ? <CloudUpload size={14} /> : <RefreshCw size={14} />}
            {contagem.pendentes ? `Enviar agora (${contagem.pendentes})` : "Baixar de novo"}
          </button>
        )}
        {online && (
          <a href={de ?? "/dashboard"} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--menu-borda)] bg-[var(--menu-fundo)] px-3 py-2 text-xs font-semibold text-[var(--menu-texto)]">
            <ArrowLeft size={14} /> Voltar ao CRM
          </a>
        )}
      </div>
    </header>
  );

  const moldura = (conteudo: React.ReactNode) => (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-16 sm:px-6" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      {cabecalho}
      {conteudo}
    </main>
  );

  if (!carregado) {
    return moldura(
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <Loader2 size={16} className="animate-spin" /> Abrindo o que está guardado no aparelho…
      </div>,
    );
  }

  if (falha) {
    return moldura(
      <div className="rounded-2xl border border-red-200 bg-white p-5 text-slate-800">
        <div className="flex gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
          <div className="min-w-0 text-sm">
            <div className="font-semibold text-red-700">Este aparelho não deixou o CRM guardar dados.</div>
            <p className="mt-1 break-words text-slate-600">Motivo: {falha.replace(/\.+$/, "")}.</p>
            <p className="mt-1 text-slate-500">Acontece em aba anônima ou com o armazenamento cheio. Abra o CRM pelo app instalado na tela inicial.</p>
          </div>
        </div>
      </div>,
    );
  }

  if (!pacote || !visao) {
    return moldura(
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-800">
        <p className="font-semibold text-slate-700">Nada baixado neste aparelho ainda</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {online
            ? sinc.rodando ? "Baixando as visitas, os clientes e o funil…" : "Toque em “Baixar de novo” acima para guardar as visitas, os clientes e o funil."
            : "Abra o CRM uma vez com internet: ele guarda sozinho as visitas, os clientes e o funil para usar sem sinal."}
        </p>
        {contagem.pendentes > 0 && <p className="mt-2 text-sm font-semibold text-amber-700">{contagem.pendentes} registro(s) feitos aqui esperando para subir.</p>}
      </div>,
    );
  }

  const abas: { id: Aba; rotulo: string; n?: number }[] = [
    { id: "visitas", rotulo: "Visitas" },
    { id: "clientes", rotulo: "Clientes" },
    { id: "funil", rotulo: "Funil" },
    { id: "pendentes", rotulo: "Pendentes", n: contagem.pendentes + contagem.erros },
  ];

  return moldura(
    <>
      {recado && (
        <div role="status" className="mb-3 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow">{recado}</div>
      )}

      {painel?.tipo === "visita" ? (
        <FormVisitaSemSinal
          clientes={visao.clientes}
          municipios={pacote.municipios}
          hoje={hoje}
          clienteInicial={painel.cliente}
          onFechar={() => setPainel(null)}
          onSalvar={(op) => guardar(op, "Visita guardada.")}
        />
      ) : painel?.tipo === "negociacao" ? (
        <FormNegociacaoSemSinal
          clientes={visao.clientes}
          colunas={pacote.colunas}
          maquinas={pacote.maquinas}
          clienteInicial={painel.cliente}
          onFechar={() => setPainel(null)}
          onSalvar={(op) => guardar(op, "Negociação guardada.")}
        />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPainel({ tipo: "visita" })} className="flex items-center justify-center gap-2 rounded-xl bg-agro-400 px-3 py-3 text-sm font-bold text-slate-900 shadow-sm">
              <CalendarPlus size={17} /> Agendar visita
            </button>
            <button type="button" onClick={() => setPainel({ tipo: "negociacao" })} className="flex items-center justify-center gap-2 rounded-xl bg-agro-400 px-3 py-3 text-sm font-bold text-slate-900 shadow-sm">
              <Handshake size={17} /> Nova negociação
            </button>
          </div>

          <nav className="mb-3 grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Seções">
            {abas.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                aria-current={aba === a.id ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-1 py-2 text-xs font-semibold sm:text-sm",
                  aba === a.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {a.rotulo}
                {!!a.n && (
                  <span className={cn("ml-1 inline-flex min-w-[1.1rem] justify-center rounded-full px-1 text-[10px] font-bold", contagem.erros ? "bg-red-600 text-white" : "bg-amber-400 text-slate-900")}>
                    {a.n}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {aba === "visitas" && <VisitasSemSinal visitas={visao.visitas} hoje={hoje} onConcluir={concluir} onAgendar={() => setPainel({ tipo: "visita" })} />}
          {aba === "clientes" && (
            <ClientesSemSinal
              clientes={visao.clientes}
              total={Math.max(pacote.totalClientes, visao.clientes.length)}
              onVisita={(c) => setPainel({ tipo: "visita", cliente: c })}
              onNegociacao={(c) => setPainel({ tipo: "negociacao", cliente: c })}
            />
          )}
          {aba === "funil" && <FunilSemSinal negociacoes={visao.negociacoes} colunas={pacote.colunas} onNova={() => setPainel({ tipo: "negociacao" })} />}
          {aba === "pendentes" && (
            <PendentesSemSinal
              fila={fila}
              onTentar={(r) => { tentarDeNovo(r).then(() => { if (navigator.onLine !== false) sincronizar({ baixar: "nunca" }).catch(() => {}); }).catch(() => {}); }}
              onDescartar={(r) => {
                if (window.confirm("Descartar? O que foi feito aqui não vai para o CRM.")) descartar(r).catch(() => {});
              }}
            />
          )}
        </>
      )}
    </>,
  );
}
