"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { definirTemaAction } from "@/lib/tema-actions";
import type { ModoTema } from "@/lib/tema";

// O SOL E A LUA, FIXOS NO CANTO DE TODAS AS TELAS.
//
// Substitui o card "Tema do CRM" de Configurações (01/10, pedido dele): para
// trocar de tema não deve ser preciso ir até Configurações — ele usa o CRM na
// cabine e no escritório e troca conforme a luz. Duas opções, nada de
// "automático pelo sistema": quem manda na escolha é ele (lib/tema.ts).
//
// Vale o que o card já fazia: a escolha vai em cookie (definirTemaAction), por
// aparelho, e a casca é refeita no servidor. Para o clique não parecer morto
// enquanto isso, a cor muda na hora pelo data-theme da raiz.
export function AlternarTema({ atual }: { atual: ModoTema }) {
  const [modo, setModo] = useState<ModoTema>(atual);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // O servidor é quem manda: depois de um refresh (ou de trocar o tema em
  // outra aba) vale o que ele devolveu.
  useEffect(() => { setModo(atual); }, [atual]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pintar = (m: ModoTema) => { document.documentElement.dataset.theme = m === "claro" ? "light" : "dark"; };

  function escolher(novo: ModoTema) {
    if (novo === modo || salvando) return;
    const anterior = modo;
    setModo(novo);
    setAviso(null);
    pintar(novo);
    startTransition(async () => {
      try {
        await definirTemaAction(novo);
        // Sem o refresh a parte desenhada no servidor (Dashboard, barra do
        // celular) só trocaria na próxima navegação.
        router.refresh();
      } catch {
        // Sem internet a escolha não é gravada. Volta ao que valia e DIZ —
        // clicar e ver nada acontecer em silêncio é o pior desfecho.
        setModo(anterior);
        pintar(anterior);
        setAviso("Sem conexão: o tema não mudou.");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setAviso(null), 4000);
      }
    });
  }

  const opcoes: { id: ModoTema; nome: string; icone: React.ReactNode }[] = [
    { id: "claro", nome: "Tema claro", icone: <Sun size={17} className="md:h-3.5 md:w-3.5" /> },
    { id: "escuro", nome: "Tema escuro", icone: <Moon size={17} className="md:h-3.5 md:w-3.5" /> },
  ];

  return (
    // No celular fica na barra de cima, ao lado do botão do menu; no
    // computador, no canto direito, DENTRO da margem de cima das telas (os 24 a
    // 32 px de padding) — por isso o par é pequeno lá (26 px): o botão
    // "Atualizar" do Dashboard começa em y=30 e o título das demais em y=32.
    // Fora da impressão.
    <div
      className="fixed right-[3.75rem] top-[calc(max(0.75rem,env(safe-area-inset-top))-3px)] z-30 md:right-4 md:top-0.5 print:hidden"
    >
      <div
        role="group"
        aria-label="Tema do CRM"
        className="flex items-center gap-0.5 rounded-full border border-[var(--menu-borda)] bg-[var(--menu-fundo)] p-0.5 shadow-sm md:p-px"
      >
        {opcoes.map((o) => {
          const ativo = modo === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => escolher(o.id)}
              aria-pressed={ativo}
              aria-label={o.nome}
              title={o.nome}
              // min-h/min-w: a regra global de 44 px para botão no celular
              // deixaria o par com quase 100 px e fora da barra.
              className={`flex h-9 min-h-0 w-9 min-w-0 items-center justify-center rounded-full transition md:h-[22px] md:w-[22px] ${
                ativo
                  ? "bg-agro-400 text-black"
                  : "text-[var(--menu-texto2)] hover:text-[var(--menu-texto)]"
              }`}
            >
              {o.icone}
            </button>
          );
        })}
      </div>
      {aviso && (
        <div role="status" className="absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white shadow">
          {aviso}
        </div>
      )}
    </div>
  );
}
