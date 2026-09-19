"use client";

// Fundo do Cérebro em versão CÉU PROFUNDO: campo de estrelas, Via Láctea,
// constelações, estrelas cadentes e um meteoro. É a alternativa ao tecido de
// sinapses — mesma ideia (pontos e ligações), outra leitura: em vez de
// "rede neural", a sensação de infinito.
//
// O que persegue realismo aqui (e por quê):
//  · HALO em volta de cada estrela. Estrela é ponto de luz visto através de
//    uma lente/atmosfera, nunca um disco de borda dura — círculo chapado é
//    o que mais denuncia céu desenhado à mão.
//  · tamanho em lei de potência: muitíssima estrela minúscula, pouquíssima
//    grande. Céu com estrela toda do mesmo tamanho não existe.
//  · cor por classe estelar: a maioria branco-azulada, poucas alaranjadas.
//  · espículas de difração nas mais brilhantes — é o que o olho associa a
//    foto de telescópio.
//  · Via Láctea com ESTRUTURA: não é uma faixa lisa, são várias manchas
//    sobrepostas com adensamento de estrelas e, principalmente, FAIXAS DE
//    POEIRA escuras cortando ela. A poeira é o detalhe que convence.
//  · galáxias distantes: borrõezinhos alongados ao fundo, que é o que dá a
//    escala de "isto continua para sempre".
//
// Todo número que vira atributo passa por arred() e o sorteio é inteiro,
// pelo mesmo motivo do grafo: senão o HTML do servidor não bate com o do
// cliente e a hidratação quebra (já derrubou a interação desta página uma
// vez, ver comentário em CerebroGrafo).

const CENTRO = { x: 500, y: 500 };

function pseudoAleatorio(semente: number): number {
  let a = (Math.trunc(semente * 1000) + 0x9e3779b9) >>> 0;
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}

// Classes estelares reais: o céu é dominado por branco e branco-azulado;
// laranja e âmbar são minoria e por isso chamam atenção quando aparecem.
const CORES = [
  "#ffffff", "#f4f8ff", "#dfeaff", "#cddeff", "#bcd2ff",
  "#ffffff", "#f8fbff", "#fff4e2", "#ffdfb4", "#ffc999",
];

// Inclinação da Via Láctea no quadro.
const ANGULO_VIA = 27;

