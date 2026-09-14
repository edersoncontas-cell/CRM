// Peças visuais do Dashboard (sem hooks — funcionam em Server Components):
// painel/card, anel de progresso com gradiente neon, indicador de variação
// e o calendário de visitas do mês.

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { T } from "@/lib/dash-tema";

export function Painel({ titulo, subtitulo, acao, children, className = "", destaque = false }: {
  titulo?: string; subtitulo?: string; acao?: React.ReactNode; children: React.ReactNode; className?: string; destaque?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl p-4 ${className}`}
      style={{ background: destaque ? T.card2 : T.card, border: `1px solid ${T.borda}`, boxShadow: T.sombra }}
    >
      {(titulo || acao) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {titulo && <h2 className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: T.texto2 }}>{titulo}</h2>}
            {subtitulo && <p className="mt-0.5 text-xs" style={{ color: T.mudo }}>{subtitulo}</p>}
          </div>
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

// Anel de progresso em SVG (gradiente neon), igual ao da referência.
export function Anel({ id, valor, max, cor1, cor2, tamanho = 92, espessura = 9, children }: {
  id: string; valor: number; max: number; cor1: string; cor2: string; tamanho?: number; espessura?: number; children?: React.ReactNode;
}) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.max(0, Math.min(1, valor / max)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="-rotate-90">
        <defs>
          <linearGradient id={`anel-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={cor1} />
            <stop offset="100%" stopColor={cor2} />
          </linearGradient>
        </defs>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={T.sobre2} strokeWidth={espessura} />
        <circle
          cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none"
          stroke={`url(#anel-${id})`} strokeWidth={espessura} strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${cor1}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function Delta({ valor, sufixo = "%", texto = "vs. ano anterior" }: { valor: number | null; sufixo?: string; texto?: string }) {
  if (valor == null) return <span className="text-[11px]" style={{ color: T.mudo }}>sem base de comparação</span>;
  const cor = valor > 0 ? T.verde : valor < 0 ? T.vermelho : T.mudo;
  const Icone = valor > 0 ? ArrowUpRight : valor < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold" style={{ color: cor }}>
      <Icone size={13} /> {Math.abs(valor)}{sufixo} <span style={{ color: T.mudo, fontWeight: 500 }}>{texto}</span>
    </span>
  );
}

export function Chip({ ativo, href, children }: { ativo: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1 text-xs font-bold transition"
      style={ativo ? { background: T.rosa, color: "#fff", boxShadow: `0 0 14px ${T.rosa}66` } : { background: T.sobre2, color: T.texto2 }}
    >
      {children}
    </Link>
  );
}

// Calendário do mês corrente marcando os dias com visita agendada.
export function CalendarioVisitas({ ano, mes, diasComVisita, hoje }: { ano: number; mes: number; diasComVisita: Map<number, number>; hoje: number | null }) {
  const nomeMes = new Date(ano, mes, 1).toLocaleDateString("pt-BR", { month: "long" });
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const dias = new Date(ano, mes + 1, 0).getDate();
  const celulas: (number | null)[] = [...Array(primeiroDia).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);

  return (
    <div>
      <div className="mb-2 text-center text-sm font-black capitalize" style={{ color: T.texto }}>
        <span style={{ color: T.ciano }}>‹</span> {nomeMes} {ano} <span style={{ color: T.ciano }}>›</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={i} className="font-bold" style={{ color: T.mudo }}>{d}</div>
        ))}
        {celulas.map((d, i) => {
          if (!d) return <div key={i} />;
          const visitas = diasComVisita.get(d) ?? 0;
          const ehHoje = d === hoje;
          return (
            <div
              key={i}
              title={visitas ? `${visitas} visita(s)` : undefined}
              className="relative flex h-7 items-center justify-center rounded-lg font-semibold"
              style={{
                color: visitas ? "#111" : ehHoje ? T.texto : T.texto2,
                background: visitas ? `linear-gradient(135deg, ${T.rosa}, ${T.violeta})` : ehHoje ? T.sobre3 : "transparent",
                boxShadow: visitas ? `0 0 10px ${T.rosa}66` : undefined,
                border: ehHoje && !visitas ? `1px solid ${T.ciano}` : undefined,
              }}
            >
              {d}
              {visitas > 1 && <span className="absolute -right-0.5 -top-1 rounded-full px-1 text-[9px] font-black" style={{ background: T.amarelo, color: "#111" }}>{visitas}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
