import type { Metadata } from "next";
import { ModoSemSinal } from "@/components/sem-sinal/ModoSemSinal";

// Fora do grupo (app) de propósito: aquele layout consulta o banco antes de
// qualquer coisa, e esta tela tem de abrir SEM servidor nenhum — ela vem do
// cache do aparelho (src/app/sw.js/route.ts) e lê só o que está guardado lá.
// Continua exigindo login como as demais (middleware).
export const metadata: Metadata = { title: "Modo sem sinal — CRM" };

export default function SemSinalPage() {
  return <ModoSemSinal />;
}
