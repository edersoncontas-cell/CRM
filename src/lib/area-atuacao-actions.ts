"use server";

import { revalidatePath } from "next/cache";
import { ufValida, municipiosDaUf } from "@/lib/municipios-brasil";
import { UFS_LIBERADAS } from "@/lib/area-atuacao-regra";
import { salvarAreaAtuacao, type ResumoArea } from "@/lib/area-atuacao";
import { registrarAudit } from "@/lib/audit";

/** Os municípios de um estado (base do IBGE), para a lista da tela. */
export async function listarMunicipiosDaUfAction(uf: string): Promise<{ ok: true; nomes: string[] } | { ok: false; erro: string }> {
  if (!ufValida(uf)) return { ok: false, erro: `Estado desconhecido: ${uf}` };
  if (!UFS_LIBERADAS.includes(uf)) return { ok: false, erro: "Por enquanto a área de atuação é só do Espírito Santo." };
  return { ok: true, nomes: municipiosDaUf(uf).map((m) => m.nome) };
}

export async function salvarAreaAtuacaoAction(entrada: { ufs: string[]; municipios: { uf: string; nome: string }[] }): Promise<{ ok: true; resumo: ResumoArea } | { ok: false; erro: string }> {
  try {
    const r = await salvarAreaAtuacao(entrada);
    if (!r.ok) return r;
    await registrarAudit({
      acao: "area_atuacao_alterada", origem: "usuario",
      descricao: `Área de atuação: ${r.resumo.estados.join(", ")} · ${r.resumo.atende} município(s)`,
      extra: r.resumo,
    });
    // Tudo que mostra cidade, mapa ou região passa a ler a área nova.
    for (const p of ["/configuracoes", "/dashboard", "/visitas", "/clientes", "/marketing", "/negociacoes", "/sem-sinal"]) revalidatePath(p);
    revalidatePath("/", "layout");
    return r;
  } catch (e) {
    return { ok: false, erro: `Não consegui salvar: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}` };
  }
}
