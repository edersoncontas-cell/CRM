"use client";

// O grafo do Cérebro: cada sessão do CRM é um nó ligado ao centro por uma
// sinapse, com pulsos correndo o tempo todo do nó para o Cérebro — é a
// imagem de que o Cérebro vê tudo, analisa tudo e conecta tudo.
//
// Tocar (ou passar o mouse) num nó acende aquela sinapse, abre os sub-nós da
// sessão e mostra o que ela faz, com o atalho para entrar. Tudo em SVG, que
// fica nítido em qualquer tela e não pesa como uma biblioteca de grafos.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Brain } from "lucide-react";
import { posicoesDoGrafo, posicoesDosRamos, ROTULO_GRUPO, type SessaoCerebro } from "@/lib/cerebro/sessoes";

export type NoGrafo = SessaoCerebro & {
  total: number;        // número que resume a sessão (clientes, negociações…)
  rotuloTotal: string;  // o que esse número significa
};

const CENTRO = { x: 500, y: 500 };

// Curva suave do centro até o nó (uma linha reta fica dura; a curva dá a
// sensação de sinapse).
function curva(alvo: { x: number; y: number }, desvio: number): string {
  const mx = (CENTRO.x + alvo.x) / 2;
  const my = (CENTRO.y + alvo.y) / 2;
  const dx = alvo.x - CENTRO.x;
  const dy = alvo.y - CENTRO.y;
  const norma = Math.hypot(dx, dy) || 1;
  // Empurra o meio da curva na perpendicular à reta centro→nó.
  const cx = mx + (-dy / norma) * desvio;
  const cy = my + (dx / norma) * desvio;
  return `M ${CENTRO.x} ${CENTRO.y} Q ${cx} ${cy} ${alvo.x} ${alvo.y}`;
}

