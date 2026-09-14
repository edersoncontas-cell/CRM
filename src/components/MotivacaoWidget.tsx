// Widgets de motivação do Dashboard. São Server Components de propósito: o
// índice do dia é calculado no servidor (fuso de Brasília) e vai pronto no
// HTML — como "use client" + new Date() a frase mudava entre servidor (UTC) e
// navegador perto da meia-noite, gerando erro de hidratação no Next.

import { T } from "@/lib/dash-tema";

const FRASES_MOTIVACIONAIS = [
  { texto: "Venda não é persuasão — é ajudar alguém a tomar a decisão certa.", autor: "Brian Tracy" },
  { texto: "Cada 'não' que ouço me aproxima do próximo 'sim'. Sigo em frente.", autor: "Mentalidade de campeão" },
  { texto: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", autor: "Robert Collier" },
  { texto: "Não espere pela oportunidade perfeita. Crie-a.", autor: "George Bernard Shaw" },
  { texto: "A diferença entre ordinário e extraordinário é aquele pequeno 'extra'.", autor: "Jimmy Johnson" },
  { texto: "Cada cliente é uma porta. O seu trabalho é encontrar a chave certa.", autor: "Mentalidade de vendedor" },
  { texto: "Uma ligação hoje vale mais que dez amanhã. Faz a ligação.", autor: "Regra do vendedor" },
];

const DICAS = [
  { emoji: "📞", dica: "Ligue antes das 9h — a taxa de resposta é 30% maior." },
  { emoji: "💬", dica: "Primeira mensagem: pergunte sobre o PROBLEMA, não sobre a máquina." },
  { emoji: "🎯", dica: "Siga o protocolo: contato → visita → proposta → fechamento. Não pule etapas." },
  { emoji: "⏱️", dica: "Responda em até 5 minutos. Depois de 1 hora, a chance cai 80%." },
  { emoji: "🏗️", dica: "Mencione a obra do cliente — mostra que você pesquisou." },
  { emoji: "💡", dica: "Fale de economia de combustível em reais/mês, não em percentual." },
  { emoji: "🤝", dica: "Após uma venda perdida, mande um WhatsApp de parabéns 6 meses depois. Semeia futuro." },
];

function hojeBrasilia(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function Caixa({ rotulo, cor, children }: { rotulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.borda}`, boxShadow: `0 0 30px 0 ${cor}14` }}>
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: cor }}>{rotulo}</p>
      <div className="mb-3 h-px w-12" style={{ background: `linear-gradient(90deg, ${cor}, transparent)` }} />
      {children}
    </div>
  );
}

export function FraseMotivacional() {
  const hoje = hojeBrasilia();
  const dia = hoje.getDate() + hoje.getMonth() * 31;
  const frase = FRASES_MOTIVACIONAIS[dia % FRASES_MOTIVACIONAIS.length];
  return (
    <Caixa rotulo="Frase do dia" cor={T.rosa}>
      <blockquote className="text-sm font-medium leading-relaxed" style={{ color: T.texto }}>&ldquo;{frase.texto}&rdquo;</blockquote>
      <p className="mt-2 text-xs" style={{ color: T.mudo }}>— {frase.autor}</p>
    </Caixa>
  );
}

export function DicaVendas() {
  const dica = DICAS[hojeBrasilia().getDay() % DICAS.length];
  return (
    <Caixa rotulo="Técnica de vendas — hoje" cor={T.ciano}>
      <p className="text-sm font-medium" style={{ color: T.texto }}>{dica.emoji} {dica.dica}</p>
    </Caixa>
  );
}
