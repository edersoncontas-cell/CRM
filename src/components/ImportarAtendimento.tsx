"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, Loader2 } from "lucide-react";

// Importa as conversas recentes do WhatsApp para o Atendimento, em lotes (loop).
export function ImportarAtendimento() {
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function importar() {
    if (!confirm("Importar suas conversas recentes do WhatsApp para o Atendimento? Pode levar 1-2 minutos.")) return;
    setRodando(true);
    setMsg("Importando…");
    let page = 1, chats = 0, msgs = 0, more = true, guard = 0;
    while (more && guard < 40) {
      guard++;
      const r = await fetch("/api/whatsapp/import-history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, pageSize: 5, messagesPerChat: 150 }),
      }).then((res) => res.json()).catch(() => null);
      if (!r?.ok) { setMsg("Falha (Z-API sem chats ou desconectada)."); setRodando(false); return; }
      chats += r.chatsProcessed; msgs += r.messagesImported; more = r.hasMore; page = r.nextPage;
      setMsg(more ? `Importando… ${chats} conversas, ${msgs} msgs` : `✅ ${chats} conversas, ${msgs} mensagens`);
    }
    setRodando(false);
    router.refresh();
  }

  return (
    <button
      onClick={importar}
      disabled={rodando}
      className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
    >
      {rodando ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
      {msg ?? "Importar conversas do WhatsApp"}
    </button>
  );
}
