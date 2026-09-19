"use client";

import { useState } from "react";
import { Megaphone, Send } from "lucide-react";
import { cn } from "@/lib/utils";

// Marketing tem dois caminhos: criar post para as redes e mandar mensagem
// para a carteira. Antes a mensagem em massa morava dentro de Visitas, o que
// confundia — mandar promoção para 200 clientes não é uma visita.
export function MarketingAbas({ posts, mensagem, inicial = "posts" }: {
  posts: React.ReactNode;
  mensagem: React.ReactNode;
  inicial?: "posts" | "mensagem";
}) {
  const [aba, setAba] = useState<"posts" | "mensagem">(inicial);
  const abas = [
    { id: "posts" as const, label: "Post para as redes", icon: Megaphone },
    { id: "mensagem" as const, label: "Mensagem para clientes", icon: Send },
  ];
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={cn("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition",
              aba === a.id ? "bg-slate-900 text-agro-400" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}
          >
            <a.icon size={16} /> {a.label}
          </button>
        ))}
      </div>
      <div hidden={aba !== "posts"}>{posts}</div>
      <div hidden={aba !== "mensagem"}>{mensagem}</div>
    </div>
  );
}