export function CosmosFundo({ leve, animar }: { leve: boolean; animar: boolean }) {
  // ── Campo de estrelas ────────────────────────────────────────────────
  const qtd = leve ? 260 : 720;
  const radVia = (ANGULO_VIA * Math.PI) / 180;

  const estrelas = Array.from({ length: qtd }, (_, i) => {
    // Metade das estrelas é puxada para dentro da faixa da Via Láctea: é o
    // adensamento que cria o "rio" de luz do céu de verdade.
    const naVia = pseudoAleatorio(i * 3.71 + 9) < 0.5;
    let x: number;
    let y: number;
    if (naVia) {
      // Sorteia ao longo da faixa e desvia pouco na perpendicular.
      const t = -260 + pseudoAleatorio(i * 1.31 + 7) * 1660;
      const desvio = (pseudoAleatorio(i * 5.3 + 10) - 0.5) * 300;
      x = arred(CENTRO.x + Math.cos(radVia) * t - Math.sin(radVia) * desvio);
      y = arred(CENTRO.y + Math.sin(radVia) * t + Math.cos(radVia) * desvio);
    } else {
      x = arred(-170 + pseudoAleatorio(i * 1.31 + 7) * 1340);
      y = arred(70 + pseudoAleatorio(i * 2.17 + 8) * 990);
    }
    // Lei de potência: a esmagadora maioria fica minúscula.
    const b = pseudoAleatorio(i * 4.13 + 11);
    const raio = arred(0.18 + b * b * b * b * 2.4);
    const op = arred(0.18 + pseudoAleatorio(i * 6.7 + 12) * 0.82);
    return {
      x, y, raio, op,
      cor: CORES[Math.floor(pseudoAleatorio(i * 7.9 + 13) * CORES.length)],
      // Só uma parte cintila, devagar e sem nunca apagar de vez.
      cintila: pseudoAleatorio(i * 8.3 + 14) > 0.86,
      dur: arred(3.5 + pseudoAleatorio(i * 9.1 + 15) * 5),
      atraso: arred(pseudoAleatorio(i * 10.7 + 16) * 7),
    };
  });

  // Halo só nas que têm corpo — nas minúsculas o halo viraria borrão.
  const comHalo = estrelas.filter((e) => e.raio > 0.62);
  // As mais brilhantes ganham espícula de difração.
  const brilhantes = estrelas.filter((e) => e.raio > 1.5).slice(0, leve ? 6 : 16);

  // ── Faixas de poeira da Via Láctea ───────────────────────────────────
  // São elas que dão textura à faixa; sem poeira, a Via Láctea vira um
  // borrão claro e chapado.
  const poeiras = Array.from({ length: leve ? 3 : 6 }, (_, i) => {
    const t = -620 + pseudoAleatorio(i * 4.9 + 61) * 1240;
    const desvio = (pseudoAleatorio(i * 6.3 + 62) - 0.5) * 150;
    return {
      cx: arred(CENTRO.x + Math.cos(radVia) * t - Math.sin(radVia) * desvio),
      cy: arred(CENTRO.y + Math.sin(radVia) * t + Math.cos(radVia) * desvio),
      rx: arred(130 + pseudoAleatorio(i * 8.1 + 63) * 200),
      ry: arred(24 + pseudoAleatorio(i * 10.3 + 64) * 40),
      giro: arred(ANGULO_VIA + (pseudoAleatorio(i * 12.7 + 65) - 0.5) * 22),
    };
  });

  // ── Galáxias distantes ───────────────────────────────────────────────
  const galaxias = Array.from({ length: leve ? 2 : 4 }, (_, i) => ({
    cx: arred(-80 + pseudoAleatorio(i * 5.7 + 71) * 1160),
    cy: arred(120 + pseudoAleatorio(i * 7.1 + 72) * 820),
    rx: arred(9 + pseudoAleatorio(i * 9.3 + 73) * 14),
    ry: arred(3 + pseudoAleatorio(i * 11.7 + 74) * 5),
    giro: arred(pseudoAleatorio(i * 13.1 + 75) * 180),
  })).filter((g) => Math.hypot(g.cx - CENTRO.x, g.cy - CENTRO.y) > 340);

  // ── Constelações ─────────────────────────────────────────────────────
  // Linha quebrada ligando estrelas notáveis, como numa carta celeste.
  const constelacoes = Array.from({ length: leve ? 3 : 6 }, (_, c) => {
    const quantos = 4 + Math.floor(pseudoAleatorio(c * 3.3 + 21) * 4);
    let x = -60 + pseudoAleatorio(c * 5.1 + 22) * 1120;
    let y = 130 + pseudoAleatorio(c * 7.3 + 23) * 840;
    const pontos: { x: number; y: number; raio: number }[] = [];
    for (let k = 0; k < quantos; k++) {
      pontos.push({
        x: arred(x), y: arred(y),
        raio: arred(1 + pseudoAleatorio(c * 11.1 + k * 2.7 + 24) * 1.4),
      });
      const ang = pseudoAleatorio(c * 13.7 + k * 3.9 + 25) * Math.PI * 2;
      const passo = 54 + pseudoAleatorio(c * 17.3 + k * 4.1 + 26) * 80;
      x += Math.cos(ang) * passo;
      y += Math.sin(ang) * passo * 0.7;
    }
    // Descarta a que cair por cima do miolo do grafo.
    return pontos.some((p) => Math.hypot(p.x - CENTRO.x, p.y - CENTRO.y) < 330) ? null : pontos;
  }).filter((c): c is { x: number; y: number; raio: number }[] => c !== null);

  // ── Estrelas cadentes ────────────────────────────────────────────────
  // Sai sempre de um canto de cima e cruza o CÉU ABERTO, não o miolo:
  // risco por cima do grafo polui e briga com as sinapses coloridas.
  const cadentes = Array.from({ length: leve ? 2 : 4 }, (_, i) => {
    const daEsquerda = i % 2 === 0;
    const x = daEsquerda
      ? arred(-150 + pseudoAleatorio(i * 4.7 + 41) * 320)
      : arred(830 + pseudoAleatorio(i * 4.7 + 41) * 320);
    const y = arred(95 + pseudoAleatorio(i * 6.1 + 42) * 260);
    const ang = daEsquerda
      ? 22 + pseudoAleatorio(i * 8.9 + 43) * 16
      : 142 + pseudoAleatorio(i * 8.9 + 43) * 16;
    const dist = 380 + pseudoAleatorio(i * 10.3 + 44) * 300;
    const rad = (ang * Math.PI) / 180;
    return {
      x, y, ang: arred(ang),
      comprimento: arred(105 + pseudoAleatorio(i * 12.7 + 45) * 85),
      dx: arred(Math.cos(rad) * dist),
      dy: arred(Math.sin(rad) * dist),
      dur: arred(9 + pseudoAleatorio(i * 14.1 + 46) * 9),
      atraso: arred(pseudoAleatorio(i * 16.3 + 47) * 12),
    };
  });

  // O meteoro: maior, mais lento e bem mais raro — o momento "olha lá!".
  const meteoro = (() => {
    const ang = 14;
    const rad = (ang * Math.PI) / 180;
    const dist = 1500;
    return { x: -260, y: 118, ang, comprimento: 300, dx: arred(Math.cos(rad) * dist), dy: arred(Math.sin(rad) * dist) };
  })();

  return (
    <>
      <defs>
        {/* Halo da estrela: UM gradiente serve todas, porque usa currentColor
            e cada estrela pinta o seu com a própria cor. Sem filtro de
            desfoque — seriam centenas e o desenho engasgaria. */}
        <radialGradient id="halo-estrela">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" />
          <stop offset="28%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>

        {/* Nebulosas: emissão (avermelhada) e reflexão (azulada), que é a
            diferença de cor que existe no céu real. */}
        <radialGradient id="neb-azul">
          <stop offset="0%" stopColor="#4a6fd6" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#4a6fd6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="neb-violeta">
          <stop offset="0%" stopColor="#8646c9" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#8646c9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="neb-hidrogenio">
          <stop offset="0%" stopColor="#d2437e" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#d2437e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="neb-teal">
          <stop offset="0%" stopColor="#1d8fb0" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#1d8fb0" stopOpacity="0" />
        </radialGradient>

        {/* Miolo da Via Láctea e a poeira que a corta */}
        <radialGradient id="via-luz">
          <stop offset="0%" stopColor="#cfd8ff" stopOpacity="0.20" />
          <stop offset="45%" stopColor="#8fa3e8" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#6b7fd0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="via-poeira">
          <stop offset="0%" stopColor="#04060f" stopOpacity="0.78" />
          <stop offset="70%" stopColor="#04060f" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#04060f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="galaxia">
          <stop offset="0%" stopColor="#e8ddff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#a98fd8" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#a98fd8" stopOpacity="0" />
        </radialGradient>

        {/* Rastros — ATENÇÃO ao gradientUnits.
            O rastro é uma LINHA HORIZONTAL, ou seja, a caixa dela tem altura
            ZERO. Gradiente em objectBoundingBox (o padrão) degenera nesse
            caso e o navegador pinta o traço quase liso — foi o que fez o
            meteoro sair branco, sem fogo nenhum. Por isso cada rastro tem o
            seu gradiente em userSpaceOnUse, com x1/x2 nas coordenadas exatas
            do traço. */}
        {cadentes.map((c, i) => (
          <linearGradient key={`gr-cad-${i}`} id={`rastro-${i}`} gradientUnits="userSpaceOnUse" x1={-c.comprimento} y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="62%" stopColor="#dbeaff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
        ))}
        {cadentes.map((c, i) => (
          <linearGradient key={`gr-cadl-${i}`} id={`rastro-largo-${i}`} gradientUnits="userSpaceOnUse" x1={-c.comprimento} y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#8fb6ff" stopOpacity="0" />
            <stop offset="75%" stopColor="#bcd6ff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#dbeaff" stopOpacity="0.35" />
          </linearGradient>
        ))}
        {/* O fogo do meteoro precisa aparecer bem antes da cabeça, senão ele
            lê como um risco branco qualquer e perde a graça. */}
        <linearGradient id="rastro-meteoro" gradientUnits="userSpaceOnUse" x1={-meteoro.comprimento} y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff6a14" stopOpacity="0" />
          <stop offset="30%" stopColor="#ff7f2a" stopOpacity="0.55" />
          <stop offset="62%" stopColor="#ffa94d" stopOpacity="0.9" />
          <stop offset="88%" stopColor="#ffe3ac" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="rastro-meteoro-largo" gradientUnits="userSpaceOnUse" x1={-meteoro.comprimento} y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#ff5e0a" stopOpacity="0" />
          <stop offset="45%" stopColor="#ff7a1f" stopOpacity="0.32" />
          <stop offset="80%" stopColor="#ffa049" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd2a0" stopOpacity="0.75" />
        </linearGradient>
      </defs>

      {/* ── Nebulosas de fundo ─────────────────────────────────────────── */}
      <g>
        <ellipse cx="150" cy="215" rx="450" ry="340" fill="url(#neb-azul)" />
        <ellipse cx="940" cy="900" rx="480" ry="360" fill="url(#neb-violeta)" />
        <ellipse cx="880" cy="215" rx="330" ry="250" fill="url(#neb-teal)" />
        <ellipse cx="160" cy="880" rx="360" ry="270" fill="url(#neb-hidrogenio)" />
        <ellipse cx="560" cy="1010" rx="420" ry="200" fill="url(#neb-hidrogenio)" />
      </g>

      {/* ── Via Láctea: manchas sobrepostas + poeira ────────────────────── */}
      <g transform={`rotate(${ANGULO_VIA} 500 500)`}>
        <ellipse cx="500" cy="500" rx="980" ry="185" fill="url(#via-luz)" />
        <ellipse cx="240" cy="486" rx="430" ry="120" fill="url(#via-luz)" />
        <ellipse cx="790" cy="512" rx="400" ry="135" fill="url(#via-luz)" />
      </g>

      {/* ── Estrelas: halo primeiro, núcleo depois ──────────────────────── */}
      <g>
        {comHalo.map((e, i) => (
          <circle key={`halo-${i}`} cx={e.x} cy={e.y} r={arred(e.raio * 4.2)} fill="url(#halo-estrela)" style={{ color: e.cor }} opacity={arred(e.op * 0.55)} />
        ))}
        {estrelas.map((e, i) => (
          <circle
            key={`est-${i}`}
            cx={e.x}
            cy={e.y}
            r={e.raio}
            fill={e.cor}
            opacity={e.op}
            className={animar && e.cintila ? "cosmos-cintila" : undefined}
            style={animar && e.cintila ? {
              ["--op" as string]: e.op,
              animationDuration: `${e.dur}s`,
              animationDelay: `${e.atraso}s`,
            } : undefined}
          />
        ))}
      </g>

      {/* Faixas de poeira POR CIMA das estrelas: é a poeira que apaga a luz
          de trás, e é exatamente isso que dá volume à Via Láctea. */}
      <g>
        {poeiras.map((p, i) => (
          <ellipse key={`po-${i}`} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill="url(#via-poeira)" transform={`rotate(${p.giro} ${p.cx} ${p.cy})`} />
        ))}
      </g>

      {/* ── Galáxias distantes ──────────────────────────────────────────── */}
      <g>
        {galaxias.map((g, i) => (
          <ellipse key={`gal-${i}`} cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} fill="url(#galaxia)" transform={`rotate(${g.giro} ${g.cx} ${g.cy})`} />
        ))}
      </g>

      {/* ── Espículas de difração das mais brilhantes ───────────────────── */}
      <g>
        {brilhantes.map((e, i) => (
          <g key={`esp-${i}`} opacity={0.8}>
            <line x1={arred(e.x - e.raio * 9)} y1={e.y} x2={arred(e.x + e.raio * 9)} y2={e.y} stroke={e.cor} strokeWidth={0.45} opacity={0.6} />
            <line x1={e.x} y1={arred(e.y - e.raio * 9)} x2={e.x} y2={arred(e.y + e.raio * 9)} stroke={e.cor} strokeWidth={0.45} opacity={0.6} />
            <circle cx={e.x} cy={e.y} r={arred(e.raio * 0.55)} fill="#ffffff" />
          </g>
        ))}
      </g>

      {/* ── Constelações ────────────────────────────────────────────────── */}
      <g>
        {constelacoes.map((pts, c) => (
          <g key={`const-${c}`}>
            <polyline
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#a8c8ff"
              strokeWidth={0.55}
              opacity={0.26}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {pts.map((p, k) => (
              <g key={k}>
                <circle cx={p.x} cy={p.y} r={arred(p.raio * 5)} fill="url(#halo-estrela)" style={{ color: "#cfe3ff" }} opacity={0.5} />
                <circle cx={p.x} cy={p.y} r={p.raio} fill="#ffffff" opacity={0.95} />
              </g>
            ))}
          </g>
        ))}
      </g>

      {/* ── Estrelas cadentes e meteoro ─────────────────────────────────── */}
      {animar && (
        <g>
          {cadentes.map((c, i) => (
            <g
              key={`cad-${i}`}
              className="cosmos-cadente"
              style={{
                ["--dx" as string]: `${c.dx}px`,
                ["--dy" as string]: `${c.dy}px`,
                animationDuration: `${c.dur}s`,
                animationDelay: `${c.atraso}s`,
              }}
            >
              <g transform={`translate(${c.x} ${c.y}) rotate(${c.ang})`}>
                {/* dois traços: o largo é o brilho em volta do risco, o fino
                    é o risco em si — junto, dá a cauda com volume */}
                <line x1={-c.comprimento} y1="0" x2="0" y2="0" stroke={`url(#rastro-largo-${i})`} strokeWidth={5} strokeLinecap="round" />
                <line x1={-c.comprimento} y1="0" x2="0" y2="0" stroke={`url(#rastro-${i})`} strokeWidth={1.4} strokeLinecap="round" />
                <circle cx="0" cy="0" r={5.5} fill="url(#halo-estrela)" style={{ color: "#dbeaff" }} />
                <circle cx="0" cy="0" r={1.5} fill="#ffffff" />
              </g>
            </g>
          ))}

          <g
            className="cosmos-meteoro"
            style={{ ["--dx" as string]: `${meteoro.dx}px`, ["--dy" as string]: `${meteoro.dy}px` }}
          >
            <g transform={`translate(${meteoro.x} ${meteoro.y}) rotate(${meteoro.ang})`}>
              <line x1={-meteoro.comprimento} y1="0" x2="0" y2="0" stroke="url(#rastro-meteoro-largo)" strokeWidth={13} strokeLinecap="round" />
              <line x1={-meteoro.comprimento} y1="0" x2="0" y2="0" stroke="url(#rastro-meteoro)" strokeWidth={4} strokeLinecap="round" />
              <line x1={arred(-meteoro.comprimento * 0.5)} y1="0" x2="0" y2="0" stroke="#fff6e4" strokeWidth={1.6} strokeLinecap="round" opacity={0.9} />
              <circle cx="0" cy="0" r={26} fill="url(#halo-estrela)" style={{ color: "#ff9440" }} opacity={0.9} />
              <circle cx="0" cy="0" r={11} fill="url(#halo-estrela)" style={{ color: "#fff0d2" }} />
              <circle cx="0" cy="0" r={3.4} fill="#ffffff" />
            </g>
          </g>
        </g>
      )}
    </>
  );
}