export function CerebroGrafo({ nos, titulo = "Cérebro" }: { nos: NoGrafo[]; titulo?: string }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const [animar, setAnimar] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq?.matches) setAnimar(false);
  }, []);

  const posicoes = useMemo(() => posicoesDoGrafo(nos), [nos]);
  const selecionado = ativo ? nos.find((n) => n.id === ativo) ?? null : null;

  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: "radial-gradient(circle at 50% 45%, #10202b 0%, #0a1119 55%, #070d13 100%)", border: "1px solid #1e2a36" }}>
      <svg
        // Folga em volta do círculo para o nome das sessões das pontas caber
        // inteiro — no celular era o que cortava "Academia de Vendas".
        viewBox="-150 -40 1300 1110"
        className="mx-auto block w-full"
        style={{ aspectRatio: "1300 / 1110", maxHeight: "min(78vh, 760px)" }}
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
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Sinapses */}
        {nos.map((n, i) => {
          const p = posicoes.get(n.id);
          if (!p) return null;
          const desvio = i % 2 === 0 ? 52 : -52;
          const d = curva(p, desvio);
          const aceso = !ativo || ativo === n.id;
          const destaque = ativo === n.id;
          return (
            <g key={`sinapse-${n.id}`} opacity={aceso ? 1 : 0.16} style={{ transition: "opacity .25s" }}>
              <path id={`caminho-${n.id}`} d={d} fill="none" stroke={destaque ? n.cor : "#2b3a49"} strokeWidth={destaque ? 2.6 : 1.4} strokeLinecap="round" />
              {animar && (
                <>
                  <circle r={destaque ? 6 : 4} fill={n.cor} filter="url(#glow)">
                    <animateMotion dur={`${3.4 + (i % 5) * 0.45}s`} repeatCount="indefinite" begin={`${(i * 0.37).toFixed(2)}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                      <mpath href={`#caminho-${n.id}`} />
                    </animateMotion>
                  </circle>
                  <circle r={3} fill="#ffffff" opacity={0.75}>
                    <animateMotion dur={`${4.6 + (i % 4) * 0.5}s`} repeatCount="indefinite" begin={`${(i * 0.53 + 1.2).toFixed(2)}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                      <mpath href={`#caminho-${n.id}`} />
                    </animateMotion>
                  </circle>
                </>
              )}
            </g>
          );
        })}

        {/* Sub-nós da sessão acesa */}
        {selecionado && (() => {
          const p = posicoes.get(selecionado.id);
          if (!p) return null;
          return posicoesDosRamos(selecionado, p).map((r) => {
            // O rótulo sai para o lado de fora da ponta (nunca por cima do
            // nome da sessão nem de outro ramo).
            const cos = Math.cos(r.angulo);
            const ancora = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
            const dx = cos > 0.25 ? 13 : cos < -0.25 ? -13 : 0;
            const dy = ancora === "middle" ? (Math.sin(r.angulo) > 0 ? 26 : -16) : 5;
            return (
              <g key={`ramo-${selecionado.id}-${r.rotulo}`}>
                <line x1={p.x} y1={p.y} x2={r.x} y2={r.y} stroke={selecionado.cor} strokeWidth={1} opacity={0.5} />
                <circle cx={r.x} cy={r.y} r={7} fill="#0b1520" stroke={selecionado.cor} strokeWidth={1.6} />
                <text x={r.x + dx} y={r.y + dy} textAnchor={ancora} fill="#cbd5e1" fontSize={18} fontWeight={600}>{r.rotulo}</text>
              </g>
            );
          });
        })()}

        {/* Centro: o Cérebro */}
        <g>
          <circle cx={CENTRO.x} cy={CENTRO.y} r={120} fill="url(#brilho-cerebro)" opacity={0.85}>
            {animar && <animate attributeName="r" values="112;126;112" dur="4s" repeatCount="indefinite" />}
          </circle>
          <circle cx={CENTRO.x} cy={CENTRO.y} r={46} fill="#0b1e2b" stroke="#38bdf8" strokeWidth={2} filter="url(#glow)" />
          <text x={CENTRO.x} y={CENTRO.y + 8} textAnchor="middle" fill="#e2f6ff" fontSize={26} fontWeight={800}>IA</text>
          <text x={CENTRO.x} y={CENTRO.y + 92} textAnchor="middle" fill="#7dd3fc" fontSize={26} fontWeight={800} letterSpacing="3">{titulo.toUpperCase()}</text>
        </g>

        {/* Nós das sessões */}
        {nos.map((n) => {
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
              onMouseEnter={() => setAtivo(n.id)}
              onMouseLeave={() => setAtivo((a) => (a === n.id ? null : a))}
              onClick={() => setAtivo((a) => (a === n.id ? null : n.id))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAtivo((a) => (a === n.id ? null : n.id)); }}
              aria-label={`${n.nome}: ${n.total} ${n.rotuloTotal}`}
            >
              {/* alvo de toque maior que o círculo: no celular o dedo acerta */}
              <circle cx={p.x} cy={p.y} r={46} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={destaque ? 30 : 23} fill="#0b1520" stroke={n.cor} strokeWidth={destaque ? 3.4 : 2.2} filter={destaque ? "url(#glow)" : undefined} />
              <text x={p.x} y={p.y + 7} textAnchor="middle" fill={n.cor} fontSize={20} fontWeight={800}>{n.total > 999 ? "999+" : n.total}</text>
              {!destaque && (
                <>
                  <text x={xr} y={yr} textAnchor={ancora} fill="#e2e8f0" fontSize={22} fontWeight={700}>{n.nome}</text>
                  <text x={xr} y={yr + 20} textAnchor={ancora} fill="#7c8da0" fontSize={17}>{n.rotuloTotal}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Ficha da sessão acesa */}
      <div className="p-3 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0 sm:p-4">
        <div
          className="pointer-events-auto mx-auto max-w-2xl rounded-2xl px-4 py-3 backdrop-blur"
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
                <Link href={selecionado.href} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ background: selecionado.cor, color: "#0b1520" }}>
                  Abrir <ArrowUpRight size={13} />
                </Link>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{selecionado.papel}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selecionado.ramos.map((r) => (
                  <span key={r} className="rounded-lg px-2 py-0.5 text-[11px] text-slate-300" style={{ background: "rgba(255,255,255,0.06)" }}>{r}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Brain size={15} style={{ color: "#38bdf8" }} />
              <span>Toque em uma sessão para ver o que ela faz e entrar. Os pulsos são os dados de cada sessão chegando ao Cérebro.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
