import { db } from "@/lib/db";

export async function enviarPushNotificacao(opts: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  const pubKey = process.env.VAPID_PUBLIC_KEY;
  const privKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_CONTACT_EMAIL ?? "mailto:ederson@crm.app";

  if (!pubKey || !privKey) return;

  const config = await db.configuracao.findUnique({ where: { chave: "push_subscription" } });
  if (!config?.valor) return;

  try {
    const webpush = await import("web-push");
    webpush.setVapidDetails(email, pubKey, privKey);
    const sub = JSON.parse(config.valor);
    await webpush.sendNotification(sub, JSON.stringify(opts));
  } catch {
    // Push failure is non-critical
  }
}
