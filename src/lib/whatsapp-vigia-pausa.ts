// Pausa curta do vigia da conexão. Fica em módulo próprio porque quem pausa
// é o gerador de QR (lib/zapi.ts) e quem obedece é o vigia — juntar os dois
// num arquivo só criaria importação circular.
//
// Enquanto o vendedor está na tela do QR, o vigia não pode reiniciar nem
// reconectar a instância: cada tentativa invalida o código que ele está
// escaneando naquele instante.

import { getConfig, setConfig } from "@/lib/config";

export const CHAVE_PAUSA_VIGIA = "whatsapp.vigia.pausaAte";

export async function pausarVigia(minutos = 3): Promise<void> {
  await setConfig(CHAVE_PAUSA_VIGIA, new Date(Date.now() + minutos * 60_000).toISOString());
}

export async function vigiaPausado(agora = new Date()): Promise<boolean> {
  const raw = await getConfig(CHAVE_PAUSA_VIGIA).catch(() => null);
  if (!raw) return false;
  const ate = new Date(raw);
  return !isNaN(ate.getTime()) && ate.getTime() > agora.getTime();
}

// A tela do QR consulta de 20 em 20 segundos. Quando a Evolution não devolve
// a imagem, o CRM reinicia a instância para forçar um pareamento novo — mas
// no máximo uma vez por minuto, senão o polling vira um loop de restarts e o
// QR nunca chega a existir tempo suficiente para ser escaneado.
const CHAVE_ULTIMO_RESTART_QR = "whatsapp.qr.ultimoRestart";

export async function podeForcarNovoQr(agora = new Date(), esperaSegundos = 60): Promise<boolean> {
  const raw = await getConfig(CHAVE_ULTIMO_RESTART_QR).catch(() => null);
  if (!raw) return true;
  const ultimo = new Date(raw);
  if (isNaN(ultimo.getTime())) return true;
  return agora.getTime() - ultimo.getTime() > esperaSegundos * 1000;
}

export async function marcarForcaNovoQr(agora = new Date()): Promise<void> {
  await setConfig(CHAVE_ULTIMO_RESTART_QR, agora.toISOString());
}
