"use client";

// RELATÓRIO DE USO — a contagem, no navegador. Não desenha nada.
//
// Como não perde nem conta em dobro:
//   · o aparelho guarda, no localStorage, o TOTAL de cada linha (dia × hora ×
//     tela × aparelho) e a lista das linhas que mudaram desde a última
//     confirmação do servidor ("sujas");
//   · manda o total das sujas; o servidor fica com o MAIOR valor de cada
//     linha (api/uso) — mandar duas vezes não soma duas vezes;
//   · só limpa a sujeira quando o servidor diz "ok" — se a aba fechar no
//     meio, se faltar sinal, se o banco cair, vai tudo na próxima vez.
// (A primeira versão tirava da fila antes de mandar e perdia a contagem de
// toda tela recarregada: o envio "de saída" não chega quando a página morre.)
//
// Nada aqui pode atrapalhar a tela: todo erro é engolido — o pior caso é não
// contar. Regras do que conta: lib/uso-regra.ts.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { TODOS_HREFS } from "@/lib/menu";
import {
  TELA_ENTRADA, PAUSA_NOVA_ENTRADA_MS, MAX_ITENS_ENVIO, DIAS_ACEITOS_ATRAS, chaveItem, diaHoraBrasilia, telaDoCaminho, somarDias,
  type Aparelho, type ItemUso,
} from "@/lib/uso-regra";

const CHAVE_TOTAIS = "crm.uso.totais.v1";
const CHAVE_SUJAS = "crm.uso.sujas.v1";
const CHAVE_DISPOSITIVO = "crm.uso.dispositivo";
const CHAVE_ULTIMA = "crm.uso.ultimaAtividade";
const TIQUE_MS = 15_000;               // de quanto em quanto o tempo na tela é somado
const PARADO_MS = 5 * 60 * 1000;       // sem toque/tecla/rolagem há 5 min: o tempo para de contar
const ENVIO_MS = 5 * 60 * 1000;        // manda a cada 5 min, só com a tela à vista (e ao esconder)

type Totais = Record<string, ItemUso>;

// Sem localStorage (aba anônima travada): segue só na memória desta página.
const memoria: Record<string, string> = {};
function ler(chave: string): string | null {
  try { return localStorage.getItem(chave); } catch { return memoria[chave] ?? null; }
}
function gravar(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { memoria[chave] = valor; }
}
function lerJson<T>(chave: string, vazio: T): T {
  try { const v = JSON.parse(ler(chave) ?? "null"); return v && typeof v === "object" ? (v as T) : vazio; } catch { return vazio; }
}

function dispositivo(): string {
  let id = ler(CHAVE_DISPOSITIVO);
  if (!id || !/^[a-z0-9]{8,24}$/.test(id)) {
    id = (Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^a-z0-9]/g, "").slice(0, 16).padEnd(8, "0");
    gravar(CHAVE_DISPOSITIVO, id);
  }
  return id;
}

function aparelhoAtual(): Aparelho {
  try {
    return window.matchMedia("(max-width: 767px)").matches || window.matchMedia("(pointer: coarse)").matches ? "celular" : "pc";
  } catch { return "pc"; }
}

/** Soma na linha da hora atual. Lê e grava direto no localStorage: duas abas não se atropelam. */
function somar(tela: string, aberturas: number, segundos: number) {
  const { dia, hora } = diaHoraBrasilia(Date.now());
  const base: ItemUso = { dia, hora, tela, aparelho: aparelhoAtual(), dispositivo: dispositivo(), aberturas: 0, segundos: 0 };
  const k = chaveItem(base);
  const totais = lerJson<Totais>(CHAVE_TOTAIS, {});
  const linha = totais[k] ?? base;
  linha.aberturas += aberturas;
  linha.segundos = Math.min(3_600, linha.segundos + segundos);
  totais[k] = linha;
  gravar(CHAVE_TOTAIS, JSON.stringify(totais));
  const sujas = new Set(lerJson<string[]>(CHAVE_SUJAS, []));
  sujas.add(k);
  gravar(CHAVE_SUJAS, JSON.stringify([...sujas]));
}

/** Tira do aparelho o que o servidor já não aceitaria mais (velho demais). */
function podar() {
  const limite = somarDias(diaHoraBrasilia(Date.now()).dia, -DIAS_ACEITOS_ATRAS);
  const totais = lerJson<Totais>(CHAVE_TOTAIS, {});
  let mudou = false;
  for (const [k, v] of Object.entries(totais)) if (!v?.dia || v.dia < limite) { delete totais[k]; mudou = true; }
  if (!mudou) return;
  gravar(CHAVE_TOTAIS, JSON.stringify(totais));
  gravar(CHAVE_SUJAS, JSON.stringify(lerJson<string[]>(CHAVE_SUJAS, []).filter((k) => k in totais)));
}

