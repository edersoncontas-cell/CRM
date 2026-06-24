import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { resolveZApiConfig } from "@/lib/zapi";

export const dynamic = "force-dynamic";

function pareceNumeroTelefone(s: string): boolean {
  if (!s) return false;
  const stripped = s.replace(/[\s+\-().@]/g, "").replace(/@.*$/, "");
  return /^\d{6,}$/.test(stripped);
}

type ZapiChat = { phone: string; lid?: string; name?: string };

/**
 * Busca todos os chats da Z-API (múltiplas páginas) e retorna dois Maps:
 * - por phone (digits-only) -> nome
 * - por lid (digits-only) -> { nome, phoneFull } para também atualizar externalPhone
 */
async function buscarChatsZapi(): Promise<{
  porPhone: Map<string, string>;
  porLid: Map<string, { nome: string; phoneFull: string }>;
}> {
  const porPhone = new Map<string, string>();
  const porLid = new Map<string, { nome: string; phoneFull: string }>();

  const cfg = await resolveZApiConfig();
  if (!cfg) return { porPhone, porLid };

  for (let page = 1; page <= 10; page++) {
    try {
      const url = `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.token}/chats?page=${page}&pageSize=100`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(cfg.clientToken ? { "Client-Token": cfg.clientToken } : {}) },
        cache: "no-store",
      });
      if (!res.ok) break;
      const data: ZapiChat[] = await res.json().catch(() => null);
      if (!Array.isArray(data) || data.length === 0) break;

      for (const c of data) {
        if (c.isGroup) continue;
        const nome: string | undefined = (c as Record<string, unknown>).name as string ?? (c as Record<string, unknown>).chatName as string ?? undefined;
        if (!nome || pareceNumeroTelefone(nome)) continue;

        const phoneDigits = c.phone?.replace(/\D/g, "") ?? "";
        const lidDigits = c.lid?.replace(/@lid$/i, "").replace(/\D/g, "") ?? "";

        if (phoneDigits) {
          porPhone.set(phoneDigits, nome);
          // também variantes BR
          for (const v of phoneLookupVariants(phoneDigits)) porPhone.set(v, nome);
        }
        if (lidDigits) {
          porLid.set(lidDigits, { nome, phoneFull: c.phone ?? "" });
        }
      }
      if (data.length < 100) break;
    } catch { break; }
  }

  return { porPhone, porLid };
}

/**
 * POST /api/whatsapp/corrigir-nomes
 * Para cada conversa sem contactName:
 * 1. Tenta pelo cliente vinculado (clienteId)
 * 2. Tenta pelo telefone no CRM
 * 3. Tenta pelo phone na Z-API (chats)
 * 4. Tenta pelo LID na Z-API (chats) — caso principal dos números 15 dígitos
 *    Quando acha pelo LID, também atualiza externalPhone com o telefone real
 */
