"use client";

// O grafo do Cérebro: cada sessão do CRM é um neurônio. Duas camadas de
// sinapse — as que vão até o centro (a sessão mandando o que aconteceu) e
// as que ligam uma sessão à outra (o caminho real do dado dentro do CRM,
// ver LIGACOES). Pulsos correm o tempo todo nas duas, é a imagem de que o
// Cérebro vê tudo, analisa tudo e conecta tudo.
//
// Tocar (ou passar o mouse) num nó acende aquela sinapse e as ligações
// dela, abre os sub-nós da sessão e mostra o que ela faz, com o atalho para
// entrar. Tudo em SVG, que fica nítido em qualquer tela e não pesa como uma
// biblioteca de grafos.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Brain } from "lucide-react";
import { CosmosFundo } from "@/components/CerebroCosmos";
import {
  LIGACOES,
  ligacoesDaSessao,
  posicoesDoGrafo,
  posicoesDosRamos,
  ROTULO_GRUPO,
  SESSOES_POR_ID,
  type SessaoCerebro,
} from "@/lib/cerebro/sessoes";

export type NoGrafo = SessaoCerebro & {
  total: number;        // número que resume a sessão (clientes, negociações…)
  rotuloTotal: string;  // o que esse número significa
};

// Qual fundo o Cérebro usa. "sinapses" é o tecido neural (o que está no ar);
// "universo" é o céu profundo com Via Láctea, constelações, estrelas cadentes
// e meteoro (ver CerebroCosmos). Trocar aqui troca o painel inteiro — as
// sessões, as ligações e a interação continuam idênticas nos dois.
const FUNDO: "sinapses" | "universo" = "sinapses";

const CEU = {
  sinapses: "radial-gradient(circle at 50% 45%, #10202b 0%, #0a1119 55%, #070d13 100%)",
  universo: "radial-gradient(circle at 50% 45%, #0b1430 0%, #060a1c 55%, #02040c 100%)",
} as const;

const CENTRO = { x: 500, y: 500 };
// Raio que as ligações entre sessões precisam contornar para não passar por
// cima do núcleo e do brilho do Cérebro.
const RAIO_LIVRE = 180;

type Ponto = { x: number; y: number };

// Curva suave do centro até o nó (uma linha reta fica dura; a curva dá a
// sensação de sinapse).
function curva(alvo: Ponto, desvio: number): string {
  const mx = (CENTRO.x + alvo.x) / 2;
  const my = (CENTRO.y + alvo.y) / 2;
  const dx = alvo.x - CENTRO.x;
  const dy = alvo.y - CENTRO.y;
  const norma = Math.hypot(dx, dy) || 1;
  // Empurra o meio da curva na perpendicular à reta centro→nó.
  const cx = mx + (-dy / norma) * desvio;
  const cy = my + (dx / norma) * desvio;
  return `M ${CENTRO.x} ${CENTRO.y} Q ${arred(cx)} ${arred(cy)} ${alvo.x} ${alvo.y}`;
}

// Curva entre DOIS NÓS (não passa pelo centro): é o que faz o desenho virar
// uma rede de verdade em vez de uma estrela.
//
// O arco abre só o TANTO QUE FALTA para escapar do núcleo: ligação entre
// vizinhos, que já passa longe do centro, fica quase reta; ligação entre
// sessões opostas, que passaria por cima do Cérebro, desvia para o lado e
// corta o miolo por dentro do anel. Abrir sempre o mesmo tanto inchava as
// curtas para fora dos nós e o grafo virava uma gaiola.
function curvaEntreNos(a: Ponto, b: Ponto): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const norma = Math.hypot(dx, dy) || 1;
  let px = -dy / norma;
  let py = dx / norma;
  // Escolhe, das duas perpendiculares, a que afasta do centro.
  if (px * (mx - CENTRO.x) + py * (my - CENTRO.y) < 0) { px = -px; py = -py; }
  // Distância do centro até a RETA a—b (não até o meio dela).
  const distReta = Math.abs(dx * (CENTRO.y - a.y) - dy * (CENTRO.x - a.x)) / norma;
  const pico = 16 + Math.max(0, RAIO_LIVRE - distReta);
  // Numa curva quadrática o desenho chega à metade do ponto de controle.
  return `M ${a.x} ${a.y} Q ${arred(mx + px * pico * 2)} ${arred(my + py * pico * 2)} ${b.x} ${b.y}`;
}

