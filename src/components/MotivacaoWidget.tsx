"use client";

const FRASES_MOTIVACIONAIS = [
  { texto: "Venda não é persuasão — é ajudar alguém a tomar a decisão certa.", autor: "Brian Tracy" },
  { texto: "Cada 'não' que ouço me aproxima do próximo 'sim'. Sigo em frente.", autor: "Mentalidade de campeão" },
  { texto: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", autor: "Robert Collier" },
  { texto: "Não espere pela oportunidade perfeita. Crie-a.", autor: "George Bernard Shaw" },
  { texto: "A diferença entre ordinário e extraordinário é aquele pequeno 'extra'.", autor: "Jimmy Johnson" },
  { texto: "Cada cliente é uma porta. O seu trabalho é encontrar a chave certa.", autor: "Mentalidade de vendedor" },
  { texto: "Uma ligação hoje vale mais que dez amanhã. Faz a ligação.", autor: "Regra do vendedor" },
];

export function FraseMotivacional() {
  const dia = new Date().getDate() + new Date().getMonth() * 31;
  const frase = FRASES_MOTIVACIONAIS[dia % FRASES_MOTIVACIONAIS.length];

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "#000000", border: "1px solid #27272a", boxShadow: "0 0 30px 0 rgba(191,222,77,0.06)" }}
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#BFDE4D" }}>
        Frase do dia
      </p>
      <div className="mb-3 h-px w-12" style={{ background: "linear-gradient(90deg, #BFDE4D, transparent)" }} />
      <blockquote className="text-sm font-medium leading-relaxed text-white">&ldquo;{frase.texto}&rdquo;</blockquote>
      <p className="mt-2 text-xs text-zinc-500">— {frase.autor}</p>
    </div>
  );
}

export function DicaVendas() {
  const dicas = [
    { emoji: "📞", dica: "Ligue antes das 9h — a taxa de resposta é 30% maior." },
    { emoji: "💬", dica: "Primeira mensagem: pergunte sobre o PROBLEMA, não sobre a máquina." },
    { emoji: "🎯", dica: "Siga o protocolo: contato → visita → proposta → fechamento. Não pule etapas." },
    { emoji: "⏱️", dica: "Responda em até 5 minutos. Depois de 1 hora, a chance cai 80%." },
    { emoji: "🏗️", dica: "Mencione a obra do cliente — mostra que você pesquisou." },
    { emoji: "💡", dica: "Fale de economia de combustível em reais/mês, não em percentual." },
    { emoji: "🤝", dica: "Após uma venda perdida, mande um WhatsApp de parabéns 6 meses depois. Semeia futuro." },
  ];

  const idx = new Date().getDay() % dicas.length;
  const dica = dicas[idx];

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "#000000",
        border: "1px solid #27272a",
        boxShadow: "0 0 30px 0 rgba(191,222,77,0.06)",
      }}
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "#BFDE4D" }}>
        Técnica de vendas — hoje
      </p>
      <div className="mb-3 h-px w-12" style={{ background: "linear-gradient(90deg, #BFDE4D, transparent)" }} />
      <p className="text-sm font-medium text-white">
        {dica.emoji} {dica.dica}
      </p>
    </div>
  );
}
