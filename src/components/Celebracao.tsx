"use client";

// Comemoração de venda faturada: fogos de artifício (alguns estourando em
// cifrões, outros em faíscas), chuva de confete por uns 5 segundos e, no
// fim, a frase BORA PRA CIMA. Tudo em <canvas>, sem biblioteca, por cima da
// tela e sem bloquear cliques (pointer-events: none).

import { useEffect, useRef, useState } from "react";

const DURACAO_MS = 5200;
const CORES_FOGO = ["#ffd54a", "#ffb300", "#4ade80", "#22d3ee", "#f472b6", "#a78bfa", "#fb7185", "#ffffff"];
const CORES_CONFETE = ["#BFDE4D", "#ffd54a", "#4ade80", "#22d3ee", "#f472b6", "#a78bfa", "#fb923c", "#ffffff"];

type Particula = {
  x: number; y: number; vx: number; vy: number; vida: number; vidaMax: number;
  cor: string; tam: number; tipo: "faisca" | "cifrao" | "confete"; rot: number; vrot: number;
};
type Foguete = { x: number; y: number; vx: number; vy: number; alvoY: number; cor: string; cifrao: boolean };

export function Celebracao({ ativa, onFim }: { ativa: boolean; onFim?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<"fogos" | "frase" | "fim">("fim");

  useEffect(() => {
    if (!ativa) { setFase("fim"); return; }
    setFase("fogos");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function ajustar() {
      if (!canvas) return;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    }
    ajustar();
    window.addEventListener("resize", ajustar);

    const W = () => window.innerWidth, H = () => window.innerHeight;
    const particulas: Particula[] = [];
    const foguetes: Foguete[] = [];
    const inicio = performance.now();
    let ultimoFoguete = 0, ultimoConfete = 0, vivo = true, raf = 0, anterior = inicio;
    const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    function lancar() {
      const cifrao = Math.random() < 0.45;
      const x = W() * (0.12 + Math.random() * 0.76);
      foguetes.push({ x, y: H() + 10, vx: (Math.random() - 0.5) * 1.2, vy: -(9 + Math.random() * 4) * (H() / 800), alvoY: H() * (0.15 + Math.random() * 0.4), cor: CORES_FOGO[Math.floor(Math.random() * CORES_FOGO.length)], cifrao });
    }
    function explodir(f: Foguete) {
      const n = f.cifrao ? 26 : 70;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const vel = (f.cifrao ? 2.2 : 3.2) + Math.random() * (f.cifrao ? 2.2 : 3.5);
        particulas.push({
          x: f.x, y: f.y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: 0, vidaMax: 70 + Math.random() * 40,
          cor: f.cifrao ? (Math.random() < 0.6 ? "#ffd54a" : "#4ade80") : f.cor, tam: f.cifrao ? 14 + Math.random() * 10 : 2 + Math.random() * 2,
          tipo: f.cifrao ? "cifrao" : "faisca", rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.2,
        });
      }
    }
    function confete(qtd: number) {
      for (let i = 0; i < qtd; i++) {
        particulas.push({
          x: Math.random() * W(), y: -10 - Math.random() * 40, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2.5, vida: 0, vidaMax: 260,
          cor: CORES_CONFETE[Math.floor(Math.random() * CORES_CONFETE.length)], tam: 6 + Math.random() * 6, tipo: "confete", rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.25,
        });
      }
    }

    function quadro(agora: number) {
      if (!vivo || !canvas || !ctx) return;
      const t = agora - inicio;
      // Física em função do tempo (não do número de quadros): fica igual num
      // celular a 30 fps e num desktop a 120 fps.
      const dt = Math.min(Math.max((agora - anterior) / (1000 / 60), 0.25), 3);
      anterior = agora;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W(), H());

      if (t < DURACAO_MS - 900) {
        if (agora - ultimoFoguete > (reduzir ? 700 : 330)) { lancar(); if (Math.random() < 0.5) lancar(); ultimoFoguete = agora; }
        if (agora - ultimoConfete > 120) { confete(reduzir ? 3 : 8); ultimoConfete = agora; }
      }
      if (t > 3300 && fase !== "frase") setFase("frase");

      for (let i = foguetes.length - 1; i >= 0; i--) {
        const f = foguetes[i];
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 0.12 * (H() / 800) * dt;
        ctx.beginPath(); ctx.arc(f.x, f.y, 2.2, 0, Math.PI * 2); ctx.fillStyle = f.cor; ctx.fill();
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 3, f.y - f.vy * 3); ctx.strokeStyle = f.cor + "88"; ctx.lineWidth = 1.5; ctx.stroke();
        if (f.y <= f.alvoY || f.vy >= -1) { explodir(f); foguetes.splice(i, 1); }
      }
      for (let i = particulas.length - 1; i >= 0; i--) {
        const q = particulas[i];
        q.vida += dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vrot * dt;
        if (q.tipo === "confete") { q.vx += Math.sin((q.vida + q.x) / 18) * 0.06 * dt; q.vy = Math.min(q.vy + 0.02 * dt, 4.5); }
        else { q.vy += (q.tipo === "cifrao" ? 0.045 : 0.06) * dt; const atrito = Math.pow(0.985, dt); q.vx *= atrito; q.vy *= atrito; }
        const alpha = Math.max(0, 1 - q.vida / q.vidaMax);
        if (alpha <= 0 || q.y > H() + 30) { particulas.splice(i, 1); continue; }
        ctx.globalAlpha = alpha;
        if (q.tipo === "cifrao") {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.sin(q.rot) * 0.35);
          ctx.font = `900 ${q.tam}px ui-sans-serif, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillStyle = q.cor; ctx.shadowColor = q.cor; ctx.shadowBlur = 8; ctx.fillText("$", 0, 0);
          ctx.restore();
        } else if (q.tipo === "confete") {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.cor;
          ctx.fillRect(-q.tam / 2, -q.tam / 4, q.tam, q.tam / 2); ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(q.x, q.y, q.tam, 0, Math.PI * 2); ctx.fillStyle = q.cor; ctx.shadowColor = q.cor; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
      }

      if (t < DURACAO_MS + 600 || particulas.length > 0 && t < DURACAO_MS + 1500) raf = requestAnimationFrame(quadro);
      else { vivo = false; setFase("fim"); onFim?.(); }
    }
    raf = requestAnimationFrame(quadro);
    return () => { vivo = false; cancelAnimationFrame(raf); window.removeEventListener("resize", ajustar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativa]);

  if (!ativa && fase === "fim") return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[200]" aria-hidden data-audit-ignore>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {fase === "frase" && (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="animate-bora select-none text-center">
            <div className="text-[13vw] font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_6px_0_rgba(0,0,0,0.35)] sm:text-7xl" style={{ WebkitTextStroke: "2px #0f172a" }}>
              BORA PRA <span className="text-agro-400">CIMA</span>
            </div>
            <div className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-agro-400 sm:text-base">venda faturada</div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes bora-pop { 0% { transform: scale(0.4) rotate(-6deg); opacity: 0; } 55% { transform: scale(1.08) rotate(1deg); opacity: 1; } 75% { transform: scale(0.98); } 100% { transform: scale(1); opacity: 1; } }
        .animate-bora { animation: bora-pop 700ms cubic-bezier(0.2, 1.4, 0.4, 1) both; }
      `}</style>
    </div>
  );
}