// Pseudo-aleatório determinístico para a decoração de fundo — Math.random()
// aqui faria o HTML do servidor não bater com o do cliente.
//
// CUIDADO: não dá para usar Math.sin nisto. A especificação do JavaScript
// NÃO exige que seno/cosseno deem o mesmo bit em todo motor, e o Node e o
// navegador realmente divergem na última casa (853.4480594691995 contra
// 853.4480594691612). Isso já quebrou a hidratação desta página uma vez e
// derrubou a interação inteira do grafo. Aqui só entra conta de inteiro
// (mulberry32), que é exata e igual em qualquer lugar.
function pseudoAleatorio(semente: number): number {
  let a = (Math.trunc(semente * 1000) + 0x9e3779b9) >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Todo número que vira atributo do SVG passa por aqui. Mesmo com o sorteio
// exato, seno e cosseno continuam podendo variar na última casa entre
// servidor e navegador — arredondar mata a diferença antes dela virar uma
// string diferente no HTML.
function arred(v: number): number {
  return Math.round(v * 100) / 100;
}

export function CerebroGrafo({ nos, titulo = "Cérebro" }: { nos: NoGrafo[]; titulo?: string }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const [animar, setAnimar] = useState(true);
  // Celular anda com menos pulso: o desenho inteiro passa de ~40 animações
  // de movimento para ~25, que é o que mantém o grafo liso num aparelho
  // simples sem tirar a sensação de rede viva.
  const [leve, setLeve] = useState(false);
  // No celular o navegador AINDA dispara mouseover/mouseenter fingindo ser
  // mouse antes do clique. Sem saber disso, o toque acendia a sessão no
  // mouseenter e o clique logo em seguida apagava — o dedo parecia não
  // funcionar. Ref (e não estado) porque precisa valer já no mesmo evento.
  const veioDeToque = useRef(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setAnimar(false);
    setLeve(window.innerWidth < 640);
  }, []);

  const posicoes = useMemo(() => posicoesDoGrafo(nos), [nos]);
  const porId = useMemo(() => new Map(nos.map((n) => [n.id, n])), [nos]);
  const selecionado = ativo ? porId.get(ativo) ?? null : null;

  // As sinapses entre sessões, já com posição e caminho prontos.
  const ligacoes = useMemo(() => {
    return LIGACOES.map((l, i) => {
      const a = porId.get(l.de);
      const b = porId.get(l.para);
      const pa = posicoes.get(l.de);
      const pb = posicoes.get(l.para);
      if (!a || !b || !pa || !pb) return null;
      return { id: `lig${i}`, a, b, pa, pb, d: curvaEntreNos(pa, pb), fluxo: l.fluxo };
    }).filter((l): l is NonNullable<typeof l> => l !== null);
  }, [porId, posicoes]);

  // Neurônios de fundo: corpo + dendritos ramificados, espalhados FORA do
  // anel de sessões, onde antes só sobrava preto. É o tecido em que o
  // Cérebro está mergulhado — fica bem apagado de propósito, para dar
  // profundidade sem disputar atenção com o grafo de verdade.
  // Onde o tecido NÃO pode entrar: a caixa de cada rótulo de sessão (nome +
  // linha de baixo), com folga. Sem isto, os filamentos passam por trás das
  // palavras e encostam nelas — fica sujo e atrapalha a leitura. As contas
  // aqui repetem as do desenho do rótulo mais abaixo, de propósito, para a
  // caixa cair exatamente onde o texto cai.
  const caixasRotulo = useMemo(() => {
    const FOLGA = 18;
    return nos.map((n) => {
      const p = posicoes.get(n.id);
      if (!p) return null;
      const dx = p.x - CENTRO.x;
      const dy = p.y - CENTRO.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const ancora = ux > 0.35 ? "start" : ux < -0.35 ? "end" : "middle";
      const xr = Math.min(985, Math.max(15, p.x + ux * 40 + (ancora === "start" ? 4 : ancora === "end" ? -4 : 0)));
      const yr = p.y + uy * 42 + (uy < -0.35 ? -14 : uy > 0.35 ? 22 : 6);
      // Largura estimada. Cada linha tem a SUA fonte, então cada uma tem o
      // seu peso por letra — medido no navegador: "Orientador de Vendas",
      // 20 letras na fonte 22 em negrito, ocupa 271 (13,6 por letra).
      // Antes isto era um 11,5 único para as duas linhas: subestimava o nome
      // em mais de 40 unidades, sobrava uma faixa de texto fora da caixa e
      // era exatamente ali que o filamento entrava na palavra.
      // O 1,08 é margem para o nome de letra larga (M, W) sair do meio da
      // média. Errar para mais aqui custa dois ou três filamentos de fundo;
      // errar para menos risca o texto.
      const larg = 1.08 * Math.max(n.nome.length * 13.6, n.rotuloTotal.length * 10.5);
      const x1 = ancora === "start" ? xr : ancora === "end" ? xr - larg : xr - larg / 2;
      return {
        x1: x1 - FOLGA,
        x2: x1 + larg + FOLGA,
        // -24 pega a altura da primeira linha; +20 é a segunda linha.
        y1: yr - 24 - FOLGA,
        y2: yr + 26 + FOLGA,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null);
  }, [nos, posicoes]);

  const tecido = useMemo(() => {
    // Espalha pelo RETÂNGULO do quadro (não por um círculo), senão os cantos
    // ficam vazios e o tecido não fecha. Descarta quem cair perto do miolo,
    // que é onde mora o grafo de verdade.
    // Muitos de propósito: com poucos pontos, o "vizinho mais próximo" ainda
    // é longe e o fio vira uma linha atravessando a tela. Densidade alta é o
    // que encurta os filamentos e faz virar tecido.
    const dentroDeRotulo = (x: number, y: number, margem = 0) =>
      caixasRotulo.some(
        (c) => x >= c.x1 - margem && x <= c.x2 + margem && y >= c.y1 - margem && y <= c.y2 + margem,
      );

    const alvo = leve ? 54 : 130;
    const pontos: { x: number; y: number }[] = [];
    for (let k = 0; k < 2200 && pontos.length < alvo; k++) {
      const x = arred(-100 + pseudoAleatorio(k * 1.37 + 31) * 1200);
      const y = arred(130 + pseudoAleatorio(k * 2.53 + 32) * 870);
      if (Math.hypot(x - CENTRO.x, y - CENTRO.y) < 368) continue;
      if (dentroDeRotulo(x, y)) continue;
      pontos.push({ x, y });
    }

    // Cada neurônio se liga aos dois vizinhos mais próximos: é a ligação
    // entre eles que faz o fundo virar TECIDO, e não pontos soltos.
    const vistos = new Set<string>();
    const filamentos: { d: string; cor: string }[] = [];
    pontos.forEach((p, i) => {
      const perto = pontos
        .map((q, j) => ({ j, dist: Math.hypot(q.x - p.x, q.y - p.y) }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      for (const { j, dist } of perto) {
        const chave = i < j ? `${i}-${j}` : `${j}-${i}`;
        // Fio comprido não é sinapse, é risco atravessando o quadro.
        if (vistos.has(chave) || dist > 125) continue;
        const q = pontos[j];
        // Arco de leve, para o fio não ficar com cara de régua.
        const mx = (p.x + q.x) / 2;
        const my = (p.y + q.y) / 2;
        const desvio = (pseudoAleatorio(i * 3.7 + j * 1.9 + 51) - 0.5) * 26;
        const nx = -(q.y - p.y) / (dist || 1);
        const ny = (q.x - p.x) / (dist || 1);
        const cx = mx + nx * desvio;
        const cy = my + ny * desvio;

        // O fio não pode CRUZAR um rótulo, mesmo com as duas pontas fora dele.
        // Testa a CURVA que vai ser desenhada, não a reta entre as pontas: o
        // fio é um Q (quadrática) com barriga de até 13 unidades, então a reta
        // podia passar raspando por fora da caixa enquanto a curva entrava.
        // E varre t de 0 a 1 inteiro — recortar as pontas deixava passar o fio
        // que nasce na beirada da caixa e entra na palavra.
        let cruza = false;
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const u = 1 - t;
          const bx = u * u * p.x + 2 * u * t * cx + t * t * q.x;
          const by = u * u * p.y + 2 * u * t * cy + t * t * q.y;
          if (dentroDeRotulo(bx, by)) { cruza = true; break; }
        }
        if (cruza) continue;
        vistos.add(chave);
        const n = filamentos.length;
        filamentos.push({
          d: `M ${p.x} ${p.y} Q ${arred(cx)} ${arred(cy)} ${q.x} ${q.y}`,
          cor: n % 4 === 0 ? "#a78bfa" : n % 7 === 0 ? "#34d399" : "#38bdf8",
        });
      }
    });

    // Divide em FAIXAS. Cada faixa respira (aparece e some) e tem a luz
    // correndo nas caudas dela, cada uma com o seu tempo — é o que faz o
    // tecido ficar intercalado em vez de ligar e desligar junto.
    const qtdFaixas = leve ? 6 : 11;
    const faixas = Array.from({ length: qtdFaixas }, (_, f) => ({
      fios: filamentos.filter((_, n) => n % qtdFaixas === f),
      // Bem devagar: a ida e volta inteira passa de 20 segundos.
      durRespiro: arred(21 + pseudoAleatorio(f * 5.3 + 81) * 13),
      // NEGATIVO de propósito: atraso positivo faria a faixa ficar invisível
      // até chegar a vez dela, e nos primeiros 20 e poucos segundos o fundo
      // apareceria quase vazio. Negativo já começa cada faixa num ponto
      // diferente do ciclo — todas vivas desde o primeiro quadro, e ainda
      // assim defasadas.
      atrasoRespiro: arred(-(f / qtdFaixas) * (21 + pseudoAleatorio(f * 5.3 + 81) * 13)),
      durPulso: arred(6.5 + pseudoAleatorio(f * 9.7 + 83) * 5),
      atrasoPulso: arred(-(f / qtdFaixas) * 9 - pseudoAleatorio(f * 11.3 + 84) * 4),
    }));

    const neuronios = pontos.map(({ x, y }, i) => {
      const quantos = 2 + Math.floor(pseudoAleatorio(i * 3.31 + 13) * 2);
      const giro = pseudoAleatorio(i * 7.77 + 14) * Math.PI * 2;
      const dendritos = Array.from({ length: quantos }, (_, j) => {
        const a = giro + (j / quantos) * Math.PI * 2 + (pseudoAleatorio(i * 2.13 + j * 1.7) - 0.5) * 0.8;
        // Bem curto: o que dá corpo ao fundo agora são os filamentos entre
        // os neurônios, não espetos saindo de cada um.
        const comp = 12 + pseudoAleatorio(i * 4.41 + j * 2.3) * 20;
        const curvatura = (pseudoAleatorio(i * 6.1 + j * 3.1) - 0.5) * 0.9;
        const cxd = x + Math.cos(a + curvatura) * comp * 0.6;
        const cyd = y + Math.sin(a + curvatura) * comp * 0.6;
        const fx = x + Math.cos(a) * comp;
        const fy = y + Math.sin(a) * comp;
        // O corpo do neurônio já nasce fora dos rótulos, mas o dendrito sai
        // dele em até 32 unidades e o neurônio ainda deriva ±8 — mais que a
        // folga da caixa. Sem isto, um corpo que passou raspando ainda enfia
        // uma ponta dentro da palavra. Descarta só o dendrito que entra: o
        // corpo fica, e o tecido não perde densidade.
        let entra = false;
        for (let t = 0; t <= 1.0001; t += 0.1) {
          const u = 1 - t;
          const bx = u * u * x + 2 * u * t * cxd + t * t * fx;
          const by = u * u * y + 2 * u * t * cyd + t * t * fy;
          // margem 9 = a amplitude da deriva do neurônio
          if (dentroDeRotulo(bx, by, 9)) { entra = true; break; }
        }
        if (entra) return null;
        return {
          d: `M ${x} ${y} Q ${arred(cxd)} ${arred(cyd)} ${arred(fx)} ${arred(fy)}`,
        };
      }).filter((d): d is { d: string } => d !== null);
      return {
        x, y, dendritos,
        corpo: arred(1.8 + pseudoAleatorio(i * 8.3 + 15) * 2),
        dx: arred((pseudoAleatorio(i * 10.7 + 17) - 0.5) * 16),
        dy: arred((pseudoAleatorio(i * 12.3 + 18) - 0.5) * 16),
        dur: arred(9 + pseudoAleatorio(i * 5.9 + 19) * 7),
        delay: arred(pseudoAleatorio(i * 3.3 + 20) * 8),
        cor: i % 3 === 0 ? "#a78bfa" : "#38bdf8",
      };
    });

    return { neuronios, faixas };
  }, [leve, caixasRotulo]);

  // Poeira neural de fundo: pontinhos que flutuam devagar, só para o painel
  // parecer um tecido vivo (puramente decorativo, sem interação).
  const poeira = useMemo(() => Array.from({ length: leve ? 12 : 26 }, (_, i) => {
    const angulo = pseudoAleatorio(i * 7.13 + 1) * Math.PI * 2;
    const raio = 150 + pseudoAleatorio(i * 3.71 + 2) * 500;
    return {
      x: arred(CENTRO.x + Math.cos(angulo) * raio),
      y: arred(CENTRO.y + Math.sin(angulo) * raio * 0.74),
      raio: arred(1.1 + pseudoAleatorio(i * 5.37 + 3) * 2.1),
      op: arred(0.16 + pseudoAleatorio(i * 2.91 + 4) * 0.3),
      dx: arred((pseudoAleatorio(i * 11.3 + 5) - 0.5) * 30),
      dy: arred((pseudoAleatorio(i * 13.7 + 6) - 0.5) * 30),
      dur: arred(5 + pseudoAleatorio(i * 4.11 + 7) * 5),
      delay: arred(pseudoAleatorio(i * 6.93 + 8) * 6),
    };
  }), [leve]);

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: CEU[FUNDO], border: "1px solid #1e2a36" }}>
      <svg
        // Folga na horizontal para o nome das sessões das pontas caber
        // inteiro (no celular era o que cortava "Academia de Vendas"); na
        // vertical o desenho é enquadrado justo, senão sobra tanto vazio em
        // cima e embaixo que o grafo fica perdido no meio do card.
        viewBox="-150 88 1300 952"
        className="mx-auto block w-full"
        style={{ aspectRatio: "1300 / 952", maxHeight: "min(78vh, 760px)" }}
        role="img"
        aria-label="Mapa das sessões do CRM ligadas ao Cérebro"
      >
        <defs>
          <radialGradient id="brilho-cerebro">
            <stop offset="0%" stopColor="#bff3ff" stopOpacity="1" />
            <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#6d28d9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
          {/* Halo do nó: usa currentColor, então UM gradiente só serve para
              as 12 sessões — cada nó pinta o seu com a própria cor. */}
          <radialGradient id="halo-no">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.14" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Cada sinapse até o centro nasce na cor do Cérebro e chega na cor
              da sessão — é o dado saindo dali e virando pensamento. */}
          {nos.map((n) => {
            const p = posicoes.get(n.id);
            if (!p) return null;
            return (
              <linearGradient key={`g-raio-${n.id}`} id={`g-raio-${n.id}`} gradientUnits="userSpaceOnUse" x1={CENTRO.x} y1={CENTRO.y} x2={p.x} y2={p.y}>
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
                <stop offset="55%" stopColor={n.cor} stopOpacity="0.45" />
                <stop offset="100%" stopColor={n.cor} stopOpacity="0.95" />
              </linearGradient>
            );
          })}
          {/* Ligação entre sessões: vai da cor de uma até a cor da outra. */}
          {ligacoes.map((l) => (
            <linearGradient key={`g-${l.id}`} id={`g-${l.id}`} gradientUnits="userSpaceOnUse" x1={l.pa.x} y1={l.pa.y} x2={l.pb.x} y2={l.pb.y}>
              <stop offset="0%" stopColor={l.a.cor} />
              <stop offset="100%" stopColor={l.b.cor} />
            </linearGradient>
          ))}
        </defs>

        {FUNDO === "universo" && <CosmosFundo leve={leve} animar={animar} />}

        {/* Tecido neural do fundo, animado POR FAIXAS. Cada faixa respira
            (aparece e some bem devagar, cada uma na sua vez) e leva a luz
            correndo em TODAS as caudas dela.
            O truque do custo: stroke-dasharray e stroke-dashoffset são
            herdáveis em SVG, então o tracejado vai no GRUPO e UMA animação
            move a luz de todos os fios daquela faixa. São ~22 animações no
            total em vez de uma por fio. */}
        <g opacity={0.62} style={{ display: FUNDO === "sinapses" ? undefined : "none" }}>
          {tecido.faixas.map((faixa, f) => (
            <g
              key={`faixa-${f}`}
              className={animar ? "cerebro-respiro" : undefined}
              style={animar ? { animationDuration: `${faixa.durRespiro}s`, animationDelay: `${faixa.atrasoRespiro}s` } : undefined}
            >
              {/* o fio apagado */}
              {faixa.fios.map((fio, i) => (
                <path key={`b-${i}`} d={fio.d} fill="none" stroke="#2d5a78" strokeWidth={0.8} strokeLinecap="round" />
              ))}
              {/* a luz por cima, em todos eles */}
              {animar && (
                <g
                  className="cerebro-pulso"
                  style={{
                    // período igual para todos: o laço fecha sem salto, e
                    // como o vão é maior que qualquer fio, nunca aparece
                    // mais de uma luz por cauda
                    strokeDasharray: "7 293",
                    ["--periodo" as string]: 300,
                    animationDuration: `${faixa.durPulso}s`,
                    animationDelay: `${faixa.atrasoPulso}s`,
                  }}
                >
                  {faixa.fios.map((fio, i) => (
                    <path key={`p-${i}`} d={fio.d} fill="none" stroke={fio.cor} strokeWidth={1.7} strokeLinecap="round" />
                  ))}
                </g>
              )}
            </g>
          ))}
          {tecido.neuronios.map((n, i) => (
            <g
              key={`neuronio-${i}`}
              className={animar ? "cerebro-neuronio" : undefined}
              style={animar ? {
                ["--dx" as string]: `${n.dx}px`,
                ["--dy" as string]: `${n.dy}px`,
                animationDuration: `${n.dur}s`,
                animationDelay: `${n.delay}s`,
              } : undefined}
            >
              {n.dendritos.map((d, j) => (
                <path key={j} d={d.d} fill="none" stroke={n.cor} strokeWidth={0.8} strokeLinecap="round" opacity={0.55} />
              ))}
              <circle cx={n.x} cy={n.y} r={n.corpo} fill={n.cor} opacity={0.8} />
            </g>
          ))}
        </g>

        {/* Poeira neural: partícula solta entre os neurônios, só textura.
            Opacidade FIXA — quem dá vida é o pulso nos filamentos. */}
        <g>
          {poeira.map((p, i) => (
            <circle
              key={`poeira-${i}`}
              cx={p.x}
              cy={p.y}
              r={p.raio}
              fill="#7dd3fc"
              opacity={p.op}
              className={animar ? "cerebro-neuronio" : undefined}
              style={animar ? {
                ["--dx" as string]: `${p.dx}px`,
                ["--dy" as string]: `${p.dy}px`,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              } : undefined}
            />
          ))}
        </g>

        {/* Sinapses ENTRE sessões: o caminho do dado dentro do CRM. Ficam
            atrás do núcleo, então o arco que passa perto do centro some por
            trás do brilho e dá profundidade. */}
        <g>
          {ligacoes.map((l, i) => {
            const ligada = ativo === l.a.id || ativo === l.b.id;
            const apagada = ativo !== null && !ligada;
            return (
              <g key={l.id} opacity={apagada ? 0.07 : ligada ? 1 : 0.5} style={{ transition: "opacity .25s" }}>
                {/* Traço inteiro: quem mostra o fluxo é o pulso que corre por
                    cima. Tracejado deixava a ligação com cara de linha
                    pontilhada de rascunho, não de sinapse. */}
                <path
                  id={`caminho-${l.id}`}
                  d={l.d}
                  fill="none"
                  stroke={`url(#g-${l.id})`}
                  strokeWidth={ligada ? 2.6 : 1.4}
                  strokeLinecap="round"
                  style={{ transition: "stroke-width .25s" }}
                />
                {animar && (
                  <circle r={ligada ? 4.6 : 3} fill={l.b.cor} opacity={ligada ? 1 : 0.7}>
                    <animateMotion
                      dur={`${(ligada ? 2.2 : 5.2 + (i % 4) * 0.7).toFixed(2)}s`}
                      repeatCount="indefinite"
                      begin={`${(i * 0.43).toFixed(2)}s`}
                      calcMode="linear"
                    >
                      <mpath href={`#caminho-${l.id}`} />
                    </animateMotion>
                  </circle>
                )}
              </g>
            );
          })}
        </g>

        {/* Sinapses até o centro */}
        {nos.map((n, i) => {
          const p = posicoes.get(n.id);
          if (!p) return null;
          const desvio = i % 2 === 0 ? 52 : -52;
          const d = curva(p, desvio);
          const aceso = !ativo || ativo === n.id;
          const destaque = ativo === n.id;
          // Sessão mais movimentada = pulso mais rápido e mais gordo — o
          // Cérebro "sente" mais forte o que está mais ativo agora.
          const intensidade = Math.min(1, n.total / 40);
          const durBase = (3.4 + (i % 5) * 0.45) * (1 - intensidade * 0.3);
          const durBranco = (4.6 + (i % 4) * 0.5) * (1 - intensidade * 0.3);
          return (
            <g key={`sinapse-${n.id}`} opacity={aceso ? 1 : 0.14} style={{ transition: "opacity .25s" }}>
              <path
                id={`caminho-${n.id}`}
                d={d}
                fill="none"
                stroke={`url(#g-raio-${n.id})`}
                strokeWidth={destaque ? 3 : 1.7}
                strokeLinecap="round"
                style={{ transition: "stroke-width .25s" }}
              />
              {animar && (
                <>
                  <circle r={destaque ? 6 : 4 + intensidade * 1.4} fill={n.cor} filter="url(#glow)">
                    <animateMotion dur={`${durBase.toFixed(2)}s`} repeatCount="indefinite" begin={`${(i * 0.37).toFixed(2)}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                      <mpath href={`#caminho-${n.id}`} />
                    </animateMotion>
                  </circle>
                  {!leve && (
                    <circle r={3} fill="#ffffff" opacity={0.75}>
                      <animateMotion dur={`${durBranco.toFixed(2)}s`} repeatCount="indefinite" begin={`${(i * 0.53 + 1.2).toFixed(2)}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                        <mpath href={`#caminho-${n.id}`} />
                      </animateMotion>
                    </circle>
                  )}
                  {!leve && intensidade > 0.5 && (
                    <circle r={3.4} fill={n.cor} opacity={0.85}>
                      <animateMotion dur={`${(durBase * 1.15).toFixed(2)}s`} repeatCount="indefinite" begin={`${(i * 0.37 + durBase / 2).toFixed(2)}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                        <mpath href={`#caminho-${n.id}`} />
                      </animateMotion>
                    </circle>
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* Dendritos da sessão acesa: disparam para fora do nó quando ele
            acende. Sem rótulo de propósito — o nome de cada função já está
            na ficha embaixo, e escrito aqui ficava cortado atrás dela nos
            nós da parte de baixo do círculo. */}
        {selecionado && (() => {
          const p = posicoes.get(selecionado.id);
          if (!p) return null;
          return posicoesDosRamos(selecionado, p).map((r, i) => (
            <g key={`ramo-${selecionado.id}-${r.rotulo}`} opacity={0.75}>
              <line x1={p.x} y1={p.y} x2={r.x} y2={r.y} stroke={selecionado.cor} strokeWidth={1.2} opacity={0.5}>
                {animar && <animate attributeName="stroke-opacity" values="0;0.5" dur="0.35s" begin={`${(i * 0.06).toFixed(2)}s`} fill="freeze" />}
              </line>
              <circle cx={r.x} cy={r.y} r={animar ? 0 : 6} fill={selecionado.cor}>
                {animar && <animate attributeName="r" values="0;6" dur="0.35s" begin={`${(i * 0.06).toFixed(2)}s`} fill="freeze" />}
              </circle>
            </g>
          ));
        })()}

        {/* Centro: o Cérebro — pensa em ondas que saem de dentro para fora */}
        <g>
          {animar && [0, 1.6].map((atraso) => (
            <circle key={`onda-${atraso}`} cx={CENTRO.x} cy={CENTRO.y} r={46} fill="none" stroke="#38bdf8" strokeWidth={1.5}>
              <animate attributeName="r" values="46;178" dur="3.2s" repeatCount="indefinite" begin={`${atraso}s`} />
              <animate attributeName="opacity" values="0.5;0" dur="3.2s" repeatCount="indefinite" begin={`${atraso}s`} />
            </circle>
          ))}
          <circle cx={CENTRO.x} cy={CENTRO.y} r={120} fill="url(#brilho-cerebro)" opacity={0.85}>
            {animar && <animate attributeName="r" values="112;126;112" dur="4s" repeatCount="indefinite" />}
          </circle>
          <circle cx={CENTRO.x} cy={CENTRO.y} r={46} fill="#0b1e2b" stroke="#38bdf8" strokeWidth={2} filter="url(#glow)" />
          <text x={CENTRO.x} y={CENTRO.y + 8} textAnchor="middle" fill="#e2f6ff" fontSize={26} fontWeight={800}>IA</text>
          {/* Contorno escuro grosso por baixo (paintOrder) para o nome não
              ficar riscado pelas sinapses que passam atrás dele. */}
          <text
            x={CENTRO.x}
            y={CENTRO.y + 152}
            textAnchor="middle"
            fill="#7dd3fc"
            fontSize={24}
            fontWeight={800}
            letterSpacing="4"
            stroke="#0a1119"
            strokeWidth={6}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {titulo.toUpperCase()}
          </text>
        </g>

        {/* Nós das sessões */}
        {nos.map((n, i) => {
          const p = posicoes.get(n.id);
          if (!p) return null;
          const aceso = !ativo || ativo === n.id;
          const destaque = ativo === n.id;
          // O rótulo sai na direção do centro para fora: quem está em cima
          // recebe o nome acima, quem está embaixo abaixo, e quem está nas
          // laterais recebe ao lado — assim dois vizinhos nunca se cruzam.
          const dx = p.x - CENTRO.x;
          const dy = p.y - CENTRO.y;
          const dist = Math.hypot(dx, dy) || 1;
          const ux = dx / dist;
          const uy = dy / dist;
          const ancora = ux > 0.35 ? "start" : ux < -0.35 ? "end" : "middle";
          const xr = Math.min(985, Math.max(15, p.x + ux * 40 + (ancora === "start" ? 4 : ancora === "end" ? -4 : 0)));
          const yr = p.y + uy * 42 + (uy < -0.35 ? -14 : uy > 0.35 ? 22 : 6);
          return (
            <g
              key={n.id}
              opacity={aceso ? 1 : 0.22}
              style={{ cursor: "pointer", transition: "opacity .25s" }}
              onPointerDown={(e) => { veioDeToque.current = e.pointerType === "touch"; }}
              onMouseEnter={() => { if (!veioDeToque.current) setAtivo(n.id); }}
              onMouseLeave={() => { if (!veioDeToque.current) setAtivo((a) => (a === n.id ? null : a)); }}
              onClick={() => {
                // No mouse o hover já acendeu a sessão, então o clique só
                // confirma (alternar apagaria o nó recém-aceso e pareceria
                // defeito). No toque o clique é que manda, e tocar de novo
                // no mesmo nó fecha a ficha.
                setAtivo((a) => (veioDeToque.current && a === n.id ? null : n.id));
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAtivo((a) => (a === n.id ? null : n.id)); }}
              aria-label={`${n.nome}: ${n.total} ${n.rotuloTotal}`}
            >
              {/* alvo de toque maior que o círculo: no celular o dedo acerta */}
              <circle cx={p.x} cy={p.y} r={46} fill="transparent" />
              {/* corpo do neurônio: o halo é o gradiente pintado com a cor da
                  sessão (currentColor), por isso um gradiente só serve todas */}
              <circle cx={p.x} cy={p.y} r={destaque ? 58 : 44} fill="url(#halo-no)" style={{ color: n.cor, transition: "r .25s" }} />
              <circle
                cx={p.x}
                cy={p.y}
                r={destaque ? 30 : 23}
                fill="#0b1520"
                stroke={n.cor}
                strokeWidth={destaque ? 3.4 : 2.2}
                filter={destaque ? "url(#glow)" : undefined}
                className={animar && !destaque ? "cerebro-no" : undefined}
                style={animar && !destaque ? { animationDuration: `${3.6 + (i % 4) * 0.5}s`, animationDelay: `${(i * 0.31).toFixed(2)}s` } : undefined}
              />
              <text x={p.x} y={p.y + 7} textAnchor="middle" fill={n.cor} fontSize={20} fontWeight={800}>{n.total > 999 ? "999+" : n.total}</text>
              {!destaque && (
                // Contorno escuro por baixo do texto (paintOrder): agora que
                // há sinapses cruzando o fundo, sem isso o nome da sessão
                // fica riscado pelas linhas.
                <>
                  <text x={xr} y={yr} textAnchor={ancora} fill="#e2e8f0" fontSize={22} fontWeight={700} stroke="#0a1119" strokeWidth={5} strokeLinejoin="round" paintOrder="stroke">{n.nome}</text>
                  <text x={xr} y={yr + 20} textAnchor={ancora} fill="#7c8da0" fontSize={17} stroke="#0a1119" strokeWidth={4} strokeLinejoin="round" paintOrder="stroke">{n.rotuloTotal}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Ficha da sessão acesa */}
      <div className="p-3 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-4">
        {/* sm:pointer-events-none é OBRIGATÓRIO, não é enfeite: no desktop a
            ficha flutua POR CIMA do grafo e cresce quando uma sessão é
            escolhida. Se ela capturasse o mouse, ao acender um nó da parte
            de baixo ela cobriria o próprio nó → o mouse "saía" do nó → a
            ficha encolhia → o mouse "entrava" de novo, num pisca-pisca sem
            fim que fazia o grafo parecer que não respondia a nada. Só o
            botão Abrir volta a receber clique. */}
        <div
          className="pointer-events-auto mx-auto max-w-2xl rounded-2xl px-4 py-3 backdrop-blur sm:pointer-events-none"
          style={{ background: "rgba(8,16,24,0.88)", border: `1px solid ${selecionado ? selecionado.cor : "#1e2a36"}` }}
        >
          {selecionado ? (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: selecionado.cor }} />
                <span className="text-sm font-black text-white">{selecionado.nome}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300" style={{ background: "rgba(255,255,255,0.08)" }}>
                  {ROTULO_GRUPO[selecionado.grupo]}
                </span>
                <Link href={selecionado.href} className="pointer-events-auto ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: selecionado.cor, color: "#0b1520" }}>
                  Abrir <ArrowUpRight size={13} />
                </Link>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{selecionado.papel}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selecionado.ramos.map((r) => (
                  <span key={r} className="rounded-lg px-2 py-0.5 text-[11px] text-slate-300" style={{ background: "rgba(255,255,255,0.06)" }}>{r}</span>
                ))}
              </div>
              {/* O que as sinapses acesas estão dizendo: por onde o dado desta
                  sessão entra e sai. */}
              {ligacoesDaSessao(selecionado.id).length > 0 && (
                <div className="mt-2.5 space-y-1 border-t pt-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  {ligacoesDaSessao(selecionado.id).map((l) => {
                    const outro = SESSOES_POR_ID.get(l.outro);
                    return (
                      <div key={l.outro} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: outro?.cor ?? "#64748b" }} />
                        <span className="font-bold text-slate-300">{outro?.nome ?? l.outro}</span>
                        <span className="truncate">— {l.fluxo}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Brain size={15} style={{ color: "#38bdf8" }} />
              <span>Toque em uma sessão para ver o que ela faz e entrar. Os pulsos são os dados correndo entre as sessões e chegando ao Cérebro.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
