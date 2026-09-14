"use server";

import { revalidatePath } from "next/cache";
import { gravarParametros, lerParametros, type Parametros } from "@/lib/parametros";
import { registrarAudit } from "@/lib/audit";

export async function salvarParametrosAction(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const atual = await lerParametros();
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const taxaPct = Number(s("taxaComissaoPct").replace(",", "."));
  const meta = Number(s("metaAnualVendas"));
  if (!Number.isFinite(taxaPct) || taxaPct < 0 || taxaPct > 100) return { ok: false, erro: "Taxa de comissão inválida (use % entre 0 e 100)." };
  if (!Number.isInteger(meta) || meta < 1) return { ok: false, erro: "Meta anual inválida (número inteiro de máquinas)." };
  const metaVisitas = Number(s("metaVisitasSemana")) || atual.metaVisitasSemana;
  const metaNegocios = Number(s("metaNegociosSemana")) || atual.metaNegociosSemana;

  const novo: Parametros = {
    nomeCrm: s("nomeCrm") || atual.nomeCrm,
    nomeVendedor: s("nomeVendedor") || atual.nomeVendedor,
    nomeEmpresa: s("nomeEmpresa") || atual.nomeEmpresa,
    marcas: s("marcas") || atual.marcas,
    regiao: s("regiao") || atual.regiao,
    taxaComissao: taxaPct / 100,
    metaAnualVendas: meta,
    metaVisitasSemana: Math.max(1, Math.round(metaVisitas)),
    metaNegociosSemana: Math.max(1, Math.round(metaNegocios)),
    whatsappBriefing: s("whatsappBriefing").replace(/\D/g, "") || null,
  };
  await gravarParametros(novo);
  await registrarAudit({ acao: "perfil_atualizado", origem: "usuario", descricao: "Parâmetros do negócio atualizados em Configurações." }).catch(() => {});
  for (const p of ["/configuracoes", "/dashboard", "/financeiro", "/financeiro/faturadas", "/financeiro/comissoes", "/financeiro/comissoes-futuras"]) revalidatePath(p);
  revalidatePath("/", "layout");
  return { ok: true };
}
