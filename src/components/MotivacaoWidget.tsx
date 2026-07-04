"use client";

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
