"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WifiOff, Wifi, CalendarPlus, Handshake, Loader2, AlertTriangle, CloudUpload, ArrowLeft, RefreshCw, CheckCircle2, History } from "lucide-react";
import { useSemSinal, useOnline, useSincroniaAutomatica } from "@/components/sem-sinal/useSemSinal";
import { FormVisitaSemSinal, FormNegociacaoSemSinal } from "@/components/sem-sinal/FormulariosSemSinal";
import { VisitasSemSinal, ClientesSemSinal, FunilSemSinal, PendentesSemSinal } from "@/components/sem-sinal/ListasSemSinal";
import type { ClienteEscolhido } from "@/components/sem-sinal/SeletorClienteSemSinal";
import { guardarRegistros, pedirArmazenamentoPersistente } from "@/lib/sem-sinal-local";
import { sincronizar, tentarDeNovo, descartar, prepararModoSemSinal, modoSemSinalGuardado, telasGuardadas } from "@/lib/sem-sinal-sincronia";
import { quandoFoi, horaCurta, avisoDoDesvio, nomeDaTela, TELAS_PRINCIPAIS, type TelaGuardada } from "@/lib/sem-sinal-telas";
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
//
// As OUTRAS telas do CRM (Dashboard, Negociações, Clientes…) abrem sem sinal
// como cópia para ler (lib/sem-sinal-telas.ts); a faixa "Telas guardadas"
// daqui leva a elas, e o aviso do topo diz por que uma tela veio parar aqui.

type Aba = "visitas" | "clientes" | "funil" | "pendentes";
type Painel = null | { tipo: "visita" | "negociacao"; cliente?: ClienteEscolhido };

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
  // undefined = lendo; null = o aparelho não deixa ler o cache.
  const [telas, setTelas] = useState<TelaGuardada[] | null | undefined>(undefined);
  const [falhaPreparo, setFalhaPreparo] = useState<string | null>(null);
  const [falhasTelas, setFalhasTelas] = useState<string[]>([]);
  const [desvio, setDesvio] = useState<string | null>(null);

  useEffect(() => {
    // A tela pode ter vindo do cache do aparelho, montada com o tema de
    // quando foi guardada. O cookie diz o tema de agora.
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_TEMA}=([^;]*)`));
    document.documentElement.dataset.theme = modoValido(m?.[1]) === "claro" ? "light" : "dark";

    const q = new URLSearchParams(window.location.search);
    const origem = q.get("de");
    const deValido = origem && origem.startsWith("/") && !origem.startsWith("//") && !origem.startsWith("/sem-sinal") ? origem : null;
    if (deValido) setDe(deValido);
    setDesvio(avisoDoDesvio(q.get("motivo"), deValido));
    const a = q.get("aba");
    if (a === "pendentes" || a === "clientes" || a === "funil") setAba(a);

    pedirArmazenamentoPersistente();
    prepararModoSemSinal();
    modoSemSinalGuardado().then(setGuardado);
    telasGuardadas().then(setTelas);
    const aoResponder = (e: MessageEvent) => {
      if (e.data?.tipo === "sem-sinal-preparado") {
        // Falhou: a tela diz o motivo em vez de "guardando agora" para sempre.
        setFalhaPreparo(e.data.ok === false ? String(e.data.motivo ?? "motivo desconhecido") : null);
        modoSemSinalGuardado().then(setGuardado);
      }
      if (e.data?.tipo === "telas-guardadas") {
        // O worker diz "/alertas: motivo"; para ele, o nome do menu.
        setFalhasTelas(Array.isArray(e.data.falhas) ? e.data.falhas.map((f: unknown) => {
          const [caminho, ...resto] = String(f).split(": ");
          return resto.length ? `${nomeDaTela(caminho)}: ${resto.join(": ")}` : String(f);
        }) : []);
        telasGuardadas().then(setTelas);
      }
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
              {falhaPreparo
                ? `Esta tela não ficou guardada no aparelho para abrir sem internet: ${falhaPreparo.replace(/\.+$/, "")}.`
                : `Esta tela ainda não ficou guardada no aparelho para abrir sem internet${online ? " — guardando agora." : "."}`}
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
        {/* Sem internet também: a tela de onde ele veio abre da cópia (ou
            volta para cá dizendo que não tem cópia). */}
        <a href={de ?? "/dashboard"} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--menu-borda)] bg-[var(--menu-fundo)] px-3 py-2 text-xs font-semibold text-[var(--menu-texto)]">
          <ArrowLeft size={14} /> Voltar ao CRM
        </a>
      </div>
    </header>
  );

  // ── As outras telas do CRM guardadas neste aparelho (cópia para ler) ──
  const faixaTelas = (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-sm" aria-label="Telas guardadas">
      {desvio && (
        <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800">
          <AlertTriangle size={13} className="mt-px shrink-0" /> {desvio}
        </p>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><History size={15} className="text-slate-500" /> Telas guardadas, para ler</h2>
        {telas && telas.length > 0 && <span className="shrink-0 text-[11px] text-slate-500">{telas.length}</span>}
      </div>
      {telas === undefined ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" /> Conferindo o que está guardado…</p>
      ) : telas === null ? (
        <p className="mt-1.5 text-xs font-semibold text-red-700">Este aparelho não deixa ler as telas guardadas (aba anônima ou armazenamento bloqueado).</p>
      ) : telas.length === 0 ? (
        <p className="mt-1.5 text-xs leading-snug text-slate-500">
          Nenhuma ainda. Com internet, o CRM guarda sozinho {TELAS_PRINCIPAIS.length} telas principais (Dashboard, Negociações, Visitas, Clientes, Alertas e Demandas) e toda tela que você abrir.
        </p>
      ) : (
        <>
          {/* 3 linhas e meia: a meia linha mostra que há mais para rolar. */}
          <div className="mt-2 flex max-h-[8.4rem] flex-wrap gap-1.5 overflow-y-auto">
            {telas.map((t) => (
              <a key={t.caminho} href={t.caminho} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                <span className="truncate">{t.nome}</span>
                <span className="shrink-0 font-normal tabular-nums text-slate-500">{horaCurta(t.guardadaEm, agora)}</span>
              </a>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Sem internet, a tela abre como estava na hora marcada. Para agendar, concluir ou abrir negociação, use esta tela.
          </p>
        </>
      )}
      {falhasTelas.length > 0 && (
        <p className="mt-1.5 break-words text-[11px] font-semibold text-amber-700">
          Não guardou agora: {falhasTelas.slice(0, 3).join(" · ")}{falhasTelas.length > 3 ? ` (+${falhasTelas.length - 3})` : ""}.
        </p>
      )}
    </section>
  );

  const moldura = (conteudo: React.ReactNode) => (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-16 sm:px-6" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      {cabecalho}
      {faixaTelas}
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
