import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { phoneLookupVariants } from "@/lib/whatsapp-routing";
import { importarMensagens } from "@/lib/whatsapp-store";
import { deveDescartarContato } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ---- tipos do arquivo exportado pelo script Python do usuário ----
type MsgHistorico = {
  iso?: string;
  data?: string;         // "dd/mm/aaaa, HH:MM" — fallback quando iso ausente
  de_mim: boolean;
  remetente: string | null;
  tipo?: string;         // chat | ptt | audio | image | document | video | sticker
  mensagem?: string;
};

type ClienteJSON = {
  nome: string;
  telefone?: string;
  tipo?: string;         // "individual" | "grupo"
  primeiro_contato?: string;
  ultimo_contato?: string;
  historico?: MsgHistorico[];
};

// Normaliza telefone para armazenamento: dígitos, com DDI 55 (sem +)
function normPhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits || digits.length < 8) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

// Converte "dd/mm/aaaa, HH:MM" → Date (fuso -03)
function parseDataBR(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00.000-03:00`);
}

// Converte mensagem do historico para o formato do importarMensagens
function mapMsg(m: MsgHistorico): { fromMe: boolean; sender: string | null; body: string; sentAt: string } {
  const sentAt = m.iso ?? (m.data ? (parseDataBR(m.data)?.toISOString() ?? new Date().toISOString()) : new Date().toISOString());
  const body = m.mensagem?.trim() || (
    m.tipo === "ptt" || m.tipo === "audio" ? "🎵 Áudio" :
    m.tipo === "image" ? "📷 Imagem" :
    m.tipo === "document" ? "📄 Documento" :
    m.tipo === "video" ? "🎬 Vídeo" :
    m.tipo === "sticker" ? "Figurinha" : ""
  );
  return { fromMe: !!m.de_mim, sender: m.remetente || null, body, sentAt };
}

export async function POST(req: NextRequest) {
  let clientes: ClienteJSON[];
  try {
    const body = await req.json();
    clientes = Array.isArray(body) ? body : Array.isArray(body?.clientes) ? body.clientes : [];
  } catch {
    return NextResponse.json({ ok: false, erro: "payload inválido" }, { status: 400 });
  }
  if (!clientes.length) return NextResponse.json({ ok: false, erro: "array vazio" }, { status: 400 });

  let criados = 0, atualizados = 0, mensagens = 0, erros = 0;

  for (const c of clientes) {
    const nome = c.nome?.trim();
    if (!nome) continue;

    const isGroup = c.tipo === "grupo";
    const phone = normPhone(c.telefone ?? "");

    try {
      // ── 1. Achar ou criar WhatsAppConversation ──────────────────────────
      let conv = null as Awaited<ReturnType<typeof db.whatsAppConversation.findFirst>>;

      if (!isGroup && phone) {
        const variants = phoneLookupVariants(phone);
        conv = await db.whatsAppConversation.findFirst({
          where: { externalPhone: { in: variants } },
          orderBy: { lastMessageAt: "desc" },
        });
      } else if (isGroup) {
        conv = await db.whatsAppConversation.findFirst({
          where: { isGroup: true, groupName: { equals: nome, mode: "insensitive" } },
          orderBy: { lastMessageAt: "desc" },
        });
      }

      const lastAt = parseDataBR(c.ultimo_contato ?? "") ?? new Date(0);

      if (!conv) {
        const extPhone = phone ?? `imp:${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;

        // Para individuais: criar também o Cliente no CRM
        let clienteId: string | null = null;
        if (!isGroup && phone && !deveDescartarContato(nome)) {
          const variants = phoneLookupVariants(phone);
          const cli = await db.cliente.findFirst({ where: { telefone: { in: variants } } });
          if (cli) {
            clienteId = cli.id;
          } else {
            const novo = await db.cliente.create({
              data: { nome, telefone: phone, origem: "whatsapp_historico" },
            });
            clienteId = novo.id;
          }
        }

        conv = await db.whatsAppConversation.create({
          data: {
            externalPhone: extPhone,
            isGroup,
            contactName: isGroup ? null : nome,
            groupName: isGroup ? nome : null,
            lastMessageAt: lastAt > new Date(0) ? lastAt : new Date(),
            clienteId,
          },
        });
        criados++;
      } else {
        // Atualiza nome e data se mais recente
        const patch: Record<string, unknown> = {};
        if (!conv.contactName && !isGroup) patch.contactName = nome;
        if (!conv.groupName && isGroup) patch.groupName = nome;
        if (lastAt > conv.lastMessageAt) patch.lastMessageAt = lastAt;

        // Vincula ao Cliente se ainda não tem
        if (!conv.clienteId && !isGroup && phone && !deveDescartarContato(nome)) {
          const variants = phoneLookupVariants(phone);
          const cli = await db.cliente.findFirst({ where: { telefone: { in: variants } } });
          if (cli) patch.clienteId = cli.id;
        }

        if (Object.keys(patch).length) {
          await db.whatsAppConversation.update({ where: { id: conv.id }, data: patch });
        }
        atualizados++;
      }

      // ── 2. Importar mensagens (se historico presente) ───────────────────
      if (Array.isArray(c.historico) && c.historico.length) {
        const msgs = c.historico
          .map(mapMsg)
          .filter((m) => m.body || m.sentAt);
        const n = await importarMensagens(conv.id, msgs, isGroup);
        mensagens += n;
      }
    } catch (e) {
      console.error("[import-json] erro em", nome, e);
      erros++;
    }
  }

  return NextResponse.json({ ok: true, criados, atualizados, mensagens, erros, total: clientes.length });
}
