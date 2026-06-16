"use client";

import { useState } from "react";
import { Heart, RefreshCw } from "lucide-react";

const QUOTES = [
  { texto: "Venda não é persuasão — é ajudar alguém a tomar a decisão certa.", autor: "Brian Tracy" },
  { texto: "Cada 'não' que ouço me aproxima do próximo 'sim'. Sigo em frente.", autor: "Mentalidade de campeão" },
  { texto: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", autor: "Robert Collier" },
  { texto: "Não espere pela oportunidade perfeita. Crie-a.", autor: "George Bernard Shaw" },
  { texto: "A diferença entre ordinário e extraordinário é aquele pequeno 'extra'.", autor: "Jimmy Johnson" },
  { texto: "Cada cliente é uma porta. O seu trabalho é encontrar a chave certa.", autor: "Mentalidade de vendedor" },
  { texto: "Energia vai para onde a atenção vai. Foque no que importa hoje.", autor: "Tony Robbins" },
  { texto: "O melhor vendedor não vende produtos — vende soluções para problemas reais.", autor: "Jeffrey Gitomer" },
  { texto: "A persistência é o caminho do êxito.", autor: "Charles Chaplin" },
  { texto: "Sem entusiasmo, nenhum grande feito foi realizado.", autor: "Ralph Waldo Emerson" },
  { texto: "Sua hiperfocagem é um superpoder — use-a nas conversas certas.", autor: "Para quem tem TDAH" },
  { texto: "Uma ligação hoje vale mais que dez amanhã. Faz a ligação.", autor: "Regra do vendedor" },
  { texto: "Um cliente satisfeito traz dez. Faça bem feito.", autor: "Mentalidade de excelência" },
  { texto: "Cada manhã é uma nova chance de superar ontem. Levanta e vai.", autor: "Mentalidade diária" },
  { texto: "A máquina certa no lugar certo transforma o negócio do cliente. Você faz isso acontecer.", autor: "Ederson, sul do ES" },
  { texto: "Quem controla a agenda controla o destino. Planeje o dia antes de ele te planejar.", autor: "Mentalidade de vendedor" },
  { texto: "TDAH não é falta de atenção — é atenção que vai para onde há desafio real.", autor: "Dr. Ned Hallowell" },
  { texto: "Fechar uma venda é o início de um relacionamento, não o fim de uma negociação.", autor: "Mentalidade consultiva" },
  { texto: "Quanto mais você transpira no treinamento, menos sangra na batalha.", autor: "Norman Schwarzkopf" },
  { texto: "Pessoas de sucesso fazem o que fracassados não querem fazer.", autor: "Earl Nightingale" },
  { texto: "Não é o mais inteligente que vence — é o mais consistente.", autor: "Regra do jogo longo" },
  { texto: "O cliente compra sentimento de segurança, não produto. Transmita confiança.", autor: "Zig Ziglar" },
];

function getQuoteOfDay(quotes: typeof QUOTES): typeof QUOTES[0] {
  const dia = new Date().getDate() + new Date().getMonth() * 31;
  return quotes[dia % quotes.length];
}

export function MotivacaoWidget() {
  const [idx, setIdx] = useState(() => {
    const dia = new Date().getDate() + new Date().getMonth() * 31;
    return dia % QUOTES.length;
  });

  const quote = QUOTES[idx];

  const proximo = () => {
    setIdx((i) => (i + 1) % QUOTES.length);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-fuchsia-700 to-brand-700 p-5 text-white shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-200">
          <Heart size={16} className="fill-fuchsia-300 text-fuchsia-300" />
          Motivação do dia
        </div>
        <button
          onClick={proximo}
          title="Próxima frase"
          className="rounded-lg p-1.5 text-fuchsia-300 hover:bg-white/10"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <blockquote className="text-base font-medium leading-relaxed text-white">
        &ldquo;{quote.texto}&rdquo;
      </blockquote>
      <p className="mt-3 text-xs text-fuchsia-300">— {quote.autor}</p>
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
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-500">
        Técnica de vendas — hoje
      </p>
      <p className="text-sm font-medium text-slate-700">
        {dica.emoji} {dica.dica}
      </p>
    </div>
  );
}
