"use server";

import { revalidatePath } from "next/cache";
import { getConfig, setConfig } from "@/lib/config";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { lerRegrasNegocio } from "@/lib/contexto-negocio";
import { contarFatosVendedor } from "@/lib/orientador-vendedor-dados";
import { analisarVendedor } from "@/lib/orientador-vendedor";
import {
  CHAVE_LEITURA, assinaturaDosFatos, montarPedido, limparResposta, type LeituraIA,
} from "@/lib/orientador-vendedor-ia";
import { registrarAudit } from "@/lib/audit";

// A leitura com IA: guardada, e refeita só quando ele pedir.
//
// Ele paga só o Gemini Plus. Tela que chama IA sozinha a cada carregamento
// gasta cota dele sem ele pedir — por isso a geração é sempre um clique, e o
// que já foi escrito fica guardado até os números mudarem.

export type EstadoLeitura = {
  leitura: LeituraIA | null;
  /** Os números mudaram desde que esta leitura foi escrita. */
  desatualizada: boolean;
  temIA: boolean;
};

export async function lerLeituraVendedorAction(): Promise<EstadoLeitura> {
  const temIA = iaHabilitada();
  try {
    const bruto = await getConfig(CHAVE_LEITURA);
    if (!bruto) return { leitura: null, desatualizada: false, temIA };
    const leitura = JSON.parse(bruto) as LeituraIA;
    if (!leitura?.texto) return { leitura: null, desatualizada: false, temIA };
    const fatos = await contarFatosVendedor();
    return { leitura, desatualizada: assinaturaDosFatos(fatos) !== leitura.assinatura, temIA };
  } catch {
    return { leitura: null, desatualizada: false, temIA };
  }
}

export async function gerarLeituraVendedorAction(): Promise<{ ok: boolean; leitura?: LeituraIA; erro?: string }> {
  if (!iaHabilitada()) {
    return { ok: false, erro: "Nenhum provedor de IA configurado. Cole a chave em Configurações." };
  }
  try {
    const [fatos, regras] = await Promise.all([contarFatosVendedor(), lerRegrasNegocio().catch(() => [])]);
    const d = analisarVendedor(fatos);
    if (d.poucosDados) {
      return { ok: false, erro: "Ainda não há negociação encerrada suficiente para uma leitura honesta." };
    }
    const { system, user } = montarPedido(fatos, d, regras.map((r) => r.texto));
    const bruto = await llmTexto(system, user, { maxTokens: 700 });
    const texto = limparResposta(bruto);
    if (!texto) return { ok: false, erro: "A IA respondeu vazio. Tente de novo." };

    const leitura: LeituraIA = { texto, em: new Date().toISOString(), assinatura: assinaturaDosFatos(fatos) };
    await setConfig(CHAVE_LEITURA, JSON.stringify(leitura));
    // A auditoria grava o FATO, nunca a chave nem o provedor de onde veio.
    await registrarAudit({
      acao: "perfil_atualizado", origem: "ia",
      descricao: "Leitura do desempenho do vendedor gerada com IA (Como você vende).",
    }).catch(() => {});
    revalidatePath("/como-voce-vende");
    return { ok: true, leitura };
  } catch (e) {
    console.error("[orientador-vendedor] leitura IA:", e);
    // A mensagem do provedor pode trazer detalhe de credencial: nunca vai
    // para a tela. O vendedor precisa saber que falhou, não o porquê técnico.
    return { ok: false, erro: "A IA não respondeu agora. Tente de novo em alguns minutos." };
  }
}
