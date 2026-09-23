// "Frase do dia" do Dashboard — texto motivacional + citação, novos todo dia
// e sem repetir (ver lib/frase-dia.ts). Server Component: nada é calculado
// no navegador, então não há risco de erro de hidratação.

import { obterFraseDoDia } from "@/lib/frase-dia";
import { temaDashAtual } from "@/lib/tema-servidor";
import { Sparkles } from "lucide-react";

export async function FraseMotivacional() {
  const T = temaDashAtual();
  const f = await obterFraseDoDia();
  return (
    <div
      className="rounded-2xl p-5 md:p-6"
      style={{ background: `linear-gradient(135deg, ${T.card2} 0%, ${T.card} 60%)`, border: `1px solid ${T.borda}`, boxShadow: `0 0 40px 0 ${T.rosa}14` }}
    >
      <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: T.rosa }}>
        <Sparkles size={14} /> Motivação do dia
      </p>
      <p className="text-sm leading-relaxed md:text-[15px]" style={{ color: T.texto }}>{f.texto}</p>
      <div className="my-3 h-px w-16" style={{ background: `linear-gradient(90deg, ${T.rosa}, ${T.violeta}, transparent)` }} />
      <blockquote className="text-base font-bold italic leading-snug md:text-lg" style={{ background: `linear-gradient(90deg, ${T.amarelo}, ${T.rosa})`, WebkitBackgroundClip: "text", color: "transparent" }}>
        &ldquo;{f.frase}&rdquo;
      </blockquote>
      <p className="mt-1.5 text-xs" style={{ color: T.texto2 }}>— {f.autor}</p>
    </div>
  );
}