/** "Entrei no CRM": voltar depois de 30 min sem ele na tela. */
function conferirEntrada() {
  const agora = Date.now();
  if (agora - (Number(ler(CHAVE_ULTIMA)) || 0) > PAUSA_NOVA_ENTRADA_MS) somar(TELA_ENTRADA, 1, 0);
  gravar(CHAVE_ULTIMA, String(agora));
}

let enviando = false;
async function enviar(saindo = false) {
  if (enviando) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const totais = lerJson<Totais>(CHAVE_TOTAIS, {});
  const sujas = lerJson<string[]>(CHAVE_SUJAS, []).filter((k) => totais[k]).slice(0, MAX_ITENS_ENVIO);
  if (!sujas.length) return;
  const lote = sujas.map((k) => ({ ...totais[k] }));
  enviando = true;
  try {
    const r = await fetch("/api/uso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: lote }),
      keepalive: saindo,
    });
    if (!r.ok) return;
    // Confirmado: limpa só a linha que não mudou enquanto ia (a que mudou
    // continua suja e vai, com o total novo, na próxima).
    const agora = lerJson<Totais>(CHAVE_TOTAIS, {});
    const enviado = new Map(lote.map((i) => [chaveItem(i), i]));
    const restam = lerJson<string[]>(CHAVE_SUJAS, []).filter((k) => {
      const foi = enviado.get(k), ja = agora[k];
      return !foi || !ja || ja.aberturas !== foi.aberturas || ja.segundos !== foi.segundos;
    });
    gravar(CHAVE_SUJAS, JSON.stringify(restam));
  } catch { /* sem sinal / página fechando: fica sujo, vai depois */ }
  finally { enviando = false; }
}

export function RegistroDeUso() {
  const pathname = usePathname();
  const tela = useRef<string | null>(null);
  const ultimaInteracao = useRef(Date.now());

  // Cada tela que aparece: uma abertura.
  useEffect(() => {
    const t = telaDoCaminho(pathname ?? "", TODOS_HREFS);
    tela.current = t;
    if (!t) return;
    try { conferirEntrada(); somar(t, 1, 0); } catch { /* nunca atrapalha a tela */ }
  }, [pathname]);

  useEffect(() => {
    const mexeu = () => {
      const antes = ultimaInteracao.current;
      ultimaInteracao.current = Date.now();
      // Parado com a tela aberta mais de 30 min e voltou a mexer: nova entrada.
      if (Date.now() - antes > PAUSA_NOVA_ENTRADA_MS) { try { conferirEntrada(); } catch { /* idem */ } }
    };
    const tique = () => {
      try {
        if (!tela.current || Date.now() - ultimaInteracao.current > PARADO_MS) return;
        somar(tela.current, 0, TIQUE_MS / 1000);
        gravar(CHAVE_ULTIMA, String(Date.now()));
      } catch { /* idem */ }
    };
    const visibilidade = () => {
      try {
        if (document.visibilityState === "hidden") { void enviar(true); return; }
        ultimaInteracao.current = Date.now();
        conferirEntrada();
      } catch { /* idem */ }
    };
    const saindo = () => { void enviar(true); };

    try { podar(); } catch { /* idem */ }
    const eventos = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const e of eventos) window.addEventListener(e, mexeu, { passive: true, capture: true });
    document.addEventListener("visibilitychange", visibilidade);
    window.addEventListener("pagehide", saindo);
    // Os dois só agem com a tela à vista: aba esquecida não acorda o banco
    // (tests/consumo-invocacoes.test.ts).
    const t1 = window.setInterval(() => { if (document.visibilityState === "visible") tique(); }, TIQUE_MS);
    const t2 = window.setInterval(() => { if (document.visibilityState === "visible") void enviar(); }, ENVIO_MS);
    // O que ficou de outra vez (página recarregada, sem sinal, banco fora) sobe logo.
    const t3 = window.setTimeout(() => { void enviar(); }, 5_000);
    return () => {
      for (const e of eventos) window.removeEventListener(e, mexeu, { capture: true });
      document.removeEventListener("visibilitychange", visibilidade);
      window.removeEventListener("pagehide", saindo);
      window.clearInterval(t1); window.clearInterval(t2); window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
