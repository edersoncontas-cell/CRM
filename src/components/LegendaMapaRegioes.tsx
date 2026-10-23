"use client";

import { useMemo } from "react";
import Link from "next/link";
import malha from "@/lib/malha-es.json";
import { COR_NAO_ATENDO, resumirMapa } from "@/lib/mapa-regioes-es";

// Legenda do mapa por região: quantas cidades ele atende, as regiões com cor e o
// cinza do "não atendo". Fica embaixo do mapa, no tom da tela (quem usa passa as
// cor). Tem os quatro estados: lista lida, vazia (ninguém marcado), e
// desconhecida (o banco não respondeu — sem cores no mapa e a legenda diz isso).

const NOMES = (malha as unknown as { features: { properties: { nome: string } }[] }).features.map((f) => f.properties.nome);

export function LegendaMapaRegioes({ atendidos, texto }: { atendidos: string[] | null; texto: string }) {
  const resumo = useMemo(() => resumirMapa(NOMES, atendidos ? new Set(atendidos) : null), [atendidos]);

  if (!atendidos) {
    return (
      <p role="status" data-mapa-legenda="desconhecida" className="mt-2 text-xs" style={{ color: texto }}>
        Não consegui ler a lista das cidades que você atende, então o mapa está sem cores. Recarregue a tela para tentar de novo.
      </p>
    );
  }
  if (resumo.atendidas === 0) {
    return (
      <p data-mapa-legenda="vazia" className="mt-2 text-xs" style={{ color: texto }}>
        Nenhuma cidade marcada como atendida — o mapa ficou todo cinza. Marque as suas em <Link href="/configuracoes" className="underline">Configurações → Área de atuação</Link>.
      </p>
    );
  }
  return (
    <div data-mapa-legenda="ok" className="mt-2 text-xs" style={{ color: texto }}>
      <div className="mb-1 font-semibold">
        Você atende {resumo.atendidas} de {resumo.total} cidades
      </div>
      <ul className="flex max-h-28 flex-wrap gap-x-3 gap-y-1 overflow-y-auto pr-1" style={{ color: texto }}>
        {resumo.regioes.map(({ regiao, qtd }) => (
          <li key={regiao.id} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: regiao.cor, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)" }} />
            <span>{regiao.nome} <b>{qtd}</b></span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: COR_NAO_ATENDO, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)" }} />
          <span>Não atendo <b>{resumo.naoAtendidas}</b></span>
        </li>
      </ul>
    </div>
  );
}