export async function POST() {
  try {
    const conversas = await db.whatsAppConversation.findMany({
      where: { isGroup: false },
      select: { id: true, contactName: true, externalPhone: true, lid: true, clienteId: true },
    });

    const precisaCorrigir = conversas.filter(
      (c) => !c.contactName || !c.contactName.trim() || pareceNumeroTelefone(c.contactName)
    );

    if (precisaCorrigir.length === 0) {
      return NextResponse.json({ ok: true, total: conversas.length, atualizados: 0, mensagem: "Tudo OK, nenhuma correção necessária." });
    }

    const { porPhone, porLid } = await buscarChatsZapi();

    let doCrm = 0;
    let daZapiPhone = 0;
    let daZapiLid = 0;
    let semNome = 0;

    for (const conv of precisaCorrigir) {
      let nomeNovo: string | null = null;
      let novoClienteId: string | null = conv.clienteId;
      let novoPhone: string | null = null;

      // 1. Cliente vinculado
      if (conv.clienteId) {
        const cli = await db.cliente.findUnique({ where: { id: conv.clienteId }, select: { nome: true } });
        if (cli?.nome && !pareceNumeroTelefone(cli.nome)) nomeNovo = cli.nome;
      }

      // 2. Busca por telefone no CRM
      if (!nomeNovo) {
        const variants = phoneLookupVariants(conv.externalPhone);
        if (variants.length > 0) {
          const cli = await db.cliente.findFirst({
            where: { telefone: { in: variants } },
            select: { id: true, nome: true },
          });
          if (cli?.nome && !pareceNumeroTelefone(cli.nome)) {
            nomeNovo = cli.nome;
            novoClienteId = cli.id;
          }
        }
      }

      // 3. Z-API por phone
      if (!nomeNovo) {
        const phoneDigits = conv.externalPhone.replace(/\D/g, "");
        const nome = porPhone.get(phoneDigits);
        if (nome) { nomeNovo = nome; daZapiPhone++; }
      }

      // 4. Z-API por LID (caso dos números de 14-15 dígitos que são LIDs)
      if (!nomeNovo) {
        // O externalPhone pode ser o próprio LID (digits only, 14-15 chars)
        // ou o conv.lid pode ter o LID com @lid
        const lidDigits =
          conv.lid?.replace(/@lid$/i, "").replace(/\D/g, "") ??
          conv.externalPhone.replace(/\D/g, "");

        const match = porLid.get(lidDigits);
        if (match?.nome) {
          nomeNovo = match.nome;
          // Se o externalPhone atual é um LID (não começa com 55 e tem 14+ dígitos),
          // atualiza para o número real retornado pela Z-API
          const phoneAtualDigits = conv.externalPhone.replace(/\D/g, "");
          if (phoneAtualDigits.length >= 14 && match.phoneFull && match.phoneFull.length > 0) {
            novoPhone = match.phoneFull.replace(/\D/g, "");
          }
          daZapiLid++;
        }
      }

      if (nomeNovo) {
        const updateData: Record<string, string | null> = { contactName: nomeNovo };
        if (novoClienteId && novoClienteId !== conv.clienteId) updateData.clienteId = novoClienteId;
        if (novoPhone) updateData.externalPhone = novoPhone;

        await db.whatsAppConversation.update({ where: { id: conv.id }, data: updateData });
        if (!conv.clienteId && novoClienteId) doCrm++;
      } else {
        semNome++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: conversas.length,
      precisavam: precisaCorrigir.length,
      atualizados: precisaCorrigir.length - semNome,
      doCrm,
      daZapiPhone,
      daZapiLid,
      semNome,
      mensagem: `${precisaCorrigir.length} sem nome → ${precisaCorrigir.length - semNome} corrigidos (${doCrm} CRM, ${daZapiPhone} Z-API phone, ${daZapiLid} Z-API LID). ${semNome} sem match.`,
    });
  } catch (e) {
    console.error("[corrigir-nomes]", e);
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}

/** GET: diagnóstico */
export async function GET() {
  try {
    const conversas = await db.whatsAppConversation.findMany({
      where: { isGroup: false },
      select: { id: true, contactName: true, externalPhone: true, lid: true, clienteId: true },
    });
    const semNome = conversas.filter((c) => !c.contactName || !c.contactName.trim());
    const nomeNumero = conversas.filter((c) => c.contactName && pareceNumeroTelefone(c.contactName));
    return NextResponse.json({
      ok: true,
      total: conversas.length,
      semNome: semNome.length,
      nomeNumero: nomeNumero.length,
      exemplos: [...nomeNumero, ...semNome].slice(0, 10).map((c) => ({
        phone: c.externalPhone, lid: c.lid, contactName: c.contactName, clienteId: c.clienteId,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { resolveZApiConfig } from "@/lib/zapi";

export const dynamic = "force-dynamic";

function pareceNumeroTelefone(s: string): boolean {
  if (!s) return false;
  const stripped = s.replace(/[\s+\-().@]/g, "").replace(/@.*$/, "");
  return /^\d{6,}$/.test(stripped);
}

/**
 * Busca os chats da Z-API em múltiplas páginas e monta um Map: phone -> nome.
 * A Z-API retorna o nome do contato salvo no celular (agenda).
 */
async function buscarNomesDaZapi(): Promise<Map<string, string>> {
  const nomes = new Map<string, string>();
  const cfg = await resolveZApiConfig();
  if (!cfg) return nomes;

  // Busca várias páginas de chats (pageSize max costuma ser 100)
  for (let page = 1; page <= 10; page++) {
    try {
      const url = `${cfg.apiUrl}/instances/${cfg.instanceId}/token/${cfg.token}/chats?page=${page}&pageSize=100`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(cfg.clientToken ? { "Client-Token": cfg.clientToken } : {}) },
        cache: "no-store",
      });
      if (!res.ok) break;
      const data = await res.json().catch(() => null);
      if (!Array.isArray(data) || data.length === 0) break;

      for (const chat of data) {
        const phone = String(chat.phone ?? chat.id ?? "").replace(/[^\d@.]/g, "");
        const nome = (chat.name as string) ?? (chat.chatName as string) ?? null;
        if (phone && nome && !pareceNumeroTelefone(nome)) {
          nomes.set(phone, nome);
          // também armazena variantes do telefone (sem 55, com 9 dígito etc)
          const variants = phoneLookupVariants(phone);
          for (const v of variants) nomes.set(v, nome);
        }
      }
      if (data.length < 100) break; // última página
    } catch {
      break;
    }
  }
  return nomes;
}

/**
 * POST /api/whatsapp/corrigir-nomes
 * 1. Carrega todos os nomes de contatos da Z-API (chats)
 * 2. Para cada conversa sem contactName (ou com número no nome):
 *    a. Tenta pelo nome do cliente vinculado no CRM
 *    b. Tenta pelo telefone no CRM
 *    c. Tenta pelo mapa de nomes da Z-API
 */
export async function POST() {
  try {
    const conversas = await db.whatsAppConversation.findMany({
      where: { isGroup: false },
      select: { id: true, contactName: true, externalPhone: true, clienteId: true },
    });

    const precisaCorrigir = conversas.filter(
      (c) => !c.contactName || !c.contactName.trim() || pareceNumeroTelefone(c.contactName)
    );

    if (precisaCorrigir.length === 0) {
      return NextResponse.json({ ok: true, total: conversas.length, atualizados: 0, mensagem: "Nenhuma conversa precisa de correção." });
    }

    // Carrega nomes da Z-API uma vez
    const nomesZapi = await buscarNomesDaZapi();

    let doCrm = 0;
    let daZapi = 0;
    let semNome = 0;

    for (const conv of precisaCorrigir) {
      let nomeNovo: string | null = null;
      let novoClienteId: string | null = conv.clienteId;

      // 1. Nome do cliente vinculado
      if (conv.clienteId) {
        const cli = await db.cliente.findUnique({ where: { id: conv.clienteId }, select: { nome: true } });
        if (cli?.nome && !pareceNumeroTelefone(cli.nome)) nomeNovo = cli.nome;
      }

      // 2. Busca pelo telefone no CRM
      if (!nomeNovo) {
        const variants = phoneLookupVariants(conv.externalPhone);
        if (variants.length > 0) {
          const cli = await db.cliente.findFirst({
            where: { telefone: { in: variants } },
            select: { id: true, nome: true },
          });
          if (cli?.nome && !pareceNumeroTelefone(cli.nome)) {
            nomeNovo = cli.nome;
            novoClienteId = cli.id;
          }
        }
      }

      // 3. Busca no mapa de nomes da Z-API
      if (!nomeNovo) {
        const phone = conv.externalPhone.replace(/[^\d@.]/g, "");
        const variants = phoneLookupVariants(phone);
        for (const v of [phone, ...variants]) {
          const nome = nomesZapi.get(v);
          if (nome) { nomeNovo = nome; break; }
        }
      }

      if (nomeNovo) {
        await db.whatsAppConversation.update({
          where: { id: conv.id },
          data: {
            contactName: nomeNovo,
            ...(novoClienteId && novoClienteId !== conv.clienteId ? { clienteId: novoClienteId } : {}),
          },
        });
        if (!conv.clienteId && novoClienteId) doCrm++;
        else if (nomesZapi.has(conv.externalPhone.replace(/[^\d@.]/g, ""))) daZapi++;
        else doCrm++;
      } else {
        semNome++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: conversas.length,
      precisavam: precisaCorrigir.length,
      atualizados: doCrm + daZapi,
      doCrm,
      daZapi,
      semNome,
      mensagem: `${precisaCorrigir.length} conversas sem nome: ${doCrm + daZapi} atualizadas (${doCrm} do CRM, ${daZapi} da agenda), ${semNome} sem nome disponível.`,
    });
  } catch (e) {
    console.error("[corrigir-nomes]", e);
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}

/** GET: diagnóstico */
export async function GET() {
  try {
    const conversas = await db.whatsAppConversation.findMany({
      where: { isGroup: false },
      select: { id: true, contactName: true, externalPhone: true, clienteId: true },
    });
    const semNome = conversas.filter((c) => !c.contactName || !c.contactName.trim());
    const nomeNumero = conversas.filter((c) => c.contactName && pareceNumeroTelefone(c.contactName));
    return NextResponse.json({
      ok: true,
      total: conversas.length,
      semNome: semNome.length,
      nomeNumero: nomeNumero.length,
      exemplos: [...nomeNumero, ...semNome].slice(0, 10).map((c) => ({
        phone: c.externalPhone,
        contactName: c.contactName,
        clienteId: c.clienteId,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}
