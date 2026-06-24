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

type ZapiChat = { phone: string; lid?: string; name?: string; chatName?: string; isGroup?: boolean };

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
        const nome = c.name ?? c.chatName;
        if (!nome || pareceNumeroTelefone(nome)) continue;
        const phoneDigits = c.phone?.replace(/\D/g, "") ?? "";
        const lidDigits = c.lid?.replace(/@lid$/i, "").replace(/\D/g, "") ?? "";
        if (phoneDigits) {
          porPhone.set(phoneDigits, nome);
          for (const v of phoneLookupVariants(phoneDigits)) porPhone.set(v, nome);
        }
        if (lidDigits) porLid.set(lidDigits, { nome, phoneFull: c.phone ?? "" });
      }
      if (data.length < 100) break;
    } catch { break; }
  }
  return { porPhone, porLid };
}

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
      return NextResponse.json({ ok: true, total: conversas.length, atualizados: 0, mensagem: "Tudo OK." });
    }
    const { porPhone, porLid } = await buscarChatsZapi();
    let doCrm = 0, daZapiPhone = 0, daZapiLid = 0, semNome = 0;
    for (const conv of precisaCorrigir) {
      let nomeNovo: string | null = null;
      let novoClienteId: string | null = conv.clienteId;
      let novoPhone: string | null = null;
      // 1. Cliente vinculado
      if (conv.clienteId) {
        const cli = await db.cliente.findUnique({ where: { id: conv.clienteId }, select: { nome: true } });
        if (cli?.nome && !pareceNumeroTelefone(cli.nome)) { nomeNovo = cli.nome; doCrm++; }
      }
      // 2. Busca por telefone no CRM
      if (!nomeNovo) {
        const variants = phoneLookupVariants(conv.externalPhone);
        if (variants.length > 0) {
          const cli = await db.cliente.findFirst({ where: { telefone: { in: variants } }, select: { id: true, nome: true } });
          if (cli?.nome && !pareceNumeroTelefone(cli.nome)) { nomeNovo = cli.nome; novoClienteId = cli.id; doCrm++; }
        }
      }
      // 3. Z-API por phone
      if (!nomeNovo) {
        const phoneDigits = conv.externalPhone.replace(/\D/g, "");
        const nome = porPhone.get(phoneDigits);
        if (nome) { nomeNovo = nome; daZapiPhone++; }
      }
      // 4. Z-API por LID (numeros de 14-15 digitos sao LIDs do WhatsApp)
      if (!nomeNovo) {
        const lidDigits = conv.lid?.replace(/@lid$/i, "").replace(/\D/g, "") ?? conv.externalPhone.replace(/\D/g, "");
        const match = porLid.get(lidDigits);
        if (match?.nome) {
          nomeNovo = match.nome;
          const phoneAtualDigits = conv.externalPhone.replace(/\D/g, "");
          if (phoneAtualDigits.length >= 14 && match.phoneFull) novoPhone = match.phoneFull.replace(/\D/g, "");
          daZapiLid++;
        }
      }
      if (nomeNovo) {
        const updateData: Record<string, string | null> = { contactName: nomeNovo };
        if (novoClienteId && novoClienteId !== conv.clienteId) updateData.clienteId = novoClienteId;
        if (novoPhone) updateData.externalPhone = novoPhone;
        await db.whatsAppConversation.update({ where: { id: conv.id }, data: updateData });
      } else { semNome++; }
    }
    return NextResponse.json({
      ok: true, total: conversas.length, precisavam: precisaCorrigir.length,
      atualizados: precisaCorrigir.length - semNome, doCrm, daZapiPhone, daZapiLid, semNome,
      mensagem: `${precisaCorrigir.length} sem nome → ${precisaCorrigir.length - semNome} corrigidos (${doCrm} CRM, ${daZapiPhone} Z-API phone, ${daZapiLid} Z-API LID). ${semNome} sem match.`,
    });
  } catch (e) {
    console.error("[corrigir-nomes]", e);
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const conversas = await db.whatsAppConversation.findMany({
      where: { isGroup: false },
      select: { id: true, contactName: true, externalPhone: true, lid: true, clienteId: true },
    });
    const semNome = conversas.filter((c) => !c.contactName || !c.contactName.trim());
    const nomeNumero = conversas.filter((c) => c.contactName && pareceNumeroTelefone(c.contactName));
    return NextResponse.json({
      ok: true, total: conversas.length, semNome: semNome.length, nomeNumero: nomeNumero.length,
      exemplos: [...nomeNumero, ...semNome].slice(0, 10).map((c) => ({
        phone: c.externalPhone, lid: c.lid, contactName: c.contactName, clienteId: c.clienteId,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}
