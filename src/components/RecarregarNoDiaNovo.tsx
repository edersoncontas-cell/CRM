"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// DIA VIROU, A TELA RECARREGA.
//
// O CRM vive aberto no celular dele como app. Quando ele volta ao app no dia
// seguinte, o navegador mostra a MESMA tela de ontem — a motivação de ontem,
// a saudação de ontem, a data de ontem — até alguma coisa recarregar. Era uma
// das causas de "a mesma mensagem em dias diferentes".
//
// Aqui: a tela sabe em que dia (Brasília) foi montada; ao voltar para ela,
// se o dia já é outro, pede os dados de novo ao servidor. No mesmo dia não
// faz nada — voltar ao app não custa consulta nenhuma.

function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function RecarregarNoDiaNovo({ dia }: { dia: string }) {
  const router = useRouter();
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState !== "visible") return;
      if (hojeBrasilia() !== dia) router.refresh();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [dia, router]);
  return null;
}
